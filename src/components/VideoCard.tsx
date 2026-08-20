import { VideoRecord } from '../types';
import { DriveVideoPlayer } from './DriveVideoPlayer';
import { Layers, Settings, Workflow, Target, PlaySquare } from 'lucide-react';

interface VideoCardProps {
  video: VideoRecord;
}

export function VideoCard({ video }: VideoCardProps) {
  return (
    <div className="flex flex-col xl:flex-row bg-neutral-800/50 border border-neutral-700/50 rounded-xl overflow-hidden hover:border-neutral-600 transition-colors">
      {/* Zona de previsualización de vídeo */}
      <div className="w-full xl:w-[480px] shrink-0 bg-black/40 border-b xl:border-b-0 xl:border-r border-neutral-700/50 p-4 flex items-center justify-center">
        <DriveVideoPlayer url={video.videoUrl} className="shadow-lg" />
      </div>

      {/* Zona de datos técnicos */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <PlaySquare className="w-4 h-4" /> Prompt Generativo
          </h3>
          <p className="text-neutral-200 text-base leading-relaxed bg-neutral-900/50 p-4 rounded-lg border border-neutral-700/50">
            {video.prompt}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-auto">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Modelo</span>
            <span className="text-sm font-medium text-neutral-300 bg-neutral-800 px-2 py-1.5 rounded-md inline-flex w-fit">{video.model}</span>
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Resolución</span>
            <span className="text-sm font-medium text-neutral-300 bg-neutral-800 px-2 py-1.5 rounded-md inline-flex w-fit">{video.resolution}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Steps</span>
            <span className="text-sm font-medium text-neutral-300 bg-neutral-800 px-2 py-1.5 rounded-md inline-flex w-fit">{video.steps}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5"><Workflow className="w-3.5 h-3.5" /> Shift</span>
            <span className="text-sm font-medium text-neutral-300 bg-neutral-800 px-2 py-1.5 rounded-md inline-flex w-fit">{video.shift}</span>
          </div>
        </div>

        {video.loras && video.loras.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-700/50">
            <span className="text-xs text-neutral-500 mb-2 block">LoRAs Aplicados</span>
            <div className="flex flex-wrap gap-2">
              {video.loras.map((lora, idx) => (
                <span key={idx} className="text-xs text-teal-300/90 bg-teal-900/30 border border-teal-800/50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span className="font-medium">{lora.name}</span>
                  <span className="opacity-60 text-[10px]">W: {lora.weight}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
