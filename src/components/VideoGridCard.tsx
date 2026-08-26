import { useState, useMemo } from 'react';
import { VideoRecord } from '../types';
import { Copy, Check, Sparkles, Edit3, Trash2, Clock, Cpu, User, Tag, ExternalLink, Calendar, SplitSquareVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { extractCreationDateFromText, getGpuVendor, GPU_LOGOS, SOFTWARE_ICONS, extractTechnicalDetails, getPlayableVideoUrl } from '../lib/utils';

interface VideoGridCardProps {
  video: VideoRecord;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onDeleteClick?: () => void;
  onEditClick?: () => void;
  onCompareClick?: () => void;
}

export function VideoGridCard({
  video,
  selectionMode,
  isSelected,
  onToggleSelect,
  onDeleteClick,
  onEditClick,
  onCompareClick,
}: VideoGridCardProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);

  const handleCopyPrompt = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(video.prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
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

  // Resolve technical details dynamically
  const resolvedTech = useMemo(() => {
    let textEnc = video.textEncoder && video.textEncoder !== 'Not Found' ? video.textEncoder : undefined;
    let vae = video.videoVae && video.videoVae !== 'Not Found' ? video.videoVae : undefined;
    let variant = video.modelVariant;
    let sizeB = video.modelSizeB;
    let softwareSource = video.softwareSource;
    let localTool = video.localTool;

    if ((!textEnc || !vae || !variant || sizeB === undefined || !softwareSource || !localTool) && video.rawMetadata) {
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
        if (extracted.softwareSource) {
          softwareSource = extracted.softwareSource;
          localTool = extracted.localTool;
        }
      } catch {}
    }

    const effectiveSoftware = softwareSource || (localTool?.toLowerCase().includes('maestro') ? 'maestro' : (localTool?.toLowerCase().includes('comfy') ? 'comfyui' : 'wan2gp'));
    const displayToolName = effectiveSoftware === 'maestro' ? 'Maestro' : (effectiveSoftware === 'comfyui' ? 'ComfyUI' : (localTool || 'Wan2GP'));

    return {
      textEncoder: textEnc,
      videoVae: vae,
      modelVariant: variant,
      modelSizeB: sizeB,
      softwareSource: effectiveSoftware,
      displayToolName,
    };
  }, [video.textEncoder, video.videoVae, video.modelVariant, video.modelSizeB, video.softwareSource, video.localTool, video.rawMetadata]);

  const mainHeadline = video.title || video.model || 'Vídeo sin título';
  const authorName = video.creatorDisplayName || video.createdBy;

  return (
    <div
      id={`video-grid-card-${video.id}`}
      className={`group flex flex-col bg-neutral-900/70 border ${
        isSelected ? 'border-teal-500 ring-1 ring-teal-500/50' : 'border-neutral-800'
      } rounded-2xl overflow-hidden hover:border-neutral-700 transition-all shadow-md hover:shadow-xl hover:bg-neutral-900/90 relative`}
    >
      {/* Zona de vídeo */}
      <div className="relative w-full bg-neutral-950 aspect-video flex items-center justify-center overflow-hidden border-b border-neutral-800/80">
        {selectionMode && (
          <div className="absolute top-2.5 left-2.5 z-20">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-4 h-4 rounded border-neutral-700 text-teal-500 focus:ring-teal-500 bg-neutral-900 cursor-pointer shadow-md"
            />
          </div>
        )}

        {/* Badge flotante en la esquina superior derecha del thumbnail para software (Maestro / Wan2GP) */}
        <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
          {resolvedTech.softwareSource === 'maestro' ? (
            <span 
              className="px-2 py-0.5 rounded-md bg-amber-500/95 border border-amber-400/80 text-neutral-950 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-lg backdrop-blur-sm"
              title="Generado con Maestro"
            >
              <img 
                src={SOFTWARE_ICONS.maestro} 
                alt="Maestro" 
                className="w-3 h-3 object-contain shrink-0" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <span>{resolvedTech.displayToolName || 'Maestro'}</span>
            </span>
          ) : resolvedTech.softwareSource === 'comfyui' ? (
            <span 
              className="px-2 py-0.5 rounded-md bg-purple-600/90 border border-purple-400/80 text-white font-bold text-[10px] shadow-lg backdrop-blur-sm flex items-center gap-1"
              title="Generado con ComfyUI"
            >
              <Cpu className="w-3 h-3 text-purple-200" />
              <span>{resolvedTech.displayToolName || 'ComfyUI'}</span>
            </span>
          ) : (
            <span 
              className="px-2 py-0.5 rounded-md bg-indigo-600/90 border border-indigo-400/80 text-white font-bold text-[10px] shadow-lg backdrop-blur-sm flex items-center gap-1.5"
              title={`Herramienta: ${resolvedTech.displayToolName || 'Wan2GP'}`}
            >
              <img 
                src={SOFTWARE_ICONS.wan2gp} 
                alt="Wan2GP" 
                className="w-3 h-3 object-contain shrink-0" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <span>{resolvedTech.displayToolName || 'Wan2GP'}</span>
            </span>
          )}
        </div>

        <video
          src={getPlayableVideoUrl(video)}
          className="w-full h-full object-contain"
          controls
          preload="metadata"
        />
      </div>

      {/* Contenido de la tarjeta */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 gap-3">
        {/* Cabecera: Título, Carpeta y Modelo */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h4 className="font-bold text-neutral-100 text-sm sm:text-base truncate" title={mainHeadline}>
              {mainHeadline}
            </h4>
            {(resolvedTech.modelVariant || video.modelVariant) && (
              <span className="shrink-0 px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-xs font-mono text-neutral-300 font-semibold">
                {resolvedTech.modelVariant || video.modelVariant}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            {video.groupName && (
              <span className="px-2.5 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs font-medium" title={`Carpeta: ${video.groupName}`}>
                📁 {video.groupName}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-md bg-teal-950/60 border border-teal-900/80 text-teal-300 font-semibold text-xs">
              {video.model}
            </span>
            {(resolvedTech.modelSizeB !== undefined || video.modelSizeB !== undefined) && (
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/70 text-cyan-300 font-mono text-xs font-bold">
                {resolvedTech.modelSizeB ?? video.modelSizeB}B
              </span>
            )}
            {resolvedTech.softwareSource === 'maestro' ? (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-xs">
                <img 
                  src={SOFTWARE_ICONS.maestro} 
                  alt="Maestro" 
                  className="w-3 h-3 object-contain shrink-0" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <span>{resolvedTech.displayToolName || 'Maestro'}</span>
              </span>
            ) : resolvedTech.softwareSource === 'comfyui' ? (
              <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/40 text-purple-300 font-semibold text-xs flex items-center gap-1.5 shadow-xs">
                <Cpu className="w-3 h-3 text-purple-400" />
                <span>{resolvedTech.displayToolName || 'ComfyUI'}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center gap-1.5 shadow-xs">
                <img 
                  src={SOFTWARE_ICONS.wan2gp} 
                  alt="Wan2GP" 
                  className="w-3 h-3 object-contain shrink-0" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <span>{resolvedTech.displayToolName || 'Wan2GP'}</span>
              </span>
            )}
            {resolvedTech.textEncoder && (
              <span 
                className="px-2 py-0.5 rounded-md bg-blue-950/50 border border-blue-800/60 text-blue-300 font-mono text-[11px]"
                title={`Text Encoder: ${resolvedTech.textEncoder}`}
              >
                {resolvedTech.textEncoder}
              </span>
            )}
            {resolvedTech.videoVae && (
              <span 
                className="px-2 py-0.5 rounded-md bg-purple-950/50 border border-purple-800/60 text-purple-300 font-mono text-[11px]"
                title={`Video VAE: ${resolvedTech.videoVae}`}
              >
                {resolvedTech.videoVae}
              </span>
            )}
          </div>
        </div>

        {/* Prompt colapsable / desplegable */}
        <div className="bg-neutral-950/80 border border-neutral-850 rounded-xl p-3 text-xs text-neutral-300">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <button
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="text-xs uppercase font-bold text-neutral-400 hover:text-teal-400 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Prompt</span>
              {isPromptExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleCopyPrompt}
              className="p-1.5 rounded-md bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-teal-300 transition-colors cursor-pointer"
              title="Copiar prompt"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          {isPromptExpanded ? (
            <p className="text-neutral-200 text-xs sm:text-[13px] leading-relaxed select-text whitespace-pre-wrap">
              {video.prompt}
            </p>
          ) : (
            <p className="line-clamp-2 text-neutral-300 text-xs sm:text-[13px] leading-relaxed select-text">
              {video.prompt}
            </p>
          )}
        </div>

        {/* Parámetros de generación clave */}
        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 text-center bg-neutral-950/80 rounded-xl border border-neutral-800 text-neutral-400 font-mono shadow-inner">
          <div className="flex flex-col items-center justify-center">
            <span className="text-neutral-400 block text-[11px] sm:text-xs uppercase font-bold tracking-wider mb-0.5">Pasos</span>
            <span className="text-neutral-100 text-sm sm:text-base font-bold">{video.steps}</span>
          </div>
          <div className="flex flex-col items-center justify-center border-x border-neutral-800/80 px-1">
            <span className="text-neutral-400 block text-[11px] sm:text-xs uppercase font-bold tracking-wider mb-0.5">Seed</span>
            <span className="text-neutral-100 text-sm sm:text-base font-bold truncate block w-full px-1" title={String(video.seed ?? '—')}>
              {video.seed !== undefined ? video.seed : '—'}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-neutral-400 block text-[11px] sm:text-xs uppercase font-bold tracking-wider mb-0.5">Tiempo</span>
            <span className="text-teal-400 text-sm sm:text-base font-bold">
              {video.renderSeconds !== undefined
                ? `${Math.floor(video.renderSeconds / 60)}m ${Math.round(video.renderSeconds % 60)}s`
                : 'N/D'}
            </span>
          </div>
        </div>

        {/* LoRAs si existen */}
        {video.loras && video.loras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {video.loras.map((lora, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-lg bg-teal-950/50 border border-teal-800/60 text-teal-300 text-xs font-mono truncate max-w-full flex items-center gap-1.5 font-medium"
                title={`${lora.name} (Peso: ${lora.weight})`}
              >
                <span>🧩</span>
                <span className="truncate">{lora.name}</span>
                <span className="px-1.5 py-0.2 bg-teal-900/60 rounded text-teal-200 text-[11px] font-bold">({lora.weight})</span>
              </span>
            ))}
          </div>
        )}

        {/* Footer de la tarjeta con autor, fecha, GPU y acciones */}
        <div className="mt-auto pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            {/* Autor y Fecha */}
            <div className="flex items-center gap-2 text-xs truncate">
              {authorName ? (
                <div 
                  className="relative p-[1px] rounded-md overflow-hidden animate-rgb-glow shadow-xs shrink-0 max-w-[130px]"
                  title={`Creado por: ${authorName}`}
                >
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] bg-neutral-950/90 text-white font-bold text-[11px] font-mono truncate">
                    <User className="w-3 h-3 text-teal-300 shrink-0" />
                    <span className="truncate">{authorName}</span>
                  </span>
                </div>
              ) : null}
              {displayCreationDate && (
                <span className="flex items-center gap-1 text-neutral-400 font-mono text-xs truncate" title={`Fecha de creación: ${displayCreationDate}`}>
                  <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span className="truncate">{displayCreationDate}</span>
                </span>
              )}
            </div>

            {/* Hardware badge with logo */}
            {video.hardware && (
              <div 
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs w-fit max-w-full font-mono font-medium ${
                  gpuVendor === 'nvidia'
                    ? 'bg-[#76b900]/10 border-[#76b900]/30 text-[#8ed800]'
                    : gpuVendor === 'amd'
                    ? 'bg-rose-950/40 border-rose-850/50 text-rose-300'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                }`}
                title={`${video.hardware.gpu} (${video.hardware.vram}G VRAM / ${video.hardware.ram}G RAM)`}
              >
                {gpuVendor === 'nvidia' ? (
                  <img src={GPU_LOGOS.nvidia} alt="NVIDIA" className="w-4 h-4 object-contain shrink-0" referrerPolicy="no-referrer" />
                ) : gpuVendor === 'amd' ? (
                  <img src={GPU_LOGOS.amd} alt="AMD" className="w-4 h-4 object-contain shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate font-semibold">{video.hardware.gpu}</span>
              </div>
            )}
          </div>

          {/* Botonera de acciones */}
          <div className="flex items-center gap-1.5 shrink-0 self-end">
            {onCompareClick && (
              <button
                onClick={onCompareClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 hover:text-violet-200 border border-violet-500/40 hover:border-violet-400/60 transition-colors cursor-pointer text-xs font-bold shadow-sm active:scale-95"
                title="Comparar 1 vs 1 (pantalla dividida con otro vídeo)"
              >
                <SplitSquareVertical className="w-4 h-4 text-violet-400" />
                <span>1 vs 1</span>
              </button>
            )}
            {onEditClick && (
              <button
                onClick={onEditClick}
                className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Editar registro"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {onDeleteClick && (
              <button
                onClick={onDeleteClick}
                className="p-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 hover:text-rose-300 border border-rose-900/40 transition-colors cursor-pointer"
                title="Eliminar vídeo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
