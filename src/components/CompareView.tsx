import { useState, useRef, useEffect } from 'react';
import { VideoRecord } from '../types';
import { Play, Pause, Volume2, VolumeX, ExternalLink, ChevronDown, ChevronUp, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { formatBytes } from '../lib/utils';

interface CompareViewProps {
  videos: VideoRecord[];
  sharedPrompt: string | null;
  onNavigateToVideo: (id: string) => void;
}

type GridSize = 'compact' | 'medium' | 'large';
type InfoLevel = 'minimal' | 'technical';

export function CompareView({ videos, sharedPrompt, onNavigateToVideo }: CompareViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [infoLevel, setInfoLevel] = useState<InfoLevel>('minimal');
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [readyCount, setReadyCount] = useState<number>(0);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Carga escalonada en segundo plano
  useEffect(() => {
    let isCancelled = false;
    setReadyCount(0);

    const preloadVideos = async () => {
      // Esperar a que los refs se llenen (renderizado inicial de tarjetas)
      await new Promise(r => setTimeout(r, 500));
      if (isCancelled) return;

      const vids = videos.map(v => videoRefs.current.get(v.id!)).filter(Boolean) as HTMLVideoElement[];
      let loaded = 0;

      for (const vid of vids) {
        if (isCancelled) break;
        
        if (vid.readyState >= 3) {
          loaded++;
          setReadyCount(loaded);
          continue;
        }

        // Si no está listo, ordenamos carga
        vid.preload = 'auto';
        
        await new Promise<void>(resolve => {
          const onReady = () => {
             vid.removeEventListener('canplay', onReady);
             vid.removeEventListener('error', onReady);
             resolve();
          };
          vid.addEventListener('canplay', onReady);
          vid.addEventListener('error', onReady);
          
          if (vid.readyState === 0) vid.load();
          
          // Timeout de 2.5s por vídeo si se queda atascado o es lento
          setTimeout(onReady, 2500);
        });

        if (!isCancelled) {
          loaded++;
          setReadyCount(loaded);
          // Retraso entre vídeos para no saltar el cortafuegos de DigiStorage
          await new Promise(r => setTimeout(r, 300));
        }
      }
    };

    preloadVideos();
    return () => { isCancelled = true; };
  }, [videos]);

  // Aplicar velocidad de reproducción a todos los vídeos cuando cambia
  useEffect(() => {
    const vids = Array.from(videoRefs.current.values());
    vids.forEach(vid => {
      vid.playbackRate = playbackRate;
    });
  }, [playbackRate]);

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
    
    if (vids.length > 8 && readyCount < videos.length) {
      setRateLimitWarning(true);
      setTimeout(() => setRateLimitWarning(false), 8000);
    }
    
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

    setIsPlaying(true);
    
    // Si todos los vídeos ya están precargados (listos), reproducir a la vez para sincronización perfecta
    if (readyCount === videos.length) {
      vids.forEach(vid => vid.play().catch(e => console.warn('Autoplay bloqueado', e)));
    } else {
      // Carga escalonada (Staggered playback) como fallback si no habían terminado de precargar
      for (let i = 0; i < vids.length; i++) {
        vids[i].play().catch(e => console.warn('Autoplay bloqueado', e));
        if (i < vids.length - 1) {
          // Pausa de 150ms entre cada petición de reproducción
          await new Promise(r => setTimeout(r, 150));
        }
      }
    }
  };

  const handleRewindAll = () => {
    const vids = Array.from(selectedIds)
      .map(id => videoRefs.current.get(id))
      .filter(Boolean) as HTMLVideoElement[];
    vids.forEach(vid => vid.currentTime = 0);
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
      
      {/* Aviso de Límite de Peticiones */}
      {rateLimitWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-amber-500">Carga Escalonada Activada</h4>
            <p className="text-xs text-neutral-400 mt-1">
              Estás reproduciendo más de 8 vídeos a la vez. Los vídeos se cargarán con un ligero retraso entre ellos (efecto cascada) para evitar que tu proveedor (ej. DigiStorage) bloquee tu IP por exceso de peticiones simultáneas.
            </p>
          </div>
        </div>
      )}

      {/* Estado de precarga */}
      {readyCount < videos.length && videos.length > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            <div>
              <h4 className="text-sm font-semibold text-indigo-400">Preparando vídeos para sincronización...</h4>
              <p className="text-xs text-neutral-400 mt-1">
                Precargando para asegurar reproducción simultánea sin cortes.
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold text-indigo-400">{readyCount}</span>
            <span className="text-sm text-neutral-500"> / {videos.length} listos</span>
            <div className="w-32 h-2 bg-neutral-900 rounded-full mt-2 overflow-hidden border border-neutral-800">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300 ease-out" 
                style={{ width: `${(readyCount / videos.length) * 100}%` }}
              />
            </div>
          </div>
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
          <button onClick={handleRewindAll} className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors ml-1" title="Rebobinar al inicio">
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <select 
            value={playbackRate} 
            onChange={e => setPlaybackRate(Number(e.target.value))} 
            className="ml-1 sm:ml-2 bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm font-semibold rounded-lg px-2 py-1.5 focus:outline-none focus:border-teal-500 cursor-pointer"
            title="Velocidad de reproducción"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>

          <button onClick={toggleMuteAll} className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors ml-1 sm:ml-2" title={isMuted ? "Activar sonido" : "Silenciar"}>
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
            {(['minimal', 'technical'] as InfoLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setInfoLevel(level)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${infoLevel === level ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {level === 'minimal' ? 'Detalle: Minimalista' : 'Detalle: Técnico'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
            {(['compact', 'medium', 'large'] as GridSize[]).map(size => (
              <button
                key={size}
                onClick={() => setGridSize(size)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${gridSize === size ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {size === 'compact' ? '6 columnas' : size === 'medium' ? '4 columnas' : '3 columnas'}
              </button>
            ))}
          </div>
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
              if (el) {
                videoRefs.current.set(video.id!, el);
                el.playbackRate = playbackRate; // Aplicar velocidad actual
              }
              else videoRefs.current.delete(video.id!);
            }}
            isGlobalMuted={isMuted}
            infoLevel={infoLevel}
            onNavigateToVideo={() => onNavigateToVideo(video.id!)}
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
  isGlobalMuted,
  infoLevel,
  onNavigateToVideo
}: { 
  video: VideoRecord; 
  isSelected: boolean; 
  onToggle: () => void; 
  videoRef: (el: HTMLVideoElement | null) => void; 
  isGlobalMuted: boolean;
  infoLevel: InfoLevel;
  onNavigateToVideo: () => void;
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

      {/* Metadata */}
      <div className="p-3 bg-neutral-900 flex-1 flex flex-col gap-1.5 group">
        <div className="flex items-center justify-between">
          <div 
            className="text-sm font-semibold text-neutral-200 truncate cursor-pointer hover:text-teal-400 transition-colors" 
            title={video.model} 
            onClick={onNavigateToVideo}
          >
            {video.model}
          </div>
          <button 
            onClick={onNavigateToVideo} 
            className="text-neutral-500 hover:text-teal-400 opacity-0 group-hover:opacity-100 transition-all p-1" 
            title="Abrir en vista detallada"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {infoLevel === 'minimal' ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-neutral-500 mt-auto">
            <span>{video.steps}st</span>
            {video.shift !== undefined && <span>· s{video.shift}</span>}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mt-1 border-t border-neutral-800/50 pt-2.5">
            <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
              <span className="text-neutral-500">Pasos / Shift</span>
              <span>{video.steps} / {video.shift !== undefined ? video.shift : '-'}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
              <span className="text-neutral-500">Resolución</span>
              <span>{video.width}x{video.height}</span>
            </div>
            {video.renderSeconds !== undefined && (
              <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
                <span className="text-neutral-500">Tiempo Render</span>
                <span className="text-teal-400">{Math.floor(video.renderSeconds / 60)}m {Math.round(video.renderSeconds % 60)}s</span>
              </div>
            )}
            {video.hardware && (
              <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
                <span className="text-neutral-500">Hardware</span>
                <span className="text-indigo-400 truncate text-right ml-2" title={`${video.hardware.gpu} • ${video.hardware.vram}GB VRAM • ${video.hardware.ram}GB RAM`}>
                  {video.hardware.gpu} ({video.hardware.vram}GB)
                </span>
              </div>
            )}
            {video.fileSizeBytes && (
              <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
                <span className="text-neutral-500">Tamaño</span>
                <span>{formatBytes(video.fileSizeBytes)}</span>
              </div>
            )}
            {video.seed !== undefined && (
              <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400">
                <span className="text-neutral-500">Seed</span>
                <span className="truncate max-w-[120px] text-right" title={video.seed.toString()}>{video.seed}</span>
              </div>
            )}
            {video.loras && video.loras.length > 0 && (
              <div className="flex flex-col gap-0.5 text-[11px] font-mono text-neutral-400 mt-1">
                <span className="text-neutral-500 mb-0.5">LoRAs:</span>
                {video.loras.map(l => (
                  <span key={l.name} className="truncate text-indigo-300 ml-1.5" title={`${l.name} (${l.weight})`}>
                    • {l.name} <span className="text-indigo-500">({l.weight})</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
