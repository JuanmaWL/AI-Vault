import { Loader2, CheckCircle2 } from 'lucide-react';

interface DeleteProgressModalProps {
  current: number;
  total: number;
  isDone?: boolean;
}

export function DeleteProgressModal({ current, total, isDone }: DeleteProgressModalProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-150">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ring-8 transition-colors duration-200 ${
          isDone ? 'bg-emerald-950/50 text-emerald-400 ring-emerald-950/20' : 'bg-rose-950/50 text-rose-400 ring-rose-950/20'
        }`}>
          {isDone ? (
            <CheckCircle2 className="w-7 h-7 animate-in zoom-in duration-200" />
          ) : (
            <Loader2 className="w-7 h-7 animate-spin text-rose-400" />
          )}
        </div>

        <h3 className="text-base font-bold text-neutral-100 mb-1">
          {isDone ? '¡Vídeos eliminados!' : 'Eliminando vídeos de la bóveda...'}
        </h3>

        <p className="text-xs text-neutral-400 mb-4">
          {isDone 
            ? `Se han eliminado ${total} ${total === 1 ? 'vídeo correctamente' : 'vídeos correctamente'}.`
            : `Procesando eliminación en la base de datos...`}
        </p>

        {/* Barra de progreso */}
        <div className="w-full bg-neutral-950 border border-neutral-800 rounded-full h-3 overflow-hidden p-0.5 mb-2.5">
          <div 
            className={`h-full rounded-full transition-all duration-200 ease-out ${
              isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-rose-500 to-amber-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Métricas numéricas */}
        <div className="flex items-center justify-between w-full text-xs font-mono text-neutral-400 px-1">
          <span>{current} de {total} ({percentage}%)</span>
          <span className="text-[11px] text-neutral-500">
            {isDone ? 'Completado' : 'Eliminando...'}
          </span>
        </div>
      </div>
    </div>
  );
}
