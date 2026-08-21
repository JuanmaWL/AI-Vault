import { useState, useEffect } from 'react';
import { UserHardware } from '../types';
import { Cpu, X, Server, MemoryStick } from 'lucide-react';

interface HardwareProfileModalProps {
  initialData?: UserHardware;
  onClose?: () => void;
  onSave: (hardware: UserHardware) => Promise<void>;
  isMandatory?: boolean;
}

export function HardwareProfileModal({ initialData, onClose, onSave, isMandatory = false }: HardwareProfileModalProps) {
  const [gpu, setGpu] = useState(initialData?.gpu || '');
  const [vram, setVram] = useState<number | ''>(initialData?.vram || '');
  const [ram, setRam] = useState<number | ''>(initialData?.ram || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Focus trap y lock de scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpu.trim() || !vram || !ram) return;
    
    setIsSaving(true);
    setErrorMsg('');
    try {
      await onSave({
        gpu: gpu.trim(),
        vram: Number(vram),
        ram: Number(ram)
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al guardar. ¿Has actualizado las reglas de Firestore?');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-teal-400" />
            Perfil de Hardware
          </h2>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 rounded-md hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {isMandatory && (
            <div className="mb-6 p-3 bg-teal-950/30 border border-teal-900/50 rounded-xl">
              <p className="text-sm text-teal-200/90 leading-relaxed">
                Parece que no tienes configurado tu perfil de hardware. Es necesario para que los vídeos generados guarden un registro exacto del equipo que los procesó.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">Modelo de GPU</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Cpu className="h-4 w-4 text-neutral-500" />
                </div>
                <input
                  type="text"
                  value={gpu}
                  onChange={e => setGpu(e.target.value)}
                  placeholder="Ej: RTX 4070 Ti Super"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">VRAM (GB)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Server className="h-4 w-4 text-neutral-500" />
                  </div>
                  <input
                    type="number"
                    min="4"
                    max="192"
                    value={vram}
                    onChange={e => setVram(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 16"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 uppercase tracking-wider">RAM Sis. (GB)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MemoryStick className="h-4 w-4 text-neutral-500" />
                  </div>
                  <input
                    type="number"
                    min="8"
                    max="256"
                    value={ram}
                    onChange={e => setRam(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 32"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving || !gpu.trim() || !vram || !ram}
              className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(13,148,136,0.2)] hover:shadow-[0_0_20px_rgba(13,148,136,0.3)] active:scale-95 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Perfil'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
