import { VideoRecord } from '../types';
import { DriveVideoPlayer } from './DriveVideoPlayer';
import { Layers, Settings, Workflow, Target, PlaySquare, ExternalLink, Calendar } from 'lucide-react';

interface VideoCardProps {
  video: VideoRecord;
}

export function VideoCard({ video }: VideoCardProps) {
  const formattedDate = video.createdAt
    ? new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(video.createdAt))
    : null;

  return (
    <div className="flex flex-col lg:flex-row bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all shadow-lg">
      {/* Zona de previsualización de vídeo amplia */}
      <div className="w-full lg:w-[540px] xl:w-[620px] shrink-0 bg-neutral-950 p-4 sm:p-6 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-neutral-800">
        <DriveVideoPlayer url={video.videoUrl} className="shadow-2xl" />
        
        <div className="mt-3 flex items-center justify-between text-xs text-neutral-400 px-1">
          {formattedDate ? (
            <span className="flex items-center gap-1.5 text-neutral-500">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
          ) : (
            <span></span>
          )}
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-neutral-400 hover:text-teal-400 transition-colors"
          >
            Abrir en Google Drive <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Zona de datos técnicos */}
      <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <PlaySquare className="w-4 h-4 text-teal-400" /> Prompt Generativo
            </h3>
          </div>
          <p className="text-neutral-200 text-sm sm:text-base leading-relaxed bg-neutral-950/70 p-5 rounded-xl border border-neutral-800/80 font-normal select-text">
            {video.prompt}
          </p>
        </div>

        <div className="mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-neutral-950/40 border border-neutral-800/50">
              <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-neutral-400" /> Modelo
              </span>
              <span className="text-sm font-semibold text-neutral-200 truncate">{video.model}</span>
            </div>
            
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-neutral-950/40 border border-neutral-800/50">
              <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-neutral-400" /> Resolución
              </span>
              <span className="text-sm font-semibold text-neutral-200">{video.resolution}</span>
            </div>

            <div className="flex flex-col gap-1 p-3 rounded-lg bg-neutral-950/40 border border-neutral-800/50">
              <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-neutral-400" /> Steps
              </span>
              <span className="text-sm font-semibold text-neutral-200">{video.steps}</span>
            </div>

            <div className="flex flex-col gap-1 p-3 rounded-lg bg-neutral-950/40 border border-neutral-800/50">
              <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                <Workflow className="w-3.5 h-3.5 text-neutral-400" /> Shift
              </span>
              <span className="text-sm font-semibold text-neutral-200">{video.shift}</span>
            </div>
          </div>

          {video.loras && video.loras.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-800/60">
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
                    <span className="text-[11px] px-1.5 py-0.2 bg-teal-900/60 rounded text-teal-200">
                      peso: {lora.weight}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

