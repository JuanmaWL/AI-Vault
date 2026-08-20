import { useMemo } from 'react';
import { cn } from '../lib/utils';

interface DriveVideoPlayerProps {
  url: string;
  className?: string;
}

export function DriveVideoPlayer({ url, className }: DriveVideoPlayerProps) {
  const embedUrl = useMemo(() => {
    try {
      // Intentar extraer el ID del enlace estándar de Google Drive
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
      return url; // Retornar url original si no coincide
    } catch (e) {
      return url;
    }
  }, [url]);

  return (
    <div className={cn("relative w-full overflow-hidden bg-neutral-900 rounded-lg aspect-video", className)}>
      {embedUrl ? (
        <iframe
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full border-0"
          allow="autoplay; fullscreen"
          allowFullScreen
          title="Video Preview"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-neutral-500">
          Enlace no válido
        </div>
      )}
    </div>
  );
}
