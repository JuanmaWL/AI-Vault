import { useEffect, useState, useMemo } from 'react';
import { db, auth } from './lib/firebase';
import { collection, addDoc, onSnapshot, orderBy, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { VideoRecord } from './types';
import { VideoCard } from './components/VideoCard';
import { CompareView } from './components/CompareView';
import { AddVideoModal } from './components/AddVideoModal';
import { LoginModal } from './components/LoginModal';
import { SetNickModal } from './components/SetNickModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { extractDriveFileId, calculateOrientation } from './lib/utils';
import { Search, Plus, Database, LogIn, LogOut, User as UserIcon, Edit3, Trash2, CheckSquare } from 'lucide-react';
import pkg from '../package.json';

const COLLECTION_NAME = 'videos';
const STORAGE_KEY = 'local_ai_videos_v2';

// Normaliza registros antiguos si existían en localStorage o Firestore
function normalizeRecord(raw: any): VideoRecord {
  const width = typeof raw.width === 'number' ? raw.width : 1920;
  const height = typeof raw.height === 'number' ? raw.height : 1080;
  const videoUrl = raw.videoUrl || '';
  const driveFileId = raw.driveFileId || extractDriveFileId(videoUrl);
  const orientation = raw.orientation || calculateOrientation(width, height);

  return {
    id: raw.id,
    schemaVersion: 2,
    videoUrl,
    driveFileId,
    prompt: raw.prompt || '',
    negativePrompt: raw.negativePrompt,
    model: raw.model || 'Desconocido',
    source: raw.source === 'cloud' ? 'cloud' : 'local',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    groupName: typeof raw.groupName === 'string' ? raw.groupName : undefined,
    width,
    height,
    orientation,
    steps: typeof raw.steps === 'number' ? raw.steps : 30,
    shift: typeof raw.shift === 'number' ? raw.shift : undefined,
    seed: typeof raw.seed === 'number' ? raw.seed : undefined,
    fps: typeof raw.fps === 'number' ? raw.fps : undefined,
    durationSeconds: typeof raw.durationSeconds === 'number' ? raw.durationSeconds : undefined,
    loras: Array.isArray(raw.loras) ? raw.loras : [],
    notes: raw.notes,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    createdBy: raw.createdBy,
    renderSeconds: typeof raw.renderSeconds === 'number' ? raw.renderSeconds : undefined,
    generatedAt: typeof raw.generatedAt === 'number' ? raw.generatedAt : undefined,
    rawMetadata: typeof raw.rawMetadata === 'string' ? raw.rawMetadata : undefined
  };
}

const MOCK_DATA: VideoRecord[] = [
  {
    id: 'mock1',
    schemaVersion: 2,
    videoUrl: 'https://drive.google.com/file/d/1M5uutzAXG3r8b8HS_HtPczRGTa_zBVAD/view?usp=sharing',
    driveFileId: '1M5uutzAXG3r8b8HS_HtPczRGTa_zBVAD',
    prompt: 'A high quality cinematic shot of a stunning futuristic cyberpunk street, neon lights reflection, masterpiece, detailed.',
    model: 'Wan2.1 FL2VA (Wan2GP)',
    source: 'local',
    tags: ['Wan2GP', '33B', 'FL2VA'],
    width: 1920,
    height: 1080,
    orientation: '16:9',
    steps: 30,
    shift: 5.0,
    seed: 4891024,
    fps: 24,
    durationSeconds: 5,
    loras: [
      { name: 'NeonGlow', weight: 0.7 }
    ],
    createdAt: Date.now()
  }
];

export default function App() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoRecord | undefined>(undefined);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isNickModalOpen, setIsNickModalOpen] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingLocal, setUsingLocal] = useState(false);

  // View state
  const [view, setView] = useState<'detail' | 'compare'>('detail');

  // Filters state
  const [filterGroup, setFilterGroup] = useState<string>('Todas');
  const [filterUser, setFilterUser] = useState<string>('Todos');
  const [filterModel, setFilterModel] = useState<string>('Todos');
  const [filterOrientation, setFilterOrientation] = useState<string>('Todas');
  const [filterSource, setFilterSource] = useState<string>('Todos');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [groupByFolder, setGroupByFolder] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [videosToDelete, setVideosToDelete] = useState<string[] | null>(null);

  // Escuchar estado de autenticación
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        if (user) {
          setUserDisplayName(user.displayName || '');
          if (!user.displayName) {
            setIsNickModalOpen(true);
          }
        }
      });
      return () => unsubscribe();
    } else {
      setCurrentUser(null);
    }
  }, []);

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Error al cerrar sesión', err);
      }
    }
  };

  const fallbackToLocal = () => {
    setUsingLocal(true);
    try {
      const localData = localStorage.getItem(STORAGE_KEY);
      if (localData) {
        const parsed = JSON.parse(localData);
        const normalized = Array.isArray(parsed) ? parsed.map(normalizeRecord) : MOCK_DATA;
        setVideos(normalized);
      } else {
        setVideos(MOCK_DATA);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_DATA));
      }
    } catch {
      setVideos(MOCK_DATA);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (db) {
      try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const fetchedVideos = snapshot.docs.map((doc) => normalizeRecord({
              id: doc.id,
              ...doc.data()
            }));
            setVideos(fetchedVideos);
            setLoading(false);
          },
          () => {
            // Si Firebase falla o no tiene permisos, pasamos fluidamente a modo local
            fallbackToLocal();
          }
        );
        return () => unsubscribe();
      } catch {
        fallbackToLocal();
      }
    } else {
      fallbackToLocal();
    }
  }, []);

  const cleanUndefined = (obj: any) => {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
  };

  const handleAddVideo = async (record: VideoRecord) => {
    const cleanRecord = cleanUndefined(record);
    if (db && !usingLocal) {
      try {
        await addDoc(collection(db, COLLECTION_NAME), cleanRecord);
      } catch (err) {
        console.error("Error al escribir en Firestore", err);
        // Fallback inmediato a almacenamiento local si Firebase rechaza la escritura
        const newRecord = { ...record, id: `local_${Date.now()}` };
        const updated = [newRecord, ...videos];
        setVideos(updated);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        setUsingLocal(true);
      }
    } else {
      const newRecord = { ...record, id: `local_${Date.now()}` };
      const updated = [newRecord, ...videos];
      setVideos(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  const handleEditVideo = async (record: VideoRecord) => {
    const cleanRecord = cleanUndefined(record);
    if (db && !usingLocal && record.id && !record.id.startsWith('local_')) {
      try {
        await updateDoc(doc(db, COLLECTION_NAME, record.id), cleanRecord);
      } catch (err) {
        console.error("Error al actualizar en Firestore", err);
        const updated = videos.map(v => v.id === record.id ? record : v);
        setVideos(updated);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}
      }
    } else {
      const updated = videos.map(v => v.id === record.id ? record : v);
      setVideos(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }
  };

  // Extract unique values for filters
  const uniqueGroups = useMemo(() => Array.from(new Set(videos.map(v => v.groupName).filter(Boolean) as string[])).sort(), [videos]);
  const uniqueUsers = useMemo(() => Array.from(new Set(videos.map(v => v.createdBy).filter(Boolean) as string[])).sort(), [videos]);
  const uniqueModels = useMemo(() => Array.from(new Set(videos.map(v => v.model).filter(Boolean) as string[])).sort(), [videos]);
  const uniqueTags = useMemo(() => Array.from(new Set(videos.flatMap(v => v.tags || []))).sort(), [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        const matchesSearch = video.prompt.toLowerCase().includes(lower) ||
          video.model.toLowerCase().includes(lower) ||
          (video.tags && video.tags.some((t) => t.toLowerCase().includes(lower)));
        if (!matchesSearch) return false;
      }
      
      // 2. Folder/Group
      if (filterGroup !== 'Todas') {
        const videoGroup = video.groupName || 'Sin carpeta';
        if (videoGroup !== filterGroup) return false;
      }
      
      // 3. User
      if (filterUser !== 'Todos') {
        const videoUser = video.createdBy || 'Anónimo';
        if (videoUser !== filterUser) return false;
      }

      // 4. Model
      if (filterModel !== 'Todos' && video.model !== filterModel) return false;

      // 5. Orientation
      if (filterOrientation !== 'Todas' && video.orientation !== filterOrientation) return false;

      // 6. Source
      if (filterSource !== 'Todos' && video.source !== filterSource.toLowerCase()) return false;

      // 7. Tags
      if (filterTags.length > 0) {
        if (!video.tags || !filterTags.every(t => video.tags!.includes(t))) return false;
      }

      return true;
    });
  }, [videos, searchTerm, filterGroup, filterUser, filterModel, filterOrientation, filterSource, filterTags]);

  const groupedVideos = useMemo(() => {
    if (!groupByFolder) return null;
    const groups: Record<string, VideoRecord[]> = {};
    filteredVideos.forEach(v => {
      const g = v.groupName || 'Sin carpeta';
      if (!groups[g]) groups[g] = [];
      groups[g].push(v);
    });
    return groups;
  }, [filteredVideos, groupByFolder]);

  const toggleGroupCollapse = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const sharedPrompt = useMemo(() => {
    if (filterGroup === 'Todas' || filteredVideos.length === 0) return null;
    const firstPrompt = filteredVideos[0].prompt;
    const allMatch = filteredVideos.every(v => v.prompt === firstPrompt);
    return allMatch ? firstPrompt : null;
  }, [filteredVideos, filterGroup]);

  const handleDuplicateVideo = (video: VideoRecord) => {
    const { id, videoUrl, driveFileId, createdAt, rawMetadata, ...rest } = video;
    setEditingVideo({ ...rest, schemaVersion: 2 } as VideoRecord);
    setIsModalOpen(true);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedVideoIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVideoIds(newSelection);
  };

  const handleDeleteConfirm = async (ids: string[]) => {
    if (db && !usingLocal) {
      try {
        await Promise.all(ids.map(id => deleteDoc(doc(db, COLLECTION_NAME, id))));
      } catch (err) {
        console.error("Error al borrar de Firestore", err);
        // Fallback local visual, pero puede que las reglas rechacen si no eres el autor
      }
    } else {
      const updated = videos.filter(v => !ids.includes(v.id));
      setVideos(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }
    setSelectedVideoIds(new Set());
    setSelectionMode(false);
    setVideosToDelete(null);
  };

  const latestUploadDate = useMemo(() => {
    if (!videos || videos.length === 0) return null;
    const timestamps = videos
      .map((v) => v.createdAt)
      .filter((t): t is number => typeof t === 'number' && !isNaN(t));
    if (timestamps.length === 0) return null;
    const maxTime = Math.max(...timestamps);
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(maxTime));
  }, [videos]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-teal-900/50 flex flex-col justify-between">
      <div>
        {/* Header Fijo */}
        <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800">
          <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Database className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">AI Video Vault</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`flex h-2 w-2 rounded-full ${usingLocal ? 'bg-amber-500' : 'bg-teal-500'}`}></span>
                  <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                    {usingLocal ? 'Modo Local' : 'Conectado a Firebase'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 max-w-2xl relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder="Buscar por prompt, modelo o etiquetas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-full pl-12 pr-6 py-2.5 text-sm focus:outline-none focus:border-neutral-600 focus:bg-neutral-900 transition-all text-neutral-200 placeholder:text-neutral-500"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Selector de Vistas */}
              <div className="hidden lg:flex bg-neutral-900 p-1 rounded-lg border border-neutral-800 mr-2">
                <button 
                  onClick={() => setView('detail')} 
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'detail' ? 'bg-neutral-800 text-teal-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                  Detallada
                </button>
                <button 
                  onClick={() => setView('compare')} 
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'compare' ? 'bg-neutral-800 text-teal-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
                >
                  Comparación
                </button>
              </div>

              {/* Botón de Autenticación / Estado de Usuario */}
              {currentUser ? (
                <div className="flex items-center gap-2 bg-neutral-900/80 border border-neutral-800 rounded-full pl-3 pr-1.5 py-1 group/user">
                  <button
                    onClick={() => setIsNickModalOpen(true)}
                    title="Haz clic para cambiar tu apodo"
                    className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-teal-400" />
                    <span className="max-w-[140px] truncate font-medium">
                      {userDisplayName || currentUser.email}
                    </span>
                    <Edit3 className="w-3 h-3 text-neutral-500 opacity-0 group-hover/user:opacity-100 transition-opacity" />
                  </button>

                  <div className="h-3 w-px bg-neutral-800" />

                  <button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    className="p-1.5 rounded-full text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-neutral-300 px-3.5 py-2 rounded-full text-xs font-medium transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-teal-400" />
                  <span>Iniciar sesión</span>
                </button>
              )}

              {/* Botón Nuevo Registro (condicional a estar autenticado) */}
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      setSelectedVideoIds(new Set());
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md border ${
                       selectionMode 
                        ? 'bg-neutral-800 text-neutral-200 border-neutral-700' 
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span className="hidden xl:inline">{selectionMode ? 'Cancelar' : 'Seleccionar'}</span>
                  </button>

                  {selectionMode && selectedVideoIds.size > 0 && (
                    <button
                       onClick={() => setVideosToDelete(Array.from(selectedVideoIds))}
                       className="flex items-center gap-2 px-4 py-2.5 bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50 rounded-full text-sm font-semibold transition-all shadow-md animate-in fade-in"
                    >
                       <Trash2 className="w-4 h-4" />
                       <span className="hidden xl:inline">Borrar ({selectedVideoIds.size})</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Registro</span>
                  </button>
                </div>
              ) : (
                <div className="relative group">
                  <button
                    disabled
                    className="flex items-center gap-2 bg-neutral-900/50 border border-neutral-800/80 text-neutral-600 px-4 py-2.5 rounded-full text-sm font-medium cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 text-neutral-600" /> Nuevo Registro
                  </button>
                  <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-50 whitespace-nowrap bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs px-3 py-1.5 rounded-lg shadow-xl">
                    Inicia sesión para añadir vídeos
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[1600px] mx-auto px-6 py-8">
          
          {/* Barra de Filtros */}
          <div className="mb-6 p-4 bg-neutral-900/40 rounded-xl border border-neutral-800/80 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm font-medium text-neutral-400">
                Mostrando <strong className="text-neutral-200">{filteredVideos.length}</strong> de {videos.length} vídeos
              </span>
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={groupByFolder} 
                  onChange={e => setGroupByFolder(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-900 text-teal-500 focus:ring-teal-500/20 w-4 h-4"
                />
                Agrupar por carpeta
              </label>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500">
                <option value="Todas">Todas las carpetas</option>
                {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                <option value="Sin carpeta">Sin carpeta</option>
              </select>

              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500">
                <option value="Todos">Todos los usuarios</option>
                {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                <option value="Anónimo">Anónimo</option>
              </select>

              <select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500">
                <option value="Todos">Todos los modelos</option>
                {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                {['Todas', '16:9', '9:16', '1:1'].map(o => (
                  <button key={o} onClick={() => setFilterOrientation(o)} className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${filterOrientation === o ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>{o}</button>
                ))}
              </div>

              <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                {['Todos', 'Local', 'Cloud'].map(s => (
                  <button key={s} onClick={() => setFilterSource(s)} className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${filterSource === s ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>{s}</button>
                ))}
              </div>
            </div>

            {uniqueTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-neutral-500 uppercase tracking-wider mr-2">Tags:</span>
                {uniqueTags.map(tag => {
                  const isActive = filterTags.includes(tag);
                  return (
                    <button 
                      key={tag}
                      onClick={() => {
                        setFilterTags(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag]);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors border ${isActive ? 'bg-teal-950/60 border-teal-800 text-teal-300' : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {view === 'compare' ? (
            <CompareView videos={filteredVideos} sharedPrompt={sharedPrompt} />
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-neutral-800 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
              <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mb-6">
                <Database className="w-8 h-8 text-neutral-700" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-300 mb-2">No hay resultados</h3>
              <p className="text-neutral-500 max-w-sm">No se encontraron vídeos que coincidan con tu búsqueda. Intenta con otros filtros.</p>
            </div>
          ) : groupedVideos ? (
            <div className="flex flex-col gap-8 pb-12">
              {Object.entries(groupedVideos).sort((a, b) => {
                if (a[0] === 'Sin carpeta') return 1;
                if (b[0] === 'Sin carpeta') return -1;
                return a[0].localeCompare(b[0]);
              }).map(([groupName, groupVideos]) => {
                const isCollapsed = collapsedGroups[groupName];
                return (
                  <div key={groupName} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between bg-neutral-900/60 p-3 px-4 rounded-xl border border-neutral-800/80">
                      <button onClick={() => toggleGroupCollapse(groupName)} className="flex items-center gap-3 text-left">
                        <span className="font-semibold text-neutral-200">{groupName}</span>
                        <span className="text-xs font-medium bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">{groupVideos.length}</span>
                      </button>
                      <button 
                        onClick={() => {
                          setFilterGroup(groupName);
                          setView('compare');
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors"
                      >
                        Comparar
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="flex flex-col gap-6 pl-2 border-l-2 border-neutral-800/50">
                        {groupVideos.map((video) => (
                          <div key={video.id || video.videoUrl}>
                            <VideoCard 
                              video={video} 
                              selectionMode={selectionMode}
                              isSelected={selectedVideoIds.has(video.id!)}
                              onToggleSelect={() => toggleSelection(video.id!)}
                              onDeleteClick={currentUser && !selectionMode ? () => setVideosToDelete([video.id!]) : undefined}
                              onEditClick={currentUser && !selectionMode ? () => {
                                setEditingVideo(video);
                                setIsModalOpen(true);
                              } : undefined}
                              onDuplicateClick={currentUser && !selectionMode ? () => handleDuplicateVideo(video) : undefined}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-12">
              {filteredVideos.map((video) => (
                <div key={video.id || video.videoUrl}>
                  <VideoCard 
                    video={video} 
                    selectionMode={selectionMode}
                    isSelected={selectedVideoIds.has(video.id!)}
                    onToggleSelect={() => toggleSelection(video.id!)}
                    onDeleteClick={currentUser && !selectionMode ? () => setVideosToDelete([video.id!]) : undefined}
                    onEditClick={currentUser && !selectionMode ? () => {
                      setEditingVideo(video);
                      setIsModalOpen(true);
                    } : undefined}
                    onDuplicateClick={currentUser && !selectionMode ? () => handleDuplicateVideo(video) : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Pie de Página */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950/90 py-6 px-6 text-xs text-neutral-500">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-neutral-300">AI Video Vault</span>
            <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-teal-400 font-medium">
              v{pkg.version}
            </span>
          </div>

          <div className="flex items-center gap-2 text-neutral-400">
            <span>Última subida:</span>
            <span className="text-neutral-200 font-medium">
              {latestUploadDate ? latestUploadDate : 'Sin registros'}
            </span>
          </div>
        </div>
      </footer>

      {videosToDelete && (
        <DeleteConfirmModal
          count={videosToDelete.length}
          onConfirm={() => handleDeleteConfirm(videosToDelete)}
          onCancel={() => setVideosToDelete(null)}
        />
      )}

      {isModalOpen && (
        <AddVideoModal 
          onClose={() => {
            setIsModalOpen(false);
            setEditingVideo(undefined);
          }} 
          onSave={editingVideo ? handleEditVideo : handleAddVideo}
          userEmail={userDisplayName || currentUser?.email || undefined}
          initialData={editingVideo}
          existingGroups={uniqueGroups}
        />
      )}

      {isLoginOpen && (
        <LoginModal
          onClose={() => setIsLoginOpen(false)}
        />
      )}

      {isNickModalOpen && currentUser && (
        <SetNickModal
          user={currentUser}
          onClose={() => setIsNickModalOpen(false)}
          onUpdated={(newNick) => {
            setUserDisplayName(newNick);
          }}
        />
      )}
    </div>
  );
}