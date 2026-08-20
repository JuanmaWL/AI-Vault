import { useEffect, useState, useMemo } from 'react';
import { db } from './lib/firebase';
import { collection, addDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { VideoRecord } from './types';
import { VideoCard } from './components/VideoCard';
import { AddVideoModal } from './components/AddVideoModal';
import { extractDriveFileId, calculateOrientation } from './lib/utils';
import { Search, Plus, Database } from 'lucide-react';
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
    createdBy: raw.createdBy
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
  const [loading, setLoading] = useState(true);
  const [usingLocal, setUsingLocal] = useState(false);

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

  const handleAddVideo = async (record: VideoRecord) => {
    if (db && !usingLocal) {
      try {
        await addDoc(collection(db, COLLECTION_NAME), record);
      } catch {
        // Fallback inmediato a almacenamiento local si Firebase rechaza la escritura
        const newRecord = { ...record, id: `local_${Date.now()}` };
        const updated = [newRecord, ...videos];
        setVideos(updated);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore local storage quota errors
        }
        setUsingLocal(true);
      }
    } else {
      const newRecord = { ...record, id: `local_${Date.now()}` };
      const updated = [newRecord, ...videos];
      setVideos(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore local storage quota errors
      }
    }
  };

  const filteredVideos = useMemo(() => {
    if (!searchTerm.trim()) return videos;
    const lower = searchTerm.toLowerCase();
    return videos.filter(
      (v) =>
        v.prompt.toLowerCase().includes(lower) ||
        v.model.toLowerCase().includes(lower) ||
        (v.tags && v.tags.some((t) => t.toLowerCase().includes(lower)))
    );
  }, [videos, searchTerm]);

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

            <button
              onClick={() => setIsModalOpen(true)}
              className="shrink-0 flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              <Plus className="w-4 h-4" /> Nuevo Registro
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-[1600px] mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-neutral-800 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
              <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center mb-6">
                <Database className="w-8 h-8 text-neutral-700" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-300 mb-2">No hay resultados</h3>
              <p className="text-neutral-500 max-w-sm">No se encontraron vídeos que coincidan con tu búsqueda. Intenta con otros términos.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-12">
              {filteredVideos.map((video) => (
                <div key={video.id || video.videoUrl}>
                  <VideoCard video={video} />
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

      {isModalOpen && (
        <AddVideoModal 
          onClose={() => setIsModalOpen(false)} 
          onSave={handleAddVideo}
        />
      )}
    </div>
  );
}

