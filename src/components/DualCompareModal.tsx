import { useState, useRef, useEffect, useMemo } from 'react';
import { VideoRecord } from '../types';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, X, ArrowLeftRight, 
  Sparkles, Layers, Cpu, Clock, HardDrive, Check,
  ChevronLeft, ChevronRight, SplitSquareVertical, Columns, Eye,
  Maximize2, Minimize2, FileText, CheckCircle2, AlertCircle, 
  SlidersHorizontal, Repeat, Search, User, Filter, Film, Tag
} from 'lucide-react';
import { computeParameterDiff, diffWords, formatBytes } from '../lib/utils';

interface DualCompareModalProps {
  initialVideoA: VideoRecord;
  initialVideoB: VideoRecord;
  allVideos: VideoRecord[];
  onClose: () => void;
}

type ViewLayout = 'split' | 'vertical' | 'toggle';
type ActiveTab = 'diffs' | 'prompt' | 'all';

export function DualCompareModal({
  initialVideoA,
  initialVideoB,
  allVideos,
  onClose,
}: DualCompareModalProps) {
  const [videoAId, setVideoAId] = useState<string>(initialVideoA.id || '');
  const [videoBId, setVideoBId] = useState<string>(initialVideoB.id || '');
  
  // Visual Video Picker Modal State
  const [pickerTarget, setPickerTarget] = useState<'A' | 'B' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerModelFilter, setPickerModelFilter] = useState('all');

  const [layout, setLayout] = useState<ViewLayout>('split');
  const [toggleActive, setToggleActive] = useState<'A' | 'B'>('A');
  const [activeTab, setActiveTab] = useState<ActiveTab>('diffs');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioSource, setAudioSource] = useState<'muted' | 'A' | 'B'>('muted');
  const [isLooping, setIsLooping] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [readyA, setReadyA] = useState(false);
  const [readyB, setReadyB] = useState(false);

  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Guarantee Video A and B are resolved against the entire catalog
  const videoA = useMemo(() => {
    return allVideos.find(v => v.id === videoAId) || initialVideoA;
  }, [allVideos, videoAId, initialVideoA]);

  const videoB = useMemo(() => {
    return allVideos.find(v => v.id === videoBId) || initialVideoB;
  }, [allVideos, videoBId, initialVideoB]);

  // Unique models list for picker quick filters
  const uniqueModels = useMemo(() => {
    const set = new Set<string>();
    allVideos.forEach(v => {
      if (v.model) set.add(v.model);
    });
    return Array.from(set).sort();
  }, [allVideos]);

  // Filtered videos for visual picker
  const pickerFilteredVideos = useMemo(() => {
    return allVideos.filter(v => {
      if (pickerModelFilter !== 'all' && v.model !== pickerModelFilter) return false;
      if (!pickerSearch.trim()) return true;
      const q = pickerSearch.toLowerCase().trim();
      const matchPrompt = v.prompt?.toLowerCase().includes(q);
      const matchModel = v.model?.toLowerCase().includes(q);
      const matchAuthor = (v.creatorDisplayName || v.createdBy || '').toLowerCase().includes(q);
      const matchGroup = (v.groupName || '').toLowerCase().includes(q);
      const matchTags = (v.tags || []).some(t => t.toLowerCase().includes(q));
      const matchHardware = v.hardware ? `${v.hardware.gpu} ${v.hardware.vram}`.toLowerCase().includes(q) : false;
      return matchPrompt || matchModel || matchAuthor || matchGroup || matchTags || matchHardware;
    });
  }, [allVideos, pickerSearch, pickerModelFilter]);

  // Compute parameter diff
  const parameterDiffs = useMemo(() => {
    return computeParameterDiff(videoA, videoB);
  }, [videoA, videoB]);

  const differentCount = useMemo(() => {
    return parameterDiffs.filter(d => d.isDifferent).length;
  }, [parameterDiffs]);

  // Compute prompt word diff
  const promptDiff = useMemo(() => {
    return diffWords(videoA.prompt || '', videoB.prompt || '');
  }, [videoA.prompt, videoB.prompt]);

  // URL resolution
  const urlA = videoA.driveFileId 
    ? `https://drive.google.com/uc?id=${videoA.driveFileId}&export=download`
    : videoA.videoUrl;
  const urlB = videoB.driveFileId 
    ? `https://drive.google.com/uc?id=${videoB.driveFileId}&export=download`
    : videoB.videoUrl;

  // Sync duration
  const handleLoadedMetadata = (video: 'A' | 'B') => {
    if (video === 'A') setReadyA(true);
    if (video === 'B') setReadyB(true);

    const durA = videoRefA.current?.duration || 0;
    const durB = videoRefB.current?.duration || 0;
    const maxDur = Math.max(durA, durB);
    if (maxDur > 0 && !isNaN(maxDur)) {
      setDuration(maxDur);
    }
  };

  // Sync playback rate
  useEffect(() => {
    if (videoRefA.current) videoRefA.current.playbackRate = playbackRate;
    if (videoRefB.current) videoRefB.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Sync audio
  useEffect(() => {
    if (videoRefA.current) videoRefA.current.muted = audioSource !== 'A';
    if (videoRefB.current) videoRefB.current.muted = audioSource !== 'B';
  }, [audioSource]);

  // Master Play / Pause
  const togglePlay = () => {
    if (isPlaying) {
      videoRefA.current?.pause();
      videoRefB.current?.pause();
      setIsPlaying(false);
    } else {
      if (videoRefA.current && videoRefB.current) {
        const time = videoRefA.current.currentTime;
        videoRefB.current.currentTime = time;
      }
      videoRefA.current?.play().catch(() => {});
      videoRefB.current?.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Seek time
  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (videoRefA.current) videoRefA.current.currentTime = newTime;
    if (videoRefB.current) videoRefB.current.currentTime = newTime;
  };

  // Step Frame (~1/24th s or 0.04s)
  const stepFrame = (frames: number) => {
    const delta = frames * 0.04;
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    handleSeek(newTime);
  };

  // Reset to 0:00
  const handleReset = () => {
    handleSeek(0);
  };

  // Loop handling
  const handleTimeUpdate = () => {
    if (videoRefA.current) {
      setCurrentTime(videoRefA.current.currentTime);
      if (duration === 0 && videoRefA.current.duration) {
        setDuration(videoRefA.current.duration);
      }
    }
  };

  const handleEnded = () => {
    if (isLooping) {
      handleSeek(0);
      videoRefA.current?.play().catch(() => {});
      videoRefB.current?.play().catch(() => {});
    } else {
      setIsPlaying(false);
    }
  };

  // Swap A and B
  const handleSwap = () => {
    const temp = videoAId;
    setVideoAId(videoBId);
    setVideoBId(temp);
  };

  // Select video from picker
  const handleSelectFromPicker = (vid: VideoRecord) => {
    if (pickerTarget === 'A') {
      setVideoAId(vid.id || '');
    } else if (pickerTarget === 'B') {
      setVideoBId(vid.id || '');
    }
    setPickerTarget(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(e.shiftKey ? -5 : -1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepFrame(e.shiftKey ? 5 : 1);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setToggleActive(prev => prev === 'A' ? 'B' : 'A');
      } else if (e.code === 'Escape') {
        if (pickerTarget) {
          setPickerTarget(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, currentTime, pickerTarget, onClose]);

  // Fullscreen container handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-neutral-950 text-neutral-100 flex flex-col overflow-hidden select-none"
    >
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-6 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between gap-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Comparativa 1 vs 1</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400">
            <span>Diferencias:</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 font-mono">
              {differentCount}
            </span>
          </div>
        </div>

        {/* Center: Interactive Slot Selectors & Swap Button */}
        <div className="flex items-center gap-2 max-w-2xl flex-1 justify-center">
          {/* Slot Button Video A */}
          <button
            onClick={() => setPickerTarget('A')}
            className="flex items-center gap-2 bg-neutral-900/90 hover:bg-neutral-850 border border-blue-500/50 hover:border-blue-400 rounded-xl px-3 py-1.5 transition-all text-left group min-w-0 max-w-[240px] sm:max-w-[280px] shadow-sm"
            title="Haz clic para elegir visualmente cualquier vídeo para el Slot A"
          >
            <span className="text-[11px] font-bold text-blue-400 px-1.5 py-0.5 rounded bg-blue-950 border border-blue-800 shrink-0 group-hover:bg-blue-900">
              A
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-neutral-200 truncate group-hover:text-blue-300">
                {videoA.model}
              </div>
              <div className="text-[10px] text-neutral-400 truncate">
                {videoA.prompt?.slice(0, 30) || 'Sin prompt'}
              </div>
            </div>
            <Film className="w-3.5 h-3.5 text-blue-400 shrink-0 opacity-60 group-hover:opacity-100" />
          </button>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all hover:scale-105 active:scale-95 shrink-0 border border-neutral-700"
            title="Intercambiar Vídeo A y Vídeo B"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          {/* Slot Button Video B */}
          <button
            onClick={() => setPickerTarget('B')}
            className="flex items-center gap-2 bg-neutral-900/90 hover:bg-neutral-850 border border-purple-500/50 hover:border-purple-400 rounded-xl px-3 py-1.5 transition-all text-left group min-w-0 max-w-[240px] sm:max-w-[280px] shadow-sm"
            title="Haz clic para elegir visualmente cualquier vídeo para el Slot B"
          >
            <span className="text-[11px] font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 shrink-0 group-hover:bg-purple-900">
              B
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-neutral-200 truncate group-hover:text-purple-300">
                {videoB.model}
              </div>
              <div className="text-[10px] text-neutral-400 truncate">
                {videoB.prompt?.slice(0, 30) || 'Sin prompt'}
              </div>
            </div>
            <Film className="w-3.5 h-3.5 text-purple-400 shrink-0 opacity-60 group-hover:opacity-100" />
          </button>
        </div>

        {/* Right Tools & Close */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Layout buttons */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setLayout('split')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${layout === 'split' ? 'bg-neutral-800 text-teal-400' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Lado a lado (Split 50/50)"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('vertical')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${layout === 'vertical' ? 'bg-neutral-800 text-teal-400' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Arriba / Abajo (Vertical)"
            >
              <SplitSquareVertical className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('toggle')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${layout === 'toggle' ? 'bg-neutral-800 text-teal-400' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Alternancia rápida A/B (Flicker)"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition-colors"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-800/80 hover:bg-rose-900/60 hover:text-rose-300 text-neutral-300 transition-colors ml-1"
            title="Cerrar comparador (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Split Video Stage */}
      <div className="flex-1 min-h-0 relative bg-black flex flex-col">
        {layout === 'toggle' ? (
          // Toggle Flicker View
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {/* Active Label Badge */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border shadow-xl ${
                toggleActive === 'A' 
                  ? 'bg-blue-950/90 text-blue-300 border-blue-600' 
                  : 'bg-purple-950/90 text-purple-300 border-purple-600'
              }`}>
                Viendo: Vídeo {toggleActive} ({toggleActive === 'A' ? videoA.model : videoB.model})
              </span>
              <button
                onClick={() => setToggleActive(prev => prev === 'A' ? 'B' : 'A')}
                className="px-3 py-1 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 text-xs font-medium border border-neutral-700 shadow-xl flex items-center gap-1.5"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Alternar (Tecla T)
              </button>
            </div>

            <video
              ref={videoRefA}
              src={urlA}
              crossOrigin="anonymous"
              playsInline
              muted={audioSource !== 'A'}
              onLoadedMetadata={() => handleLoadedMetadata('A')}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              className={`max-w-full max-h-full object-contain ${toggleActive === 'A' ? 'block' : 'hidden'}`}
            />

            <video
              ref={videoRefB}
              src={urlB}
              crossOrigin="anonymous"
              playsInline
              muted={audioSource !== 'B'}
              onLoadedMetadata={() => handleLoadedMetadata('B')}
              className={`max-w-full max-h-full object-contain ${toggleActive === 'B' ? 'block' : 'hidden'}`}
            />
          </div>
        ) : (
          // Split (Horizontal 50/50) or Vertical (Stacked)
          <div className={`flex-1 grid ${layout === 'vertical' ? 'grid-rows-2' : 'grid-cols-1 md:grid-cols-2'} gap-1 p-1 overflow-hidden`}>
            {/* Vídeo A Panel */}
            <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden border border-blue-900/30 rounded-lg group">
              {/* Badge Identificador A con botón rápido de cambio */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/40 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="text-xs font-bold text-blue-300 font-mono">Vídeo A</span>
                <span className="text-xs text-neutral-300 font-medium truncate max-w-[150px]">({videoA.model})</span>
                <button
                  onClick={() => setPickerTarget('A')}
                  className="ml-1 text-[10px] bg-blue-900/60 hover:bg-blue-800 text-blue-200 px-2 py-0.5 rounded font-medium transition-colors"
                >
                  Cambiar
                </button>
              </div>

              <video
                ref={videoRefA}
                src={urlA}
                crossOrigin="anonymous"
                playsInline
                muted={audioSource !== 'A'}
                onLoadedMetadata={() => handleLoadedMetadata('A')}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Vídeo B Panel */}
            <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden border border-purple-900/30 rounded-lg group">
              {/* Badge Identificador B con botón rápido de cambio */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-purple-500/40 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                <span className="text-xs font-bold text-purple-300 font-mono">Vídeo B</span>
                <span className="text-xs text-neutral-300 font-medium truncate max-w-[150px]">({videoB.model})</span>
                <button
                  onClick={() => setPickerTarget('B')}
                  className="ml-1 text-[10px] bg-purple-900/60 hover:bg-purple-800 text-purple-200 px-2 py-0.5 rounded font-medium transition-colors"
                >
                  Cambiar
                </button>
              </div>

              <video
                ref={videoRefB}
                src={urlB}
                crossOrigin="anonymous"
                playsInline
                muted={audioSource !== 'B'}
                onLoadedMetadata={() => handleLoadedMetadata('B')}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Synchronized Playback Control Bar */}
      <div className="bg-neutral-900 border-t border-neutral-800 p-3 sm:px-6 flex flex-col gap-2 shrink-0 z-30">
        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-teal-400 min-w-[50px]">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 10}
              step={0.01}
              value={currentTime}
              onChange={e => handleSeek(Number(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-teal-500 focus:outline-none"
            />
          </div>
          <span className="text-xs font-mono font-medium text-neutral-500 min-w-[50px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Master Control Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-neutral-950 font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)] hover:scale-105 active:scale-95"
              title="Reproducir / Pausar ambos (Barra Espaciadora)"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Pausa' : 'Play'}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
              title="Rebobinar al inicio (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => stepFrame(-1)}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition-colors"
              title="Fotograma anterior (-1 Frame: Flecha Izquierda)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => stepFrame(1)}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition-colors"
              title="Siguiente fotograma (+1 Frame: Flecha Derecha)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-2 rounded-lg text-xs font-medium transition-colors border ${
                isLooping 
                  ? 'bg-teal-950/60 border-teal-800 text-teal-300' 
                  : 'bg-neutral-800 border-neutral-700 text-neutral-500 hover:text-neutral-300'
              }`}
              title={isLooping ? "Bucle continuo activo" : "Bucle desactivado"}
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* Speed Presets */}
            <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 ml-1 sm:ml-2">
              {[0.25, 0.5, 1, 2].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackRate(speed)}
                  className={`px-2 py-1 text-xs font-semibold rounded font-mono transition-colors ${
                    playbackRate === speed 
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' 
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Audio Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400 mr-1 hidden sm:inline">Audio:</span>
            <button
              onClick={() => setAudioSource('muted')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                audioSource === 'muted' 
                  ? 'bg-neutral-700 text-white' 
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <VolumeX className="w-3.5 h-3.5" /> Silencio
            </button>
            <button
              onClick={() => setAudioSource('A')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                audioSource === 'A' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-neutral-800 text-blue-400 hover:bg-neutral-700'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Audio A
            </button>
            <button
              onClick={() => setAudioSource('B')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                audioSource === 'B' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-neutral-800 text-purple-400 hover:bg-neutral-700'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Audio B
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Differences Matrix & Diff Spotlight */}
      <div className="max-h-[35vh] overflow-y-auto bg-neutral-950 border-t border-neutral-800 flex flex-col shrink-0">
        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('diffs')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'diffs' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Diferencias ({differentCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('prompt')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'prompt' 
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' 
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Diff de Prompt {promptDiff.hasDifferences ? '(Diferente)' : '(Idéntico)'}</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === 'all' 
                  ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm' 
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Todos los Parámetros</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block"></span>
              Vídeo A: {videoA.model}
            </span>
            <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded bg-purple-500 inline-block"></span>
              Vídeo B: {videoB.model}
            </span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'prompt' ? (
            // Prompt Diff View
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-neutral-900/80 border border-blue-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Prompt Vídeo A</span>
                    <span className="text-[11px] text-neutral-500 font-mono">{videoA.prompt?.length || 0} caracteres</span>
                  </div>
                  <p className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap">
                    {promptDiff.chunksA.map((chunk, idx) => (
                      <span
                        key={idx}
                        className={chunk.type === 'removed' ? 'bg-amber-500/30 text-amber-200 px-1 py-0.5 rounded font-bold' : ''}
                      >
                        {chunk.value}{' '}
                      </span>
                    ))}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/80 border border-purple-900/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Prompt Vídeo B</span>
                    <span className="text-[11px] text-neutral-500 font-mono">{videoB.prompt?.length || 0} caracteres</span>
                  </div>
                  <p className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap">
                    {promptDiff.chunksB.map((chunk, idx) => (
                      <span
                        key={idx}
                        className={chunk.type === 'added' ? 'bg-teal-500/30 text-teal-200 px-1 py-0.5 rounded font-bold' : ''}
                      >
                        {chunk.value}{' '}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Parameter Matrix (Diffs or All)
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {parameterDiffs
                .filter(item => activeTab === 'all' || item.isDifferent)
                .map(item => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                      item.isDifferent
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                        : 'bg-neutral-900/50 border-neutral-800/80 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                        {item.label}
                      </span>
                      {item.isDifferent ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          Δ Diferente
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-500 text-[10px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-neutral-500" /> Idéntico
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Valor A */}
                      <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-900/40 min-w-0">
                        <div className="text-[10px] font-bold text-blue-400 mb-0.5 uppercase tracking-wider">A</div>
                        <div className="font-mono text-neutral-200 truncate" title={item.displayA}>
                          {item.displayA}
                        </div>
                      </div>

                      {/* Valor B */}
                      <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-900/40 min-w-0">
                        <div className="text-[10px] font-bold text-purple-400 mb-0.5 uppercase tracking-wider">B</div>
                        <div className="font-mono text-neutral-200 truncate" title={item.displayB}>
                          {item.displayB}
                        </div>
                      </div>
                    </div>

                    {/* Delta / Diferencia cuantitativa */}
                    {item.delta && (
                      <div className="text-[11px] font-mono font-semibold text-amber-400 text-right">
                        Δ {item.delta}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Visual Video Selector Drawer/Modal */}
      {pickerTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border font-bold text-sm ${
                  pickerTarget === 'A' 
                    ? 'bg-blue-950 text-blue-400 border-blue-700' 
                    : 'bg-purple-950 text-purple-400 border-purple-700'
                }`}>
                  Slot {pickerTarget}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100">
                    Seleccionar Vídeo para Slot {pickerTarget}
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Explora el catálogo global ({allVideos.length} vídeos disponibles de todos los usuarios y categorías).
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPickerTarget(null)}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                title="Cerrar selector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Bar inside Modal */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-950/60 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Buscar por prompt, modelo, autor, etiquetas, hardware..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-teal-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Quick Model Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-neutral-500 font-medium">Modelo:</span>
                <select
                  value={pickerModelFilter}
                  onChange={e => setPickerModelFilter(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">Todos los modelos</option>
                  {uniqueModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Compact Visual Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pickerFilteredVideos.length === 0 ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                  <Film className="w-10 h-10 text-neutral-700 mb-3" />
                  <p className="text-sm font-semibold text-neutral-300">No se encontraron vídeos</p>
                  <p className="text-xs text-neutral-500 mt-1">Prueba a cambiar los términos de búsqueda o el modelo.</p>
                </div>
              ) : (
                pickerFilteredVideos.map(vid => {
                  const isCurrentA = vid.id === videoAId;
                  const isCurrentB = vid.id === videoBId;
                  const isCurrentTarget = (pickerTarget === 'A' && isCurrentA) || (pickerTarget === 'B' && isCurrentB);
                  
                  const vidUrl = vid.driveFileId 
                    ? `https://drive.google.com/uc?id=${vid.driveFileId}&export=download`
                    : vid.videoUrl;

                  return (
                    <div
                      key={vid.id}
                      onClick={() => handleSelectFromPicker(vid)}
                      className={`relative flex flex-col rounded-xl border bg-neutral-950/80 overflow-hidden cursor-pointer transition-all hover:scale-[1.01] group ${
                        isCurrentTarget
                          ? pickerTarget === 'A'
                            ? 'border-blue-500 ring-2 ring-blue-500/30'
                            : 'border-purple-500 ring-2 ring-purple-500/30'
                          : 'border-neutral-800 hover:border-teal-500/60'
                      }`}
                    >
                      {/* Current Assignment Badges */}
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                        {isCurrentA && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-950/90 text-blue-300 border border-blue-700 text-[10px] font-bold shadow-md">
                            Vídeo A
                          </span>
                        )}
                        {isCurrentB && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-950/90 text-purple-300 border border-purple-700 text-[10px] font-bold shadow-md">
                            Vídeo B
                          </span>
                        )}
                      </div>

                      {/* Video Preview thumbnail */}
                      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden border-b border-neutral-800/80">
                        <video
                          src={vidUrl}
                          className="w-full h-full object-contain pointer-events-none"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 bg-neutral-950/30 group-hover:bg-transparent transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 rounded-lg bg-teal-500 text-neutral-950 text-xs font-bold shadow-lg">
                            Elegir para Slot {pickerTarget}
                          </span>
                        </div>
                      </div>

                      {/* Video Info Summary */}
                      <div className="p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-neutral-200 truncate group-hover:text-teal-300">
                            {vid.model}
                          </span>
                          <span className="text-[11px] font-mono text-neutral-400">
                            {vid.steps}st · {vid.width}x{vid.height}
                          </span>
                        </div>

                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                          {vid.prompt || 'Sin prompt registrado'}
                        </p>

                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-1 border-t border-neutral-900">
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <User className="w-3 h-3 text-neutral-500" />
                            {vid.creatorDisplayName || vid.createdBy || 'Anónimo'}
                          </span>
                          {vid.renderSeconds !== undefined && (
                            <span className="text-teal-400">
                              {Math.floor(vid.renderSeconds / 60)}m {Math.round(vid.renderSeconds % 60)}s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins.toString().padStart(2, '0')}:${Number(secs) < 10 ? '0' : ''}${secs}`;
}
