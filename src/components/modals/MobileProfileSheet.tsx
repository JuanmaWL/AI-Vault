import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types';
import { User as UserIcon, Edit3, Cpu, Database, Plus, LogOut, X, Shield, ExternalLink, HardDrive } from 'lucide-react';

interface MobileProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { email: string | null; uid: string };
  userDisplayName: string | null;
  isAdmin: boolean;
  userProfile?: UserProfile | null;
  onOpenEditProfile: () => void;
  onOpenHardwareModal: () => void;
  onOpenBatchImport: () => void;
  onOpenAddVideo: () => void;
  onLogout: () => void;
  usingLocal: boolean;
}

export function MobileProfileSheet({
  isOpen,
  onClose,
  currentUser,
  userDisplayName,
  isAdmin,
  userProfile,
  onOpenEditProfile,
  onOpenHardwareModal,
  onOpenBatchImport,
  onOpenAddVideo,
  onLogout,
  usingLocal,
}: MobileProfileSheetProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden" role="dialog" aria-modal="true">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-h-[85vh] bg-neutral-900 border-t border-neutral-800 rounded-t-3xl shadow-2xl flex flex-col z-10 overflow-hidden"
        >
          <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />

          {/* Cabecera del usuario */}
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-300 flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-base truncate">
                  {userDisplayName || 'Usuario'}
                </div>
                <div className="text-xs text-neutral-400 truncate">
                  {currentUser.email}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${usingLocal ? 'bg-amber-500' : 'bg-teal-500'}`} />
                  <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                    {usingLocal ? 'Modo Local' : 'Conectado'}
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded font-semibold ml-1">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 cursor-pointer"
              aria-label="Cerrar perfil"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Opciones táctiles principales */}
          <div className="p-4 space-y-2 overflow-y-auto">
            {/* Editar Perfil */}
            <button
              onClick={() => {
                onClose();
                onOpenEditProfile();
              }}
              className="w-full h-13 px-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 flex items-center justify-between text-sm active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-neutral-800/80 flex items-center justify-center text-teal-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-white">Editar Perfil & HF Dataset</div>
                  <div className="text-[11px] text-neutral-500">Nombre público y enlace de sincronización</div>
                </div>
              </div>
            </button>

            {/* Hardware Profile (Admin) */}
            {isAdmin && (
              <button
                onClick={() => {
                  onClose();
                  onOpenHardwareModal();
                }}
                className="w-full h-13 px-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 flex items-center justify-between text-sm active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-neutral-800/80 flex items-center justify-center text-teal-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">Perfil de Hardware</div>
                    <div className="text-[11px] text-neutral-500">
                      {userProfile?.hardware?.gpu || 'Configurar GPU y especificaciones'}
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* Batch Import (Admin) */}
            {isAdmin && (
              <button
                onClick={() => {
                  onClose();
                  onOpenBatchImport();
                }}
                className="w-full h-13 px-4 rounded-2xl bg-teal-950/40 border border-teal-800/50 hover:border-teal-700 text-teal-200 flex items-center justify-between text-sm active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-300">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-teal-100">Batch Import</div>
                    <div className="text-[11px] text-teal-400/70">Importar múltiples vídeos por URL</div>
                  </div>
                </div>
              </button>
            )}

            {/* Nuevo Registro (Admin) */}
            {isAdmin && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAddVideo();
                }}
                className="w-full h-13 px-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-200 flex items-center justify-between text-sm active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-neutral-800/80 flex items-center justify-center text-teal-400">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-white">Nuevo Registro</div>
                    <div className="text-[11px] text-neutral-500">Subir o registrar vídeo individual</div>
                  </div>
                </div>
              </button>
            )}

            {/* Cerrar sesión */}
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full h-12 px-4 rounded-2xl bg-rose-950/30 border border-rose-900/40 hover:bg-rose-950/50 text-rose-300 flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.99] transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
