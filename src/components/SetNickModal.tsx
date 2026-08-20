import { useState, FormEvent } from 'react';
import { updateProfile, User } from 'firebase/auth';
import { X, User as UserIcon, Check } from 'lucide-react';

interface SetNickModalProps {
  user: User;
  onClose: () => void;
  onUpdated: (newNick: string) => void;
}

export function SetNickModal({ user, onClose, onUpdated }: SetNickModalProps) {
  const [nick, setNick] = useState(user.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanNick = nick.trim();
    if (!cleanNick) {
      setError('Por favor, escribe un apodo o nombre.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateProfile(user, {
        displayName: cleanNick
      });
      onUpdated(cleanNick);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar el apodo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-teal-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">Configurar Apodo</h2>
              <p className="text-xs text-neutral-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              ¿Cómo quieres que te llamemos?
            </label>
            <input
              type="text"
              required
              autoFocus
              maxLength={25}
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Ej: Juanma, WanMaster, etc."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50 transition-all placeholder:text-neutral-600"
            />
            <p className="text-[11px] text-neutral-500">
              Este nombre aparecerá en la cabecera y en los registros que crees.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-teal-500 hover:bg-teal-400 text-neutral-950 font-semibold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Guardar Apodo
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
