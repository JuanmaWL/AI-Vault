import { useState } from 'react';
import { VideoRecord } from '../types';
import { DriveVideoPlayer } from './DriveVideoPlayer';
import { Layers, Settings, Workflow, Target, PlaySquare, ExternalLink, Calendar, Hash, Clock, StickyNote, Tag, Trash2, Edit3, ChevronDown, ChevronUp, Copy, Cpu, HardDrive, User, Sparkles, Gauge, SplitSquareVertical } from 'lucide-react';
import { formatBytes } from '../lib/utils';

interface VideoCardProps {
  video: VideoRecord;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onDeleteClick?: () => void;
  onEditClick?: () => void;
  onDuplicateClick?: () => void;
  onCompareClick?: () => void;
}

export function VideoCard({ video, selectionMode, isSelected, onToggleSelect, onDeleteClick, onEditClick, onDuplicateClick, onCompareClick }: VideoCardProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isNegativeExpanded, setIsNegativeExpanded] = useState(false);

  const formattedDate = video.createdAt
    ? new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(video.createdAt))
    : null;

  const fpsText = video.fps ? `${video.fps}` : null;

  const PROMPT_LIMIT = 150;
  const isPromptLong = video.prompt.length > PROMPT_LIMIT;
  const isNegativeLong = (video.negativePrompt?.length || 0) > PROMPT_LIMIT;

  return (
    <div id={`video-card-${video.id}`} className={`flex flex-col lg:flex-row bg-neutral-900/60 border ${isSelected ? 'border-teal-500' : 'border-neutral-800'} rounded-2xl overflow-hidden hover:border-neutral-700 transition-all shadow-lg relative`}>
      {/* Zona de previsualización de vídeo amplia */}
      <div className="w-full lg:w-[540px] xl:w-[620px] shrink-0 bg-neutral-950 p-4 sm:p-6 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-neutral-800">
        
        {selectionMode && (
          <div className="absolute top-4 left-4 z-10">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="w-5 h-5 rounded border-neutral-700 text-teal-500 focus:ring-teal-500 bg-neutral-900 cursor-pointer shadow-md"
            />
          </div>
        )}

        {video.driveFileId ? (
          <DriveVideoPlayer url={video.videoUrl} driveFileId={video.driveFileId} className="shadow-2xl" />
        ) : (
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800 flex items-center justify-center">
            <video 
              src={video.videoUrl} 
              className="w-full h-full object-contain" 
              controls 
              preload="metadata"
            />
          </div>
        )}
        
        <div className="mt-3 p-3 bg-neutral-950/70 rounded-xl border border-neutral-800/90 text-xs text-neutral-300">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Columna 1: Usuario & Hardware */}
            <div className="flex flex-col gap-1.5 min-w-0">
              {/* Nick / Autor */}
              {(video.creatorDisplayName || video.createdBy) ? (
                <div 
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 text-[11px] font-medium"
                  title={`Creado por: ${video.creatorDisplayName || video.createdBy}${video.createdBy && video.creatorDisplayName ? ` (${video.createdBy})` : ''}`}
                >
                  <User className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="truncate">{video.creatorDisplayName || video.createdBy}</span>
                </div>
              ) : formattedDate ? (
                <div className="flex items-center gap-1.5 px-2 py-1 text-neutral-500 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{formattedDate}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 text-neutral-600 text-[11px]">
                  <User className="w-3.5 h-3.5 shrink-0 opacity-40" />
                  <span>Anónimo</span>
                </div>
              )}

              {/* GPU & Memoria */}
              {video.hardware ? (
                <div 
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium ${
                    video.hardware.gpu.toLowerCase().includes('rtx') || video.hardware.gpu.toLowerCase().includes('nvidia') || video.hardware.gpu.toLowerCase().includes('gtx')
                      ? 'bg-[#76b900]/10 border-[#76b900]/30 text-[#76b900]' 
                      : 'bg-indigo-950/40 border-indigo-900/50 text-indigo-300'
                  }`}
                  title={`${video.hardware.gpu} • ${video.hardware.vram}GB VRAM • ${video.hardware.ram}GB RAM`}
                >
                  {(video.hardware.gpu.toLowerCase().includes('rtx') || video.hardware.gpu.toLowerCase().includes('nvidia') || video.hardware.gpu.toLowerCase().includes('gtx')) ? (
                    <span className="font-black italic text-[9px] tracking-wider shrink-0">NV</span>
                  ) : (
                    <Cpu className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate font-mono">
                    {video.hardware.gpu} <span className="opacity-75 text-[10px]">({video.hardware.vram}G/{video.hardware.ram}G)</span>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 text-neutral-600 text-[11px]">
                  <Cpu className="w-3.5 h-3.5 shrink-0 opacity-40" />
                  <span>HW no reg.</span>
                </div>
              )}
            </div>

            {/* Columna 2: Render Time, Peso de archivo & Link */}
            <div className="flex flex-col gap-1.5 min-w-0">
              {/* Render Time */}
              {video.renderSeconds !== undefined ? (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-teal-400 text-[11px] font-medium font-mono">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{Math.floor(video.renderSeconds / 60)}m {Math.round(video.renderSeconds % 60)}s render</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 text-neutral-600 text-[11px]">
                  <Clock className="w-3.5 h-3.5 shrink-0 opacity-40" />
                  <span>Render N/D</span>
                </div>
              )}

              {/* Peso & Enlace Drive / Original */}
              <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-[11px]">
                <div className="flex items-center gap-1.5 text-neutral-300 font-mono truncate">
                  <HardDrive className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span>{video.fileSizeBytes ? formatBytes(video.fileSizeBytes) : 'N/D'}</span>
                </div>
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-teal-400 hover:text-teal-300 transition-colors font-medium text-[10px] ml-auto shrink-0"
                >
                  {video.driveFileId ? 'Drive' : 'Link'} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zona de datos técnicos */}
      <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          {/* Header con Modelo y Source */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                {video.model}
              </span>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  video.source === 'local'
                    ? 'bg-teal-950/60 border-teal-800 text-teal-300'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                }`}
              >
                {video.source === 'local' ? 'Local (Wan2GP)' : 'Cloud'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Badges Técnicos Específicos */}
              {(video.textEncoder || video.videoVae) && (
                <div className="flex flex-wrap gap-1.5">
                  {video.textEncoder && (
                    <span 
                      className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono ${
                        video.textEncoder === 'Not Found'
                          ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400'
                          : 'bg-blue-950/40 border-blue-800/60 text-blue-300'
                      }`}
                      title={`Text Encoder: ${video.textEncoder}`}
                    >
                      <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                      <span className="text-[10px] text-blue-400/70 font-sans uppercase">Text:</span>
                      {video.textEncoder}
                    </span>
                  )}
                  {video.videoVae && (
                    <span 
                      className={`text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono ${
                        video.videoVae === 'Not Found'
                          ? 'bg-neutral-800/60 border-neutral-700 text-neutral-400'
                          : 'bg-purple-950/40 border-purple-800/60 text-purple-300'
                      }`}
                      title={`Video VAE: ${video.videoVae}`}
                    >
                      <Cpu className="w-2.5 h-2.5 text-purple-400" />
                      <span className="text-[10px] text-purple-400/70 font-sans uppercase">Video:</span>
                      {video.videoVae}
                    </span>
                  )}
                </div>
              )}

              {/* Badges de Tags */}
              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {video.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-400 flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Botones de acción */}
              {!selectionMode && (
                <div className="flex items-center gap-1">
                  {onCompareClick && (
                    <button
                      onClick={onCompareClick}
                      className="p-1.5 text-neutral-500 hover:text-teal-400 hover:bg-teal-950/30 rounded-lg transition-colors border border-transparent hover:border-teal-900/50"
                      title="Comparar este vídeo (1 vs 1)"
                    >
                      <SplitSquareVertical className="w-4 h-4" />
                    </button>
                  )}
                  {onDuplicateClick && (
                    <button
                      onClick={onDuplicateClick}
                      className="p-1.5 text-neutral-500 hover:text-teal-400 hover:bg-teal-950/30 rounded-lg transition-colors border border-transparent hover:border-teal-900/50"
                      title="Duplicar vídeo"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                  {onEditClick && (
                    <button
                      onClick={onEditClick}
                      className="p-1.5 text-neutral-500 hover:text-teal-400 hover:bg-teal-950/30 rounded-lg transition-colors border border-transparent hover:border-teal-900/50"
                      title="Editar vídeo"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteClick && (
                    <button
                      onClick={onDeleteClick}
                      className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-900/50"
                      title="Borrar vídeo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 mb-2">
              <PlaySquare className="w-3.5 h-3.5 text-teal-400" /> Prompt
            </h3>
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800/80">
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
              <h4 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                Negative Prompt
              </h4>
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

          <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 px-1">
            {fpsText && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>FPS:</span>
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