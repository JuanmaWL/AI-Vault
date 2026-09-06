import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, 
  Search, 
  CheckSquare, 
  Square, 
  Folder, 
  FolderOpen, 
  DownloadCloud, 
  Play, 
  ExternalLink, 
  Filter, 
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { formatBytes } from '../../lib/utils';

export interface HfNewVideoItem {
  path: string;
  downloadUrl: string;
  size?: number;
  category: string;
  fileName: string;
}

interface HfImportManagerModalProps {
  newVideos: HfNewVideoItem[];
  selectedPaths: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onConfirmImport: () => void;
  onClose: () => void;
  isImporting?: boolean;
}

export function HfImportManagerModal({
  newVideos,
  selectedPaths,
  onSelectionChange,
  onConfirmImport,
  onClose,
  isImporting = false,
}: HfImportManagerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    newVideos.forEach(v => {
      set.add(v.category || 'Sin carpeta');
    });
    return Array.from(set).sort();
  }, [newVideos]);

  // Filter videos based on search & category
  const filteredVideos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return newVideos.filter(v => {
      const matchCat = selectedCategoryFilter === 'all' || (v.category || 'Sin carpeta') === selectedCategoryFilter;
      if (!matchCat) return false;
      if (!term) return true;
      return (
        v.fileName.toLowerCase().includes(term) ||
        v.path.toLowerCase().includes(term) ||
        v.category.toLowerCase().includes(term)
      );
    });
  }, [newVideos, searchTerm, selectedCategoryFilter]);

  // Group filtered videos by category
  const groupedVideos = useMemo(() => {
    const groups: Record<string, HfNewVideoItem[]> = {};
    filteredVideos.forEach(v => {
      const cat = v.category || 'Sin carpeta';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(v);
    });
    return groups;
  }, [filteredVideos]);

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleVideo = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    onSelectionChange(next);
  };

  const toggleCategorySelection = (categoryVideos: HfNewVideoItem[]) => {
    const categoryPaths = categoryVideos.map(v => v.path);
    const allSelected = categoryPaths.every(p => selectedPaths.has(p));
    const next = new Set(selectedPaths);
    
    if (allSelected) {
      categoryPaths.forEach(p => next.delete(p));
    } else {
      categoryPaths.forEach(p => next.add(p));
    }
    onSelectionChange(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedPaths);
    filteredVideos.forEach(v => next.add(v.path));
    onSelectionChange(next);
  };

  const handleDeselectAllFiltered = () => {
    const next = new Set(selectedPaths);
    filteredVideos.forEach(v => next.delete(v.path));
    onSelectionChange(next);
  };

  const handleInvertFiltered = () => {
    const next = new Set(selectedPaths);
    filteredVideos.forEach(v => {
      if (next.has(v.path)) {
        next.delete(v.path);
      } else {
        next.add(v.path);
      }
    });
    onSelectionChange(next);
  };

  // Close preview on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewVideoUrl) {
          setPreviewVideoUrl(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewVideoUrl, onClose]);

  return (
    <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Gestor de Selección de Dataset
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  {selectedPaths.size} de {newVideos.length} seleccionados
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Organiza, filtra por carpetas y selecciona exactamente qué vídeos sincronizar en tu catálogo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar gestor"
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 sm:px-6 border-b border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Search Box */}
          <div className="flex-1 min-w-[240px] max-w-md relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, carpeta o ruta..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-8 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="Borrar búsqueda"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">Todas las carpetas ({categories.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>📁 {c}</option>
              ))}
            </select>
          </div>

          {/* Quick Selection Actions */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-teal-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Seleccionar todos los vídeos visibles con el filtro actual"
            >
              Marcar todos
            </button>
            <span className="text-neutral-700">|</span>
            <button
              type="button"
              onClick={handleDeselectAllFiltered}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Deseleccionar todos los vídeos visibles"
            >
              Desmarcar todos
            </button>
            <span className="text-neutral-700">|</span>
            <button
              type="button"
              onClick={handleInvertFiltered}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Invertir selección actual"
            >
              Invertir
            </button>
          </div>
        </div>

        {/* Content Body: Grouped List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {Object.keys(groupedVideos).length === 0 ? (
            <div className="py-16 text-center text-neutral-500 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-30 text-neutral-400" />
              <p className="text-sm font-medium text-neutral-400">No hay vídeos que coincidan con la búsqueda.</p>
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); setSelectedCategoryFilter('all'); }}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedVideos).map(([category, items]) => {
              const isCollapsed = collapsedCategories.has(category);
              const categorySelectedCount = items.filter(v => selectedPaths.has(v.path)).length;
              const allCategorySelected = categorySelectedCount === items.length;
              const someCategorySelected = categorySelectedCount > 0 && !allCategorySelected;

              return (
                <div 
                  key={category} 
                  className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl overflow-hidden transition-all shadow-sm"
                >
                  {/* Category Header with Master Checkbox */}
                  <div className="p-3 sm:px-4 bg-neutral-900/80 border-b border-neutral-800/70 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleCategoryCollapse(category)}
                        aria-label={isCollapsed ? `Desplegar ${category}` : `Plegar ${category}`}
                        className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-0.5"
                      >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold text-white text-xs sm:text-sm truncate">
                          {category}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-semibold border border-neutral-700">
                          {items.length} {items.length === 1 ? 'vídeo' : 'vídeos'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">
                        {categorySelectedCount} / {items.length} marcados
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleCategorySelection(items)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          allCategorySelected
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-xs'
                            : someCategorySelected
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 border-neutral-700'
                        }`}
                        title={allCategorySelected ? 'Desmarcar toda esta carpeta' : 'Marcar toda esta carpeta'}
                      >
                        {allCategorySelected ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
                            <span>Toda la carpeta</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5" />
                            <span>{someCategorySelected ? 'Completar' : 'Marcar carpeta'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Video Items List */}
                  {!isCollapsed && (
                    <div className="p-2 sm:p-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {items.map((v) => {
                        const isChecked = selectedPaths.has(v.path);
                        return (
                          <div
                            key={v.path}
                            className={`flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all select-none ${
                              isChecked
                                ? 'bg-neutral-900/90 border-teal-500/40 text-neutral-100 shadow-xs'
                                : 'bg-neutral-950/40 border-neutral-850 text-neutral-500 opacity-60 hover:opacity-90'
                            }`}
                          >
                            <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleVideo(v.path)}
                                className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-teal-500 focus:ring-teal-500 shrink-0 cursor-pointer"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-mono font-medium truncate" title={v.fileName}>
                                  {v.fileName}
                                </span>
                                <span className="text-[10px] text-neutral-500 truncate" title={v.path}>
                                  {v.path}
                                </span>
                              </div>
                            </label>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {v.size && (
                                <span className="text-[10px] font-mono text-neutral-500 hidden sm:inline">
                                  {formatBytes(v.size)}
                                </span>
                              )}

                              {/* Preview Video Button */}
                              <button
                                type="button"
                                onClick={() => setPreviewVideoUrl(v.downloadUrl)}
                                aria-label={`Previsualizar ${v.fileName}`}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-teal-300 transition-colors cursor-pointer"
                                title="Previsualizar vídeo"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Video Preview Floating Modal/Overlay */}
        {previewVideoUrl && (
          <div className="fixed inset-0 z-70 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
              <div className="p-3 px-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/80">
                <span className="text-xs font-mono font-bold text-teal-300 truncate max-w-md">
                  {previewVideoUrl.split('/').pop()}
                </span>
                <button
                  onClick={() => setPreviewVideoUrl(null)}
                  aria-label="Cerrar previsualización"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <video
                  src={previewVideoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Bar */}
        <div className="p-4 sm:px-6 border-t border-neutral-800 bg-neutral-950/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Total a sincronizar:</span>
            <strong className="text-teal-400 font-mono text-sm">{selectedPaths.size} vídeos</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
            >
              Volver
            </button>

            <button
              type="button"
              onClick={() => {
                onConfirmImport();
                onClose();
              }}
              disabled={selectedPaths.size === 0 || isImporting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 transition-all disabled:cursor-not-allowed shadow-md shadow-teal-950/50 cursor-pointer active:scale-95"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Importar {selectedPaths.size} seleccionados</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
