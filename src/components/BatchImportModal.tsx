import { useState, useRef, useMemo } from 'react';
import { VideoRecord, Lora, VideoSource } from '../types';
import { extractDriveFileId, calculateOrientation, extractTechnicalDetails, parseWanGpMetadata, parseVideoUrlInfo, ParsedVideoUrlInfo } from '../lib/utils';
import { X, Check, FileVideo, AlertCircle, Loader2, Sparkles, Folder, Wand2, ArrowRight, Layers, User, Upload, FileText } from 'lucide-react';
import { CategorySelector } from './CategorySelector';
import wasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';

interface BatchImportModalProps {
  onClose: () => void;
  onSaveBatch: (videos: VideoRecord[]) => Promise<void>;
  userEmail?: string;
  userDisplayName?: string;
  userUid?: string;
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
  const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'error'; msg: string }[]>([]);
  
  const isProcessingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileWarning(null);

    // Check if file is .txt
    const isTxt = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
    if (!isTxt) {
      setFileWarning(`El archivo "${file.name}" no es un archivo .txt.`);
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

  const addLog = (type: 'info' | 'success' | 'error', msg: string) => {
    setLogs(prev => [...prev, { type, msg }]);
  };

  // Real-time analysis of pasted URLs
  const urlAnalysis = useMemo(() => {
    const lines = urlsInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http'));

    const categoryCounts = new Map<string, number>();
    const authorCounts = new Map<string, number>();
    const repoCounts = new Map<string, number>();
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

      if (info.username) {
        authorCounts.set(info.username, (authorCounts.get(info.username) || 0) + 1);
      }

      if (info.repoName) {
        repoCounts.set(info.repoName, (repoCounts.get(info.repoName) || 0) + 1);
      }
    });

    return {
      totalUrls: lines.length,
      huggingFaceCount,
      categoryCounts: Array.from(categoryCounts.entries()),
      authorCounts: Array.from(authorCounts.entries()),
      repoCounts: Array.from(repoCounts.entries()),
      parsedList,
    };
  }, [urlsInput]);

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
    const results: VideoRecord[] = [];

    try {
      const mediainfo = await import('mediainfo.js');

      for (let i = 0; i < lines.length; i++) {
        const url = lines[i];
        const urlInfo = parseVideoUrlInfo(url);

        // Determine final category / groupName
        let finalGroupName: string | undefined = undefined;
        if (categoryStrategy === 'auto') {
          finalGroupName = urlInfo.suggestedGroupName?.trim() || undefined;
          if (finalGroupName && onAddCategory) {
            onAddCategory(finalGroupName);
          }
        } else if (categoryStrategy === 'fixed') {
          finalGroupName = fixedCategory.trim() || undefined;
          if (finalGroupName && onAddCategory) {
            onAddCategory(finalGroupName);
          }
        }

        setProgress({ current: i + 1, total: lines.length });
        addLog('info', `Procesando (${i + 1}/${lines.length}): ${urlInfo.fileName || url}`);

        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
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

          const mi = await mediainfo.default({
            format: 'object',
            locateFile: () => wasmUrl
          });

          const result = await mi.analyzeData(getSize, readChunk);
          const generalTrack = result.media?.track?.find((t: any) => t['@type'] === 'General') as any;
          const videoTrack = result.media?.track?.find((t: any) => t['@type'] === 'Video') as any;
          const commentRaw = generalTrack?.extra?.Comment || generalTrack?.Comment || videoTrack?.extra?.Comment || videoTrack?.Comment;

          // Default video parameters
          let width = 1920;
          let height = 1080;
          let prompt = "Importado desde URL";
          let model = "Wan 2.1";
          let modelSizeB: number | undefined = undefined;
          let durationSeconds = 5;
          let steps = 30;
          let shift = "5.0";
          let seed = "";
          let tagsInput = "Wan 2.1";
          let videoVae: string = 'Not Found';
          let textEncoder: string = 'Not Found';
          let loras: Lora[] = [];
          let renderSeconds: number | undefined = undefined;
          let generatedAt: number | undefined = undefined;
          let fileSizeBytes: number | undefined = blob.size;

          if (videoTrack?.Width) width = Number(videoTrack.Width);
          if (videoTrack?.Height) height = Number(videoTrack.Height);
          if (generalTrack?.Duration) durationSeconds = parseFloat(generalTrack.Duration);

          if (commentRaw) {
            const metadata = parseWanGpMetadata(commentRaw, generalTrack?.Duration ? parseFloat(generalTrack.Duration) : undefined, 24);
            if (metadata) {
              if (metadata.prompt) prompt = metadata.prompt;
              if (metadata.seed !== undefined) seed = metadata.seed;
              if (metadata.steps !== undefined) steps = metadata.steps;
              if (metadata.shift !== undefined) shift = metadata.shift;
              if (metadata.baseModel) model = metadata.baseModel;
              if (metadata.modelSizeB !== undefined) modelSizeB = metadata.modelSizeB;
              videoVae = metadata.videoVae;
              textEncoder = metadata.textEncoder;
              if (metadata.tags && metadata.tags.length > 0) tagsInput = metadata.tags.join(', ');
              if (metadata.renderSeconds !== undefined) renderSeconds = metadata.renderSeconds;
              if (metadata.generatedAt !== undefined) generatedAt = metadata.generatedAt;
              if (metadata.loras && metadata.loras.length > 0) loras = metadata.loras;
            }
          }

          const orientation = calculateOrientation(width, height);
          const driveFileId = extractDriveFileId(url) || '';

          // Creator attribution: prefer current session identity, fallback to author extracted from URL
          const resolvedDisplayName = userDisplayName || userEmail || urlInfo.username || undefined;
          const resolvedCreatedBy = userEmail || userDisplayName || (urlInfo.username ? `@${urlInfo.username}` : undefined);

          const record: VideoRecord = {
            schemaVersion: 2,
            videoUrl: url,
            groupName: finalGroupName,
            driveFileId,
            prompt,
            model,
            modelSizeB,
            source: importSource,
            tags: tagsInput ? tagsInput.split(',').map(s => s.trim()).filter(Boolean) : [],
            width,
            height,
            orientation,
            steps,
            shift: shift ? parseFloat(shift) : undefined,
            seed: seed ? parseInt(seed) : undefined,
            fps: 24,
            durationSeconds,
            videoVae,
            textEncoder,
            loras,
            createdAt: Date.now(),
            createdBy: resolvedCreatedBy,
            creatorUid: userUid,
            creatorDisplayName: resolvedDisplayName,
            renderSeconds,
            fileSizeBytes,
            generatedAt,
            rawMetadata: commentRaw
          };

          results.push(record);
          addLog('success', `✓ ${model} (${width}x${height}) ${finalGroupName ? `· Categoría: [${finalGroupName}]` : ''}`);

        } catch (e: any) {
          addLog('error', `Error al procesar ${url}: ${e.message}`);
        }
      }

      if (results.length > 0) {
        addLog('info', `Guardando ${results.length} vídeos en la base de datos...`);
        await onSaveBatch(results);
        setIsCompleted(true);
        addLog('success', `¡Proceso completado! Se han guardado ${results.length} vídeos con éxito.`);
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        addLog('error', 'No se ha podido procesar ningún vídeo.');
        setIsProcessing(false);
        isProcessingRef.current = false;
      }

    } catch (e: any) {
      addLog('error', `Fallo general del proceso: ${e.message}`);
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
              <FileVideo className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                Importación Batch
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800">
                  Auto-categorías
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400">
                Detecta automáticamente categorías y metadatos de Hugging Face y URLs directas MP4.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer" 
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          {/* Origen & Estrategia de Categorías */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Origen */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Origen de los vídeos
              </label>
              <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setImportSource('local')}
                  disabled={isProcessing}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    importSource === 'local' 
                      ? 'bg-neutral-800 text-teal-400 shadow-sm border border-neutral-700' 
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Generación Local (PC)
                </button>
                <button
                  type="button"
                  onClick={() => setImportSource('cloud')}
                  disabled={isProcessing}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    importSource === 'cloud' 
                      ? 'bg-neutral-800 text-teal-400 shadow-sm border border-neutral-700' 
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Servicio Cloud
                </button>
              </div>
            </div>

            {/* Modo de Categorización */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                <span>Estrategia de Categoría</span>
              </label>
              <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCategoryStrategy('auto')}
                  disabled={isProcessing}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    categoryStrategy === 'auto'
                      ? 'bg-teal-950/90 text-teal-300 border border-teal-700 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title="Extrae la subcarpeta de la URL (Ej: /Ezio%20%26%20Thanos/)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  Auto por URL
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryStrategy('fixed')}
                  disabled={isProcessing}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    categoryStrategy === 'fixed'
                      ? 'bg-neutral-800 text-teal-400 shadow-sm border border-neutral-700'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5" />
                  Fija
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryStrategy('none')}
                  disabled={isProcessing}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    categoryStrategy === 'none'
                      ? 'bg-neutral-800 text-neutral-200 shadow-sm border border-neutral-700'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  Ninguna
                </button>
              </div>
            </div>
          </div>

          {/* Selector de Categoría Fija (Si la estrategia es 'fixed') */}
          {categoryStrategy === 'fixed' && (
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-2 animate-in fade-in duration-150">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
                <Folder className="w-4 h-4 text-teal-400" />
                Asignar todos los vídeos a esta categoría:
              </label>
              <CategorySelector
                value={fixedCategory}
                onChange={setFixedCategory}
                categories={availableCategories}
                onCreateCategory={onAddCategory}
                disabled={isProcessing}
                placeholder="Elige una categoría existente o escribe para crear nueva..."
              />
            </div>
          )}

          {/* Auto URL Info Box (Si la estrategia es 'auto') */}
          {categoryStrategy === 'auto' && (
            <div className="p-3 bg-teal-950/20 border border-teal-900/40 rounded-xl text-xs text-neutral-300 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-teal-300">
                  Detección automática por URL activa
                </p>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Las carpetas contenidas en las rutas de Hugging Face (después de <code>/resolve/main/</code>) se asignarán automáticamente como Categoría. Si no hay subcarpeta, se asignará el nombre del repositorio.
                </p>
              </div>
            </div>
          )}

          {/* URLs Input & Drop Zone */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                URLs de los vídeos (Una por línea)
              </label>
              {urlAnalysis.totalUrls > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-teal-400 border border-neutral-700">
                  {urlAnalysis.totalUrls} {urlAnalysis.totalUrls === 1 ? 'URL detectada' : 'URLs detectadas'}
                </span>
              )}
            </div>

            {/* Drop Zone */}
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
                if (file) {
                  handleFile(file);
                }
              }}
              className={`relative border-2 border-dashed rounded-xl p-3.5 sm:p-4 text-center transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isDragging
                  ? 'border-teal-400 bg-teal-950/40 shadow-[0_0_20px_rgba(20,184,166,0.15)] scale-[1.01]'
                  : 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700'
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
              
              <div className="flex items-center gap-2.5 text-left">
                <div className={`p-2 rounded-lg border transition-colors ${
                  isDragging 
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' 
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                }`}>
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <p className="text-neutral-300 font-medium">
                    Arrastra aquí un .txt con URLs (una por línea), o pega/escribe abajo
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Lectura local instantánea de archivos de texto plano (.txt)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-teal-400 hover:text-teal-300 border border-neutral-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" />
                Seleccionar archivo .txt
              </button>
            </div>

            {/* File Warning Notice (non-blocking) */}
            {fileWarning && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{fileWarning}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFileWarning(null)}
                  className="text-amber-400 hover:text-amber-200 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <textarea
              value={urlsInput}
              onChange={(e) => {
                setUrlsInput(e.target.value);
                if (fileWarning) setFileWarning(null);
              }}
              disabled={isProcessing}
              placeholder="https://huggingface.co/datasets/Usuario/Repo/resolve/main/Carpeta%20Categoria/video1.mp4&#10;https://huggingface.co/datasets/Usuario/Repo/resolve/main/Carpeta%20Categoria/video2.mp4"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-neutral-600 font-mono resize-none h-32 custom-scrollbar"
            />
          </div>

          {/* Live Preview of Detected Data from URLs */}
          {urlAnalysis.totalUrls > 0 && (
            <div className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5 animate-in fade-in duration-200">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                <span>Resumen de datos detectados en las URLs</span>
                {urlAnalysis.huggingFaceCount > 0 && (
                  <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                    {urlAnalysis.huggingFaceCount} de Hugging Face
                  </span>
                )}
              </div>

              {/* Detected Categories */}
              {categoryStrategy === 'auto' && (
                <div className="space-y-1">
                  <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                    <Folder className="w-3 h-3 text-teal-400" /> Categorías detectadas a asignar:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {urlAnalysis.categoryCounts.length > 0 ? (
                      urlAnalysis.categoryCounts.map(([cat, count]) => (
                        <span 
                          key={cat}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-950/80 border border-teal-800 text-teal-300 text-xs font-medium"
                        >
                          <span className="font-bold">{cat}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-900 text-teal-200 font-mono">
                            {count} {count === 1 ? 'vídeo' : 'vídeos'}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-neutral-500 italic">
                        No se han detectado subcarpetas explícitas (se usarán repositorios o sin categoría).
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Detected Authors / Repos */}
              {(urlAnalysis.authorCounts.length > 0 || urlAnalysis.repoCounts.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-400 border-t border-neutral-850">
                  {urlAnalysis.authorCounts.length > 0 && (
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-neutral-500">Autor(es):</span>
                      {urlAnalysis.authorCounts.map(([author]) => (
                        <span key={author} className="text-neutral-300 font-mono font-semibold">
                          @{author}
                        </span>
                      ))}
                    </div>
                  )}

                  {urlAnalysis.repoCounts.length > 0 && (
                    <div className="flex items-center gap-1 ml-2">
                      <Layers className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-neutral-500">Repo:</span>
                      {urlAnalysis.repoCounts.map(([repo]) => (
                        <span key={repo} className="text-neutral-300 font-mono">
                          {repo}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Real-time Process Logs */}
          <div className="bg-neutral-950 rounded-xl border border-neutral-800 p-3.5 h-36 overflow-y-auto custom-scrollbar font-mono text-xs flex flex-col gap-1.5">
            {logs.length === 0 ? (
              <span className="text-neutral-500 italic">Los resultados y metadatos extraídos aparecerán aquí al iniciar el proceso...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-teal-400' : 'text-neutral-300'}`}>
                  {log.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {log.type === 'success' && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {log.type === 'info' && <span className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-50">→</span>}
                  <span className="break-all">{log.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-neutral-800 bg-neutral-900/80 flex items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-neutral-400 font-medium">
            {isProcessing && `Procesando: ${progress.current} de ${progress.total}`}
            {isCompleted && <span className="text-teal-400 font-semibold">✓ Guardado finalizado. Cerrando...</span>}
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing || isCompleted}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={isProcessing || isCompleted || urlAnalysis.totalUrls === 0}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-neutral-950 px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(20,184,166,0.2)] cursor-pointer"
            >
              {isProcessing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Procesando {progress.current}/{progress.total}...</>
              ) : isCompleted ? (
                <><Check className="w-4 h-4 text-neutral-950" /> Guardado con éxito</>
              ) : (
                <><Check className="w-4 h-4" /> Importar {urlAnalysis.totalUrls > 0 ? `(${urlAnalysis.totalUrls})` : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
