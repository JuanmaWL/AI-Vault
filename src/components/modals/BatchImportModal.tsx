import { useState, useRef, useMemo } from 'react';
import { VideoRecord, VideoSource, UserProfile } from '../../types';
import { parseVideoUrlInfo, ParsedVideoUrlInfo, processVideoMetadataFromUrl, SOFTWARE_ICONS } from '../../lib/utils';
import { X, Check, FileVideo, AlertCircle, Loader2, Sparkles, Folder, Upload, FileText, Terminal, Layers, Copy } from 'lucide-react';
import { CategorySelector } from '../layout/CategorySelector';

interface BatchImportModalProps {
  onClose: () => void;
  onSaveBatch: (videos: VideoRecord[]) => Promise<void>;
  userEmail?: string;
  userDisplayName?: string;
  userUid?: string;
  userProfile?: UserProfile | null;
  availableCategories?: string[];
  onAddCategory?: (category: string) => void;
}

type CategoryStrategy = 'auto' | 'fixed' | 'none';

export function BatchImportModal({ 
  onClose, 
  onSaveBatch, 
  userEmail,
  userDisplayName,
  userUid,
  userProfile,
  availableCategories = [],
  onAddCategory,
}: BatchImportModalProps) {
  const [urlsInput, setUrlsInput] = useState('');
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importSource, setImportSource] = useState<VideoSource>('local');
  const [categoryStrategy, setCategoryStrategy] = useState<CategoryStrategy>('auto');
  const [fixedCategory, setFixedCategory] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'error' | 'warning'; msg: string }[]>([]);
  const [softwareCounts, setSoftwareCounts] = useState<{ wan2gp: number; maestro: number; comfyui: number; other: number }>({
    wan2gp: 0,
    maestro: 0,
    comfyui: 0,
    other: 0,
  });
  
  const isProcessingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleFile = (file: File) => {
    setFileWarning(null);

    const isTxt = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
    if (!isTxt) {
      setFileWarning(`El archivo "${file.name}" no es un archivo .txt válido.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      setUrlsInput(content);

      const hasHttp = content.split('\n').some(line => line.trim().startsWith('http'));
      if (!hasHttp) {
        setFileWarning('El archivo no contiene ninguna línea que empiece por "http".');
      }
    };
    reader.onerror = () => {
      setFileWarning('Error al leer el archivo seleccionado.');
    };
    reader.readAsText(file);
  };

  const addLog = (type: 'info' | 'success' | 'error' | 'warning', msg: string) => {
    setLogs(prev => [...prev, { type, msg }]);
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Real-time analysis of pasted URLs
  const urlAnalysis = useMemo(() => {
    const lines = urlsInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http'));

    const categoryCounts = new Map<string, number>();
    let huggingFaceCount = 0;

    const parsedList: { url: string; info: ParsedVideoUrlInfo }[] = [];

    lines.forEach(url => {
      const info = parseVideoUrlInfo(url);
      parsedList.push({ url, info });

      if (info.isHuggingFace) {
        huggingFaceCount++;
      }

      if (info.suggestedGroupName) {
        categoryCounts.set(
          info.suggestedGroupName,
          (categoryCounts.get(info.suggestedGroupName) || 0) + 1
        );
      }
    });

    return {
      totalUrls: lines.length,
      huggingFaceCount,
      categoryCounts: Array.from(categoryCounts.entries()),
      parsedList,
    };
  }, [urlsInput]);

  const [copiedLogs, setCopiedLogs] = useState(false);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    const text = logs.map(l => `[${l.type.toUpperCase()}] ${l.msg}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleProcess = async () => {
    if (isProcessingRef.current || isProcessing || isCompleted) return;
    
    const lines = urlsInput.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
    if (lines.length === 0) {
      addLog('error', 'No se encontraron URLs válidas que empiecen por http/https.');
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setProgress({ current: 0, total: lines.length });
    setLogs([]);
    setSoftwareCounts({ wan2gp: 0, maestro: 0, comfyui: 0, other: 0 });
    const results: VideoRecord[] = [];
    const counts = { wan2gp: 0, maestro: 0, comfyui: 0, other: 0 };

    try {
      for (let i = 0; i < lines.length; i++) {
        const url = lines[i];
        const urlInfo = parseVideoUrlInfo(url);

        setProgress({ current: i + 1, total: lines.length });
        addLog('info', `Procesando (${i + 1}/${lines.length}): ${urlInfo.fileName || url}`);

        try {
          const record = await processVideoMetadataFromUrl({
            url,
            source: importSource,
            customCategory: categoryStrategy === 'fixed' 
              ? fixedCategory 
              : (categoryStrategy === 'none' ? '' : undefined),
            userEmail,
            userDisplayName,
            userUid,
            userProfile,
            onAddCategory,
          });

          results.push(record);
          
          const sSource = record.softwareSource || 'wan2gp';
          if (sSource === 'maestro') counts.maestro++;
          else if (sSource === 'comfyui') counts.comfyui++;
          else if (sSource === 'other') counts.other++;
          else counts.wan2gp++;
          setSoftwareCounts({ ...counts });

          const toolLabel = sSource === 'maestro' ? '[Maestro]' : sSource === 'comfyui' ? '[ComfyUI]' : '[Wan2GP]';
          addLog('success', `✓ ${record.model} (${record.width}x${record.height}) ${toolLabel} ${record.groupName ? `· [${record.groupName}]` : ''}`);

        } catch (e: any) {
          console.error(`[Batch Import] Error procesando URL #${i + 1}:`, url, e);
          addLog('error', `Error en ${urlInfo.fileName || url}: ${e.message || e}`);
        }
      }

      if (results.length > 0) {
        addLog('info', `Guardando ${results.length} vídeos en la base de datos...`);
        try {
          await onSaveBatch(results);
          setIsCompleted(true);
          
          const summaryParts = [];
          if (counts.maestro > 0) summaryParts.push(`${counts.maestro} Maestro`);
          if (counts.wan2gp > 0) summaryParts.push(`${counts.wan2gp} Wan2GP`);
          if (counts.comfyui > 0) summaryParts.push(`${counts.comfyui} ComfyUI`);
          if (counts.other > 0) summaryParts.push(`${counts.other} otros`);
          const breakdownText = summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : '';

          addLog('success', `¡Proceso completado! Se han guardado ${results.length} vídeos${breakdownText} con éxito.`);
          setTimeout(() => {
            onClose();
          }, 2000);
        } catch (saveErr: any) {
          console.error("[Batch Import] ❌ Error crítico al persistir en base de datos:", saveErr);
          addLog('error', `❌ ERROR AL GUARDAR EN BASE DE DATOS: ${saveErr.message || saveErr}`);
          addLog('warning', `⚠️ No se han cerrado los registros. Comprueba tu conexión, sesión o permisos en Firebase.`);
          setIsProcessing(false);
          isProcessingRef.current = false;
          return;
        }
      } else {
        addLog('error', 'No se ha podido procesar ningún vídeo.');
        setIsProcessing(false);
        isProcessingRef.current = false;
      }

    } catch (e: any) {
      console.error("[Batch Import] Fallo general del proceso:", e);
      addLog('error', `Fallo general del proceso: ${e.message || e}`);
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Importación por Lote
              </h2>
              <p className="text-xs text-neutral-400">
                Pega URLs o carga un archivo .txt para extraer y registrar metadatos de vídeo automáticamente.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer disabled:opacity-40" 
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-full items-stretch">
            
            {/* LEFT COLUMN: Input & Upload */}
            <div className="flex flex-col gap-3 min-h-0">
              
              {/* Drop & File Upload Strip */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isProcessing) setIsDragging(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isProcessing) setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  if (isProcessing) return;
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                className={`border border-dashed rounded-xl px-3 py-2 text-center transition-all flex items-center justify-between gap-2 ${
                  isDragging
                    ? 'border-teal-400 bg-teal-950/40 text-teal-300'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 text-neutral-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                  disabled={isProcessing}
                />
                
                <div className="flex items-center gap-2 text-xs">
                  <Upload className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="text-[11px] truncate">Arrastra o selecciona un archivo .txt</span>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-teal-300 border border-neutral-700 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-3 h-3" />
                  Cargar .txt
                </button>
              </div>

              {/* File warning banner */}
              {fileWarning && (
                <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px]">{fileWarning}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFileWarning(null)}
                    className="text-amber-400 hover:text-amber-200 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* URLs Textarea Container */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-1.5 shrink-0">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    URLs de los vídeos
                  </label>
                  {urlAnalysis.totalUrls > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800">
                      {urlAnalysis.totalUrls} {urlAnalysis.totalUrls === 1 ? 'vídeo' : 'vídeos'}
                    </span>
                  )}
                </div>
                <textarea
                  value={urlsInput}
                  onChange={(e) => {
                    setUrlsInput(e.target.value);
                    if (fileWarning) setFileWarning(null);
                  }}
                  disabled={isProcessing}
                  placeholder="Pega aquí las URLs de los vídeos (una por línea):&#10;https://huggingface.co/datasets/.../Categoria/video1.mp4&#10;https://.../video2.mp4"
                  className="w-full flex-1 bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-neutral-600 font-mono resize-none custom-scrollbar min-h-[220px]"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: Configuration & Live Monitor / Console */}
            <div className="flex flex-col gap-3 min-h-0">
              
              {/* Config Options */}
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 space-y-3 shrink-0">
                {/* Source & Strategy */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Origen
                    </label>
                    <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setImportSource('local')}
                        disabled={isProcessing}
                        className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${
                          importSource === 'local' 
                            ? 'bg-neutral-800 text-teal-300 shadow-sm border border-neutral-700' 
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        Local
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportSource('cloud')}
                        disabled={isProcessing}
                        className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${
                          importSource === 'cloud' 
                            ? 'bg-neutral-800 text-teal-300 shadow-sm border border-neutral-700' 
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        Cloud
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Categoría
                    </label>
                    <div className="flex bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setCategoryStrategy('auto')}
                        disabled={isProcessing}
                        className={`flex-1 py-1 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                          categoryStrategy === 'auto'
                            ? 'bg-teal-950 text-teal-300 border border-teal-700 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="Extrae la carpeta de la ruta URL"
                      >
                        <Sparkles className="w-3 h-3 text-teal-400" />
                        Auto
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryStrategy('fixed')}
                        disabled={isProcessing}
                        className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${
                          categoryStrategy === 'fixed'
                            ? 'bg-neutral-800 text-teal-300 shadow-sm border border-neutral-700'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        Fija
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryStrategy('none')}
                        disabled={isProcessing}
                        className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                          categoryStrategy === 'none'
                            ? 'bg-neutral-800 text-neutral-300 shadow-sm border border-neutral-700'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        Off
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fixed category selector */}
                {categoryStrategy === 'fixed' && (
                  <div className="pt-1 animate-in fade-in duration-150">
                    <CategorySelector
                      value={fixedCategory}
                      onChange={setFixedCategory}
                      categories={availableCategories}
                      onCreateCategory={onAddCategory}
                      disabled={isProcessing}
                      placeholder="Seleccionar o crear categoría..."
                    />
                  </div>
                )}
              </div>

              {/* Dynamic State: Pre-detection Summary OR Live Terminal Logs */}
              {!isProcessing && logs.length === 0 ? (
                /* PRE-IMPORT DETECTION SUMMARY */
                <div className="flex-1 bg-neutral-950/80 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between min-h-0">
                  <div className="space-y-3 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
                      <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-teal-400" />
                        Resumen detectado
                      </span>
                      {urlAnalysis.huggingFaceCount > 0 && (
                        <span className="text-[10px] text-amber-400 font-medium px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                          {urlAnalysis.huggingFaceCount} de Hugging Face
                        </span>
                      )}
                    </div>

                    {categoryStrategy === 'auto' && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-neutral-400 font-medium flex items-center gap-1">
                          <Folder className="w-3.5 h-3.5 text-teal-400" /> Categorías detectadas:
                        </span>
                        {urlAnalysis.categoryCounts.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pt-0.5">
                            {urlAnalysis.categoryCounts.map(([cat, count]) => (
                              <span 
                                key={cat}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-teal-300 text-xs"
                              >
                                <span className="font-medium truncate max-w-[130px]">{cat}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                                  {count}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-500 italic">
                            {urlAnalysis.totalUrls === 0 
                              ? 'Pega URLs en el panel izquierdo para previsualizar las categorías.' 
                              : 'Sin carpetas en las URLs. Se guardarán sin categoría.'}
                          </p>
                        )}
                      </div>
                    )}

                    {categoryStrategy === 'fixed' && (
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Todos los vídeos ({urlAnalysis.totalUrls}) se asignarán a la categoría <strong className="text-teal-300 font-semibold">{fixedCategory || '(Sin asignar)'}</strong>.
                      </p>
                    )}

                    {categoryStrategy === 'none' && (
                      <p className="text-xs text-neutral-500 italic">
                        Los vídeos se importarán sin asignación de categoría.
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-neutral-850 text-[11px] text-neutral-500 flex items-center justify-between shrink-0">
                    <span>Listo para procesar metadatos</span>
                    <span className="font-mono text-neutral-400">{urlAnalysis.totalUrls} pendientes</span>
                  </div>
                </div>
              ) : (
                /* LIVE IMPORT PROGRESS & TERMINAL LOGS */
                <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col gap-2 min-h-0">
                  {/* Progress Header */}
                  <div className="space-y-1.5 shrink-0">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-teal-300 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-teal-400" />
                        {isCompleted ? 'Completado' : isProcessing ? 'Procesando metadatos...' : 'Registro de importación'}
                      </span>
                      <div className="flex items-center gap-2">
                        {logs.length > 0 && (
                          <button
                            type="button"
                            onClick={handleCopyLogs}
                            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-teal-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-2 py-0.5 rounded transition-colors cursor-pointer"
                            title="Copiar registro de logs al portapapeles"
                          >
                            {copiedLogs ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedLogs ? '¡Copiado!' : 'Copiar logs'}</span>
                          </button>
                        )}
                        <span className="font-mono text-neutral-400 text-xs">
                          {progress.current} / {progress.total}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-800">
                      <div 
                        className="bg-teal-500 h-full transition-all duration-200"
                        style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                      />
                    </div>

                    {/* Live software breakdown badges */}
                    {(softwareCounts.maestro > 0 || softwareCounts.wan2gp > 0 || softwareCounts.comfyui > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 animate-in fade-in">
                        <span className="text-[10px] uppercase font-semibold text-neutral-400">Detectados:</span>
                        {softwareCounts.maestro > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <img src={SOFTWARE_ICONS.maestro} alt="Maestro" className="w-2.5 h-2.5 object-contain" referrerPolicy="no-referrer" />
                            <span>{softwareCounts.maestro} Maestro</span>
                          </span>
                        )}
                        {softwareCounts.wan2gp > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                            <img src={SOFTWARE_ICONS.wan2gp} alt="Wan2GP" className="w-2.5 h-2.5 object-contain" referrerPolicy="no-referrer" />
                            <span>{softwareCounts.wan2gp} Wan2GP</span>
                          </span>
                        )}
                        {softwareCounts.comfyui > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {softwareCounts.comfyui} ComfyUI
                          </span>
                        )}
                        {softwareCounts.other > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {softwareCounts.other} Otros
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                    {/* Terminal console */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[11px] flex flex-col gap-1 p-2 bg-neutral-900/60 rounded-lg border border-neutral-850">
                    {logs.map((log, i) => (
                      <div key={i} className={`flex items-start gap-1.5 leading-relaxed ${
                        log.type === 'error' 
                          ? 'text-rose-400 font-semibold' 
                          : log.type === 'warning'
                          ? 'text-amber-300'
                          : log.type === 'success' 
                          ? 'text-teal-300' 
                          : 'text-neutral-400'
                      }`}>
                        {log.type === 'error' && <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-rose-400" />}
                        {log.type === 'warning' && <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />}
                        {log.type === 'success' && <Check className="w-3 h-3 shrink-0 mt-0.5 text-teal-400" />}
                        {log.type === 'info' && <span className="w-3 h-3 shrink-0 mt-0.5 opacity-40">→</span>}
                        <span className="break-all">{log.msg}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-neutral-400">
            {isProcessing && `Importando (${progress.current}/${progress.total})...`}
            {isCompleted && <span className="text-teal-400 font-medium">✓ Proceso finalizado con éxito</span>}
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing || isCompleted}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-40 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={isProcessing || isCompleted || urlAnalysis.totalUrls === 0}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-neutral-950 px-5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {isProcessing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Procesando...</>
              ) : isCompleted ? (
                <><Check className="w-3.5 h-3.5 text-neutral-950" /> Finalizado</>
              ) : (
                <><Check className="w-3.5 h-3.5" /> Iniciar Importación {urlAnalysis.totalUrls > 0 ? `(${urlAnalysis.totalUrls})` : ''}</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
