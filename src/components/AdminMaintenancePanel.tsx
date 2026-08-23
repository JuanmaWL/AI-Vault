import { useState, useRef, useEffect, useMemo } from 'react';
import { VideoRecord } from '../types';
import { parseWanGpMetadata, generateTitleFromPrompt } from '../lib/utils';
import { doc, updateDoc, Firestore } from 'firebase/firestore';
import { 
  Wrench, 
  X, 
  Play, 
  Square, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  Layers, 
  Sparkles, 
  Info,
  Check,
  RefreshCw
} from 'lucide-react';
import wasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';

// Dynamically import mediainfo.js for analyzing embedded MP4 comment metadata
let mediainfoPromise: Promise<any> | null = null;
const loadMediaInfo = () => {
  if (!mediainfoPromise) {
    mediainfoPromise = import('mediainfo.js');
  }
  return mediainfoPromise;
};

interface AdminMaintenancePanelProps {
  isAdmin: boolean;
  videos: VideoRecord[];
  db: Firestore | null;
  usingLocal: boolean;
  onUpdateLocalRecord?: (updatedRecord: VideoRecord) => void;
  onClose: () => void;
}

interface LogItem {
  id: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export function AdminMaintenancePanel({
  isAdmin,
  videos,
  db,
  usingLocal,
  onUpdateLocalRecord,
  onClose
}: AdminMaintenancePanelProps) {
  // Strict security check: do not render anything if not admin
  if (!isAdmin) {
    return null;
  }

  // Focus trap & body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // --- Task 1: Re-analyze metadata state ---
  const [isRunningReanalysis, setIsRunningReanalysis] = useState(false);
  const cancelReanalysisRef = useRef(false);
  const [reanalysisProgress, setReanalysisProgress] = useState({ current: 0, total: 0 });
  const [reanalysisStats, setReanalysisStats] = useState<{ updated: number; unchanged: number; errors: number } | null>(null);
  const [reanalysisLogs, setReanalysisLogs] = useState<LogItem[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Candidates for metadata re-analysis: videos that lack modelSizeB
  const pendingVideos = useMemo(() => {
    return videos.filter(v => typeof v.modelSizeB !== 'number');
  }, [videos]);

  // Candidates for cleaning redundant size tags: videos with modelSizeB and redundant tags (e.g., "20B", "33B", "pruned", /^\d+B$/i)
  const isRedundantTag = (tag: string): boolean => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed === 'pruned') return true;
    if (/^\d+\s*b$/i.test(trimmed)) return true;
    return false;
  };

  const tagCleanCandidates = useMemo(() => {
    return videos.filter(v => {
      if (typeof v.modelSizeB !== 'number') return false;
      if (!v.tags || !Array.isArray(v.tags) || v.tags.length === 0) return false;
      return v.tags.some(t => isRedundantTag(t));
    });
  }, [videos]);

  // --- Task 2: Clean redundant tags state ---
  const [isCleaningTags, setIsCleaningTags] = useState(false);
  const [showTagConfirm, setShowTagConfirm] = useState(false);
  const [tagCleanStats, setTagCleanStats] = useState<{ updated: number; errors: number } | null>(null);

