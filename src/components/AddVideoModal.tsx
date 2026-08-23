import { useState, FormEvent, useMemo, useRef, DragEvent } from 'react';
import { VideoRecord, Lora, VideoSource } from '../types';
import { extractDriveFileId, calculateOrientation, parseModelAndTags, extractTechnicalDetails, parseWanGpMetadata, parseVideoUrlInfo, TEXT_ENCODER_OPTIONS, VIDEO_VAE_OPTIONS } from '../lib/utils';
import { X, Plus, Trash2, Check, FileVideo, AlertCircle, UploadCloud, Wand2, Cpu, Layers, Sparkles, Folder } from 'lucide-react';
import { CategorySelector } from './CategorySelector';
import wasmUrl from 'mediainfo.js/MediaInfoModule.wasm?url';

interface AddVideoModalProps {
  onClose: () => void;
  onSave: (video: VideoRecord) => Promise<void>;
  userEmail?: string;
  initialData?: VideoRecord;
  existingGroups: string[];
  onAddCategory?: (category: string) => void;
}

const COMMON_MODELS = [
  'Wan 2.1',
  'Minimax H3',
  'LTX 2.3',
  'LTX 2.5',
  'HunyuanVideo',
  'Kling 1.5',
  'Runway Gen-3',
  'Luma Dream Machine'
];

