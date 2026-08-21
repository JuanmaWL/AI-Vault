import { AlertTriangle } from 'lucide-react';

interface Props {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ count, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 flex flex-col items-center text-center">
           <div className="w-12 h-12 bg-rose-950/50 text-rose-400 rounded-full flex items-center justify-center mb-4">
             <AlertTriangle className="w-6 h-6" />
           </div>
           <h2 className="text-lg font-bold text-neutral-100 mb-2">Confirmar borrado</h2>
           <p className="text-sm text-neutral-400 mb-6">
             ¿Estás seguro de que quieres borrar {count === 1 ? 'este vídeo' : `estos ${count} vídeos`}? Esta acción no se puede deshacer.
           </p>
           <div className="flex gap-3 w-full">
             <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors">
               Cancelar
             </button>
             <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors">
               Borrar {count > 1 && `(${count})`}
             </button>
           </div>
        </div>
      </div>
    </div>
  )
}
