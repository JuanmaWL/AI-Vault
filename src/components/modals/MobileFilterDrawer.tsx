import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, SlidersHorizontal, RotateCcw, Check, Cpu, Folder, Layers, Sparkles, Tag, Film, Zap } from 'lucide-react';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filterGroup: string;
  setFilterGroup: (val: string) => void;
  uniqueGroups: string[];
  filterModel: string;
  setFilterModel: (val: string) => void;
  uniqueModels: string[];
  filterModelSizeB: string;
  setFilterModelSizeB: (val: string) => void;
  uniqueModelSizes: number[];
  filterGpu: string;
  setFilterGpu: (val: string) => void;
  uniqueGpus: string[];
  filterSpeed: string;
  setFilterSpeed: (val: string) => void;
  filterResolution: string;
  setFilterResolution: (val: string) => void;
  uniqueResolutions: string[];
  filterLocalTool: string;
  setFilterLocalTool: (val: string) => void;
  uniqueLocalTools: string[];
  filterVae: string;
  setFilterVae: (val: string) => void;
  uniqueVaes: string[];
  filterEncoder: string;
  setFilterEncoder: (val: string) => void;
  uniqueEncoders: string[];
  filterTags: string[];
  setFilterTags: React.Dispatch<React.SetStateAction<string[]>>;
  uniqueTags: string[];
  activeFiltersCount: number;
  handleResetFilters: () => void;
  totalFilteredCount: number;
}

export function MobileFilterDrawer({
  isOpen,
  onClose,
  filterGroup,
  setFilterGroup,
  uniqueGroups,
  filterModel,
  setFilterModel,
  uniqueModels,
  filterModelSizeB,
  setFilterModelSizeB,
  uniqueModelSizes,
  filterGpu,
  setFilterGpu,
  uniqueGpus,
  filterSpeed,
  setFilterSpeed,
  filterResolution,
  setFilterResolution,
  uniqueResolutions,
  filterLocalTool,
  setFilterLocalTool,
  uniqueLocalTools,
  filterVae,
  setFilterVae,
  uniqueVaes,
  filterEncoder,
  setFilterEncoder,
  uniqueEncoders,
  filterTags,
  setFilterTags,
  uniqueTags,
  activeFiltersCount,
  handleResetFilters,
  totalFilteredCount,
}: MobileFilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden" role="dialog" aria-modal="true">
        {/* Fondo oscurecido con cierre táctil */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Panel inferior (Bottom Sheet) */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-h-[85vh] bg-neutral-900 border-t border-neutral-800 rounded-t-3xl shadow-2xl flex flex-col z-10 overflow-hidden"
        >
          {/* Barra indicadora superior (drag handle) */}
          <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />

          {/* Cabecera del Cajón */}
          <div className="px-5 py-3.5 border-b border-neutral-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-white text-base">Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500 text-neutral-950">
                  {activeFiltersCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-900/60 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Limpiar</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 cursor-pointer"
                aria-label="Cerrar filtros"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenido con scroll táctil cómodo */}
          <div className="p-5 overflow-y-auto space-y-4 overscroll-contain flex-1">
            {/* Carpeta */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-teal-400" />
                Carpeta
              </label>
              <select
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
                className="w-full h-11 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="Todas">📁 Todas las carpetas</option>
                {uniqueGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
                <option value="Sin carpeta">Sin carpeta</option>
              </select>
            </div>

            {/* Modelo AI */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                Modelo AI
              </label>
              <select
                value={filterModel}
                onChange={e => setFilterModel(e.target.value)}
                className="w-full h-11 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="Todos">🧠 Todos los modelos</option>
                {uniqueModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Parámetros B y GPU en 2 columnas */}
            <div className="grid grid-cols-2 gap-3">
              {uniqueModelSizes.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Parámetros
                  </label>
                  <select
                    value={filterModelSizeB}
                    onChange={e => setFilterModelSizeB(e.target.value)}
                    className="w-full h-11 px-3 bg-neutral-950 border border-teal-900/60 rounded-xl text-xs text-teal-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="Todos">⚡ Todos</option>
                    {uniqueModelSizes.map(s => (
                      <option key={s} value={String(s)}>{s}B</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-teal-400" />
                  GPU
                </label>
                <select
                  value={filterGpu}
                  onChange={e => setFilterGpu(e.target.value)}
                  className="w-full h-11 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="Todas">🎮 Todas</option>
                  {uniqueGpus.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="Sin GPU">Sin GPU</option>
                </select>
              </div>
            </div>

            {/* Velocidad y Resolución en 2 columnas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Velocidad
                </label>
                <select
                  value={filterSpeed}
                  onChange={e => setFilterSpeed(e.target.value)}
                  className="w-full h-11 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Todas">⚡ Todas</option>
                  <option value="Ultrarrápido">&lt;15 s/MP</option>
                  <option value="Óptimo">15-40 s/MP</option>
                  <option value="Equilibrado">40-80 s/MP</option>
                  <option value="Lento">80-140 s/MP</option>
                  <option value="Muy Lento">&gt;140 s/MP</option>
                  <option value="Sin datos">Sin datos</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Film className="w-3.5 h-3.5 text-teal-400" />
                  Resolución
                </label>
                <select
                  value={filterResolution}
                  onChange={e => setFilterResolution(e.target.value)}
                  className="w-full h-11 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="Todas">📐 Todas</option>
                  {uniqueResolutions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Herramienta Local */}
            {uniqueLocalTools.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Herramienta Local
                </label>
                <select
                  value={filterLocalTool}
                  onChange={e => setFilterLocalTool(e.target.value)}
                  className="w-full h-11 px-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-neutral-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="Todos">🔧 Todas las herramientas</option>
                  {uniqueLocalTools.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Video VAE y Encoder */}
            {(uniqueVaes.length > 0 || uniqueEncoders.length > 0) && (
              <div className="pt-2 border-t border-neutral-800/80 space-y-3">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Encoders & Arquitectura
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {uniqueVaes.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-purple-300">Video VAE</label>
                      <select
                        value={filterVae}
                        onChange={e => setFilterVae(e.target.value)}
                        className="w-full h-11 px-3 bg-neutral-950 border border-purple-900/60 rounded-xl text-xs text-purple-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value="Todos">🔮 Todos los VAE</option>
                        {uniqueVaes.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {uniqueEncoders.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-blue-300">Text Encoder</label>
                      <select
                        value={filterEncoder}
                        onChange={e => setFilterEncoder(e.target.value)}
                        className="w-full h-11 px-3 bg-neutral-950 border border-blue-900/60 rounded-xl text-xs text-blue-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="Todos">🔤 Todos los Encoders</option>
                        {uniqueEncoders.map(enc => (
                          <option key={enc} value={enc}>{enc}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tags / Etiquetas */}
            {uniqueTags.length > 0 && (
              <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-teal-400" />
                  Etiquetas
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {uniqueTags.map(tag => {
                    const isActive = filterTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          setFilterTags(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag]);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border cursor-pointer ${
                          isActive
                            ? 'bg-teal-950 border-teal-500 text-teal-200'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botón Flotante Fijo: Aplicar Filtros */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-950 shrink-0">
            <button
              onClick={onClose}
              className="w-full h-12 bg-teal-500 hover:bg-teal-400 text-neutral-950 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-teal-950/40 text-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Ver {totalFilteredCount} vídeos</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