  const addLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
    const time = new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date());

    setReanalysisLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        type,
        message,
        timestamp: time
      }
    ]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [reanalysisLogs]);

  // Re-analyze runner
  const handleStartReanalysis = async () => {
    if (pendingVideos.length === 0 || isRunningReanalysis) return;

    cancelReanalysisRef.current = false;
    setIsRunningReanalysis(true);
    setReanalysisLogs([]);
    setReanalysisStats(null);
    setReanalysisProgress({ current: 0, total: pendingVideos.length });

    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    addLog('info', `Iniciando re-análisis secuencial de ${pendingVideos.length} vídeos pendientes...`);

    const mediainfoModule = await loadMediaInfo();

    for (let i = 0; i < pendingVideos.length; i++) {
      if (cancelReanalysisRef.current) {
        addLog('warn', `Proceso detenido por el administrador en el vídeo ${i} de ${pendingVideos.length}.`);
        break;
      }

      const video = pendingVideos[i];
      setReanalysisProgress({ current: i + 1, total: pendingVideos.length });

      const videoIdentifier = video.prompt?.substring(0, 35) || video.model || video.id || `Vídeo #${i + 1}`;

      try {
        if (!video.videoUrl) {
          throw new Error('Sin URL de vídeo');
        }

        addLog('info', `[${i + 1}/${pendingVideos.length}] Descargando: "${videoIdentifier}..."`);

        const response = await fetch(video.videoUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} (${response.statusText || 'Error de red'})`);
        }

        const blob = await response.blob();

        const getSize = () => blob.size;
        const readChunk = (chunkSize: number, offset: number) =>
          new Promise<Uint8Array>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.error) {
                reject(e.target.error);
              } else if (e.target?.result) {
                resolve(new Uint8Array(e.target.result as ArrayBuffer));
              } else {
                reject(new Error("Empty chunk"));
              }
            };
            reader.readAsArrayBuffer(blob.slice(offset, offset + chunkSize));
          });

        const mi = await mediainfoModule.default({
          format: 'object',
          locateFile: () => wasmUrl
        });

        const result = await mi.analyzeData(getSize, readChunk);
        const generalTrack = result.media?.track?.find((t: any) => t['@type'] === 'General') as any;
        const videoTrack = result.media?.track?.find((t: any) => t['@type'] === 'Video') as any;
        const commentRaw = generalTrack?.extra?.Comment || generalTrack?.Comment || videoTrack?.extra?.Comment || videoTrack?.Comment;

        if (!commentRaw) {
          addLog('warn', `[${i + 1}/${pendingVideos.length}] Sin metadatos WanGP embebidos: "${videoIdentifier}"`);
          unchangedCount++;
          continue;
        }

        const metadata = parseWanGpMetadata(
          commentRaw,
          generalTrack?.Duration ? parseFloat(generalTrack.Duration) : undefined,
          24
        );

        if (!metadata) {
          addLog('warn', `[${i + 1}/${pendingVideos.length}] No se pudo interpretar JSON de metadatos: "${videoIdentifier}"`);
          unchangedCount++;
          continue;
        }

        // Build selective update fields only for missing structured properties
        const updateFields: Record<string, any> = {};
        const changesSummary: string[] = [];

        if (typeof metadata.modelSizeB === 'number' && typeof video.modelSizeB !== 'number') {
          updateFields.modelSizeB = metadata.modelSizeB;
          changesSummary.push(`modelSizeB: ${metadata.modelSizeB}B`);
        }

        if (metadata.modelVariant && !video.modelVariant) {
          updateFields.modelVariant = metadata.modelVariant;
          changesSummary.push(`modelVariant: ${metadata.modelVariant}`);
        }

        if (!video.title && metadata.prompt) {
          const autoTitle = generateTitleFromPrompt(metadata.prompt);
          if (autoTitle) {
            updateFields.title = autoTitle;
            changesSummary.push(`title: "${autoTitle}"`);
          }
        }

        if (metadata.videoVae && (!video.videoVae || video.videoVae === 'Not Found') && metadata.videoVae !== 'Not Found') {
          updateFields.videoVae = metadata.videoVae;
          changesSummary.push(`videoVae: ${metadata.videoVae}`);
        }

        if (metadata.textEncoder && (!video.textEncoder || video.textEncoder === 'Not Found') && metadata.textEncoder !== 'Not Found') {
          updateFields.textEncoder = metadata.textEncoder;
          changesSummary.push(`textEncoder: ${metadata.textEncoder}`);
        }

        if (metadata.precision && !video.precision) {
          updateFields.precision = metadata.precision;
          changesSummary.push(`precision: ${metadata.precision}`);
        }

        if (!video.rawMetadata && metadata.rawComment) {
          updateFields.rawMetadata = metadata.rawComment;
        }

        if (Object.keys(updateFields).length > 0) {
          // Persist to Firestore if live db, otherwise local
          if (db && !usingLocal && video.id && !video.id.startsWith('local_') && !video.id.startsWith('mock')) {
            const videoDocRef = doc(db, 'videos', video.id);
            await updateDoc(videoDocRef, updateFields);
          }

          if (onUpdateLocalRecord && video.id) {
            onUpdateLocalRecord({
              ...video,
              ...updateFields
            });
          }

          updatedCount++;
          addLog('success', `[${i + 1}/${pendingVideos.length}] Actualizado: "${videoIdentifier}" (${changesSummary.join(', ')})`);
        } else {
          unchangedCount++;
          addLog('info', `[${i + 1}/${pendingVideos.length}] Sin cambios nuevos detectados: "${videoIdentifier}"`);
        }

      } catch (err: any) {
        errorCount++;
        addLog('error', `[${i + 1}/${pendingVideos.length}] Error procesando "${videoIdentifier}": ${err?.message || 'No accesible'}`);
      }
    }

    setIsRunningReanalysis(false);
    setReanalysisStats({
      updated: updatedCount,
      unchanged: unchangedCount,
      errors: errorCount
    });
    addLog('info', `Re-análisis finalizado. ${updatedCount} actualizados, ${unchangedCount} sin cambios, ${errorCount} errores.`);
  };

  const handleStopReanalysis = () => {
    cancelReanalysisRef.current = true;
    addLog('warn', 'Detención solicitada. Finalizando el vídeo actual...');
  };

  // Clean redundant tags runner
  const handleCleanRedundantTags = async () => {
    if (tagCleanCandidates.length === 0 || isCleaningTags) return;

    setIsCleaningTags(true);
    setShowTagConfirm(false);
    let updated = 0;
    let errors = 0;

    for (const video of tagCleanCandidates) {
      try {
        const cleanedTags = (video.tags || []).filter(t => !isRedundantTag(t));
        
        if (db && !usingLocal && video.id && !video.id.startsWith('local_') && !video.id.startsWith('mock')) {
          const videoDocRef = doc(db, 'videos', video.id);
          await updateDoc(videoDocRef, { tags: cleanedTags });
        }

        if (onUpdateLocalRecord && video.id) {
          onUpdateLocalRecord({
            ...video,
            tags: cleanedTags
          });
        }
        updated++;
      } catch (err) {
        console.error('Error cleaning tags for video', video.id, err);
        errors++;
      }
    }

    setIsCleaningTags(false);
    setTagCleanStats({ updated, errors });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Panel de Mantenimiento y Administración
              </h2>
              <p className="text-xs text-neutral-400">
                Herramientas avanzadas de re-análisis de metadatos y saneamiento de catálogo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunningReanalysis || isCleaningTags}
            className="text-neutral-500 hover:text-neutral-300 transition-colors p-1.5 rounded-lg hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-neutral-300">
          
          {/* SECTION 1: Re-análisis de metadatos */}
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-teal-400" />
                  Re-análisis Secuencial de Metadatos
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Descarga secuencialmente cada vídeo para extraer de forma estructurada su tamaño de modelo (<code className="text-teal-300 bg-neutral-900 px-1.5 py-0.5 rounded font-mono">modelSizeB</code>) y encoders/VAEs usando <code className="text-teal-300 bg-neutral-900 px-1.5 py-0.5 rounded font-mono">parseWanGpMetadata</code>.
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 flex items-center gap-2">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  pendingVideos.length > 0
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                }`}>
                  {pendingVideos.length > 0
                    ? `${pendingVideos.length} pendientes`
                    : 'Catálogo al 100%'}
                </span>
              </div>
            </div>

            {/* Candidate summary block */}
            <div className="flex items-center justify-between bg-neutral-900/90 border border-neutral-800 rounded-xl p-3.5 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-neutral-400" />
                <span>Vídeos sin tamaño estructurado (<code className="text-neutral-300 font-mono">modelSizeB</code>):</span>
              </div>
              <span className="font-mono font-bold text-sm text-white">
                {pendingVideos.length} / {videos.length}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-1">
              {!isRunningReanalysis ? (
                <button
                  onClick={handleStartReanalysis}
                  disabled={pendingVideos.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 transition-all shadow-md shadow-teal-950/40 disabled:cursor-not-allowed"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Re-analizar {pendingVideos.length} vídeos pendientes</span>
                </button>
              ) : (
                <button
                  onClick={handleStopReanalysis}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-950/40"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Detener proceso ({reanalysisProgress.current}/{reanalysisProgress.total})</span>
                </button>
              )}
            </div>

            {/* Progress bar */}
            {isRunningReanalysis && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                    Procesando vídeo {reanalysisProgress.current} de {reanalysisProgress.total}...
                  </span>
                  <span className="font-mono font-bold text-teal-300">
                    {Math.round((reanalysisProgress.current / (reanalysisProgress.total || 1)) * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-teal-500 transition-all duration-300"
                    style={{
                      width: `${(reanalysisProgress.current / (reanalysisProgress.total || 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* Final Stats Summary */}
            {reanalysisStats && (
              <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/60 text-xs flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-bold text-teal-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resumen de re-análisis:</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-neutral-300 font-mono mt-1">
                  <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                    <span className="text-teal-400 font-bold">{reanalysisStats.updated}</span> actualizados
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                    <span className="text-neutral-400 font-bold">{reanalysisStats.unchanged}</span> sin cambios
                  </div>
                  <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
                    <span className="text-rose-400 font-bold">{reanalysisStats.errors}</span> con error
                  </div>
                </div>
              </div>
            )}

            {/* Live Log Console */}
            {reanalysisLogs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Registro de actividad en tiempo real:
                </span>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1.5">
                  {reanalysisLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-neutral-600 shrink-0">{log.timestamp}</span>
                      {log.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />}
                      {log.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                      {log.type === 'warn' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                      {log.type === 'info' && <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />}
                      <span className={
                        log.type === 'success' ? 'text-teal-300' :
                        log.type === 'error' ? 'text-rose-300' :
                        log.type === 'warn' ? 'text-amber-300' : 'text-neutral-300'
                      }>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Limpieza de tags redundantes */}
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-amber-400" />
                  Limpiar Tags Redundantes de Tamaño
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  Elimina etiquetas como <code className="text-amber-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">"20B"</code>, <code className="text-amber-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">"33B"</code> o <code className="text-amber-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">"pruned"</code> del array de tags de aquellos vídeos que ya poseen <code className="text-teal-300 bg-neutral-900 px-1 py-0.5 rounded font-mono">modelSizeB</code> estructurado.
                </p>
              </div>

              <span className={`text-xs font-semibold px-3 py-1 rounded-full border shrink-0 ${
                tagCleanCandidates.length > 0
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {tagCleanCandidates.length} con tags redundantes
              </span>
            </div>

            {/* Action button & Confirmation Modal/Panel */}
            {!showTagConfirm ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowTagConfirm(true)}
                  disabled={tagCleanCandidates.length === 0 || isCleaningTags || isRunningReanalysis}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 text-neutral-200 border border-neutral-700 transition-all disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Limpiar tags redundantes ({tagCleanCandidates.length} vídeos)</span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-2 text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>¿Confirmar limpieza masiva?</strong> Se actualizarán los tags de <strong>{tagCleanCandidates.length} vídeos</strong> eliminando exclusivamente las etiquetas de tamaño redundantes (el resto de tags se mantendrán intactos).
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleCleanRedundantTags}
                    disabled={isCleaningTags}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-all"
                  >
                    {isCleaningTags ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Confirmar y Aplicar</span>
                  </button>
                  <button
                    onClick={() => setShowTagConfirm(false)}
                    disabled={isCleaningTags}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {tagCleanStats && (
              <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-800/60 text-xs text-teal-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Limpieza completada con éxito: <strong>{tagCleanStats.updated} vídeos</strong> actualizados ({tagCleanStats.errors} errores).</span>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/70 flex justify-end shrink-0">
          <button
            onClick={onClose}
            disabled={isRunningReanalysis || isCleaningTags}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
