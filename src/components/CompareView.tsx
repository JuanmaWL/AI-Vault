import { useState, useRef, useEffect } from 'react';
import { VideoRecord } from '../types';
import { Play, Pause, Volume2, VolumeX, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface CompareViewProps {
  videos: VideoRecord[];
  sharedPrompt: string | null;
}

type GridSize = 'compact' | 'medium' | 'large';

export function CompareView({ videos, sharedPrompt }: CompareViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Seleccionar todos por defecto al cambiar la lista de videos filtrados
  useEffect(() => {
    setSelectedIds(new Set(videos.map(v => v.id!)));
  }, [videos]);

  // Atajo de teclado (Barra espaciadora) para Reproducir/Pausar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' && 
        e.target instanceof HTMLElement && 
        e.target.tagName !== 'INPUT' && 
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        if (isPlaying) handlePauseAll();
        else handlePlayAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedIds]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handlePlayAll = async () => {
    const vids = Array.from(selectedIds)
      .map(id => videoRefs.current.get(id))
      .filter(Boolean) as HTMLVideoElement[];
    
    // Asegurar que los vídeos tienen metadatos cargados antes de sincronizar
    await Promise.all(vids.map(vid => {
      return new Promise<void>(resolve => {
        if (vid.readyState >= 1) { // HAVE_METADATA
          resolve();
        } else {
          const onLoaded = () => { 
            vid.removeEventListener('loadedmetadata', onLoaded); 
            resolve(); 
          };
          vid.addEventListener('loadedmetadata', onLoaded);
          vid.load(); // Forzar carga
        }
      });
    }));

    vids.forEach(vid => vid.currentTime = 0);
    await Promise.all(vids.map(vid => vid.play().catch(e => console.warn('Autoplay bloqueado', e))));
    setIsPlaying(true);
  };

  const handlePauseAll = () => {
    const vids = Array.from(selectedIds)
      .map(id => videoRefs.current.get(id))
      .filter(Boolean) as HTMLVideoElement[];
    vids.forEach(vid => vid.pause());
    setIsPlaying(false);
  };

  const toggleMuteAll = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    Array.from(videoRefs.current.values()).forEach(vid => {
      vid.muted = newMuted;
    });
  };

  const gridClass = {
    compact: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
    medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    large: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
  }[gridSize];

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] text-center">
        <h3 className="text-xl font-semibold text-neutral-300 mb-2">No hay vídeos para comparar</h3>
        <p className="text-neutral-500">Ajusta los filtros para ver resultados.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Prompt Compartido Colapsable */}
      {sharedPrompt && (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setPromptExpanded(!promptExpanded)}>
            <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-2">
              Prompt Compartido
            </h3>
            <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
              {promptExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          {promptExpanded && (
            <div className="mt-3 text-sm text-neutral-300 font-mono whitespace-pre-wrap bg-neutral-950 p-4 rounded-lg border border-neutral-800/50 max-h-64 overflow-y-auto">
              {sharedPrompt}
            </div>
          )}
        </div>
      )}

      {/* Barra de Controles Fija */}
      <div className="sticky top-4 z-20 bg-neutral-950/90 backdrop-blur-md border border-neutral-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handlePlayAll} className="flex items-center gap-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Play className="w-4 h-4 fill-current" /> <span className="hidden sm:inline">Reproducir todos</span>
          </button>
          <button onClick={handlePauseAll} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Pause className="w-4 h-4 fill-current" /> <span className="hidden sm:inline">Pausar todos</span>
          </button>
          <button onClick={toggleMuteAll} className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors ml-1 sm:ml-2" title={isMuted ? "Activar sonido" : "Silenciar"}>
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          {(['compact', 'medium', 'large'] as GridSize[]).map(size => (
            <button
              key={size}
              onClick={() => setGridSize(size)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${gridSize === size ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {size === 'compact' ? 'Compacto (6)' : size === 'medium' ? 'Medio (4)' : 'Grande (3)'}
            </button>
          ))}
        </div>
      </div>

      {/* Cuadrícula de Comparación */}
      <div className={`grid ${gridClass} gap-4 pb-12`}>
        {videos.map(video => (
          <CompareCard 
            key={video.id!}
            video={video}
            isSelected={selectedIds.has(video.id!)}
            onToggle={() => toggleSelect(video.id!)}
            videoRef={(el) => {
              if (el) videoRefs.current.set(video.id!, el);
              else videoRefs.current.delete(video.id!);
            }}
            isGlobalMuted={isMuted}
          />
        ))}
      </div>
    </div>
  );
}

function CompareCard({ 
  video, 
  isSelected, 
  onToggle, 
  videoRef, 
  isGlobalMuted 
}: { 
  video: VideoRecord; 
  isSelected: boolean; 
  onToggle: () => void; 
  videoRef: (el: HTMLVideoElement | null) => void; 
  isGlobalMuted: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  
  // Endpoint de Google Drive para descarga/streaming directo, o el enlace MP4 directo
  const directUrl = video.driveFileId 
    ? `https://drive.google.com/uc?id=${video.driveFileId}&export=download`
    : video.videoUrl;

  return (
    <div className={`relative flex flex-col bg-neutral-900 border ${isSelected ? 'border-teal-500/50 ring-1 ring-teal-500/30' : 'border-neutral-800'} rounded-xl overflow-hidden transition-all h-full`}>
      {/* Checkbox Overlay */}
      <div className="absolute top-2 left-2 z-10 bg-neutral-950/80 rounded-md p-1 backdrop-blur-sm border border-neutral-800">
        <label className="flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={onToggle}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-900 text-teal-500 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>

      {/* Video Container */}
      {/* Usamos aspect-[4/3] para forzar altura uniforme en la cuadrícula y acomodar tanto 16:9 como 9:16 con object-contain */}
      <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center border-b border-neutral-800">
        {hasError ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <span className="text-xs text-rose-400 mb-3 font-medium">No se pudo cargar directamente</span>
            <a 
              href={video.videoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {video.driveFileId ? 'Ver en Drive' : 'Abrir original'}
            </a>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={directUrl}
            className="w-full h-full object-contain"
            controls
            muted={isGlobalMuted}
            preload="metadata"
            onError={() => setHasError(true)}
          />
        )}
      </div>

      {/* Metadata Compacta */}
      <div className="p-3 bg-neutral-900 flex-1 flex flex-col justify-between gap-1.5">
        <div className="text-sm font-semibold text-neutral-200 truncate" title={video.model}>
          {video.model}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-neutral-400">
          <span>{video.steps}st</span>
          {video.shift !== undefined && <span>· s{video.shift}</span>}
          {video.seed !== undefined && <span>· {video.seed}</span>}
          {video.renderSeconds !== undefined && (
            <span>· <span className="text-teal-400">{Math.floor(video.renderSeconds / 60)}m {Math.round(video.renderSeconds % 60)}s</span></span>
          )}
        </div>
      </div>
    </div>
  );
}
