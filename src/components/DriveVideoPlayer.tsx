import { useMemo } from 'react';
import { cn } from '../lib/utils';
import { ExternalLink } from 'lucide-react';

interface DriveVideoPlayerProps {
  url: string;
  className?: string;
}

export function DriveVideoPlayer({ url, className }: DriveVideoPlayerProps) {
  const embedUrl = useMemo(() => {
    try {
      // Extraer el ID de diferentes formatos de Google Drive
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
      return url;
    } catch {
      return url;
    }
  }, [url]);

  return (
    <div className={cn("relative w-full overflow-hidden bg-neutral-950 rounded-xl aspect-video min-h-[260px] sm:min-h-[320px] md:min-h-[360px] flex items-center justify-center border border-neutral-800", className)}>
      {embedUrl ? (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0 absolute inset-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title="Previsualización de vídeo"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-neutral-500 text-sm">
          <span>Enlace de vídeo no válido</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-400 hover:underline flex items-center gap-1"
          >
            Abrir enlace directo <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

