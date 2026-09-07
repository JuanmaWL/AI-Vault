import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, X } from 'lucide-react';

interface RetroCrtOverlayProps {
  isActive: boolean;
  onToggle: () => void;
}

export function RetroCrtOverlay({ isActive, onToggle }: RetroCrtOverlayProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger brief status toast whenever isActive toggles
  useEffect(() => {
    if (isActive) {
      setToastMessage('🕹️ Modo Retro CRT [Konami Code] Activado');
    } else if (toastMessage !== null) {
      setToastMessage('🕹️ Modo Retro CRT Desactivado');
    }

    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3200);

    return () => clearTimeout(timer);
  }, [isActive]);

  return (
    <>
      {/* Toast de Notificación del Konami Code */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-2.5 rounded-xl bg-neutral-900/95 border border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.35)] backdrop-blur-xl text-amber-300 text-xs font-mono select-none"
          >
            <Tv className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold tracking-wide">{toastMessage}</span>
            <button
              onClick={() => {
                setToastMessage(null);
                if (isActive) onToggle();
              }}
              className="ml-2 text-neutral-400 hover:text-neutral-200 transition-colors"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtro Visual Global Retro CRT (Scanlines + Fósforo Ámbar Sutil) */}
      {isActive && (
        <div 
          className="fixed inset-0 pointer-events-none z-[9990] overflow-hidden select-none"
          style={{ contain: 'strict' }}
        >
          {/* 1. Tinte sutil de fósforo ámbar cálido */}
          <div className="absolute inset-0 bg-amber-500/[0.035] mix-blend-color pointer-events-none" />

          {/* 2. Scanlines analógicas de tubo catódico */}
          <div
            className="absolute inset-0 opacity-[0.22] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.75) 50%)',
              backgroundSize: '100% 3px'
            }}
          />

          {/* 3. Rejilla de apertura de fósforo vertical muy suave */}
          <div
            className="absolute inset-0 opacity-[0.10] mix-blend-screen pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(90deg, rgba(245, 158, 11, 0.2), rgba(0, 0, 0, 0) 50%, rgba(245, 158, 11, 0.2))',
              backgroundSize: '3px 100%'
            }}
          />

          {/* 4. Viñeta y curvatura de esquinas CRT */}
          <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.65)] pointer-events-none" />

          {/* 5. Barrido suave de haz de electrones */}
          <div 
            className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-amber-400/[0.04] to-transparent pointer-events-none animate-[scanline-sweep_8s_linear_infinite]"
          />

          {/* 6. Indicador discreto en esquina inferior izquierda */}
          <div className="absolute bottom-3 left-4 pointer-events-auto">
            <button
              onClick={onToggle}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-950/80 border border-amber-500/40 text-[10px] font-mono text-amber-400/80 hover:text-amber-300 hover:border-amber-400 transition-all backdrop-blur-md shadow-sm group"
              title="Haz clic o vuelve a introducir el Konami Code (↑↑↓↓←→←→BA) para desactivar"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>CRT RETRO [ON]</span>
              <span className="text-neutral-500 group-hover:text-neutral-300 ml-1">✕</span>
            </button>
          </div>

          <style>{`
            @keyframes scanline-sweep {
              0% { transform: translateY(-100%); }
              100% { transform: translateY(1200%); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
