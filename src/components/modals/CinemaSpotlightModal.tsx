import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoRecord } from '../../types';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Check, 
  Info, 
  Layers, 
  Gauge, 
  Cpu, 
  Keyboard,
  Sparkles,
  GripHorizontal,
  Eye,
  Tag,
  Clock,
  HardDrive,
  SlidersHorizontal,
  AlignLeft,
  Calendar,
  User,
  Sliders,
  Clapperboard,
  Zap,
  Flame,
} from 'lucide-react';
import { getPlayableVideoUrl, extractTechnicalDetails, extractCreationDateFromText, SOFTWARE_ICONS, GPU_LOGOS, getGpuVendor, formatBytes, calculateEfficiencyMetrics } from '../../lib/utils';
import { SmartVideoPlayer } from '../common/SmartVideoPlayer';

interface CinemaSpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoRecord[];
  initialVideoIndex: number;
}

type OverlayOpacity = 100 | 80 | 50 | 25;

export function CinemaSpotlightModal({
  isOpen,
  onClose,
  videos,
  initialVideoIndex,
}: CinemaSpotlightModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialVideoIndex);
  const [direction, setDirection] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showMetadataOverlay, setShowMetadataOverlay] = useState<boolean>(false);
  const [isDetailedView, setIsDetailedView] = useState<boolean>(true);
  const [overlayOpacity, setOverlayOpacity] = useState<OverlayOpacity>(25);
  const [showKeyHelp, setShowKeyHelp] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Synchronize index if modal opens with a new initial index, ensure metadata overlay starts closed
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialVideoIndex, videos.length - 1)));
      setDirection(0);
      setShowMetadataOverlay(false);
    }
  }, [isOpen, initialVideoIndex, videos.length]);

  // Disable background scrolling while in Cinema mode
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, [isOpen]);

  const currentVideo = videos[currentIndex] || null;

  // Track fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Apply playback rate & loop whenever video changes or setting changes
  useEffect(() => {
    if (videoElementRef.current) {
      videoElementRef.current.playbackRate = playbackRate;
      videoElementRef.current.loop = isLooping;
      videoElementRef.current.muted = isMuted;
    }
  }, [playbackRate, isLooping, isMuted, currentIndex]);

  // Technical details fallback (100% exact to Catálogo)
  const resolvedTech = useMemo(() => {
    if (!currentVideo) return { textEncoder: undefined, videoVae: undefined, modelVariant: undefined, modelSizeB: undefined, softwareSource: 'wan2gp', displayToolName: 'Wan2GP' };

    let textEnc = currentVideo.textEncoder && currentVideo.textEncoder !== 'Not Found' ? currentVideo.textEncoder : undefined;
    let vae = currentVideo.videoVae && currentVideo.videoVae !== 'Not Found' ? currentVideo.videoVae : undefined;
    let variant = currentVideo.modelVariant;
    let sizeB = currentVideo.modelSizeB;
    let softwareSource = currentVideo.softwareSource;
    let localTool = currentVideo.localTool;

    if ((!textEnc || !vae || !variant || sizeB === undefined || !softwareSource || !localTool) && currentVideo.rawMetadata) {
      try {
        const parsed = typeof currentVideo.rawMetadata === 'string' ? JSON.parse(currentVideo.rawMetadata) : currentVideo.rawMetadata;
        const extracted = extractTechnicalDetails(
          parsed,
          typeof currentVideo.rawMetadata === 'string' ? currentVideo.rawMetadata : JSON.stringify(currentVideo.rawMetadata),
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
  }, [currentVideo]);

  // GPU vendor & branding info
  const gpuInfo = useMemo(() => {
    if (!currentVideo?.hardware) return null;
    const gpuName = typeof currentVideo.hardware === 'object' ? currentVideo.hardware.gpu : String(currentVideo.hardware);
    const vram = typeof currentVideo.hardware === 'object' ? currentVideo.hardware.vram : undefined;
    const vendor = getGpuVendor(gpuName);
    return {
      name: gpuName,
      vram,
      vendor,
      logo: vendor === 'nvidia' ? GPU_LOGOS.nvidia : vendor === 'amd' ? GPU_LOGOS.amd : null
    };
  }, [currentVideo]);

  const efficiencyMetrics = useMemo(() => {
    if (!currentVideo) return null;
    return calculateEfficiencyMetrics(currentVideo.renderSeconds, currentVideo.steps, currentVideo.width, currentVideo.height);
  }, [currentVideo]);

  // Creation date (prioritizes actual creation timestamp extracted from filename/prompt/metadata, fallback to upload date)
  const displayCreationDate = useMemo(() => {
    if (!currentVideo) return null;
    const fromText = extractCreationDateFromText(currentVideo.title) ||
      extractCreationDateFromText(currentVideo.videoUrl) ||
      extractCreationDateFromText(currentVideo.prompt) ||
      extractCreationDateFromText(currentVideo.rawMetadata || '');
    if (fromText) return fromText;

    if (currentVideo.createdAt) {
      try {
        const date = new Date(currentVideo.createdAt);
        if (!isNaN(date.getTime())) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${day}/${month}/${year} ${hours}:${minutes}`;
        }
      } catch {}
    }
    return null;
  }, [currentVideo]);

  const goToPrev = () => {
    setDirection(-1);
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : videos.length - 1));
  };

  const goToNext = () => {
    setDirection(1);
    setCurrentIndex(prev => (prev < videos.length - 1 ? prev + 1 : 0));
  };

  // Easter Egg 4.1: 5 clics rápidos consecutivos sobre el badge de GPU activan GPU Turbo Mode (visual sutil, sin sonido)
  const [gpuTurboActive, setGpuTurboActive] = useState(false);
  const gpuClicksRef = useRef(0);
  const gpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGpuBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    gpuClicksRef.current += 1;
    if (gpuTimerRef.current) clearTimeout(gpuTimerRef.current);

    if (gpuClicksRef.current >= 5) {
      gpuClicksRef.current = 0;
      setGpuTurboActive(true);
      setTimeout(() => {
        setGpuTurboActive(false);
      }, 4000);
    } else {
      gpuTimerRef.current = setTimeout(() => {
        gpuClicksRef.current = 0;
      }, 1000);
    }
  };

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showKeyHelp) {
          setShowKeyHelp(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (videoElementRef.current) {
          if (videoElementRef.current.paused) {
            videoElementRef.current.play();
          } else {
            videoElementRef.current.pause();
          }
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted(prev => !prev);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setShowMetadataOverlay(prev => !prev);
      } else if (e.key === 'k' || e.key === 'K' || e.key === '?') {
        e.preventDefault();
        setShowKeyHelp(prev => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, videos.length, onClose, showKeyHelp]);

  const handleCopyPrompt = () => {
    if (!currentVideo?.prompt) return;
    navigator.clipboard.writeText(currentVideo.prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const cycleOverlayOpacity = () => {
    const opacities: OverlayOpacity[] = [100, 80, 50, 25];
    const nextIdx = (opacities.indexOf(overlayOpacity) + 1) % opacities.length;
    setOverlayOpacity(opacities[nextIdx]);
  };

  const opacityBgClasses: Record<OverlayOpacity, string> = {
    100: 'bg-neutral-900/98 border-neutral-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl',
    80: 'bg-neutral-900/85 border-neutral-750/70 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-xl',
    50: 'bg-neutral-900/55 border-neutral-800/60 shadow-2xl backdrop-blur-md',
    25: 'bg-neutral-900/30 border-neutral-800/40 shadow-xl backdrop-blur-sm',
  };

  if (!isOpen || !currentVideo) return null;

  return (
    <AnimatePresence>
      <div 
        ref={containerRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 backdrop-blur-2xl select-none overflow-hidden"
      >
        {/* ========================================================================= */}
        {/* EFECTO RGB CHROMATIC AMBIENT GLOW OPTIMIZADO POR HARDWARE (GPU / COMPOSITOR) */}
        {/* Monta y desmonta estrictamente con el ciclo de vida del modal            */}
        {/* ========================================================================= */}
        <div 
          className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-0"
          style={{ contain: 'strict' }}
        >
          {/* Aura 1: Rosa Neón / Magenta Fluctuante */}
          <motion.div 
            animate={{
              scale: [1, 1.25, 0.95, 1.15, 1],
              opacity: isFullscreen ? [0.45, 0.7, 0.4, 0.65, 0.45] : [0.35, 0.55, 0.3, 0.5, 0.35],
              rotate: [0, 120, 240, 360],
              x: [-40, 30, -20, 40, -40],
              y: [-30, 40, -40, 20, -30],
            }}
            transition={{
              duration: 14,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' }}
            className="absolute w-[650px] sm:w-[950px] h-[500px] sm:h-[700px] bg-gradient-to-tr from-fuchsia-600/40 via-pink-500/35 to-rose-500/25 rounded-full blur-[140px] mix-blend-screen"
          />

          {/* Aura 2: Violeta Cósmico / Azul Cobalto / Cyan */}
          <motion.div 
            animate={{
              scale: [1.15, 0.9, 1.2, 1, 1.15],
              opacity: isFullscreen ? [0.4, 0.65, 0.35, 0.6, 0.4] : [0.3, 0.5, 0.25, 0.45, 0.3],
              rotate: [360, 240, 120, 0],
              x: [30, -40, 20, -30, 30],
              y: [40, -20, 30, -40, 40],
            }}
            transition={{
              duration: 16,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' }}
            className="absolute w-[600px] sm:w-[900px] h-[450px] sm:h-[650px] bg-gradient-to-bl from-indigo-500/40 via-purple-600/35 to-cyan-500/30 rounded-full blur-[140px] mix-blend-screen"
          />

          {/* Aura 3: Verde Esmeralda / Teal / Ámbar Fuego */}
          <motion.div 
            animate={{
              scale: [0.95, 1.2, 1, 1.15, 0.95],
              opacity: isFullscreen ? [0.35, 0.6, 0.4, 0.55, 0.35] : [0.25, 0.45, 0.3, 0.4, 0.25],
              rotate: [0, -90, -180, -270, -360],
              x: [-20, 40, -30, 10, -20],
            }}
            transition={{
              duration: 11,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' }}
            className="absolute w-[500px] sm:w-[800px] h-[380px] sm:h-[550px] bg-gradient-to-r from-emerald-500/35 via-teal-400/30 to-amber-500/30 rounded-full blur-[120px] mix-blend-screen"
          />

          {/* Anillo de resplandor reactivo central */}
          <motion.div
            animate={{
              opacity: [0.5, 0.85, 0.5],
              scale: [0.98, 1.04, 0.98],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' }}
            className="absolute w-[80%] max-w-5xl h-[65vh] rounded-3xl bg-gradient-to-r from-pink-500/15 via-teal-500/20 to-purple-500/20 blur-[80px] pointer-events-none"
          />
        </div>

        {/* Top Header Bar */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 sm:p-5 flex items-center justify-between bg-gradient-to-b from-neutral-950/95 via-neutral-950/70 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500/20 via-teal-500/20 to-purple-500/20 border border-teal-500/40 text-teal-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(20,184,166,0.35)]">
              <Clapperboard className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
              <span>MODO CINE</span>
            </span>
            <div className="flex flex-col min-w-0">
              <h3 className="text-white font-bold text-sm sm:text-base truncate max-w-[260px] sm:max-w-md drop-shadow">
                {currentVideo.title || currentVideo.model}
              </h3>
              <span className="text-neutral-400 font-mono text-xs">
                {currentIndex + 1} de {videos.length} vídeos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botón de Ayuda de Atajos de Teclado */}
            <button
              onClick={() => setShowKeyHelp(prev => !prev)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showKeyHelp 
                  ? 'bg-teal-950 text-teal-300 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.3)]' 
                  : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700'
              }`}
              title="Atajos de teclado y ayuda (Tecla K o ?)"
            >
              <Keyboard className="w-5 h-5" />
            </button>

            {/* Toggle Info Overlay con efecto parpadeo/brillo sutil cuando está apagado para captar la atención */}
            <button
              onClick={() => setShowMetadataOverlay(prev => !prev)}
              className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                showMetadataOverlay 
                  ? 'bg-teal-950/80 text-teal-300 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.3)]' 
                  : 'bg-neutral-900/90 text-teal-300 border-teal-500/50 shadow-[0_0_12px_rgba(20,184,166,0.35)] animate-pulse hover:text-teal-200 hover:border-teal-400'
              }`}
              title="Mostrar/Ocultar ficha técnica (Tecla I)"
            >
              <Info className="w-5 h-5 text-teal-400" />
              {!showMetadataOverlay && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                </span>
              )}
            </button>

            {/* Toggle Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer"
              title="Pantalla Completa (Tecla F)"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-900/80 hover:bg-rose-500/20 border border-neutral-800 hover:border-rose-500/40 text-neutral-400 hover:text-rose-300 transition-all cursor-pointer ml-1"
              title="Cerrar Modo Cine (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Arrows */}
        {videos.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-3 sm:left-6 z-30 p-3.5 rounded-full bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/90 text-neutral-300 hover:text-teal-300 transition-all shadow-2xl backdrop-blur-md cursor-pointer hover:scale-110 active:scale-95 hover:border-teal-500/40 group"
              title="Vídeo Anterior (←)"
            >
              <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={goToNext}
              className="absolute right-3 sm:right-6 z-30 p-3.5 rounded-full bg-neutral-900/80 hover:bg-neutral-850 border border-neutral-800/90 text-neutral-300 hover:text-teal-300 transition-all shadow-2xl backdrop-blur-md cursor-pointer hover:scale-110 active:scale-95 hover:border-teal-500/40 group"
              title="Vídeo Siguiente (→)"
            >
              <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </>
        )}

        {/* ========================================================================= */}
        {/* VIDEO CANVAS STAGE CON BISELADO PREMIUM Y ESQUINAS MÁS REDONDEADAS (1)     */}
        {/* ========================================================================= */}
        <div className="relative w-full h-full max-w-6xl max-h-[85vh] flex items-center justify-center p-4 sm:p-10 z-10">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentVideo.id || currentVideo.videoUrl}
              custom={direction}
              initial={{ 
                opacity: 0, 
                x: direction > 0 ? 90 : direction < 0 ? -90 : 0, 
                scale: 0.96,
                filter: "blur(6px)"
              }}
              animate={{ 
                opacity: 1, 
                x: 0, 
                scale: 1,
                filter: "blur(0px)"
              }}
              exit={{ 
                opacity: 0, 
                x: direction > 0 ? -90 : direction < 0 ? 90 : 0, 
                scale: 0.96,
                filter: "blur(6px)"
              }}
              transition={{ 
                duration: 0.28, 
                ease: [0.16, 1, 0.3, 1] 
              }}
              className="w-full h-full flex items-center justify-center relative"
            >
              {/* Marco Cinemático Premium: Doble bisel, esquinas redondeadas 28px/3xl y clip perfecto */}
              <div className="relative w-full h-full flex items-center justify-center group/theater">
                {/* Glow perimetral multicromático sutil */}
                <div className="absolute -inset-2 rounded-[32px] bg-gradient-to-r from-pink-500/35 via-teal-400/35 to-purple-500/35 opacity-90 blur-xl pointer-events-none" />
                
                {/* Bisel exterior de titanio satinado */}
                <div className="relative p-1 sm:p-1.5 rounded-[30px] bg-gradient-to-b from-neutral-700/80 via-neutral-900/90 to-neutral-950 border border-neutral-700/60 shadow-[0_25px_80px_rgba(0,0,0,0.95)] max-h-[78vh] flex items-center justify-center">
                  
                  {/* Contenedor interior con esquinas curvadas y overflow-hidden para forzar el redondeado del vídeo HTML5 */}
                  <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-black flex items-center justify-center border border-neutral-800/90 shadow-inner">
                    <SmartVideoPlayer
                      src={getPlayableVideoUrl(currentVideo)}
                      videoRef={(el) => {
                        videoElementRef.current = el;
                        if (el) {
                          el.playbackRate = playbackRate;
                          el.loop = isLooping;
                          el.muted = isMuted;
                          el.play().catch(() => {});
                        }
                      }}
                      className="w-full h-full max-h-[74vh] object-contain rounded-[24px]"
                      controls
                      autoPlay
                      loop={isLooping}
                      muted={isMuted}
                      preload="auto"
                      aspectRatio="aspect-auto"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom Floating Toolbar: Playback Rates & Controls (Draggable) */}
          <motion.div 
            drag
            dragConstraints={containerRef}
            dragElastic={0.1}
            dragMomentum={false}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 sm:bottom-8 z-30 bg-neutral-900/90 backdrop-blur-md border border-neutral-800/90 hover:border-neutral-700/80 rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3.5 shadow-2xl cursor-grab active:cursor-grabbing select-none"
          >
            {/* Grip handle */}
            <div className="flex items-center text-neutral-500 hover:text-neutral-300 pr-0.5 cursor-grab active:cursor-grabbing" title="Arrastrar barra de reproducción">
              <GripHorizontal className="w-4 h-4" />
            </div>

            {/* Play / Pause toggle */}
            <button
              onClick={() => {
                if (videoElementRef.current) {
                  if (videoElementRef.current.paused) videoElementRef.current.play();
                  else videoElementRef.current.pause();
                }
              }}
              className="p-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition-colors cursor-pointer"
              title="Play / Pausa (Espacio)"
            >
              <Play className="w-4 h-4 fill-current" />
            </button>

            {/* Rewind */}
            <button
              onClick={() => {
                if (videoElementRef.current) videoElementRef.current.currentTime = 0;
              }}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 transition-colors cursor-pointer"
              title="Reiniciar a 0:00"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Selector de Velocidad */}
            <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-xl p-0.5">
              {[0.25, 0.5, 0.75, 1, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setPlaybackRate(rate);
                    if (videoElementRef.current) videoElementRef.current.playbackRate = rate;
                  }}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    playbackRate === rate
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                  }`}
                  title={`Velocidad ${rate}x`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Mute */}
            <button
              onClick={() => {
                setIsMuted(prev => !prev);
                if (videoElementRef.current) videoElementRef.current.muted = !isMuted;
              }}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 transition-colors cursor-pointer"
              title="Silenciar / Activar Sonido (M)"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-teal-400" />}
            </button>
          </motion.div>
        </div>

        {/* ========================================================================= */}
        {/* PANEL DE METADATOS REESTRUCTURADO Y JERARQUIZADO (3)                      */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {showMetadataOverlay && (
            <motion.div
              drag
              dragConstraints={containerRef}
              dragElastic={0.1}
              dragMomentum={false}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.2 }}
              className={`absolute bottom-24 right-6 z-40 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-full rounded-2xl p-4 sm:p-5 border transition-colors duration-200 cursor-default ${opacityBgClasses[overlayOpacity]}`}
            >
              {/* Barra de agarre / Arrastre (Drag handle) + Acciones directas */}
              <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-neutral-800/80 select-none">
                <div 
                  className="flex items-center gap-2 cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-200 transition-colors flex-1"
                  title="Arrastra para mover la ficha técnica a cualquier posición"
                >
                  <GripHorizontal className="w-4 h-4 text-neutral-500" />
                  <span className="text-[11px] font-mono font-semibold tracking-wider text-neutral-400 uppercase">
                    Ficha Técnica
                  </span>
                </div>

                {/* Controles: Básico/Detallado, Opacidad y Cerrar directamente */}
                <div className="flex items-center gap-1.5 shrink-0 bg-neutral-950/70 p-1 rounded-xl border border-neutral-800/80">
                  {/* Toggle Básico vs Detallado */}
                  <button
                    onClick={() => setIsDetailedView(prev => !prev)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isDetailedView 
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' 
                        : 'bg-neutral-800 text-neutral-300 hover:text-white border border-transparent'
                    }`}
                    title={isDetailedView ? "Cambiar a Modo Básico" : "Cambiar a Modo Detallado"}
                  >
                    {isDetailedView ? <SlidersHorizontal className="w-3 h-3" /> : <AlignLeft className="w-3 h-3" />}
                    <span>{isDetailedView ? 'Detallado' : 'Básico'}</span>
                  </button>

                  <div className="w-px h-3.5 bg-neutral-800" />

                  {/* Selector de Translucidez */}
                  <button
                    onClick={cycleOverlayOpacity}
                    className="px-1.5 py-0.5 rounded-lg text-[10px] font-mono font-bold text-neutral-400 hover:text-teal-300 hover:bg-neutral-800 transition-colors cursor-pointer flex items-center gap-1"
                    title={`Cambiar opacidad (Actual: ${overlayOpacity}%)`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>{overlayOpacity}%</span>
                  </button>

                  <div className="w-px h-3.5 bg-neutral-800" />

                  {/* Cerrar directamente desde el panel */}
                  <button
                    onClick={() => setShowMetadataOverlay(false)}
                    className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Ocultar ficha técnica (Tecla I para volver a mostrar)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* SECCIÓN 1: MODELO & PIPELINE (Badges integrados con el mismo estilo del catálogo) */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-teal-400 font-mono shadow-sm">
                    {currentVideo.model}
                  </span>

                  {typeof (resolvedTech.modelSizeB ?? currentVideo.modelSizeB) === 'number' && (
                    <span 
                      className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/40 text-teal-300 shadow-sm"
                      title={`Tamaño del modelo: ${resolvedTech.modelSizeB ?? currentVideo.modelSizeB}B parámetros`}
                    >
                      {resolvedTech.modelSizeB ?? currentVideo.modelSizeB}B
                    </span>
                  )}

                  {(resolvedTech.modelVariant || currentVideo.modelVariant) && (
                    <span 
                      className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-950/50 border border-indigo-800/60 text-indigo-300 shadow-sm uppercase"
                      title={`Variante del modelo: ${resolvedTech.modelVariant || currentVideo.modelVariant}`}
                    >
                      {resolvedTech.modelVariant || currentVideo.modelVariant}
                    </span>
                  )}
                </div>

                {/* Software Badge */}
                {resolvedTech.softwareSource === 'maestro' ? (
                  <span 
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-sm flex items-center gap-1.5"
                    title="Generado con Maestro"
                  >
                    <img src={SOFTWARE_ICONS.maestro} alt="Maestro" className="w-3.5 h-3.5 object-contain" />
                    <span>{resolvedTech.displayToolName || 'Maestro'}</span>
                  </span>
                ) : resolvedTech.softwareSource === 'comfyui' ? (
                  <span 
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-300 shadow-sm flex items-center gap-1.5"
                    title="Generado con ComfyUI"
                  >
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>{resolvedTech.displayToolName || 'ComfyUI'}</span>
                  </span>
                ) : resolvedTech.softwareSource === 'wan2gp' || resolvedTech.displayToolName?.toLowerCase().includes('wan') ? (
                  <span 
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 shadow-sm flex items-center gap-1.5"
                    title="Generado con Wan2GP"
                  >
                    <img src={SOFTWARE_ICONS.wan2gp} alt="Wan2GP" className="w-3.5 h-3.5 object-contain" />
                    <span>{resolvedTech.displayToolName || 'Wan2GP'}</span>
                  </span>
                ) : resolvedTech.displayToolName ? (
                  <span 
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 shadow-sm flex items-center gap-1.5"
                    title={`Herramienta: ${resolvedTech.displayToolName}`}
                  >
                    <span>{resolvedTech.displayToolName}</span>
                  </span>
                ) : null}
              </div>

              {/* SECCIÓN 2: PARÁMETROS DE INFERENCIA & GPU (Grid unificado) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono mb-3">
                <div className="bg-neutral-950/70 p-2 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-500 block text-[10px] font-bold uppercase tracking-wider">STEPS</span>
                  <span className="text-neutral-200 font-bold">{currentVideo.steps} pasos</span>
                </div>
                <div className="bg-neutral-950/70 p-2 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-500 block text-[10px] font-bold uppercase tracking-wider">SHIFT</span>
                  <span className="text-neutral-200 font-bold">{currentVideo.shift ?? 'N/A'}</span>
                </div>
                <div className="bg-neutral-950/70 p-2 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-500 block text-[10px] font-bold uppercase tracking-wider">RESOLUCIÓN</span>
                  <span className="text-neutral-200 font-bold">{currentVideo.width}×{currentVideo.height}</span>
                </div>
                <div className="bg-neutral-950/70 p-2 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-500 block text-[10px] font-bold uppercase tracking-wider">TIEMPO RENDER</span>
                  <span className="text-teal-400 font-bold">
                    {currentVideo.renderSeconds !== undefined 
                      ? `${Math.floor(currentVideo.renderSeconds / 60)}m ${Math.round(currentVideo.renderSeconds % 60)}s` 
                      : 'N/A'}
                  </span>
                </div>
                
                {/* GPU Integrada en la misma zona de parámetros con Easter Egg Turbo */}
                <div className="col-span-2 sm:col-span-2 bg-neutral-950/70 p-2 rounded-xl border border-neutral-800/80 flex flex-col justify-between">
                  <span className="text-neutral-500 block text-[10px] font-bold uppercase tracking-wider mb-1">GPU / HARDWARE</span>
                  {gpuInfo ? (
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={handleGpuBadgeClick}
                        className={`text-[11px] px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5 font-bold shadow-sm cursor-pointer select-none transition-all ${
                          gpuTurboActive
                            ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30'
                            : gpuInfo.vendor === 'nvidia'
                            ? 'bg-[#76B900]/15 border-[#76B900]/40 text-[#a3e635] hover:border-[#76b900]/70'
                            : gpuInfo.vendor === 'amd'
                            ? 'bg-[#ED1C24]/15 border-[#ED1C24]/40 text-[#fca5a5] hover:border-[#ED1C24]/70'
                            : 'bg-neutral-900 border-neutral-750 text-neutral-300 hover:border-neutral-600'
                        }`}
                        title={gpuTurboActive ? 'GPU Turbo Mode Activado (+15% Clock)' : (gpuInfo.vram ? `GPU: ${gpuInfo.name} (${gpuInfo.vram}GB VRAM)` : `GPU: ${gpuInfo.name}`)}
                      >
                        {gpuTurboActive ? (
                          <>
                            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                            <span>{gpuInfo.name} · TURBO (+15%)</span>
                          </>
                        ) : (
                          <>
                            {gpuInfo.logo ? (
                              <img 
                                src={gpuInfo.logo} 
                                alt={gpuInfo.vendor} 
                                className="w-3.5 h-3.5 object-contain shrink-0" 
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                            )}
                            <span>{gpuInfo.name}</span>
                            {gpuInfo.vram && (
                              <span className="text-[10px] opacity-80 font-normal">({gpuInfo.vram}GB)</span>
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-neutral-500 font-mono">GPU No Detectada</span>
                  )}
                </div>

                {/* Benchmark de Eficiencia Técnica */}
                {efficiencyMetrics && (
                  <div 
                    className={`col-span-2 sm:col-span-3 p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${efficiencyMetrics.ratingBg} ${efficiencyMetrics.ratingBorder} ${efficiencyMetrics.ratingColor}`}
                    title={`Velocidad de generación de la GPU:\n• Nivel: ${efficiencyMetrics.ratingLabel} (${efficiencyMetrics.score}/100).\n• ¿Qué es MP?: Megapíxeles (${currentVideo?.width}×${currentVideo?.height} ÷ 1.000.000 = ${efficiencyMetrics.megapixels} MP).\n• Cálculo: ${efficiencyMetrics.secPerStep}s/step en ${efficiencyMetrics.megapixels} MP = ${efficiencyMetrics.secPerStepPerMegapixel} s/step/MP normalizado.\n• A menor tiempo por paso normalizado, más rápido renderiza la GPU.`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      {isDetailedView ? (
                        <span>Velocidad: {efficiencyMetrics.secPerStepPerMegapixel} s/step/MP</span>
                      ) : (
                        <span>Velocidad: {efficiencyMetrics.ratingLabel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isDetailedView ? (
                        <span className="text-[11px] text-neutral-400 hidden sm:inline font-mono">
                          {efficiencyMetrics.secPerStep} s/step @ {efficiencyMetrics.megapixels} MP
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400 hidden sm:inline font-sans">
                          {efficiencyMetrics.secPerStep}s/paso
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-bold font-sans bg-neutral-950/70 border border-neutral-800" title="Índice de velocidad relativa (a menor tiempo por paso, mayor puntuación)">
                        {efficiencyMetrics.score}/100 score
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN 3: PIPELINE & ENCODERS (En modo detallado) */}
              {isDetailedView && (
                <div className="bg-neutral-950/70 rounded-xl p-2.5 border border-neutral-800/80 mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-teal-400" />
                      Pipeline & Encoders
                    </span>
                    {displayCreationDate && (
                      <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {displayCreationDate}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                    {/* Text Encoder */}
                    {resolvedTech.textEncoder && (
                      <span 
                        className="text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono bg-blue-950/40 border-blue-800/60 text-blue-300"
                        title={`Text Encoder: ${resolvedTech.textEncoder}`}
                      >
                        <span className="text-[9px] text-blue-400/70 font-sans uppercase font-bold">Encoder:</span>
                        {resolvedTech.textEncoder}
                      </span>
                    )}

                    {/* Video VAE */}
                    {resolvedTech.videoVae && (
                      <span 
                        className="text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono bg-purple-950/40 border-purple-800/60 text-purple-300"
                        title={`Video VAE: ${resolvedTech.videoVae}`}
                      >
                        <span className="text-[9px] text-purple-400/70 font-sans uppercase font-bold">VAE:</span>
                        {resolvedTech.videoVae}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {currentVideo.tags && currentVideo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-neutral-800/60">
                      {currentVideo.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-teal-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECCIÓN 4: PROMPT (Con botón de copiado rápido) */}
              {currentVideo.prompt && (
                <div className="bg-neutral-950/80 rounded-xl p-2.5 border border-neutral-800/90">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">PROMPT</span>
                    <button
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 font-mono transition-colors cursor-pointer"
                    >
                      {copiedPrompt ? <Check className="w-3 h-3 text-teal-300" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPrompt ? 'Copiado' : 'Copiar prompt'}</span>
                    </button>
                  </div>
                  <p className={`text-xs text-neutral-300 leading-relaxed font-sans select-text ${isDetailedView ? 'line-clamp-4' : 'line-clamp-2'}`}>
                    {currentVideo.prompt}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* MODAL / OVERLAY DE ATAJOS DE TECLADO                                      */}
        {/* ========================================================================= */}
        <AnimatePresence>
          {showKeyHelp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 max-w-sm w-[90%] bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 rounded-2xl p-5 shadow-2xl text-neutral-200"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-teal-400" />
                  <h4 className="font-bold text-sm text-white">Atajos de Teclado</h4>
                </div>
                <button
                  onClick={() => setShowKeyHelp(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Play / Pausa</span>
                  <kbd className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 font-mono text-teal-300 font-bold">Espacio</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Vídeo anterior / siguiente</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 font-mono text-teal-300 font-bold">←</kbd>
                    <kbd className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 font-mono text-teal-300 font-bold">→</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Pantalla Completa</span>
                  <kbd className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 font-mono text-teal-300 font-bold">F</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Ficha técnica (Mostrar/Ocultar)</span>
                  <kbd className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 font-mono text-teal-300 font-bold">I</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Silenciar / Audio</span>
                  <kbd className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 font-mono text-teal-300 font-bold">M</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Cerrar Modo Cine</span>
                  <kbd className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800 font-mono text-neutral-300 font-bold">Esc</kbd>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-500 text-center">
                Pulsa cualquier atajo o haz clic fuera para continuar
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
