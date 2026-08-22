import { useState, useRef } from 'react';
import { VideoRecord, Lora, VideoSource } from '../types';
import { extractDriveFileId, calculateOrientation, extractTechnicalDetails } from '../lib/utils';
import { X, Check, FileVideo, AlertCircle, Loader2 } from 'lucide-react';
import wasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';

interface BatchImportModalProps {
  onClose: () => void;
  onSaveBatch: (videos: VideoRecord[]) => Promise<void>;
  userEmail?: string;
}

export function BatchImportModal({ onClose, onSaveBatch, userEmail }: BatchImportModalProps) {
  const [urlsInput, setUrlsInput] = useState('');
  const [importSource, setImportSource] = useState<VideoSource>('local');
  const [groupName, setGroupName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<{ type: 'info' | 'success' | 'error'; msg: string }[]>([]);
  
  const isProcessingRef = useRef(false);

  const addLog = (type: 'info' | 'success' | 'error', msg: string) => {
    setLogs(prev => [...prev, { type, msg }]);
  };

  const handleProcess = async () => {
    if (isProcessingRef.current) return;
    
    const lines = urlsInput.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
    if (lines.length === 0) {
      addLog('error', 'No se encontraron URLs válidas.');
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
        setProgress({ current: i + 1, total: lines.length });
        addLog('info', `Procesando: ${url}`);

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

          // Valores por defecto
          let width = 1920;
          let height = 1080;
          let prompt = "Importado desde URL";
          let model = "Wan 2.1";
          let durationSeconds = 5;
          let steps = 30;
          let shift = "5.0";
          let seed = "";
          let tagsInput = "Wan 2.1";
          let videoVae: string | undefined = undefined;
          let textEncoder: string | undefined = undefined;
          let precision: string | undefined = undefined;
          let loras: Lora[] = [];
          let renderSeconds: number | undefined = undefined;
          let generatedAt: number | undefined = undefined;
          let fileSizeBytes: number | undefined = blob.size;

          if (videoTrack?.Width) width = Number(videoTrack.Width);
          if (videoTrack?.Height) height = Number(videoTrack.Height);
          if (generalTrack?.Duration) durationSeconds = parseFloat(generalTrack.Duration);

          if (commentRaw) {
            try {
              const parsed = JSON.parse(commentRaw);
              if (parsed.prompt) prompt = parsed.prompt;
              if (parsed.seed !== undefined) seed = String(parsed.seed);
              if (parsed.num_inference_steps !== undefined) steps = Number(parsed.num_inference_steps);
              if (parsed.flow_shift !== undefined) shift = String(parsed.flow_shift);

              const techDetails = extractTechnicalDetails(parsed, commentRaw, parsed.model_type || parsed.type || '');
              if (techDetails.baseModel) model = techDetails.baseModel;
              if (techDetails.videoVae) videoVae = techDetails.videoVae;
              if (techDetails.textEncoder) textEncoder = techDetails.textEncoder;
              if (techDetails.precision) precision = techDetails.precision;
              if (techDetails.tags.length > 0) tagsInput = techDetails.tags.join(', ');

              if (parsed.generation_time !== undefined) renderSeconds = Number(parsed.generation_time);
              if (parsed.creation_timestamp !== undefined) generatedAt = Number(parsed.creation_timestamp) * 1000;

              if (parsed.activated_loras && parsed.loras_multipliers) {
                const weights = String(parsed.loras_multipliers).split('|');
                parsed.activated_loras.forEach((loraPath: string, i: number) => {
                  const nameParts = loraPath.split(/[\/\\]/);
                  let baseName = nameParts[nameParts.length - 1];
                  baseName = baseName.replace(/\.[^/.]+$/, "");
                  const weightStr = weights[i];
                  if (weightStr !== undefined && weightStr !== '') {
                    loras.push({ name: baseName, weight: parseFloat(weightStr) });
                  }
                });
              }
            } catch(e) {
              const techDetails = extractTechnicalDetails(undefined, commentRaw);
              if (techDetails.videoVae) videoVae = techDetails.videoVae;
              if (techDetails.textEncoder) textEncoder = techDetails.textEncoder;
              if (techDetails.precision) precision = techDetails.precision;
            }
          }

          const orientation = calculateOrientation(width, height);
          const driveFileId = extractDriveFileId(url) || '';

          const record: VideoRecord = {
            schemaVersion: 2,
            videoUrl: url,
            groupName: groupName.trim() || undefined,
            driveFileId,
            prompt,
            model,
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
            precision,
            loras,
            createdAt: Date.now(),
            createdBy: userEmail,
            renderSeconds,
            fileSizeBytes,
            generatedAt,
            rawMetadata: commentRaw
          };

          results.push(record);
          addLog('success', `Exito: Metadatos extraídos (${model}, ${width}x${height})`);

        } catch (e: any) {
          addLog('error', `Error en ${url}: ${e.message}`);
        }
      }

      if (results.length > 0) {
        addLog('info', `Guardando ${results.length} vídeos en la base de datos...`);
        await onSaveBatch(results);
        addLog('success', `¡Proceso completado! Se han guardado ${results.length} vídeos.`);
        setTimeout(() => onClose(), 2000);
      } else {
        addLog('error', 'No se ha podido procesar ningún vídeo.');
      }

    } catch (e: any) {
      addLog('error', `Fallo general: ${e.message}`);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
              <FileVideo className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Importación Batch (Hugging Face / URLs directas)</h2>
              <p className="text-sm text-neutral-400">Extrae metadatos automáticamente de los MP4 y los guarda.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors" disabled={isProcessing}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-neutral-300">Origen de los vídeos</label>
            <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 w-fit">
              <button
                type="button"
                onClick={() => setImportSource('local')}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  importSource === 'local' 
                    ? 'bg-neutral-800 text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Generación Local (PC)
              </button>
              <button
                type="button"
                onClick={() => setImportSource('cloud')}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  importSource === 'cloud' 
                    ? 'bg-neutral-800 text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Servicio Cloud
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-neutral-300">Carpeta / Grupo (Opcional)</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isProcessing}
              placeholder="Ej: Proyecto Neo-Tokyo"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-neutral-600"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-neutral-300">URLs de los vídeos (Una por línea)</label>
            <textarea
              value={urlsInput}
              onChange={(e) => setUrlsInput(e.target.value)}
              disabled={isProcessing}
              placeholder="https://huggingface.co/datasets/Usuario/Repo/resolve/main/video1.mp4&#10;https://huggingface.co/datasets/Usuario/Repo/resolve/main/video2.mp4"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-teal-500 transition-colors placeholder:text-neutral-600 font-mono resize-none h-40 custom-scrollbar"
            />
          </div>

          <div className="bg-neutral-950 rounded-xl border border-neutral-800 p-4 h-48 overflow-y-auto custom-scrollbar font-mono text-xs flex flex-col gap-1.5">
            {logs.length === 0 ? (
              <span className="text-neutral-500 italic">Los resultados del proceso aparecerán aquí...</span>
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

        <div className="p-6 border-t border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
          <div className="text-sm text-neutral-400 font-medium">
            {isProcessing && `Procesando: ${progress.current} / ${progress.total}`}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleProcess}
              disabled={isProcessing || !urlsInput.trim()}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-neutral-950 px-6 py-2.5 rounded-lg text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_20px_rgba(20,184,166,0.2)]"
            >
              {isProcessing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
              ) : (
                <><Check className="w-4 h-4" /> Importar Batch</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
