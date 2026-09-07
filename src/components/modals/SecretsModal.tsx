import React, { useEffect } from 'react';
import { Terminal, Zap, Monitor, X, Command, Sparkles, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isRetroMode: boolean;
  onToggleRetroMode: () => void;
}

export const SecretsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  isRetroMode,
  onToggleRetroMode
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                Funciones Ocultas & Atajos
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                  Easter Eggs
                </span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Características no convencionales y comandos integrados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido / Lista de Secretos */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Secreto 1: GPU Turbo Mode */}
          <div className="p-4 rounded-xl bg-neutral-950/50 border border-neutral-800/80 space-y-2.5 hover:border-amber-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-neutral-200 font-mono">
                  GPU Turbo Clock
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                +15% Clock
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Activa un micro-overclocking visual de alta tecnología con resplandor térmico sutil en la tarjeta gráfica seleccionada.
            </p>

            <div className="pt-1 flex items-center gap-2 text-[11px] text-neutral-300 bg-neutral-900/80 px-3 py-2 rounded-lg border border-neutral-800 font-mono">
              <span className="text-teal-400 font-bold">Activación:</span>
              <span>5 clics rápidos consecutivos sobre la etiqueta de GPU</span>
            </div>
          </div>

          {/* Secreto 2: Modo Retro CRT */}
          <div className="p-4 rounded-xl bg-neutral-950/50 border border-neutral-800/80 space-y-2.5 hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-neutral-200 font-mono">
                  Modo Retro CRT (Konami Code)
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleRetroMode}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                  isRetroMode
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                }`}
              >
                {isRetroMode ? '✓ Activo (Apagar)' : 'Probar / Encender'}
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Superpone un filtro analógico de tubo catódico vintage con líneas de exploración (scanlines), viñeta curva y tono fósforo ámbar.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-300 bg-neutral-900/80 px-3 py-2 rounded-lg border border-neutral-800 font-mono">
              <span className="text-teal-400 font-bold mr-1">Secuencia:</span>
              {['↑', '↑', '↓', '↓', '←', '→', '←', '→', 'B', 'A'].map((k, i) => (
                <kbd
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[10px] text-neutral-200 shadow-xs"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>

        </div>

        {/* Pie del modal */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-xs text-neutral-400">
          <span className="text-[11px] text-neutral-500 font-mono">AI Video Vault Dev Secrets</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
