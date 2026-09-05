import { AlertTriangle, ShieldAlert, Check, X } from 'lucide-react';

interface Props {
  count?: number;
  totalCount?: number;
  authorizedCount?: number;
  unauthorizedCount?: number;
  authorIdentifier?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  count = 1,
  totalCount,
  authorizedCount,
  unauthorizedCount = 0,
  authorIdentifier,
  onConfirm,
  onCancel
}: Props) {
  const actualAuthorized = authorizedCount !== undefined ? authorizedCount : count;
  const actualTotal = totalCount !== undefined ? totalCount : count;
  const actualUnauthorized = unauthorizedCount || (actualTotal - actualAuthorized);

  const isNoneAuthorized = actualAuthorized === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Modal Content */}
        <div className="p-6 flex flex-col items-center text-center">
          <div className={`w-12 h-12 ${isNoneAuthorized ? 'bg-amber-950/50 text-amber-400' : 'bg-rose-950/50 text-rose-400'} rounded-full flex items-center justify-center mb-4 ring-8 ${isNoneAuthorized ? 'ring-amber-950/20' : 'ring-rose-950/20'}`}>
            {isNoneAuthorized ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>

          <h2 className="text-lg font-bold text-neutral-100 mb-2">
            {isNoneAuthorized ? 'No tienes permiso para borrar' : 'Confirmar borrado'}
          </h2>

          {isNoneAuthorized ? (
            <div className="space-y-3 mb-6">
              <p className="text-sm text-neutral-300">
                Solo el <strong className="text-white">autor original</strong> de un vídeo puede borrarlo.
              </p>
              <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 text-left leading-relaxed">
                Ninguno de los {actualTotal === 1 ? 'vídeos seleccionados' : `${actualTotal} vídeos seleccionados`} pertenece a tu usuario actual {authorIdentifier ? `(${authorIdentifier})` : ''}.
              </div>
            </div>
          ) : (
            <div className="space-y-3 mb-6 w-full">
              <p className="text-sm text-neutral-300">
                {actualAuthorized === 1 
                  ? '¿Estás seguro de que quieres borrar este vídeo?' 
                  : `¿Estás seguro de que quieres borrar estos ${actualAuthorized} vídeos?`}
              </p>
              <p className="text-xs text-neutral-400">
                Esta acción es permanente y no se puede deshacer.
              </p>

              {actualUnauthorized > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 text-left flex items-start gap-2 leading-relaxed">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso de seguridad:</strong> Se seleccionaron {actualTotal} vídeos en total, pero <strong className="text-amber-200">{actualUnauthorized} pertenecen a otros autores</strong> y quedarán protegidos. Solo se eliminarán los <strong>{actualAuthorized} de tu autoría</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 w-full">
            {isNoneAuthorized ? (
              <button 
                onClick={onCancel} 
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-neutral-200 bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                Cerrar
              </button>
            ) : (
              <>
                <button 
                  onClick={onCancel} 
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={onConfirm} 
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-950/50"
                >
                  {actualAuthorized === 1 ? 'Borrar vídeo' : `Borrar (${actualAuthorized})`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

