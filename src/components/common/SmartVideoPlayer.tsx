import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Film, AlertCircle, RefreshCw } from 'lucide-react';

export interface SmartVideoPlayerProps {
  src: string;
  className?: string;
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  poster?: string;
  title?: string;
  aspectRatio?: string; // default aspect-video
  videoRef?: (el: HTMLVideoElement | null) => void;
  onLoadedData?: () => void;
  onCanPlay?: () => void;
}

export const SmartVideoPlayer = forwardRef<HTMLVideoElement, SmartVideoPlayerProps>(function SmartVideoPlayer({
  src,
  className = 'w-full h-full object-contain',
  controls = true,
  preload = 'metadata',
  autoPlay = false,
  loop = false,
  muted = false,
  playsInline = true,
  poster,
  title,
  aspectRatio = 'aspect-video',
  videoRef: externalVideoRefCallback,
  onLoadedData,
  onCanPlay,
}, ref) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);

  useImperativeHandle(ref, () => internalVideoRef.current as HTMLVideoElement);

  // Set internal and external ref callback
  const handleSetRef = (el: HTMLVideoElement | null) => {
    internalVideoRef.current = el;
    if (externalVideoRefCallback) {
      externalVideoRefCallback(el);
    }
  };

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src, reloadKey]);

  const handleLoadedData = () => {
    setIsLoaded(true);
    setHasError(false);
    if (onLoadedData) onLoadedData();
  };

  const handleCanPlay = () => {
    setIsLoaded(true);
    setHasError(false);
    if (onCanPlay) onCanPlay();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoaded(false);
    setReloadKey(k => k + 1);
  };

  return (
    <div className={`relative w-full ${aspectRatio} bg-neutral-950 flex items-center justify-center overflow-hidden select-none`}>
      {/* Skeleton / Loading Layer with subtle themed pulse */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 z-10 bg-neutral-950 flex flex-col items-center justify-center gap-2.5 transition-opacity duration-300 pointer-events-none">
          {/* Glowing video icon + spinner */}
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 shadow-inner">
              <Film className="w-4 h-4 text-neutral-500 animate-pulse" />
            </div>
            <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-transparent border-t-teal-500 animate-spin" />
          </div>
          <span className="text-[11px] font-mono text-neutral-500 font-medium tracking-tight">
            Cargando vídeo...
          </span>
        </div>
      )}

      {/* Error Fallback Layer */}
      {hasError && (
        <div className="absolute inset-0 z-10 bg-neutral-950 border border-neutral-850 p-4 flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-4 h-4" />
          </div>
          <p className="text-xs text-neutral-300 font-medium">No se pudo cargar el vídeo</p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-750 text-[11px] text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reintentar</span>
          </button>
        </div>
      )}

      {/* HTML5 Native Video element with smooth fade-in */}
      <video
        key={`${src}-${reloadKey}`}
        ref={handleSetRef}
        src={src}
        controls={controls}
        preload={preload}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        poster={poster}
        title={title}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        onError={handleError}
        className={`${className} transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
});
