import { useState, useEffect, useMemo } from 'react';
import { UserHardware, HardwareMilestone } from '../types';
import { Cpu, X, Server, MemoryStick, Calendar, Plus, Trash2, History, AlertCircle, Check, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface HardwareProfileModalProps {
  initialData?: UserHardware;
  initialHardware?: UserHardware;
  initialHistory?: HardwareMilestone[];
  onClose?: () => void;
  onSave: (hardware: UserHardware, history?: HardwareMilestone[], initialHardware?: UserHardware) => Promise<void>;
  isMandatory?: boolean;
}

export function HardwareProfileModal({ 
  initialData, 
  initialHardware,
  initialHistory, 
  onClose, 
  onSave, 
  isMandatory = false 
}: HardwareProfileModalProps) {
  const [gpu, setGpu] = useState(initialData?.gpu || '');
  const [vram, setVram] = useState<number | ''>(initialData?.vram || '');
  const [ram, setRam] = useState<number | ''>(initialData?.ram || '');
  
  // Configuración de origen (anterior al primer hito de hardware)
  const [initialGpu, setInitialGpu] = useState(initialHardware?.gpu || '');
  const [initialVram, setInitialVram] = useState<number | ''>(initialHardware?.vram || '');
  const [initialRam, setInitialRam] = useState<number | ''>(initialHardware?.ram || '');

  const [history, setHistory] = useState<HardwareMilestone[]>(initialHistory || []);
  const [showHistory, setShowHistory] = useState(Boolean(initialHistory && initialHistory.length > 0));
  const [showAddForm, setShowAddForm] = useState(false);

  // Upgrade form state
  const [upgradeDate, setUpgradeDate] = useState('');
  const [changeType, setChangeType] = useState<'ram' | 'gpu' | 'both'>('ram');
  const [newRam, setNewRam] = useState<number | ''>('');
  const [newGpu, setNewGpu] = useState('');
  const [newVram, setNewVram] = useState<number | ''>('');
  const [validationError, setValidationError] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Lock scroll on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Sorted history by date descending for display
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => b.sinceDate.localeCompare(a.sinceDate));
  }, [history]);

  // Validation logic for the upgrade form
  const validateUpgrade = (): string | null => {
    if (!upgradeDate) {
      return 'Selecciona la fecha en la que se produjo el cambio.';
    }
    
    // Check if date already exists in history
    if (history.some(h => h.sinceDate === upgradeDate)) {
      return `Ya existe un hito registrado para la fecha ${upgradeDate}.`;
    }

    if (changeType === 'ram' || changeType === 'both') {
      if (!newRam || Number(newRam) <= 0) {
        return 'Indica los GB de la nueva memoria RAM.';
      }
      if (Number(newRam) === Number(ram)) {
        return 'La nueva RAM no puede ser igual al valor actual configurado.';
      }
    }

    if (changeType === 'gpu' || changeType === 'both') {
      if (!newGpu.trim()) {
        return 'Indica el modelo de la nueva GPU.';
      }
      if (!newVram || Number(newVram) <= 0) {
        return 'Indica los GB de VRAM de la nueva GPU.';
      }
      if (newGpu.trim().toLowerCase() === gpu.trim().toLowerCase() && Number(newVram) === Number(vram)) {
        return 'La nueva GPU y VRAM no pueden ser idénticas al valor actual.';
      }
    }

    return null;
  };

  const handleAddUpgrade = () => {
    const error = validateUpgrade();
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError('');

    const targetGpu = (changeType === 'gpu' || changeType === 'both') ? newGpu.trim() : (gpu.trim() || 'GPU Principal');
    const targetVram = (changeType === 'gpu' || changeType === 'both') ? Number(newVram) : (Number(vram) || 16);
    const targetRam = (changeType === 'ram' || changeType === 'both') ? Number(newRam) : (Number(ram) || 32);

    let label = '';
    if (changeType === 'ram') label = `Upgrade a ${targetRam}GB RAM`;
    else if (changeType === 'gpu') label = `Upgrade a ${targetGpu} (${targetVram}GB)`;
    else label = `Upgrade a ${targetGpu} + ${targetRam}GB RAM`;

    const milestone: HardwareMilestone = {
      sinceDate: upgradeDate,
      gpu: targetGpu,
      vram: targetVram,
      ram: targetRam,
      label
    };

    setHistory(prev => [...prev, milestone]);
    setUpgradeDate('');
    setNewRam('');
    setNewGpu('');
    setNewVram('');
    setShowAddForm(false);
  };

  const handleRemoveMilestone = (sinceDate: string) => {
    setHistory(prev => prev.filter(h => h.sinceDate !== sinceDate));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpu.trim() || !vram || !ram) return;
    
    setIsSaving(true);
    setErrorMsg('');
    try {
      const resolvedInitialHardware: UserHardware | undefined = (history.length > 0 && initialGpu.trim() && initialVram && initialRam)
        ? {
            gpu: initialGpu.trim(),
            vram: Number(initialVram),
            ram: Number(initialRam)
          }
        : undefined;

      await onSave({
        gpu: gpu.trim(),
        vram: Number(vram),
        ram: Number(ram)
      }, history, resolvedInitialHardware);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al guardar el perfil localmente.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50 shrink-0">
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
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {isMandatory && (
            <div className="p-3 bg-teal-950/30 border border-teal-900/50 rounded-xl">
              <p className="text-sm text-teal-200/90 leading-relaxed">
                Configura tu equipo actual para asociarlo automáticamente a los vídeos generados.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Configuración Actual del Sistema */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4" />
                Configuración Actual
              </h3>
              <span className="text-[11px] text-neutral-500">Equipo en uso hoy</span>
            </div>

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
                  placeholder="Ej: RTX 4080 Super"
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
                    max="512"
                    value={ram}
                    onChange={e => setRam(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej: 64"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Historial y Upgrades */}
          <div className="pt-4 border-t border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-left group"
              >
                <History className="w-4 h-4 text-neutral-400 group-hover:text-teal-400 transition-colors" />
                <span className="text-xs font-bold text-neutral-300 group-hover:text-white uppercase tracking-wider transition-colors">
                  Historial de Cambios ({history.length})
                </span>
                {showHistory ? (
                  <ChevronUp className="w-3.5 h-3.5 text-neutral-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                )}
              </button>

              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowHistory(true);
                    setShowAddForm(true);
                    setValidationError('');
                  }}
                  className="text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Registrar upgrade
                </button>
              )}
            </div>

            {showHistory && (
              <div className="space-y-3">
                {/* Formulario ágil de upgrade */}
                {showAddForm && (
                  <div className="bg-neutral-950 border border-teal-900/40 rounded-xl p-4 space-y-3.5 animate-in fade-in zoom-in-98 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        Nuevo Cambio de Componente
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="text-neutral-500 hover:text-neutral-300 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>

                    {/* Selector de qué cambió */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setChangeType('ram'); setValidationError(''); }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          changeType === 'ram'
                            ? 'bg-teal-950/60 border-teal-500 text-teal-200'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <MemoryStick className="w-3.5 h-3.5" />
                        RAM
                      </button>
                      <button
                        type="button"
                        onClick={() => { setChangeType('gpu'); setValidationError(''); }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          changeType === 'gpu'
                            ? 'bg-teal-950/60 border-teal-500 text-teal-200'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        GPU / VRAM
                      </button>
                      <button
                        type="button"
                        onClick={() => { setChangeType('both'); setValidationError(''); }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all ${
                          changeType === 'both'
                            ? 'bg-teal-950/60 border-teal-500 text-teal-200'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        Ambos
                      </button>
                    </div>

                    {/* Fecha de entrada en vigor */}
                    <div>
                      <label className="block text-[10px] text-neutral-400 uppercase font-medium mb-1">
                        Fecha del cambio (a partir de cuándo aplica)
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={upgradeDate}
                          onChange={e => { setUpgradeDate(e.target.value); setValidationError(''); }}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>

                    {/* Inputs condicionales */}
                    {(changeType === 'ram' || changeType === 'both') && (
                      <div className="bg-neutral-900/70 p-2.5 rounded-lg border border-neutral-800/80">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-medium text-neutral-300">Nueva Memoria RAM</label>
                          <span className="text-[10px] text-neutral-500">Actual: {ram || 32} GB</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="8"
                            max="512"
                            placeholder="Ej: 64"
                            value={newRam}
                            onChange={e => { setNewRam(e.target.value === '' ? '' : Number(e.target.value)); setValidationError(''); }}
                            className="w-24 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          />
                          <span className="text-xs text-neutral-400">GB RAM</span>
                        </div>
                      </div>
                    )}

                    {(changeType === 'gpu' || changeType === 'both') && (
                      <div className="bg-neutral-900/70 p-2.5 rounded-lg border border-neutral-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-medium text-neutral-300">Nueva Tarjeta Gráfica</label>
                          <span className="text-[10px] text-neutral-500">Actual: {gpu || 'GPU'} ({vram || 16}GB)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="Modelo (ej: RTX 5090)"
                            value={newGpu}
                            onChange={e => { setNewGpu(e.target.value); setValidationError(''); }}
                            className="col-span-2 bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="VRAM"
                              value={newVram}
                              onChange={e => { setNewVram(e.target.value === '' ? '' : Number(e.target.value)); setValidationError(''); }}
                              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-white"
                            />
                            <span className="text-[10px] text-neutral-400">GB</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Validación en línea */}
                    {validationError && (
                      <div className="flex items-center gap-1.5 text-rose-400 text-xs py-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{validationError}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleAddUpgrade}
                      className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Añadir Hito al Historial
                    </button>
                  </div>
                )}

                {/* Lista de hitos existentes */}
                {sortedHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {sortedHistory.map((item) => (
                        <div 
                          key={item.sinceDate} 
                          className="flex items-center justify-between text-xs bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 bg-neutral-900 text-teal-300 font-mono text-[11px] rounded border border-neutral-800">
                              {item.sinceDate}
                            </span>
                            <div>
                              <span className="text-neutral-200 font-medium">
                                {item.gpu}
                              </span>
                              <span className="text-neutral-400 ml-1">
                                ({item.vram}GB VRAM / {item.ram}GB RAM)
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestone(item.sinceDate)}
                            className="text-neutral-500 hover:text-rose-400 p-1 transition-colors rounded hover:bg-neutral-900"
                            title="Eliminar este hito"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Configuración de origen (opcional, aplicable a vídeos anteriores al primer hito) */}
                    <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3.5 space-y-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-teal-400" />
                          Configuración de Origen (Opcional)
                        </span>
                        <span className="text-[10px] text-neutral-500">Antes del 1er hito ({sortedHistory[sortedHistory.length - 1]?.sinceDate})</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-normal">
                        Hardware que utilizabas para generar vídeos <strong className="text-neutral-300">antes de tu primer hito registrado</strong>. Si se deja vacío, el sistema estimará automáticamente los valores para mantener compatibilidad.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="block text-[10px] text-neutral-400 uppercase font-medium mb-1">GPU Origen</label>
                          <input
                            type="text"
                            placeholder="Ej: RTX 4080"
                            value={initialGpu}
                            onChange={e => setInitialGpu(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-400 uppercase font-medium mb-1">VRAM (GB)</label>
                          <input
                            type="number"
                            min="4"
                            max="192"
                            placeholder="Ej: 16"
                            value={initialVram}
                            onChange={e => setInitialVram(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-400 uppercase font-medium mb-1">RAM (GB)</label>
                          <input
                            type="number"
                            min="8"
                            max="512"
                            placeholder="Ej: 32"
                            value={initialRam}
                            onChange={e => setInitialRam(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  !showAddForm && (
                    <div className="text-center py-3 px-4 bg-neutral-950/40 rounded-xl border border-neutral-800/50 text-xs text-neutral-500">
                      No hay hitos registrados. Se usará la configuración actual para todos los vídeos.
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Footer de acción */}
          <div className="pt-4 border-t border-neutral-800 flex justify-end gap-3">
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
