import { useState, useRef, useEffect, useMemo } from 'react';
import { Folder, Plus, Check, X, ChevronDown, Search, FolderPlus } from 'lucide-react';

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  onCreateCategory?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function CategorySelector({
  value,
  onChange,
  categories,
  onCreateCategory,
  placeholder = 'Seleccionar o crear categoría...',
  disabled = false,
  allowClear = true,
  className = '',
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter existing categories
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const q = searchTerm.toLowerCase().trim();
    return categories.filter(c => c.toLowerCase().includes(q));
  }, [categories, searchTerm]);

  const exactMatchExists = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return false;
    return categories.some(c => c.toLowerCase() === q);
  }, [categories, searchTerm]);

  const handleSelect = (categoryName: string) => {
    onChange(categoryName);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCreate = () => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    if (onCreateCategory) {
      onCreateCategory(trimmed);
    }
    onChange(trimmed);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selector Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }
        }}
        className={`flex items-center justify-between gap-2 w-full bg-neutral-950 border rounded-xl px-3.5 py-2.5 text-sm transition-all cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed border-neutral-800' : 
          isOpen ? 'border-teal-500 ring-1 ring-teal-500/20' : 'border-neutral-800 hover:border-neutral-700'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Folder className={`w-4 h-4 shrink-0 ${value ? 'text-teal-400' : 'text-neutral-500'}`} />
          {value ? (
            <span className="font-medium text-neutral-100 truncate flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-teal-950/80 border border-teal-800 text-teal-300 text-xs font-semibold">
                {value}
              </span>
            </span>
          ) : (
            <span className="text-neutral-500 truncate text-xs sm:text-sm">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && allowClear && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-md transition-colors"
              title="Quitar categoría"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-400' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-neutral-800 bg-neutral-950/60 flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-500 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredCategories.length === 1 && !exactMatchExists) {
                    handleSelect(filteredCategories[0]);
                  } else if (searchTerm.trim() && !exactMatchExists) {
                    handleCreate();
                  }
                }
              }}
              placeholder="Buscar o escribir nueva..."
              className="w-full bg-transparent text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none py-1"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Create Action if typed term is not in list */}
          {searchTerm.trim() && !exactMatchExists && (
            <div className="p-1.5 border-b border-neutral-800 bg-teal-950/30">
              <button
                type="button"
                onClick={handleCreate}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 transition-colors text-left cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-teal-400 shrink-0" />
                <span className="truncate">
                  Crear y asignar: <strong className="text-teal-200">"{searchTerm.trim()}"</strong>
                </span>
                <Plus className="w-3.5 h-3.5 ml-auto text-teal-400" />
              </button>
            </div>
          )}

          {/* Categories List */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
            {/* None Option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                !value ? 'bg-neutral-800 text-teal-400 font-semibold' : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
              }`}
            >
              <span className="italic">Sin categoría / Ninguna</span>
              {!value && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
            </button>

            {filteredCategories.length > 0 ? (
              filteredCategories.map(cat => {
                const isSelected = value === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                      isSelected
                        ? 'bg-teal-950/70 border border-teal-800/60 text-teal-300 font-bold'
                        : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-teal-400' : 'text-neutral-500'}`} />
                      <span className="truncate">{cat}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                  </button>
                );
              })
            ) : !searchTerm.trim() ? (
              <div className="px-3 py-4 text-center text-xs text-neutral-500">
                No hay categorías creadas aún.
                <div className="text-[11px] text-neutral-600 mt-1">Escribe arriba para crear la primera.</div>
              </div>
            ) : (
              <div className="px-3 py-2 text-center text-xs text-neutral-500">
                Pulsa el botón de arriba para crear <strong className="text-neutral-400">"{searchTerm.trim()}"</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
