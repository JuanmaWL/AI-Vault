import { useState, useRef, useEffect, useMemo } from 'react';
import { VideoRecord } from '../types';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, X, ArrowLeftRight, 
  Sparkles, Layers, Cpu, Clock, HardDrive, Check,
  ChevronLeft, ChevronRight, SplitSquareVertical, Columns, Eye,
  Maximize2, Minimize2, FileText, CheckCircle2, AlertCircle, 
  SlidersHorizontal, Repeat, Search, User, Filter, Film, Tag,
  Grid2X2, Grid3X3, LayoutGrid, Info, ArrowUpRight, Loader2,
  Sliders, MoveHorizontal
} from 'lucide-react';
import { computeParameterDiff, diffWords, formatBytes } from '../lib/utils';

interface DualCompareModalProps {
  initialVideoA: VideoRecord;
  initialVideoB: VideoRecord;
  allVideos: VideoRecord[];
  onClose: () => void;
}

type ViewLayout = 'split' | 'vertical' | 'slider';
type ActiveTab = 'diffs' | 'prompt' | 'all';
type PickerCols = 2 | 3 | 4 | 5;
type AudioSelection = 'muted' | 'A' | 'B' | 'both';

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
  const [pickerAuthorFilter, setPickerAuthorFilter] = useState('all');
  const [pickerGroupFilter, setPickerGroupFilter] = useState('all');
  const [pickerResolutionFilter, setPickerResolutionFilter] = useState('all');
  const [pickerCols, setPickerCols] = useState<PickerCols>(4);
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerPageSize, setPickerPageSize] = useState<number>(8); // Inicia con pocos vídeos para no saturar

  const [layout, setLayout] = useState<ViewLayout>('split');
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0 to 100% for wipe slider
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('diffs');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioSource, setAudioSource] = useState<AudioSelection>('muted');
  const [isLooping, setIsLooping] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [readyA, setReadyA] = useState(false);
  const [readyB, setReadyB] = useState(false);

  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);

  // Guarantee Video A and B are resolved against the entire catalog
  const videoA = useMemo(() => {
    return allVideos.find(v => v.id === videoAId) || initialVideoA;
  }, [allVideos, videoAId, initialVideoA]);

  const videoB = useMemo(() => {
    return allVideos.find(v => v.id === videoBId) || initialVideoB;
  }, [allVideos, videoBId, initialVideoB]);

  // Reset ready flags when videos change
  useEffect(() => {
    setReadyA(false);
    setIsPlaying(false);
  }, [videoAId]);

  useEffect(() => {
    setReadyB(false);
    setIsPlaying(false);
  }, [videoBId]);

  const areBothVideosReady = readyA && readyB;

  // Unique filter lists for picker
  const uniqueModels = useMemo(() => {
    const set = new Set<string>();
    allVideos.forEach(v => {
      if (v.model) set.add(v.model);
    });
    return Array.from(set).sort();
  }, [allVideos]);

  const uniqueAuthors = useMemo(() => {
    const map = new Map<string, string>();
    allVideos.forEach(v => {
      const name = v.creatorDisplayName || v.createdBy;
      if (name) map.set(name, name);
    });
    return Array.from(map.values()).sort();
  }, [allVideos]);

  const uniqueGroups = useMemo(() => {
    const set = new Set<string>();
    allVideos.forEach(v => {
      if (v.groupName) set.add(v.groupName);
    });
    return Array.from(set).sort();
  }, [allVideos]);

  const uniqueResolutions = useMemo(() => {
    const set = new Set<string>();
    allVideos.forEach(v => {
      if (v.width && v.height) set.add(`${v.width}x${v.height}`);
    });
    return Array.from(set).sort();
  }, [allVideos]);

  // Reset page when filters change
  useEffect(() => {
    setPickerPage(1);
  }, [pickerSearch, pickerModelFilter, pickerAuthorFilter, pickerGroupFilter, pickerResolutionFilter, pickerPageSize]);

  // Filtered videos for visual picker
  const pickerFilteredVideos = useMemo(() => {
    return allVideos.filter(v => {
      // Model Filter
      if (pickerModelFilter !== 'all' && v.model !== pickerModelFilter) return false;
      
      // Author Filter
      if (pickerAuthorFilter !== 'all') {
        const author = v.creatorDisplayName || v.createdBy;
        if (author !== pickerAuthorFilter) return false;
      }

      // Group / Folder Filter
      if (pickerGroupFilter !== 'all' && v.groupName !== pickerGroupFilter) return false;

      // Resolution Filter
      if (pickerResolutionFilter !== 'all') {
        const res = `${v.width}x${v.height}`;
        if (res !== pickerResolutionFilter) return false;
      }

      // Free Search Filter
      if (!pickerSearch.trim()) return true;
      const q = pickerSearch.toLowerCase().trim();
      const matchPrompt = v.prompt?.toLowerCase().includes(q);
      const matchModel = v.model?.toLowerCase().includes(q);
      const matchAuthor = (v.creatorDisplayName || v.createdBy || '').toLowerCase().includes(q);
      const matchGroup = (v.groupName || '').toLowerCase().includes(q);
      const matchTags = (v.tags || []).some(t => t.toLowerCase().includes(q));
      const matchHardware = v.hardware ? `${v.hardware.gpu} ${v.hardware.vram}`.toLowerCase().includes(q) : false;
      const matchResolution = `${v.width}x${v.height}`.includes(q);
      const matchSteps = `${v.steps}`.includes(q);
      
      return matchPrompt || matchModel || matchAuthor || matchGroup || matchTags || matchHardware || matchResolution || matchSteps;
    });
  }, [allVideos, pickerSearch, pickerModelFilter, pickerAuthorFilter, pickerGroupFilter, pickerResolutionFilter]);

  // Paginated videos
  const totalPages = Math.ceil(pickerFilteredVideos.length / (pickerPageSize === -1 ? (pickerFilteredVideos.length || 1) : pickerPageSize));
  const paginatedVideos = useMemo(() => {
    if (pickerPageSize === -1) return pickerFilteredVideos;
    const start = (pickerPage - 1) * pickerPageSize;
    return pickerFilteredVideos.slice(start, start + pickerPageSize);
  }, [pickerFilteredVideos, pickerPage, pickerPageSize]);

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

  const handleCanPlay = (video: 'A' | 'B') => {
    if (video === 'A') setReadyA(true);
    if (video === 'B') setReadyB(true);
  };

  // Sync playback rate
  useEffect(() => {
    if (videoRefA.current) videoRefA.current.playbackRate = playbackRate;
    if (videoRefB.current) videoRefB.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Sync audio: Muted, A, B, or Both
  useEffect(() => {
    if (videoRefA.current) {
      videoRefA.current.muted = audioSource !== 'A' && audioSource !== 'both';
    }
    if (videoRefB.current) {
      videoRefB.current.muted = audioSource !== 'B' && audioSource !== 'both';
    }
  }, [audioSource]);

  // Master Play / Pause
  const togglePlay = () => {
    if (!areBothVideosReady) return;

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
      if (areBothVideosReady) {
        videoRefA.current?.play().catch(() => {});
        videoRefB.current?.play().catch(() => {});
      }
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

  // Slider Mouse/Touch Drag Handlers for Wipe Compare
  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percent);
  };

  const handleMouseDownSlider = (e: React.MouseEvent) => {
    setIsDraggingSlider(true);
    handleSliderMove(e.clientX);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingSlider) {
        handleSliderMove(e.clientX);
      }
    };
    const handleGlobalMouseUp = () => {
      if (isDraggingSlider) {
        setIsDraggingSlider(false);
      }
    };

    if (isDraggingSlider) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingSlider]);

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
  }, [isPlaying, duration, currentTime, pickerTarget, onClose, areBothVideosReady]);

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

  // Grid class mapping for the picker
  const pickerGridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  }[pickerCols];

  // Helper formatting for time
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00.00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Render High-Density Compact Parameters Table
  const renderParametersTable = () => (
    <div className="flex flex-col divide-y divide-neutral-800/60 border border-neutral-800/80 rounded-xl overflow-hidden bg-neutral-900/40 text-xs">
      <div className="grid grid-cols-12 px-3 py-2 bg-neutral-900/90 font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
        <div className="col-span-4">Parámetro</div>
        <div className="col-span-4 text-blue-400">Vídeo A</div>
        <div className="col-span-4 text-purple-400">Vídeo B</div>
      </div>
      {parameterDiffs
        .filter(item => activeTab === 'all' || item.isDifferent)
        .map(item => (
          <div
            key={item.id}
            className={`grid grid-cols-12 px-3 py-2 items-center transition-colors ${
              item.isDifferent 
                ? 'bg-amber-950/20 hover:bg-amber-950/30' 
                : 'hover:bg-neutral-800/30 opacity-80'
            }`}
          >
            <div className="col-span-4 flex items-center gap-1.5 pr-2">
              {item.isDifferent ? (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 shrink-0"></span>
              )}
              <span className={`truncate font-medium ${item.isDifferent ? 'text-amber-200 font-semibold' : 'text-neutral-300'}`}>
                {item.label}
              </span>
            </div>
            
            <div className="col-span-4 font-mono truncate pr-2 text-neutral-200 text-[11px]" title={item.displayA}>
              <span className={`px-1.5 py-0.5 rounded ${item.isDifferent ? 'bg-blue-950/80 text-blue-300 border border-blue-800/50' : ''}`}>
                {item.displayA}
              </span>
            </div>

            <div className="col-span-4 font-mono truncate text-neutral-200 text-[11px] flex items-center justify-between" title={item.displayB}>
              <span className={`px-1.5 py-0.5 rounded truncate ${item.isDifferent ? 'bg-purple-950/80 text-purple-300 border border-purple-800/50' : ''}`}>
                {item.displayB}
              </span>
              {item.delta && (
                <span className="ml-1 text-[10px] text-amber-400 font-mono font-bold shrink-0">
                  Δ {item.delta}
                </span>
              )}
            </div>
          </div>
        ))}
    </div>
  );

  // Render High-Contrast Prompt Diff
  const renderPromptDiffView = () => (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] px-1 text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-rose-500/30 border border-rose-500 inline-block"></span>
            <span className="text-rose-300">Exclusivo de A / Eliminado en B</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500 inline-block"></span>
            <span className="text-emerald-300 font-bold">Añadido en B / Nuevo</span>
          </span>
        </div>
        <span className="text-neutral-500 font-mono">
          {promptDiff.hasDifferences ? 'Prompts con diferencias' : 'Prompts 100% idénticos'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Prompt Vídeo A */}
        <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-blue-900/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-blue-500"></span> Prompt Vídeo A ({videoA.model})
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">{videoA.prompt?.length || 0} car.</span>
          </div>
          <p className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap select-text">
            {promptDiff.chunksA.map((chunk, idx) => (
              <span
                key={idx}
                className={chunk.type === 'removed' 
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60 px-1 py-0.5 rounded font-bold inline-block my-0.5 shadow-sm' 
                  : 'text-neutral-300'}
              >
                {chunk.value}{' '}
              </span>
            ))}
          </p>
        </div>

        {/* Prompt Vídeo B */}
        <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-purple-900/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-purple-500"></span> Prompt Vídeo B ({videoB.model})
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">{videoB.prompt?.length || 0} car.</span>
          </div>
          <p className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap select-text">
            {promptDiff.chunksB.map((chunk, idx) => (
              <span
                key={idx}
                className={chunk.type === 'added' 
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 px-1 py-0.5 rounded font-bold inline-block my-0.5 shadow-sm' 
                  : 'text-neutral-300'}
              >
                {chunk.value}{' '}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );

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
            className="flex items-center gap-2.5 bg-neutral-900/90 hover:bg-neutral-850 border border-blue-500/50 hover:border-blue-400 rounded-xl px-3 py-1.5 transition-all text-left group min-w-0 max-w-[240px] sm:max-w-[280px] shadow-sm cursor-pointer"
            title="Haz clic para elegir visualmente cualquier vídeo para el Slot A"
          >
            <span className="text-[11px] font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-950 border border-blue-800 shrink-0 group-hover:bg-blue-900">
              A
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-neutral-200 truncate group-hover:text-blue-300">
                {videoA.model}
              </div>
              <div className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                <span>{videoA.steps}st</span>
                <span>·</span>
                <span>{videoA.width}x{videoA.height}</span>
              </div>
            </div>
            <Film className="w-3.5 h-3.5 text-blue-400 shrink-0 opacity-60 group-hover:opacity-100" />
          </button>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all hover:scale-105 active:scale-95 shrink-0 border border-neutral-700 cursor-pointer"
            title="Intercambiar Vídeo A y Vídeo B"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          {/* Slot Button Video B */}
          <button
            onClick={() => setPickerTarget('B')}
            className="flex items-center gap-2.5 bg-neutral-900/90 hover:bg-neutral-850 border border-purple-500/50 hover:border-purple-400 rounded-xl px-3 py-1.5 transition-all text-left group min-w-0 max-w-[240px] sm:max-w-[280px] shadow-sm cursor-pointer"
            title="Haz clic para elegir visualmente cualquier vídeo para el Slot B"
          >
            <span className="text-[11px] font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-950 border border-purple-800 shrink-0 group-hover:bg-purple-900">
              B
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-neutral-200 truncate group-hover:text-purple-300">
                {videoB.model}
              </div>
              <div className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                <span>{videoB.steps}st</span>
                <span>·</span>
                <span>{videoB.width}x{videoB.height}</span>
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
              className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${layout === 'split' ? 'bg-neutral-800 text-teal-400' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Lado a lado (Split 50/50)"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('vertical')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${layout === 'vertical' ? 'bg-neutral-800 text-teal-400' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Arriba / Abajo (Con panel de análisis a la derecha)"
            >
              <SplitSquareVertical className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('slider')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${layout === 'slider' ? 'bg-neutral-800 text-teal-400' : 'text-neutral-400 hover:text-neutral-200'}`}
              title="Slider Cortinilla con Ratón (Wipe Compare)"
            >
              <MoveHorizontal className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-800/80 hover:bg-rose-900/60 hover:text-rose-300 text-neutral-300 transition-colors ml-1 cursor-pointer"
            title="Cerrar comparador (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Comparative Viewport - Optimized with Vertical Right-Side Panel */}
      <div className="flex-1 min-h-0 relative bg-black flex overflow-hidden">
        {/* If Vertical Layout: Video Left Area (60%), Details Right Area (40%) */}
        {layout === 'vertical' ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Stacked Videos on Left Column */}
            <div className="flex-1 lg:w-3/5 grid grid-rows-2 gap-1 p-1 bg-black overflow-hidden">
              {/* Vídeo A Panel */}
              <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden border border-blue-900/30 rounded-lg group">
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/40 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  <span className="text-xs font-bold text-blue-300 font-mono">Vídeo A</span>
                  <span className="text-xs text-neutral-300 font-medium truncate max-w-[150px]">({videoA.model})</span>
                  <button
                    onClick={() => setPickerTarget('A')}
                    className="ml-1 text-[10px] bg-blue-900/60 hover:bg-blue-800 text-blue-200 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer"
                  >
                    Cambiar
                  </button>
                </div>

                <video
                  ref={videoRefA}
                  src={urlA}
                  crossOrigin="anonymous"
                  playsInline
                  muted={audioSource !== 'A' && audioSource !== 'both'}
                  onLoadedMetadata={() => handleLoadedMetadata('A')}
                  onCanPlay={() => handleCanPlay('A')}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Vídeo B Panel */}
              <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden border border-purple-900/30 rounded-lg group">
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-purple-500/40 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                  <span className="text-xs font-bold text-purple-300 font-mono">Vídeo B</span>
                  <span className="text-xs text-neutral-300 font-medium truncate max-w-[150px]">({videoB.model})</span>
                  <button
                    onClick={() => setPickerTarget('B')}
                    className="ml-1 text-[10px] bg-purple-900/60 hover:bg-purple-800 text-purple-200 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer"
                  >
                    Cambiar
                  </button>
                </div>

                <video
                  ref={videoRefB}
                  src={urlB}
                  crossOrigin="anonymous"
                  playsInline
                  muted={audioSource !== 'B' && audioSource !== 'both'}
                  onLoadedMetadata={() => handleLoadedMetadata('B')}
                  onCanPlay={() => handleCanPlay('B')}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>

            {/* Right Side Analysis & Differences Column */}
            <div className="lg:w-2/5 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-950 flex flex-col overflow-hidden shrink-0">
              {/* Right Panel Tabs */}
              <div className="p-3 bg-neutral-900/70 border-b border-neutral-800 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab('diffs')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeTab === 'diffs' 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Diferencias ({differentCount})
                  </button>
                  <button
                    onClick={() => setActiveTab('prompt')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeTab === 'prompt' 
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' 
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Prompt Diff
                  </button>
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeTab === 'all' 
                        ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm' 
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Todos
                  </button>
                </div>
              </div>

              {/* Right Panel Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === 'prompt' ? renderPromptDiffView() : renderParametersTable()}
              </div>
            </div>
          </div>
        ) : layout === 'slider' ? (
          // Interactive Wipe Reveal Slider
          <div 
            ref={sliderContainerRef}
            onMouseDown={handleMouseDownSlider}
            className="flex-1 relative flex items-center justify-center overflow-hidden cursor-ew-resize select-none bg-neutral-950"
          >
            {/* Top Indicator */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 shadow-xl">
              <MoveHorizontal className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-bold text-neutral-200">
                Arrastra el slider con el ratón: {Math.round(sliderPosition)}%
              </span>
              <span className="text-[10px] text-blue-400 font-mono ml-2">Izquierda: A ({videoA.model})</span>
              <span className="text-neutral-600">|</span>
              <span className="text-[10px] text-purple-400 font-mono">Derecha: B ({videoB.model})</span>
            </div>

            {/* Video A (Full Width Underlying) */}
            <video
              ref={videoRefA}
              src={urlA}
              crossOrigin="anonymous"
              playsInline
              muted={audioSource !== 'A' && audioSource !== 'both'}
              onLoadedMetadata={() => handleLoadedMetadata('A')}
              onCanPlay={() => handleCanPlay('A')}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Video B (Clipped Overlay via sliderPosition) */}
            <div 
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
            >
              <video
                ref={videoRefB}
                src={urlB}
                crossOrigin="anonymous"
                playsInline
                muted={audioSource !== 'B' && audioSource !== 'both'}
                onLoadedMetadata={() => handleLoadedMetadata('B')}
                onCanPlay={() => handleCanPlay('B')}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
            </div>

            {/* Draggable Divider Line & Knob */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.8)] z-30 pointer-events-none"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-teal-400 text-neutral-950 flex items-center justify-center shadow-2xl border-2 border-white">
                <MoveHorizontal className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          // Split Horizontal (50/50)
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-1 p-1 overflow-hidden">
            {/* Vídeo A Panel */}
            <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden border border-blue-900/30 rounded-lg group">
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/40 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="text-xs font-bold text-blue-300 font-mono">Vídeo A</span>
                <span className="text-xs text-neutral-300 font-medium truncate max-w-[150px]">({videoA.model})</span>
                <button
                  onClick={() => setPickerTarget('A')}
                  className="ml-1 text-[10px] bg-blue-900/60 hover:bg-blue-800 text-blue-200 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
              </div>

              <video
                ref={videoRefA}
                src={urlA}
                crossOrigin="anonymous"
                playsInline
                muted={audioSource !== 'A' && audioSource !== 'both'}
                onLoadedMetadata={() => handleLoadedMetadata('A')}
                onCanPlay={() => handleCanPlay('A')}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Vídeo B Panel */}
            <div className="relative bg-neutral-950 flex items-center justify-center overflow-hidden border border-purple-900/30 rounded-lg group">
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-purple-500/40 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                <span className="text-xs font-bold text-purple-300 font-mono">Vídeo B</span>
                <span className="text-xs text-neutral-300 font-medium truncate max-w-[150px]">({videoB.model})</span>
                <button
                  onClick={() => setPickerTarget('B')}
                  className="ml-1 text-[10px] bg-purple-900/60 hover:bg-purple-800 text-purple-200 px-2 py-0.5 rounded font-medium transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
              </div>

              <video
                ref={videoRefB}
                src={urlB}
                crossOrigin="anonymous"
                playsInline
                muted={audioSource !== 'B' && audioSource !== 'both'}
                onLoadedMetadata={() => handleLoadedMetadata('B')}
                onCanPlay={() => handleCanPlay('B')}
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
          <span className="text-xs font-mono font-medium text-teal-400 min-w-[55px]">
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
              disabled={!areBothVideosReady}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-teal-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <span className="text-xs font-mono font-medium text-neutral-500 min-w-[55px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Master Control Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Play Button - Blocked until both ready */}
            <button
              onClick={togglePlay}
              disabled={!areBothVideosReady}
              className={`flex items-center gap-2 font-bold px-4 py-2 rounded-lg text-sm transition-all ${
                areBothVideosReady
                  ? 'bg-teal-500 hover:bg-teal-400 text-neutral-950 shadow-[0_0_15px_rgba(20,184,166,0.3)] hover:scale-105 active:scale-95 cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
              }`}
              title={areBothVideosReady ? "Reproducir / Pausar ambos (Espacio)" : "Cargando vídeos, espera un momento..."}
            >
              {!areBothVideosReady ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  <span>Cargando vídeos...</span>
                </>
              ) : isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pausa</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              disabled={!areBothVideosReady}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Rebobinar al inicio (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => stepFrame(-1)}
              disabled={!areBothVideosReady}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Fotograma anterior (-1 Frame: Flecha Izquierda)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => stepFrame(1)}
              disabled={!areBothVideosReady}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Siguiente fotograma (+1 Frame: Flecha Derecha)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-2 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
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
                  className={`px-2 py-1 text-xs font-semibold rounded font-mono transition-colors cursor-pointer ${
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

          {/* Audio Selector (Muted, Audio A, Audio B, Both) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400 mr-1 hidden sm:inline">Audio:</span>
            <button
              onClick={() => setAudioSource('muted')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                audioSource === 'muted' 
                  ? 'bg-neutral-700 text-white shadow-sm' 
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <VolumeX className="w-3.5 h-3.5" /> Silencio
            </button>
            <button
              onClick={() => setAudioSource('A')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                audioSource === 'A' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-neutral-800 text-blue-400 hover:bg-neutral-700'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Audio A
            </button>
            <button
              onClick={() => setAudioSource('B')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                audioSource === 'B' 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'bg-neutral-800 text-purple-400 hover:bg-neutral-700'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Audio B
            </button>
            <button
              onClick={() => setAudioSource('both')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                audioSource === 'both' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-neutral-800 text-emerald-400 hover:bg-neutral-700'
              }`}
              title="Reproducir pistas de audio de ambos vídeos simultáneamente"
            >
              <Volume2 className="w-3.5 h-3.5" /> Ambos
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Differences Matrix & Diff Spotlight (Used when layout !== 'vertical') */}
      {layout !== 'vertical' && (
        <div className="max-h-[35vh] overflow-y-auto bg-neutral-950 border-t border-neutral-800 flex flex-col shrink-0">
          {/* Navigation Tabs */}
          <div className="px-6 py-2.5 bg-neutral-900/60 border-b border-neutral-800/80 flex items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('diffs')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
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
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
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
            {activeTab === 'prompt' ? renderPromptDiffView() : renderParametersTable()}
          </div>
        </div>
      )}

      {/* Visual Video Selector Drawer/Modal - Maximized High-Efficiency Wide Format */}
      {pickerTarget && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-[96vw] max-w-7xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 border-b border-neutral-800 flex items-center justify-between gap-4 bg-neutral-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-xl border font-bold text-xs uppercase tracking-wider ${
                  pickerTarget === 'A' 
                    ? 'bg-blue-950 text-blue-300 border-blue-700' 
                    : 'bg-purple-950 text-purple-300 border-purple-700'
                }`}>
                  Asignar a Slot {pickerTarget}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                    <span>Selector Rápido de Vídeo</span>
                    <span className="text-xs font-normal text-neutral-400">
                      ({pickerFilteredVideos.length} de {allVideos.length} vídeos)
                    </span>
                  </h3>
                </div>
              </div>

              {/* Live Preview Comparison Pill in Header */}
              <div className="hidden md:flex items-center gap-3 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <span className="text-[10px] font-bold uppercase text-blue-400">A:</span>
                  <span className="truncate max-w-[120px] font-medium text-neutral-200">{videoA.model}</span>
                </div>
                <span className="text-neutral-600">vs</span>
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <span className="text-[10px] font-bold uppercase text-purple-400">B:</span>
                  <span className="truncate max-w-[120px] font-medium text-neutral-200">{videoB.model}</span>
                </div>
              </div>

              <button
                onClick={() => setPickerTarget(null)}
                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Cerrar selector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Density Control Bar */}
            <div className="p-3 sm:px-6 border-b border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Search Bar */}
              <div className="flex-1 min-w-[220px] max-w-md relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Buscar por prompt, autor, modelo, tags, hardware, resolución..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-teal-500 transition-colors"
                  autoFocus
                />
                {pickerSearch && (
                  <button
                    onClick={() => setPickerSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Filter Selects */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Model Filter */}
                <select
                  value={pickerModelFilter}
                  onChange={e => setPickerModelFilter(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">Todos los modelos</option>
                  {uniqueModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                {/* Author Filter */}
                {uniqueAuthors.length > 0 && (
                  <select
                    value={pickerAuthorFilter}
                    onChange={e => setPickerAuthorFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">Todos los autores</option>
                    {uniqueAuthors.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                )}

                {/* Resolution Filter */}
                {uniqueResolutions.length > 0 && (
                  <select
                    value={pickerResolutionFilter}
                    onChange={e => setPickerResolutionFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">Resoluciones</option>
                    {uniqueResolutions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}

                {/* Folder/Group Filter */}
                {uniqueGroups.length > 0 && (
                  <select
                    value={pickerGroupFilter}
                    onChange={e => setPickerGroupFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="all">Todas las carpetas</option>
                    {uniqueGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                )}

                {(pickerModelFilter !== 'all' || pickerAuthorFilter !== 'all' || pickerResolutionFilter !== 'all' || pickerGroupFilter !== 'all' || pickerSearch) && (
                  <button
                    onClick={() => {
                      setPickerSearch('');
                      setPickerModelFilter('all');
                      setPickerAuthorFilter('all');
                      setPickerResolutionFilter('all');
                      setPickerGroupFilter('all');
                    }}
                    className="text-xs text-teal-400 hover:text-teal-300 font-medium px-2 py-1 transition-colors cursor-pointer"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>

              {/* Grid Column Density Controls & Pagination sizing */}
              <div className="flex items-center gap-3">
                {/* Column Layout Controls */}
                <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1">
                  <span className="text-[11px] text-neutral-500 px-1 font-medium hidden sm:inline">Columnas:</span>
                  {[2, 3, 4, 5].map(cols => (
                    <button
                      key={cols}
                      onClick={() => setPickerCols(cols as PickerCols)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        pickerCols === cols 
                          ? 'bg-teal-500 text-neutral-950 shadow-sm' 
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                      title={`Ver en ${cols} columnas`}
                    >
                      {cols}
                    </button>
                  ))}
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span className="hidden sm:inline">Ver:</span>
                  <select
                    value={pickerPageSize}
                    onChange={e => setPickerPageSize(Number(e.target.value))}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value={6}>6 vídeos</option>
                    <option value={8}>8 vídeos</option>
                    <option value={16}>16 vídeos</option>
                    <option value={24}>24 vídeos</option>
                    <option value={-1}>Todos</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Compact Video Cards Grid - Clean, high-density & no prompt bloat */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {pickerFilteredVideos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <Film className="w-12 h-12 text-neutral-700 mb-3" />
                  <p className="text-base font-semibold text-neutral-200">No se encontraron vídeos</p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    Ningún vídeo coincide con los filtros aplicados. Prueba a borrar la búsqueda o cambiar los filtros.
                  </p>
                  <button
                    onClick={() => {
                      setPickerSearch('');
                      setPickerModelFilter('all');
                      setPickerAuthorFilter('all');
                      setPickerResolutionFilter('all');
                      setPickerGroupFilter('all');
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-teal-400 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Restablecer todos los filtros
                  </button>
                </div>
              ) : (
                <div className={`grid ${pickerGridClass} gap-3 sm:gap-4`}>
                  {paginatedVideos.map(vid => {
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
                        className={`group/card relative flex flex-col rounded-xl border bg-neutral-950 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-[1.015] ${
                          isCurrentTarget
                            ? pickerTarget === 'A'
                              ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-950/20'
                              : 'border-purple-500 ring-2 ring-purple-500/40 bg-purple-950/20'
                            : 'border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {/* Video Thumbnail Stage */}
                        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                          <video
                            src={vidUrl}
                            muted
                            playsInline
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                            onMouseEnter={e => (e.target as HTMLVideoElement).play().catch(() => {})}
                            onMouseLeave={e => {
                              const v = e.target as HTMLVideoElement;
                              v.pause();
                              v.currentTime = 0;
                            }}
                          />

                          {/* Gradient Overlays */}
                          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/60 pointer-events-none" />

                          {/* Top Badges */}
                          <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                            <span className="px-2 py-0.5 rounded-md bg-neutral-900/90 text-teal-400 font-bold text-[11px] border border-teal-500/30 truncate max-w-[140px] shadow-sm">
                              {vid.model}
                            </span>
                            {vid.renderSeconds !== undefined && vid.renderSeconds > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-black/80 text-amber-300 font-mono text-[10px] flex items-center gap-1 border border-neutral-700 shadow-sm">
                                <Clock className="w-2.5 h-2.5" />
                                {vid.renderSeconds < 60 
                                  ? `${vid.renderSeconds}s` 
                                  : `${Math.floor(vid.renderSeconds / 60)}m ${vid.renderSeconds % 60}s`}
                              </span>
                            )}
                          </div>

                          {/* Slot selection badge if currently selected */}
                          {isCurrentA && (
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-lg">
                              <Check className="w-3 h-3" /> Slot A
                            </div>
                          )}
                          {isCurrentB && (
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-purple-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-lg">
                              <Check className="w-3 h-3" /> Slot B
                            </div>
                          )}
                        </div>

                        {/* Card Info & Crucial Metrics */}
                        <div className="p-2.5 flex flex-col gap-1.5 bg-neutral-900/90">
                          {/* Row 1: Author & Group */}
                          <div className="flex items-center justify-between text-[11px] text-neutral-300">
                            <span className="flex items-center gap-1 truncate max-w-[130px]" title={vid.creatorDisplayName || vid.createdBy || 'Anónimo'}>
                              <User className="w-3 h-3 text-neutral-500 shrink-0" />
                              <span className="truncate font-medium">
                                {vid.creatorDisplayName || (vid.createdBy ? vid.createdBy.split('@')[0] : 'Anónimo')}
                              </span>
                            </span>
                            {vid.groupName && (
                              <span className="text-[10px] text-neutral-500 truncate max-w-[100px]" title={vid.groupName}>
                                📁 {vid.groupName}
                              </span>
                            )}
                          </div>

                          {/* Row 2: Crucial Technical Metrics Grid */}
                          <div className="grid grid-cols-3 gap-1 text-[10px] font-mono pt-1 border-t border-neutral-800/80">
                            <div className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800/60 text-neutral-300 text-center truncate" title="Steps">
                              <span className="text-neutral-500 font-sans">St: </span>
                              <span className="text-teal-400 font-bold">{vid.steps || '-'}</span>
                            </div>
                            <div className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800/60 text-neutral-300 text-center truncate" title="Resolución">
                              <span>{vid.width && vid.height ? `${vid.width}x${vid.height}` : '-'}</span>
                            </div>
                            <div className="bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800/60 text-neutral-300 text-center truncate" title="Peso del archivo">
                              <span>{formatBytes(vid.fileSizeBytes)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Pagination Footer */}
            {pickerFilteredVideos.length > 0 && totalPages > 1 && (
              <div className="p-3 sm:px-6 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-4 shrink-0 text-xs">
                <span className="text-neutral-400">
                  Mostrando página <span className="text-neutral-200 font-bold">{pickerPage}</span> de{' '}
                  <span className="text-neutral-200 font-bold">{totalPages}</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPickerPage(p => Math.max(1, p - 1))}
                    disabled={pickerPage === 1}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-300 font-medium transition-colors cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPickerPage(p => Math.min(totalPages, p + 1))}
                    disabled={pickerPage >= totalPages}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-300 font-medium transition-colors cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
