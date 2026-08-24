import { useState } from 'react';
import { VideoRecord } from '../types';
import { DriveVideoPlayer } from './DriveVideoPlayer';
import { Copy, Check, Sparkles, Edit3, Trash2, Clock, Cpu, User, Tag, ExternalLink } from 'lucide-react';

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

  const mainHeadline = video.title || video.model || 'Vídeo sin título';

  return (
    <div
      id={`video-grid-card-${video.id}`}
      className={`group flex flex-col bg-neutral-900/60 border ${
        isSelected ? 'border-teal-500 ring-1 ring-teal-500/50' : 'border-neutral-800'
      } rounded-2xl overflow-hidden hover:border-neutral-700 transition-all shadow-md hover:shadow-xl hover:bg-neutral-900/80 relative`}
    >
      {/* Zona de vídeo con badges superpuestos */}
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

        {video.driveFileId ? (
          <DriveVideoPlayer url={video.videoUrl} driveFileId={video.driveFileId} className="w-full h-full min-h-0 aspect-auto rounded-none border-0" />
        ) : (
          <video
            src={video.videoUrl}
            className="w-full h-full object-contain"
            controls
            preload="metadata"
          />
        )}

        {/* Badges superiores sobre el video o flotantes */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10 pointer-events-none">
          {video.groupName && (
            <span className="px-2 py-0.5 rounded-full bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 text-[10px] font-semibold text-neutral-300 shadow-sm">
              📁 {video.groupName}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 text-[10px] font-semibold text-teal-300 font-mono shadow-sm">
            {video.width}x{video.height}
          </span>
        </div>
      </div>

      {/* Contenido de la tarjeta */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 gap-3">
        {/* Cabecera: Título y Modelo */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-bold text-neutral-100 text-sm truncate" title={mainHeadline}>
              {mainHeadline}
            </h4>
            {video.modelVariant && (
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[10px] font-mono text-neutral-300">
                {video.modelVariant}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
            <span className="px-2 py-0.5 rounded-md bg-teal-950/60 border border-teal-900/80 text-teal-300 font-semibold text-[11px]">
              {video.model}
            </span>
            {video.modelSizeB !== undefined && (
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/70 text-cyan-300 font-mono text-[10px] font-bold">
                {video.modelSizeB}B
              </span>
            )}
            {video.source && (
              <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-[10px] text-neutral-400">
                {video.source === 'local' ? 'Local' : 'Cloud'}
              </span>
            )}
          </div>
        </div>

        {/* Prompt comprimido con botón de copiar */}
        <div className="relative group/prompt bg-neutral-950/80 border border-neutral-850 rounded-xl p-2.5 text-xs text-neutral-300">
          <p className="line-clamp-2 text-neutral-300 text-[11px] leading-relaxed select-text" title={video.prompt}>
            {video.prompt}
          </p>
          <button
            onClick={handleCopyPrompt}
            className="absolute top-1.5 right-1.5 p-1 rounded bg-neutral-800/90 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 opacity-0 group-hover/prompt:opacity-100 transition-all cursor-pointer shadow"
            title="Copiar prompt completo"
          >
            {copiedPrompt ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        {/* Parámetros de generación clave */}
        <div className="grid grid-cols-3 gap-1.5 py-1.5 text-center bg-neutral-950/60 rounded-lg border border-neutral-850/80 text-[10px] text-neutral-400 font-mono">
          <div>
            <span className="text-neutral-500 block text-[9px] uppercase tracking-wider">Pasos</span>
            <span className="text-neutral-200 font-bold">{video.steps}</span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[9px] uppercase tracking-wider">Seed</span>
            <span className="text-neutral-200 font-bold truncate block px-1" title={String(video.seed ?? '—')}>
              {video.seed !== undefined ? video.seed : '—'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block text-[9px] uppercase tracking-wider">Tiempo</span>
            <span className="text-teal-400 font-bold">
              {video.renderSeconds !== undefined
                ? `${Math.floor(video.renderSeconds / 60)}m ${Math.round(video.renderSeconds % 60)}s`
                : 'N/D'}
            </span>
          </div>
        </div>

        {/* LoRAs si existen */}
        {video.loras && video.loras.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {video.loras.map((lora, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded bg-teal-950/40 border border-teal-900/50 text-teal-300 text-[10px] font-mono truncate max-w-[150px]"
                title={`${lora.name} (Peso: ${lora.weight})`}
              >
                🧩 {lora.name} ({lora.weight})
              </span>
            ))}
          </div>
        )}

        {/* Footer de la tarjeta con autor, GPU y acciones */}
        <div className="mt-auto pt-2.5 border-t border-neutral-850 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[11px] truncate">
            {video.creatorDisplayName || video.createdBy ? (
              <span className="truncate flex items-center gap-1">
                <User className="w-3 h-3 text-teal-400 shrink-0" />
                <span className="truncate">{video.creatorDisplayName || video.createdBy}</span>
              </span>
            ) : video.hardware ? (
              <span className="truncate flex items-center gap-1 text-[#76b900]">
                <Cpu className="w-3 h-3 shrink-0" />
                <span className="truncate font-mono text-[10px]">{video.hardware.gpu}</span>
              </span>
            ) : (
              <span className="text-neutral-600 text-[10px]">Anónimo</span>
            )}
          </div>

          {/* Botonera de acciones */}
          <div className="flex items-center gap-1 shrink-0">
            {onCompareClick && (
              <button
                onClick={onCompareClick}
                className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 transition-colors cursor-pointer"
                title="Comparar este vídeo"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
            {onEditClick && (
              <button
                onClick={onEditClick}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Editar registro"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteClick && (
              <button
                onClick={onDeleteClick}
                className="p-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 hover:text-rose-300 border border-rose-900/40 transition-colors cursor-pointer"
                title="Eliminar vídeo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