export function AddVideoModal({ onClose, onSave, userEmail, initialData, existingGroups, onAddCategory }: AddVideoModalProps) {
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl || '');
  const [prompt, setPrompt] = useState(initialData?.prompt || '');
  const [negativePrompt, setNegativePrompt] = useState(initialData?.negativePrompt || '');
  const [model, setModel] = useState(initialData?.model || '');
  const [modelSizeB, setModelSizeB] = useState<number | undefined>(initialData?.modelSizeB);
  const [source, setSource] = useState<VideoSource>(initialData?.source || 'local');
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(', ') || '');
  const [groupName, setGroupName] = useState(initialData?.groupName || '');
  const [width, setWidth] = useState<number | ''>(initialData?.width || '');
  const [height, setHeight] = useState<number | ''>(initialData?.height || '');
  const [steps, setSteps] = useState<number | ''>(initialData?.steps || '');
  const [shift, setShift] = useState<string>(initialData?.shift?.toString() || '');
  const [seed, setSeed] = useState<string>(initialData?.seed?.toString() || '');
  const [fps, setFps] = useState<string>(initialData?.fps?.toString() || '');
  const [durationSeconds, setDurationSeconds] = useState<string>(initialData?.durationSeconds?.toString() || '');
  const [fileSizeBytes, setFileSizeBytes] = useState<number | undefined>(initialData?.fileSizeBytes);
  const [videoVae, setVideoVae] = useState<string>(initialData?.videoVae || '');
  const [textEncoder, setTextEncoder] = useState<string>(initialData?.textEncoder || '');
  const [precision, setPrecision] = useState<string>(initialData?.precision || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loras, setLoras] = useState<Lora[]>(initialData?.loras || []);
  
  // Extra fields for metadata
  const [renderSeconds, setRenderSeconds] = useState<string>(initialData?.renderSeconds?.toString() || '');
  const [generatedAt, setGeneratedAt] = useState<number | undefined>(initialData?.generatedAt);
  const [rawMetadata, setRawMetadata] = useState<string>(initialData?.rawMetadata || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Autocomplete state
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({});
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const detectedFileId = useMemo(() => extractDriveFileId(videoUrl), [videoUrl]);
  const isDirectMp4 = useMemo(() => videoUrl.toLowerCase().includes('.mp4'), [videoUrl]);
  const currentOrientation = useMemo(() => calculateOrientation(Number(width) || 0, Number(height) || 0), [width, height]);
  const parsedUrlInfo = useMemo(() => parseVideoUrlInfo(videoUrl), [videoUrl]);

  const handleVideoUrlChange = (newUrl: string) => {
    setVideoUrl(newUrl);
    const info = parseVideoUrlInfo(newUrl);
    if (info.suggestedGroupName && !groupName) {
      setGroupName(info.suggestedGroupName);
      setAutoFilled(prev => ({ ...prev, groupName: true }));
    }
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

      const generalTrack = result.media?.track?.find((t: any) => t['@type'] === 'General') as any;
      const videoTrack = result.media?.track?.find((t: any) => t['@type'] === 'Video') as any;

      const commentRaw = generalTrack?.extra?.Comment || generalTrack?.Comment || videoTrack?.extra?.Comment || videoTrack?.Comment;
      
      let newAutoFilled: Record<string, boolean> = {};
      let foundSomething = false;

      if (file.size) {
        setFileSizeBytes(file.size);
        newAutoFilled.fileSizeBytes = true;
      }

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
        const metadata = parseWanGpMetadata(commentRaw, generalTrack?.Duration ? parseFloat(generalTrack.Duration) : undefined, fps ? Number(fps) : 24);
        if (metadata) {
          setRawMetadata(commentRaw);
          if (metadata.prompt) { setPrompt(metadata.prompt); newAutoFilled.prompt = true; foundSomething = true; }
          if (metadata.seed !== undefined) { setSeed(metadata.seed); newAutoFilled.seed = true; foundSomething = true; }
          if (metadata.steps !== undefined) { setSteps(metadata.steps); newAutoFilled.steps = true; foundSomething = true; }
          if (metadata.shift !== undefined) { setShift(metadata.shift); newAutoFilled.shift = true; foundSomething = true; }
          if (metadata.baseModel) { setModel(metadata.baseModel); newAutoFilled.model = true; foundSomething = true; }
          if (metadata.modelSizeB !== undefined) { setModelSizeB(metadata.modelSizeB); }
          if (metadata.videoVae) { setVideoVae(metadata.videoVae); newAutoFilled.videoVae = true; foundSomething = true; }
          if (metadata.textEncoder) { setTextEncoder(metadata.textEncoder); newAutoFilled.textEncoder = true; foundSomething = true; }
          if (metadata.precision) { setPrecision(metadata.precision); newAutoFilled.precision = true; foundSomething = true; }
          if (metadata.tags && metadata.tags.length > 0) {
            const existingTags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
            const merged = Array.from(new Set([...existingTags, ...metadata.tags]));
            setTagsInput(merged.join(', '));
            newAutoFilled.tags = true;
            foundSomething = true;
          }
          if (metadata.width && metadata.height && !newAutoFilled.width) {
            setWidth(metadata.width);
            setHeight(metadata.height);
            newAutoFilled.width = true;
            newAutoFilled.height = true;
            foundSomething = true;
          }
          if (metadata.renderSeconds !== undefined) {
            setRenderSeconds(String(metadata.renderSeconds));
            newAutoFilled.renderSeconds = true;
            foundSomething = true;
          }
          if (metadata.durationSeconds !== undefined && !newAutoFilled.durationSeconds) {
            setDurationSeconds(metadata.durationSeconds);
            newAutoFilled.durationSeconds = true;
            foundSomething = true;
          }
          if (metadata.generatedAt !== undefined) {
            setGeneratedAt(metadata.generatedAt);
            newAutoFilled.generatedAt = true;
            foundSomething = true;
          }
          if (metadata.loras && metadata.loras.length > 0) {
            setLoras(metadata.loras);
            newAutoFilled.loras = true;
            foundSomething = true;
          }
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

  const [wandSuccess, setWandSuccess] = useState(false);
  const handleExtractDigiStorage = () => {
    const digiMatch = videoUrl.match(/^https?:\/\/digistorage\.es\/links\/([a-zA-Z0-9-]+)/i);
    if (digiMatch && digiMatch[1]) {
      const linkId = digiMatch[1];
      setVideoUrl(`https://digistorage.es/content/links/${linkId}/files/get/video.mp4?path=%2F`);
      setAutoFilled(prev => ({ ...prev, videoUrl: true }));
      setWandSuccess(true);
      setTimeout(() => setWandSuccess(false), 2000);
    }
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
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    
    // Filtrar loras vacíos
    const cleanLoras = loras.filter(l => l.name.trim() !== '');
    
    // Procesar tags
    let cleanTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const modelName = model.trim();
    if (modelName !== '') {
      if (!cleanTags.some(t => t.toLowerCase() === modelName.toLowerCase())) {
        cleanTags.unshift(modelName);
      }
    }
    
    cleanTags = Array.from(new Set(cleanTags));

    const record: VideoRecord = {
      id: initialData?.id,
      schemaVersion: 2,
      videoUrl: videoUrl.trim(),
      driveFileId: detectedFileId || extractDriveFileId(videoUrl),
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() ? negativePrompt.trim() : undefined,
      model: model.trim(),
      modelSizeB,
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
      createdAt: initialData?.createdAt || Date.now(),
      createdBy: initialData?.createdBy || userEmail || undefined,
      renderSeconds: renderSeconds.trim() !== '' ? Number(renderSeconds) : undefined,
      fileSizeBytes,
      videoVae: videoVae.trim() ? videoVae.trim() : undefined,
      textEncoder: textEncoder.trim() ? textEncoder.trim() : undefined,
      precision: precision.trim() ? precision.trim() : undefined,
      generatedAt,
      rawMetadata: rawMetadata.trim() !== '' ? rawMetadata : undefined,
      groupName: groupName.trim() !== '' ? groupName.trim() : undefined
    };

    if (groupName.trim() && onAddCategory) {
      onAddCategory(groupName.trim());
    }

    try {
      await onSave(record);
      onClose();
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-neutral-100">{initialData ? 'Editar Registro de Vídeo' : 'Nuevo Registro de Vídeo'}</h2>
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
                  Enlace del Vídeo (Drive / DigiStorage) <span className="text-teal-400">*</span>
                </label>
                {detectedFileId && (
                  <span className="text-[11px] text-teal-400 font-mono">
                    ID extraído: {detectedFileId.slice(0, 10)}...
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  type="url" 
                  required
                  value={videoUrl}
                  onChange={e => handleVideoUrlChange(e.target.value)}
                  placeholder="Drive, Hugging Face o DigiStorage (ej: https://huggingface.co/...)"
                  className={`w-full ${wandSuccess ? 'bg-teal-950/40 border-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.2)]' : 'bg-neutral-950 border-neutral-800'} rounded-xl pl-4 ${videoUrl.includes('digistorage.es/links/') && !isDirectMp4 ? 'pr-12' : 'pr-4'} py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50 transition-all duration-300 font-mono`}
                />
                {videoUrl.includes('digistorage.es/links/') && !isDirectMp4 && (
                  <button
                    type="button"
                    onClick={handleExtractDigiStorage}
                    title="Va a intentar extraer el mp4 directo"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all duration-300 ${wandSuccess ? 'bg-teal-500 text-neutral-950 scale-110' : 'bg-teal-500/10 text-teal-400 hover:bg-teal-500/20'}`}
                  >
                    {wandSuccess ? <Check className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Hugging Face URL Detection Badge */}
              {parsedUrlInfo.isHuggingFace && (
                <div className="flex items-center justify-between gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 px-3 py-2 rounded-xl animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      Hugging Face: <strong className="text-amber-200">@{parsedUrlInfo.username}</strong> / <strong className="text-amber-200">{parsedUrlInfo.repoName}</strong>
                      {parsedUrlInfo.category && (
                        <span className="text-teal-300 ml-1">
                          · Carpeta: <strong>"{parsedUrlInfo.category}"</strong>
                        </span>
                      )}
                    </span>
                  </div>
                  {parsedUrlInfo.suggestedGroupName && parsedUrlInfo.suggestedGroupName !== groupName && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupName(parsedUrlInfo.suggestedGroupName!);
                        setAutoFilled(prev => ({ ...prev, groupName: true }));
                      }}
                      className="shrink-0 px-2 py-0.5 rounded bg-teal-900/80 hover:bg-teal-800 text-teal-200 text-[11px] font-bold border border-teal-700 transition-colors cursor-pointer"
                    >
                      Asignar categoría
                    </button>
                  )}
                </div>
              )}
              
              {/* Mini Preview Video */}
              {videoUrl && (detectedFileId || isDirectMp4) && (
                <div className="mt-3 aspect-video w-full rounded-xl bg-black border border-neutral-800 overflow-hidden shadow-lg transition-all duration-500 opacity-100 translate-y-0 relative group">
                  {detectedFileId ? (
                    <iframe
                      src={`https://drive.google.com/file/d/${detectedFileId}/preview`}
                      className="w-full h-full"
                      allow="autoplay"
                    />
                  ) : (
                    <video
                      src={videoUrl}
                      className="w-full h-full object-contain"
                      controls
                      preload="metadata"
                      autoPlay
                      muted
                      loop
                    />
                  )}
                  <div className="absolute top-2 right-2 bg-neutral-950/80 backdrop-blur text-[10px] text-neutral-300 px-2 py-1 rounded-md border border-neutral-800 font-medium">
                    Vista previa
                  </div>
                </div>
              )}
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
                Negative Prompt (Opcional, eh ☝🏻)
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

            {/* Grupo / Carpeta / Categoría */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-teal-400" />
                  Categoría / Carpeta (opcional)
                  <AutoFillBadge field="groupName" />
                </label>
                {parsedUrlInfo.suggestedGroupName && parsedUrlInfo.suggestedGroupName !== groupName && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupName(parsedUrlInfo.suggestedGroupName!);
                      setAutoFilled(prev => ({ ...prev, groupName: true }));
                    }}
                    className="text-[11px] text-teal-400 hover:text-teal-300 underline cursor-pointer"
                  >
                    Usar detectada: "{parsedUrlInfo.suggestedGroupName}"
                  </button>
                )}
              </div>
              <CategorySelector
                value={groupName}
                onChange={setGroupName}
                categories={existingGroups}
                onCreateCategory={onAddCategory}
                placeholder="Seleccionar o crear categoría..."
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

              <div className="flex flex-col gap-2">
                <label className="text-[11px] text-neutral-500 mb-0.5 block">Preset de Resolución</label>
                <select 
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-600"
                  value={`${width}x${height}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== 'custom') {
                      const [w, h] = val.split('x');
                      setWidth(Number(w));
                      setHeight(Number(h));
                    }
                  }}
                >
                  <option value="custom">Personalizado...</option>
                  <optgroup label="1080p">
                    <option value="1920x1080">1920x1080 (16:9)</option>
                    <option value="1920x1088">1920x1088 (~16:9)</option>
                    <option value="1080x1920">1080x1920 (9:16)</option>
                    <option value="1088x1920">1088x1920 (~9:16)</option>
                    <option value="1440x1440">1440x1440 (1:1)</option>
                    <option value="1536x1024">1536x1024 (3:2)</option>
                    <option value="1024x1536">1024x1536 (2:3)</option>
                    <option value="1920x832">1920x832 (21:9)</option>
                    <option value="832x1920">832x1920 (9:21)</option>
                    <option value="2048x768">2048x768 (8:3)</option>
                    <option value="1024x1792">1024x1792 (4:7)</option>
                    <option value="1088x1088">1088x1088 (1:1)</option>
                  </optgroup>
                  <optgroup label="720p">
                    <option value="1280x720">1280x720 (16:9)</option>
                    <option value="1280x704">1280x704 (~16:9)</option>
                    <option value="720x1280">720x1280 (9:16)</option>
                    <option value="704x1280">704x1280 (~9:16)</option>
                    <option value="1024x1024">1024x1024 (1:1)</option>
                    <option value="1600x384">1600x384 (4:1)</option>
                    <option value="1280x544">1280x544 (21:9)</option>
                    <option value="544x1280">544x1280 (9:21)</option>
                    <option value="1088x832">1088x832 (4:3)</option>
                    <option value="832x1088">832x1088 (3:4)</option>
                    <option value="960x960">960x960 (1:1)</option>
                    <option value="1344x768">1344x768 (~16:9)</option>
                    <option value="768x1344">768x1344 (~9:16)</option>
                    <option value="768x768">768x768 (1:1)</option>
                  </optgroup>
                  <optgroup label="540p">
                    <option value="960x544">960x544 (16:9)</option>
                    <option value="544x960">544x960 (9:16)</option>
                  </optgroup>
                  <optgroup label="480p">
                    <option value="832x608">832x608 (4:3)</option>
                    <option value="608x832">608x832 (3:4)</option>
                    <option value="704x704">704x704 (1:1)</option>
                    <option value="832x480">832x480 (16:9)</option>
                    <option value="480x832">480x832 (9:16)</option>
                    <option value="544x544">544x544 (1:1)</option>
                  </optgroup>
                  <optgroup label="384p">
                    <option value="672x384">672x384 (16:9)</option>
                    <option value="384x672">384x672 (9:16)</option>
                    <option value="512x512">512x512 (1:1)</option>
                  </optgroup>
                  <optgroup label="320p">
                    <option value="576x320">576x320 (16:9)</option>
                    <option value="320x576">320x576 (9:16)</option>
                    <option value="448x448">448x448 (1:1)</option>
                  </optgroup>
                  <optgroup label="256p">
                    <option value="448x256">448x256 (7:4)</option>
                    <option value="256x448">256x448 (4:7)</option>
                    <option value="320x320">320x320 (1:1)</option>
                  </optgroup>
                </select>
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

            {/* Componentes Técnicos: Text Encoder y Video VAE */}
            <div className="space-y-3 p-4 bg-neutral-950/60 rounded-xl border border-neutral-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Encoders & Arquitectura (Minimax / Wan)
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Text Encoder */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Text Encoder
                    </label>
                    <AutoFillBadge field="textEncoder" />
                  </div>
                  <div className="relative">
                    <select
                      value={textEncoder || 'Not Found'}
                      onChange={e => setTextEncoder(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-blue-500/50 appearance-none font-sans"
                    >
                      {TEXT_ENCODER_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Video VAE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      Video VAE
                    </label>
                    <AutoFillBadge field="videoVae" />
                  </div>
                  <div className="relative">
                    <select
                      value={videoVae || 'Not Found'}
                      onChange={e => setVideoVae(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-purple-500/50 appearance-none font-sans"
                    >
                      {VIDEO_VAE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400">
                      ▼
                    </div>
                  </div>
                </div>
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
            {isSubmitting ? 'Guardando...' : (initialData ? 'Guardar Cambios' : 'Guardar Registro')}
          </button>
        </div>
      </div>
    </div>
  );
}
