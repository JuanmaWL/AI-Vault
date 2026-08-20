import { useMemo } from 'react';
import { cn, extractDriveFileId } from '../lib/utils';
import { ExternalLink } from 'lucide-react';

interface DriveVideoPlayerProps {
  url?: string;
  driveFileId?: string;
  className?: string;
}

export function DriveVideoPlayer({ url, driveFileId, className }: DriveVideoPlayerProps) {
  const embedUrl = useMemo(() => {
    try {
      const fileId = driveFileId || (url ? extractDriveFileId(url) : '');
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
      return url || '';
    } catch {
      return url || '';
    }
  }, [url, driveFileId]);

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
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 hover:underline flex items-center gap-1"
            >
              Abrir enlace directo <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

