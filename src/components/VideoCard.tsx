import { useState, useMemo } from 'react';
import { VideoRecord } from '../types';
import { Layers, Settings, Workflow, Target, PlaySquare, ExternalLink, Calendar, Hash, Clock, StickyNote, Tag, Trash2, Edit3, ChevronDown, ChevronUp, Copy, Check, Cpu, HardDrive, User, Sparkles, Gauge, SplitSquareVertical, ArrowLeftRight } from 'lucide-react';
import { formatBytes, extractCreationDateFromText, getGpuVendor, GPU_LOGOS, extractTechnicalDetails, getPlayableVideoUrl } from '../lib/utils';

interface VideoCardProps {
  video: VideoRecord;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onDeleteClick?: () => void;
  onEditClick?: () => void;
  onCompareClick?: () => void;
}

export function VideoCard({ video, selectionMode, isSelected, onToggleSelect, onDeleteClick, onEditClick, onCompareClick }: VideoCardProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isNegativeExpanded, setIsNegativeExpanded] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);
  
  // Persist technical details expanded state in localStorage (defaults to true for maximum visibility)
  const [showTechDetails, setShowTechDetails] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ai_vault_show_tech_details');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleTechDetails = () => {
    setShowTechDetails(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ai_vault_show_tech_details', String(next));
      } catch {}
      return next;
    });
  };

  const handleCopyPrompt = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(video.prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = video.prompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopyNegative = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!video.negativePrompt) return;
    try {
      await navigator.clipboard.writeText(video.negativePrompt);
      setCopiedNegative(true);
      setTimeout(() => setCopiedNegative(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = video.negativePrompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedNegative(true);
      setTimeout(() => setCopiedNegative(false), 2000);
    }
  };

  const creationFromFilename = extractCreationDateFromText(video.title) || 
    extractCreationDateFromText(video.videoUrl) ||
    extractCreationDateFromText(video.prompt);

  const formattedDate = video.createdAt
    ? (() => {
        const d = new Date(video.createdAt);
        if (isNaN(d.getTime())) return null;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : null;

  const displayCreationDate = creationFromFilename || formattedDate;

  const gpuVendor = getGpuVendor(video.hardware?.gpu);

  const fpsText = video.fps ? `${video.fps}` : null;

  const PROMPT_LIMIT = 150;
  const isPromptLong = video.prompt.length > PROMPT_LIMIT;
  const isNegativeLong = (video.negativePrompt?.length || 0) > PROMPT_LIMIT;

  // Resolve technical details dynamically (from fields or rawMetadata fallback)
  const resolvedTech = useMemo(() => {
    let textEnc = video.textEncoder && video.textEncoder !== 'Not Found' ? video.textEncoder : undefined;
    let vae = video.videoVae && video.videoVae !== 'Not Found' ? video.videoVae : undefined;
    let variant = video.modelVariant;
    let sizeB = video.modelSizeB;
    let precision = video.precision;

    if ((!textEnc || !vae || !variant || sizeB === undefined) && video.rawMetadata) {
      try {
        const parsed = typeof video.rawMetadata === 'string' ? JSON.parse(video.rawMetadata) : video.rawMetadata;
        const extracted = extractTechnicalDetails(
          parsed,
          typeof video.rawMetadata === 'string' ? video.rawMetadata : JSON.stringify(video.rawMetadata),
          parsed.model_type || parsed.type || ''
        );
        if (!textEnc && extracted.textEncoder !== 'Not Found') textEnc = extracted.textEncoder;
        if (!vae && extracted.videoVae !== 'Not Found') vae = extracted.videoVae;
        if (!variant && extracted.modelVariant) variant = extracted.modelVariant;
        if (sizeB === undefined && extracted.modelSizeB !== undefined) sizeB = extracted.modelSizeB;
        if (!precision && extracted.precision) precision = extracted.precision;
      } catch {}
    }

    return {
      textEncoder: textEnc,
      videoVae: vae,
      modelVariant: variant,
      modelSizeB: sizeB
    };
  }, [video.textEncoder, video.videoVae, video.modelVariant, video.modelSizeB, video.rawMetadata]);

  const hasTechDetails = Boolean(
    resolvedTech.textEncoder ||
    resolvedTech.videoVae ||
    (video.tags && video.tags.length > 0)
  );

  const mainHeadline = video.title || video.model || 'Vídeo sin título';
  const authorName = video.creatorDisplayName || video.createdBy;

  return (
    <div id={`video-card-${video.id}`} className={`flex flex-col lg:flex-row bg-neutral-900/60 border ${isSelected ? 'border-teal-500' : 'border-neutral-800'} rounded-2xl overflow-hidden hover:border-neutral-700 transition-all shadow-lg relative`}>
      {/* Zona de previsualización de vídeo amplia */}
      <div className="w-full lg:w-[540px] xl:w-[620px] shrink-0 bg-neutral-950 p-4 sm:p-6 flex flex-col justify-start border-b lg:border-b-0 lg:border-r border-neutral-800">
        
        {/* Barra superior encima del vídeo: Modelo, Parámetros B, Variante y Herramienta */}
        <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-semibold text-neutral-200 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 flex items-center gap-1.5 shadow-sm">
              <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="truncate">{video.model}</span>
            </span>

            {typeof (resolvedTech.modelSizeB ?? video.modelSizeB) === 'number' && (
              <span 
                className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/40 text-teal-300 shadow-sm"
                title={`Tamaño del modelo: ${resolvedTech.modelSizeB ?? video.modelSizeB}B parámetros`}
              >
                {resolvedTech.modelSizeB ?? video.modelSizeB}B
              </span>
            )}

            {(resolvedTech.modelVariant || video.modelVariant) && (
              <span 
                className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-950/50 border border-indigo-800/60 text-indigo-300 shadow-sm"
                title={`Variante del modelo: ${resolvedTech.modelVariant || video.modelVariant}`}
              >
                {resolvedTech.modelVariant || video.modelVariant}
              </span>
            )}
          </div>

          {video.localTool && (
            <span 
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-teal-300 shadow-sm shrink-0"
              title={`Herramienta de generación: ${video.localTool}`}
            >
              {video.localTool}
            </span>
          )}
        </div>

        {/* Contenedor del video */}
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800 flex items-center justify-center">
          {selectionMode && (
            <div className="absolute top-3 left-3 z-20">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="w-5 h-5 rounded border-neutral-700 text-teal-500 focus:ring-teal-500 bg-neutral-900 cursor-pointer shadow-md"
              />
            </div>
          )}

          <video 
            src={getPlayableVideoUrl(video)} 
            className="w-full h-full object-contain" 
            controls 
            preload="metadata"
          />
        </div>
        
        {/* Metadatos debajo del vídeo en rejilla 2x2 holgada y legible */}
        <div className="mt-3 p-3 bg-neutral-950/80 rounded-xl border border-neutral-800/90 text-xs text-neutral-300">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Fila 1 - Col 1: Autor (Badge RGB Gamer Style) */}
            {authorName ? (
              <div 
                className="relative p-[1.5px] rounded-lg overflow-hidden animate-rgb-glow shadow-md min-w-0"
                title={`Creado por: ${authorName}${video.createdBy && video.creatorDisplayName ? ` (${video.createdBy})` : ''}`}
              >
                <div className="flex items-center gap-2 px-2.5 py-1.5 h-[29px] rounded-[7px] bg-neutral-950/90 backdrop-blur-sm text-neutral-100 text-xs truncate">
                  <div className="w-4 h-4 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                    <User className="w-2.5 h-2.5 text-teal-300" />
                  </div>
                  <span className="truncate font-bold tracking-wide text-white font-mono">{authorName}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 h-8 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-500 text-xs">
                <User className="w-3.5 h-3.5 opacity-40 shrink-0" />
                <span>Anónimo</span>
              </div>
            )}

            {/* Fila 1 - Col 2: Tiempo de Render */}
            {video.renderSeconds !== undefined ? (
              <div 
                className="flex items-center gap-2 px-2.5 py-1.5 h-8 rounded-lg bg-neutral-900 border border-neutral-800 text-teal-400 text-xs font-medium font-mono truncate"
                title={`Tiempo de renderizado: ${Math.floor(video.renderSeconds / 60)}m ${Math.round(video.renderSeconds % 60)}s`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{Math.floor(video.renderSeconds / 60)}m {Math.round(video.renderSeconds % 60)}s</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 h-8 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-600 text-xs">
                <Clock className="w-3.5 h-3.5 shrink-0 opacity-40" />
                <span>Render N/D</span>
              </div>
            )}

            {/* Fila 2 - Col 1: Fecha / Hora (DD/MM/YYYY HH:MM) */}
            {displayCreationDate ? (
              <div 
                className="flex items-center gap-2 px-2.5 py-1.5 h-8 bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg font-mono truncate" 
                title={`Fecha y hora de creación: ${displayCreationDate}`}
              >
                <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="truncate">{displayCreationDate}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 h-8 bg-neutral-900 border border-neutral-800 text-neutral-600 text-xs rounded-lg">
                <Calendar className="w-3.5 h-3.5 shrink-0 opacity-40" />
                <span>Fecha N/D</span>
              </div>
            )}

            {/* Fila 2 - Col 2: Peso de archivo & Link Drive / Original */}
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 h-8 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
              <div className="flex items-center gap-1.5 text-neutral-200 font-mono truncate" title="Tamaño del archivo de vídeo">
                <HardDrive className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className="truncate">{video.fileSizeBytes ? formatBytes(video.fileSizeBytes) : 'Peso N/D'}</span>
              </div>
              <a
                href={video.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-teal-400 hover:text-teal-300 transition-colors font-medium text-xs ml-auto shrink-0 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700/60"
                title="Abrir vídeo en nueva pestaña"
              >
                Link <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Zona de datos técnicos */}
      <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          {/* Header con Titular Principal, Carpeta y Acciones */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                {/* Titular Principal */}
                <h2 
                  className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug break-words"
                  title={mainHeadline}
                >
                  {mainHeadline}
                </h2>

                {/* Carpeta */}
                {video.groupName && (
                  <div>
                    <span 
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-200 bg-neutral-950 px-2.5 py-0.5 rounded-md border border-neutral-800 shadow-sm"
                      title={`Carpeta: ${video.groupName}`}
                    >
                      📁 {video.groupName}
                    </span>
                  </div>
                )}
              </div>

              {/* Botones a la derecha: Toggle Detalles Técnicos y Acciones */}
              <div className="flex items-center gap-2 shrink-0">
                {hasTechDetails && (
                  <button
                    type="button"
                    onClick={handleToggleTechDetails}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      showTechDetails
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40 shadow-sm'
                        : 'bg-neutral-950/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                    }`}
                    title={showTechDetails ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Detalles técnicos</span>
                    {showTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}

                {/* Botones de acción */}
                {!selectionMode && (
                  <div className="flex items-center gap-1.5">
                    {onCompareClick && (
                      <button
                        onClick={onCompareClick}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/40 hover:border-teal-400/70 transition-all shadow-sm cursor-pointer active:scale-95"
                        title="Comparar 1 vs 1 (pantalla dividida con otro vídeo)"
                      >
                        <SplitSquareVertical className="w-3.5 h-3.5 text-teal-400" />
                        <span>Comparar 1 vs 1</span>
                      </button>
                    )}
                    {onEditClick && (
                      <button
                        onClick={onEditClick}
                        className="p-1.5 text-neutral-500 hover:text-teal-400 hover:bg-neutral-800 rounded-lg transition-colors border border-transparent hover:border-neutral-700 cursor-pointer"
                        title="Editar vídeo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {onDeleteClick && (
                      <button
                        onClick={onDeleteClick}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-900/50 cursor-pointer"
                        title="Borrar vídeo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sección desplegable de Detalles Técnicos */}
            {showTechDetails && hasTechDetails && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-neutral-950/70 rounded-xl border border-neutral-800/80 animate-in fade-in duration-150">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Sparkles className="w-3 h-3 text-teal-400" />
                  Info Técnica:
                </span>
                {resolvedTech.textEncoder && (
                  <span 
                    className="text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono bg-blue-950/40 border-blue-800/60 text-blue-300"
                    title={`Text Encoder: ${resolvedTech.textEncoder}`}
                  >
                    <span className="text-[10px] text-blue-400/70 font-sans uppercase">Encoder:</span>
                    {resolvedTech.textEncoder}
                  </span>
                )}
                {resolvedTech.videoVae && (
                  <span 
                    className="text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono bg-purple-950/40 border-purple-800/60 text-purple-300"
                    title={`Video VAE: ${resolvedTech.videoVae}`}
                  >
                    <span className="text-[10px] text-purple-400/70 font-sans uppercase">VAE:</span>
                    {resolvedTech.videoVae}
                  </span>
                )}
                {video.tags && video.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-auto">
                    {video.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 flex items-center gap-1"
                      >
                        <Tag className="w-2.5 h-2.5 text-teal-400" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                <PlaySquare className="w-3.5 h-3.5 text-teal-400" /> Prompt
              </h3>
              <button
                onClick={handleCopyPrompt}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  copiedPrompt
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60'
                }`}
                title="Copiar prompt completo al portapapeles"
              >
                {copiedPrompt ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-teal-400 animate-in zoom-in" />
                    <span className="font-semibold text-teal-300">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Copiar prompt</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800/80 relative group">
              <p className="text-neutral-200 text-sm sm:text-base leading-relaxed font-normal select-text whitespace-pre-wrap">
                {isPromptExpanded || !isPromptLong 
                  ? video.prompt 
                  : `${video.prompt.substring(0, PROMPT_LIMIT)}...`}
              </p>
              {isPromptLong && (
                <button 
                  onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                  className="mt-2 text-teal-500 hover:text-teal-400 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {isPromptExpanded ? (
                    <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" /> Ver más</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Negative Prompt si existe */}
          {video.negativePrompt && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h4 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Negative Prompt
                </h4>
                <button
                  onClick={handleCopyNegative}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    copiedNegative
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                  title="Copiar negative prompt"
                >
                  {copiedNegative ? (
                    <>
                      <Check className="w-3 h-3 text-teal-400" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-neutral-500" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-neutral-950/40 p-3 rounded-lg border border-neutral-800/60">
                <p className="text-neutral-400 text-xs leading-relaxed italic select-text whitespace-pre-wrap">
                  {isNegativeExpanded || !isNegativeLong
                    ? video.negativePrompt 
                    : `${video.negativePrompt.substring(0, PROMPT_LIMIT)}...`}
                </p>
                {isNegativeLong && (
                  <button 
                    onClick={() => setIsNegativeExpanded(!isNegativeExpanded)}
                    className="mt-1.5 text-neutral-400 hover:text-neutral-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    {isNegativeExpanded ? 'Menos' : 'Más...'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Métricas técnicas */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-blue-950/20 border border-blue-900/30">
              <span className="text-[11px] text-blue-500/80 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-400" /> Resolución
              </span>
              <span className="text-xs sm:text-sm font-semibold text-blue-100 font-mono">
                {video.width}x{video.height}
              </span>
            </div>
            
            <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-violet-950/20 border border-violet-900/30">
              <span className="text-[11px] text-violet-500/80 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-violet-400" /> Proporción
              </span>
              <span className="text-xs sm:text-sm font-semibold text-violet-100 font-mono">
                {video.orientation}
              </span>
            </div>

            <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
              <span className="text-[11px] text-emerald-500/80 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-emerald-400" /> Steps
              </span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-100 font-mono">{video.steps}</span>
            </div>

            <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/30">
              <span className="text-[11px] text-amber-500/80 flex items-center gap-1.5">
                <Workflow className="w-3.5 h-3.5 text-amber-400" /> Shift
              </span>
              <span className="text-xs sm:text-sm font-semibold text-amber-100 font-mono">
                {video.shift !== undefined ? video.shift : '—'}
              </span>
            </div>

            <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/30">
              <span className="text-[11px] text-rose-500/80 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-rose-400" /> Seed
              </span>
              <span className="text-xs sm:text-sm font-semibold text-rose-100 font-mono truncate" title={String(video.seed || '')}>
                {video.seed !== undefined ? video.seed : '—'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 px-0.5">
            {/* Hardware / Tarjeta Gráfica */}
            {video.hardware && (
              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                  gpuVendor === 'nvidia'
                    ? 'bg-[#76b900]/10 border-[#76b900]/35 text-[#8ed800]' 
                    : gpuVendor === 'amd'
                    ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                    : 'bg-indigo-950/40 border-indigo-900/50 text-indigo-300'
                }`}
                title={`GPU: ${video.hardware.gpu} • ${video.hardware.vram}GB VRAM • ${video.hardware.ram}GB RAM`}
              >
                {gpuVendor === 'nvidia' ? (
                  <img src={GPU_LOGOS.nvidia} alt="NVIDIA" className="w-4 h-4 object-contain shrink-0" referrerPolicy="no-referrer" />
                ) : gpuVendor === 'amd' ? (
                  <img src={GPU_LOGOS.amd} alt="AMD" className="w-4 h-4 object-contain shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <Cpu className="w-4 h-4 shrink-0" />
                )}
                <span className="font-mono font-bold text-xs">{video.hardware.gpu}</span>
                <span className="text-[11px] opacity-80 font-mono">({video.hardware.vram}G VRAM / {video.hardware.ram}G RAM)</span>
              </div>
            )}

            {fpsText && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-neutral-400">FPS:</span>
                <span className="text-neutral-200 font-medium font-mono">{fpsText}</span>
              </div>
            )}
          </div>

          {/* LoRAs */}
          {video.loras && video.loras.length > 0 && (
            <div className="pt-3 border-t border-neutral-800/60">
              <span className="text-xs font-medium text-neutral-500 mb-2 block uppercase tracking-wider">
                LoRAs Aplicados ({video.loras.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {video.loras.map((lora, idx) => (
                  <span
                    key={idx}
                    className="text-xs text-teal-300 bg-teal-950/50 border border-teal-800/60 px-3 py-1 rounded-full flex items-center gap-2"
                  >
                    <span className="font-medium">{lora.name}</span>
                    <span className="text-[11px] px-1.5 py-0.2 bg-teal-900/60 rounded text-teal-200 font-mono">
                      peso: {lora.weight}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notas */}
          {video.notes && (
            <div className="pt-2 flex items-start gap-2 text-xs text-neutral-400 bg-neutral-950/40 p-3 rounded-lg border border-neutral-800/50">
              <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{video.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}