import { useState, FormEvent, useMemo, useRef, DragEvent } from 'react';
import { VideoRecord, Lora, VideoSource } from '../types';
import { extractDriveFileId, calculateOrientation } from '../lib/utils';
import { X, Plus, Trash2, Check, FileVideo, AlertCircle, UploadCloud } from 'lucide-react';
import wasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';

interface AddVideoModalProps {
  onClose: () => void;
  onSave: (video: VideoRecord) => Promise<void>;
  userEmail?: string;
}

const COMMON_MODELS = [
  'Wan2.1 FL2VA (Wan2GP)',
  'Minimax H3 FL2VA Pruned (Wan2GP)',
  'Minimax H3 FL2VA 33B (Wan2GP)',
  'LTX 2.3 (Wan2GP)',
  'LTX 2.5 Distilled (Wan2GP)',
  'Kling 1.5',
  'Runway Gen-3',
  'Luma Dream Machine',
  'HunyuanVideo'
];

export function AddVideoModal({ onClose, onSave, userEmail }: AddVideoModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState('Wan2.1 FL2VA (Wan2GP)');
  const [source, setSource] = useState<VideoSource>('local');
  const [tagsInput, setTagsInput] = useState('Wan2GP, 33B');
  const [width, setWidth] = useState<number>(1920);
  const [height, setHeight] = useState<number>(1080);
  const [steps, setSteps] = useState<number>(30);
  const [shift, setShift] = useState<string>('5.0');
  const [seed, setSeed] = useState<string>('');
  const [fps, setFps] = useState<string>('24');
  const [durationSeconds, setDurationSeconds] = useState<string>('5');
  const [notes, setNotes] = useState('');
  const [loras, setLoras] = useState<Lora[]>([]);
  
  // Extra fields for metadata
  const [renderSeconds, setRenderSeconds] = useState<string>('');
  const [generatedAt, setGeneratedAt] = useState<number | undefined>(undefined);
  const [rawMetadata, setRawMetadata] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Autocomplete state
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedFileId = useMemo(() => extractDriveFileId(videoUrl), [videoUrl]);
  const currentOrientation = useMemo(() => calculateOrientation(width, height), [width, height]);

  const parseModelAndTags = (modelType: string, typeDesc: string = '') => {
    const combined = `${modelType} ${typeDesc}`.toLowerCase();
    let baseModel = modelType;
    let newTags: string[] = [];

    if (combined.includes('minimax') || combined.includes('h3')) {
        baseModel = 'Minimax H3';
    } else if (combined.includes('wan 2.1') || combined.includes('wan_2.1') || combined.includes('wan2.1')) {
        baseModel = 'Wan 2.1';
    } else if (combined.includes('wan 2.2') || combined.includes('wan_2.2') || combined.includes('wan2.2')) {
        baseModel = 'Wan 2.2';
    } else if (combined.includes('ltx 2.3') || combined.includes('ltx_2.3') || combined.includes('ltx2.3')) {
        baseModel = 'LTX 2.3';
    } else if (combined.includes('ltx 2.5') || combined.includes('ltx_2.5') || combined.includes('ltx2.5')) {
        baseModel = 'LTX 2.5';
    } else if (combined.includes('hunyuan')) {
        baseModel = 'HunyuanVideo';
    }

    if (combined.includes('pruned')) newTags.push('pruned');
    if (combined.includes('distilled')) newTags.push('distilled');
    if (combined.includes('33b')) newTags.push('33B');
    if (combined.includes('20b')) newTags.push('20B');
    if (combined.includes('14b')) newTags.push('14B');
    if (combined.includes('ref2va')) newTags.push('ref2va');
    if (combined.includes('fl2va')) newTags.push('fl2va');
    if (combined.includes('int8')) newTags.push('int8');
    if (combined.includes('fp8')) newTags.push('fp8');

    return { baseModel, newTags: Array.from(new Set(newTags)) };
  };

  const processLocalFile = async (file: File) => {
    setExtracting(true);
    setExtractError(null);

    try {
      const mediainfo = await import('mediainfo.js');
      
      const getSize = () => file.size;
      const readChunk = (chunkSize: number, offset: number) =>
        new Promise<Uint8Array>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.error) {
              reject(event.target.error);
            }
            resolve(new Uint8Array(event.target?.result as ArrayBuffer));
          };
          reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
        });

      const mi = await mediainfo.default({ 
        format: 'object',
        locateFile: () => wasmUrl
      });
      
      const result = await mi.analyzeData(getSize, readChunk);
      
      console.log("MediaInfo Result:", JSON.stringify(result, null, 2));

      const generalTrack = result.media?.track?.find((t: any) => t['@type'] === 'General');
      const videoTrack = result.media?.track?.find((t: any) => t['@type'] === 'Video');

      const commentRaw = generalTrack?.extra?.Comment || generalTrack?.Comment || videoTrack?.extra?.Comment || videoTrack?.Comment;
      
      let newAutoFilled: Record<string, boolean> = {};
      let foundSomething = false;

      if (videoTrack?.Width) {
        setWidth(Number(videoTrack.Width));
        newAutoFilled.width = true;
        foundSomething = true;
      }
      if (videoTrack?.Height) {
        setHeight(Number(videoTrack.Height));
        newAutoFilled.height = true;
        foundSomething = true;
      }
      if (generalTrack?.Duration) {
        setDurationSeconds(String(parseFloat(generalTrack.Duration)));
        newAutoFilled.durationSeconds = true;
        foundSomething = true;
      }

      if (commentRaw) {
        try {
          const parsed = JSON.parse(commentRaw);
          setRawMetadata(commentRaw);
          
          if (parsed.prompt) { setPrompt(parsed.prompt); newAutoFilled.prompt = true; foundSomething = true; }
          if (parsed.seed !== undefined) { setSeed(String(parsed.seed)); newAutoFilled.seed = true; foundSomething = true; }
          if (parsed.num_inference_steps !== undefined) { setSteps(Number(parsed.num_inference_steps)); newAutoFilled.steps = true; foundSomething = true; }
          if (parsed.flow_shift !== undefined) { setShift(String(parsed.flow_shift)); newAutoFilled.shift = true; foundSomething = true; }
          
          if (parsed.model_type || parsed.type) { 
            const { baseModel, newTags } = parseModelAndTags(parsed.model_type || '', parsed.type || '');
            setModel(baseModel); 
            newAutoFilled.model = true;
            if (newTags.length > 0) {
              setTagsInput(newTags.join(', '));
              newAutoFilled.tags = true;
            }
            foundSomething = true; 
          }
          
          if (parsed.resolution && !newAutoFilled.width) {
            const [w, h] = parsed.resolution.split('x');
            if (w && h) {
              setWidth(Number(w));
              setHeight(Number(h));
              newAutoFilled.width = true;
              newAutoFilled.height = true;
              foundSomething = true;
            }
          }
          
          if (parsed.generation_time !== undefined) {
            setRenderSeconds(String(parsed.generation_time));
            newAutoFilled.renderSeconds = true;
            foundSomething = true;
          }
          if (parsed.creation_timestamp !== undefined) {
            setGeneratedAt(Number(parsed.creation_timestamp) * 1000);
            newAutoFilled.generatedAt = true;
            foundSomething = true;
          }

          if (parsed.activated_loras && parsed.loras_multipliers) {
            const weights = String(parsed.loras_multipliers).split('|');
            const newLoras: Lora[] = [];
            parsed.activated_loras.forEach((loraPath: string, i: number) => {
              const nameParts = loraPath.split(/[\/\\]/);
              let baseName = nameParts[nameParts.length - 1];
              baseName = baseName.replace(/\.[^/.]+$/, "");

              const weightStr = weights[i];
              if (weightStr !== undefined && weightStr !== '') {
                newLoras.push({ name: baseName, weight: parseFloat(weightStr) });
              }
            });
            if (newLoras.length > 0) {
              setLoras(newLoras);
              newAutoFilled.loras = true;
              foundSomething = true;
            }
          }
          
        } catch (e) {
          console.error("Error parsing JSON comment", e);
        }
      }
      
      if (!foundSomething) {
         setExtractError("No se encontraron metadatos en este archivo.");
      }
      
      setAutoFilled(newAutoFilled);

    } catch (err) {
      console.error("Error with mediainfo.js", err);
      setExtractError("Error al procesar el archivo local.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processLocalFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      processLocalFile(file);
    } else {
      setExtractError("Por favor, suelta un archivo de vídeo válido.");
    }
  };

  const handleAddLora = () => {
    setLoras([...loras, { name: '', weight: 1.0 }]);
  };

  const handleRemoveLora = (index: number) => {
    setLoras(loras.filter((_, i) => i !== index));
  };

  const handleLoraChange = (index: number, field: keyof Lora, value: string | number) => {
    const updated = [...loras];
    updated[index] = { ...updated[index], [field]: value };
    setLoras(updated);
  };

  const setResolutionPreset = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  };

  const AutoFillBadge = ({ field }: { field: string }) => {
    if (!autoFilled[field]) return null;
    return (
      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-teal-950/40 border border-teal-800/60 rounded" title="Importado desde archivo">
        <Check className="w-3 h-3 text-teal-400" />
      </span>
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Filtrar loras vacíos
    const cleanLoras = loras.filter(l => l.name.trim() !== '');
    
    // Procesar tags
    const cleanTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const record: VideoRecord = {
      schemaVersion: 2,
      videoUrl: videoUrl.trim(),
      driveFileId: detectedFileId || extractDriveFileId(videoUrl),
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() ? negativePrompt.trim() : undefined,
      model: model.trim(),
      source,
      tags: cleanTags.length > 0 ? cleanTags : undefined,
      width: Number(width) || 1920,
      height: Number(height) || 1080,
      orientation: currentOrientation,
      steps: Number(steps) || 30,
      shift: shift.trim() !== '' ? Number(shift) : undefined,
      seed: seed.trim() !== '' ? Number(seed) : undefined,
      fps: fps.trim() !== '' ? Number(fps) : undefined,
      durationSeconds: durationSeconds.trim() !== '' ? Number(durationSeconds) : undefined,
      loras: cleanLoras,
      notes: notes.trim() ? notes.trim() : undefined,
      createdAt: Date.now(),
      createdBy: userEmail || undefined,
      renderSeconds: renderSeconds.trim() !== '' ? Number(renderSeconds) : undefined,
      generatedAt,
      rawMetadata: rawMetadata.trim() !== '' ? rawMetadata : undefined
    };

    await onSave(record);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-neutral-100">Nuevo Registro de Vídeo</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Catálogo y metadatos de generación AI</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          
          {/* Autocompletar desde archivo local */}
          <div 
            className={`rounded-xl p-5 border-2 border-dashed transition-all ${
              isDragging 
                ? 'bg-teal-950/20 border-teal-500/50' 
                : 'bg-neutral-900/30 border-neutral-800'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-teal-400" />
                  Autocompletar desde archivo local (opcional)
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Arrastra o selecciona el vídeo original para extraer prompt, modelo, resolución, etc.
                </p>
              </div>
              <div className="shrink-0">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={extracting}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 border ${
                    isDragging
                      ? 'bg-teal-900/50 text-teal-200 border-teal-700/50'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {extracting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                      Extrayendo...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      {isDragging ? 'Suelta el vídeo aquí' : 'Seleccionar Archivo'}
                    </>
                  )}
                </button>
              </div>
            </div>
            {extractError && (
              <div className="mt-3 flex items-center gap-2 text-rose-400 text-xs bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/50">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{extractError}</p>
              </div>
            )}
          </div>

          <form id="add-video-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Origen del Vídeo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Enlace de Google Drive <span className="text-teal-400">*</span>
                </label>
                {detectedFileId && (
                  <span className="text-[11px] text-teal-400 font-mono">
                    ID extraído: {detectedFileId.slice(0, 10)}...
                  </span>
                )}
              </div>
              <input 
                type="url" 
                required
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/1M5uutzAXG3r8b8HS.../view?usp=sharing"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50 transition-all font-mono"
              />
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Prompt <span className="text-teal-400">*</span>
                <AutoFillBadge field="prompt" />
              </label>
              <textarea 
                required
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Descripción completa del prompt utilizado..."
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50 transition-all resize-none leading-relaxed"
              />
            </div>

            {/* Prompt Negativo */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Negative Prompt (Opcional)
              </label>
              <textarea 
                value={negativePrompt}
                onChange={e => setNegativePrompt(e.target.value)}
                placeholder="Elementos excluidos o negativos..."
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600 transition-all resize-none"
              />
            </div>

            {/* Modelo y Origen (Local vs Cloud) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Modelo AI <span className="text-teal-400">*</span>
                  <AutoFillBadge field="model" />
                </label>
                <input 
                  type="text" 
                  required
                  list="models-list"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="Ej: Wan2.1, Minimax H3, LTX 2.3..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50 transition-all"
                />
                <datalist id="models-list">
                  {COMMON_MODELS.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Origen
                </label>
                <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setSource('local')}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      source === 'local'
                        ? 'bg-neutral-800 text-teal-400 font-semibold'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Local
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource('cloud')}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      source === 'cloud'
                        ? 'bg-neutral-800 text-teal-400 font-semibold'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Cloud
                  </button>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                Etiquetas / Tags (Separadas por comas)
                <AutoFillBadge field="tags" />
              </label>
              <input 
                type="text" 
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="pruned, 33B, distilled, ref2va, Wan2GP..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600 transition-all"
              />
            </div>

            {/* Resolución y Orientación */}
            <div className="space-y-3 p-4 bg-neutral-950/60 rounded-xl border border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Dimensiones y Orientación
                  <AutoFillBadge field="width" />
                  <AutoFillBadge field="height" />
                </label>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-teal-400">
                  {width} x {height} ({currentOrientation})
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setResolutionPreset(1920, 1080)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    width === 1920 && height === 1080
                      ? 'bg-teal-950/80 border-teal-700 text-teal-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  1920x1080 (16:9)
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionPreset(1280, 720)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    width === 1280 && height === 720
                      ? 'bg-teal-950/80 border-teal-700 text-teal-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  1280x720 (16:9)
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionPreset(1080, 1920)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    width === 1080 && height === 1920
                      ? 'bg-teal-950/80 border-teal-700 text-teal-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  1080x1920 (9:16)
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionPreset(1024, 1024)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    width === 1024 && height === 1024
                      ? 'bg-teal-950/80 border-teal-700 text-teal-300'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  1024x1024 (1:1)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-neutral-500 block mb-1">Ancho (px)</label>
                  <input 
                    type="number" 
                    required
                    min={64}
                    value={width}
                    onChange={e => setWidth(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-500 block mb-1">Alto (px)</label>
                  <input 
                    type="number" 
                    required
                    min={64}
                    value={height}
                    onChange={e => setHeight(Number(e.target.value))}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-neutral-200"
                  />
                </div>
              </div>
            </div>

            {/* Parámetros de Generación */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  Steps <span className="text-teal-400">*</span>
                  <AutoFillBadge field="steps" />
                </label>
                <input 
                  type="number" 
                  required
                  min={1}
                  value={steps}
                  onChange={e => setSteps(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  Shift
                  <AutoFillBadge field="shift" />
                </label>
                <input 
                  type="number" 
                  step="0.1"
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  placeholder="5.0"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  Seed
                  <AutoFillBadge field="seed" />
                </label>
                <input 
                  type="number" 
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                  placeholder="Aleatorio"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  FPS / Seg
                  <AutoFillBadge field="durationSeconds" />
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <input 
                    type="number" 
                    value={fps}
                    onChange={e => setFps(e.target.value)}
                    placeholder="24"
                    title="FPS"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-xs text-neutral-200"
                  />
                  <input 
                    type="number" 
                    step="0.5"
                    value={durationSeconds}
                    onChange={e => setDurationSeconds(e.target.value)}
                    placeholder="5s"
                    title="Duración en segundos"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-xs text-neutral-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  Render (s)
                  <AutoFillBadge field="renderSeconds" />
                </label>
                <input 
                  type="number" 
                  value={renderSeconds}
                  onChange={e => setRenderSeconds(e.target.value)}
                  placeholder="Ej: 479"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50"
                />
              </div>
            </div>

            {/* LoRAs */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1">
                  LoRAs Aplicados
                  <AutoFillBadge field="loras" />
                </label>
                <button 
                  type="button" 
                  onClick={handleAddLora}
                  className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir LoRA
                </button>
              </div>
              
              {loras.length === 0 ? (
                <div className="text-xs text-neutral-600 italic py-1">Sin LoRAs añadidos.</div>
              ) : (
                <div className="space-y-2">
                  {loras.map((lora, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={lora.name}
                        onChange={e => handleLoraChange(idx, 'name', e.target.value)}
                        placeholder="Nombre del LoRA"
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50"
                      />
                      <input 
                        type="number" 
                        step="0.05"
                        value={lora.weight}
                        onChange={e => handleLoraChange(idx, 'weight', Number(e.target.value))}
                        placeholder="Peso (1.0)"
                        className="w-24 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50"
                      />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLora(idx)}
                        className="text-neutral-500 hover:text-red-400 p-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notas opcionales */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Notas / Observaciones
              </label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones de calidad, artefactos, render time..."
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-neutral-300 focus:outline-none focus:border-neutral-600 transition-all resize-none"
              />
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-neutral-800 bg-neutral-950 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="add-video-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 text-sm font-semibold rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
          </button>
        </div>
      </div>
    </div>
  );
}
