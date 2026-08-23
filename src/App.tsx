import { useEffect, useState, useMemo } from 'react';
import { db, auth } from './lib/firebase';
import { collection, addDoc, onSnapshot, orderBy, query, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { VideoRecord, UserProfile, UserHardware } from './types';
import { VideoCard } from './components/VideoCard';
import { CompareView } from './components/CompareView';
import { DashboardView } from './components/DashboardView';
import { AddVideoModal } from './components/AddVideoModal';
import { BatchImportModal } from './components/BatchImportModal';
import { AccessGate } from './components/AccessGate';
import { EditProfileModal } from './components/EditProfileModal';
import { HardwareProfileModal } from './components/HardwareProfileModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { DualCompareModal } from './components/DualCompareModal';
import { extractDriveFileId, calculateOrientation } from './lib/utils';
import { Search, Plus, Database, LogOut, User as UserIcon, Edit3, Trash2, CheckSquare, Cpu, Sparkles, SplitSquareVertical, X, Check } from 'lucide-react';
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
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : undefined,
    prompt: raw.prompt || '',
    negativePrompt: raw.negativePrompt,
    model: raw.model || 'Desconocido',
    modelSizeB: typeof raw.modelSizeB === 'number' ? raw.modelSizeB : undefined,
    modelVariant: typeof raw.modelVariant === 'string' && raw.modelVariant.trim() ? raw.modelVariant.trim() : undefined,
    source: raw.source === 'cloud' ? 'cloud' : 'local',
    localTool: typeof raw.localTool === 'string' && raw.localTool.trim() ? raw.localTool.trim() : undefined,
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
    creatorDisplayName: typeof raw.creatorDisplayName === 'string' ? raw.creatorDisplayName : undefined,
    videoVae: typeof raw.videoVae === 'string' ? raw.videoVae : undefined,
    textEncoder: typeof raw.textEncoder === 'string' ? raw.textEncoder : undefined,
    precision: typeof raw.precision === 'string' ? raw.precision : undefined,
    renderSeconds: typeof raw.renderSeconds === 'number' ? raw.renderSeconds : undefined,
    fileSizeBytes: typeof raw.fileSizeBytes === 'number' ? raw.fileSizeBytes : undefined,
    generatedAt: typeof raw.generatedAt === 'number' ? raw.generatedAt : undefined,
    rawMetadata: typeof raw.rawMetadata === 'string' ? raw.rawMetadata : undefined,
    hardware: raw.hardware
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
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoRecord | undefined>(undefined);
  const [isNickModalOpen, setIsNickModalOpen] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [usingLocal, setUsingLocal] = useState(false);
  
  const isAdmin = userProfile?.role === 'admin';
  
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ai_video_vault_custom_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleAddCategory = (newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    setCustomCategories(prev => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed].sort();
      try {
        localStorage.setItem('ai_video_vault_custom_categories', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // View state
  const [view, setView] = useState<'detail' | 'compare' | 'dashboard'>('detail');

  // Filters state
  const [filterGroup, setFilterGroup] = useState<string>('Todas');
  const [filterUser, setFilterUser] = useState<string>('Todos');
  const [filterModel, setFilterModel] = useState<string>('Todos');
  const [filterOrientation, setFilterOrientation] = useState<string>('Todas');
  const [filterSource, setFilterSource] = useState<string>('Todos');
  const [filterResolution, setFilterResolution] = useState<string>('Todas');
  const [filterLora, setFilterLora] = useState<string>('Todos');
  const [filterPrecision, setFilterPrecision] = useState<string>('Todas');
  const [filterVae, setFilterVae] = useState<string>('Todos');
  const [filterEncoder, setFilterEncoder] = useState<string>('Todos');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [groupByFolder, setGroupByFolder] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [dualComparePair, setDualComparePair] = useState<{ videoA: VideoRecord; videoB: VideoRecord } | null>(null);
  const [videosToDelete, setVideosToDelete] = useState<string[] | null>(null);

  // Fetch or create user profile with Firestore multi-device sync
  const fetchUserProfile = async (user: User) => {
    let localHardware: UserHardware | undefined;
    try {
      const stored = localStorage.getItem('ai_video_vault_hardware');
      if (stored) localHardware = JSON.parse(stored);
    } catch {}

    let localHfUrl: string | undefined;
    try {
      localHfUrl = localStorage.getItem('ai_video_vault_hf_dataset_url') || undefined;
    } catch {}

    let firestoreHardware: UserHardware | undefined;
    let firestoreDisplayName: string | undefined;
    let firestoreRole: 'admin' | 'viewer' | undefined;
    let firestoreHfUrl: string | undefined;

    if (db) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.hardware) firestoreHardware = data.hardware as UserHardware;
          if (data.displayName) firestoreDisplayName = data.displayName as string;
          if (data.role) firestoreRole = data.role as 'admin' | 'viewer';
          if (data.huggingfaceDatasetUrl) firestoreHfUrl = data.huggingfaceDatasetUrl as string;
        }
      } catch (e) {
        console.warn('Could not fetch user profile from Firestore', e);
      }
    }

    const activeHardware = firestoreHardware || localHardware;
    const activeDisplayName = user.displayName || firestoreDisplayName || '';
    const activeHfUrl = firestoreHfUrl || localHfUrl;

    if (activeDisplayName) {
      setUserDisplayName(activeDisplayName);
    }

    if (activeHardware) {
      try {
        localStorage.setItem('ai_video_vault_hardware', JSON.stringify(activeHardware));
      } catch {}
    }

    if (activeHfUrl) {
      try {
        localStorage.setItem('ai_video_vault_hf_dataset_url', activeHfUrl);
      } catch {}
    }

    // If we had local hardware but not yet in Firestore, sync it up
    if (db && localHardware && !firestoreHardware) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email || '',
          displayName: activeDisplayName,
          hardware: localHardware,
          huggingfaceDatasetUrl: activeHfUrl || '',
          updatedAt: Date.now()
        }, { merge: true });
      } catch (err) {
        console.warn('Could not sync local hardware to Firestore', err);
      }
    }

    const baseProfile: UserProfile = { 
      uid: user.uid, 
      email: user.email || '', 
      displayName: activeDisplayName,
      hardware: activeHardware,
      role: firestoreRole,
      huggingfaceDatasetUrl: activeHfUrl
    };
    setUserProfile(baseProfile);

    if (!activeHardware && firestoreRole === 'admin') {
      setIsHardwareModalOpen(true);
    }
  };

  // Escuchar estado de autenticación
  useEffect(() => {
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        if (user) {
          setUserDisplayName(user.displayName || '');
          fetchUserProfile(user);
          if (!user.displayName) {
            setIsNickModalOpen(true);
          }
        } else {
          setUserProfile(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      setCurrentUser(null);
      setAuthLoading(false);
    }
  }, []);

  const handleSaveHardware = async (hardware: UserHardware) => {
    if (!currentUser) return;
    try {
      localStorage.setItem('ai_video_vault_hardware', JSON.stringify(hardware));
    } catch (err) {
      console.error('Error saving hardware to local storage', err);
    }

    if (db) {
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || userDisplayName || '',
          hardware,
          updatedAt: Date.now()
        }, { merge: true });
      } catch (err) {
        console.warn('Could not sync hardware to Firestore', err);
      }
    }

    setUserProfile(prev => {
      if (prev) return { ...prev, hardware };
      return { uid: currentUser.uid, email: currentUser.email || '', displayName: userDisplayName, hardware };
    });
    setIsHardwareModalOpen(false);
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('ai_video_vault_hardware');
        setVideos([]);
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
    if (!currentUser) return;

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
  }, [currentUser]);

  const cleanUndefined = (obj: any) => {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
  };

  const handleSaveBatch = async (records: VideoRecord[]) => {
    const activeNick = userDisplayName || currentUser?.displayName || userProfile?.displayName;
    const activeEmail = currentUser?.email || userProfile?.email;
    const activeUid = currentUser?.uid || userProfile?.uid;

    records.forEach(record => {
      if (!record.hardware && userProfile?.hardware) {
        record.hardware = { ...userProfile.hardware };
      }
      if (!record.createdBy && activeEmail) {
        record.createdBy = activeEmail;
      }
      if (!record.creatorUid && activeUid) {
        record.creatorUid = activeUid;
      }
      if (!record.creatorDisplayName && activeNick) {
        record.creatorDisplayName = activeNick;
      }
    });

    if (db && !usingLocal) {
      try {
        const batchPromises = records.map(record => {
          const cleanRecord = cleanUndefined(record);
          return addDoc(collection(db, COLLECTION_NAME), cleanRecord);
        });
        await Promise.all(batchPromises);
      } catch (err) {
        console.error("Error al escribir en Firestore batch", err);
        const recordsWithIds = records.map(r => ({ ...r, id: `local_${crypto.randomUUID()}` }));
        const newVids = [...recordsWithIds, ...videos];
        setVideos(newVids);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newVids));
        } catch {}
        setUsingLocal(true);
      }
    } else {
      const recordsWithIds = records.map(r => ({ ...r, id: `local_${crypto.randomUUID()}` }));
      const newVids = [...recordsWithIds, ...videos];
      setVideos(newVids);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newVids));
      } catch {}
    }
  };

  const handleAddVideo = async (record: VideoRecord) => {
    // Inject hardware & creator stamp from user profile if not already present
    if (!record.hardware && userProfile?.hardware) {
      record.hardware = { ...userProfile.hardware };
    }
    if (!record.createdBy && (currentUser?.email || userProfile?.email)) {
      record.createdBy = currentUser?.email || userProfile?.email;
    }
    if (!record.creatorUid && (currentUser?.uid || userProfile?.uid)) {
      record.creatorUid = currentUser?.uid || userProfile?.uid;
    }
    const activeNick = userDisplayName || currentUser?.displayName || userProfile?.displayName;
    if (!record.creatorDisplayName && activeNick) {
      record.creatorDisplayName = activeNick;
    }

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

  // Extract unique values for filters and category selectors
  const uniqueGroups = useMemo(() => {
    const fromVideos = videos.map(v => v.groupName).filter(Boolean) as string[];
    return Array.from(new Set([...fromVideos, ...customCategories])).sort();
  }, [videos, customCategories]);
  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    videos.forEach(v => {
      if (v.createdBy) {
        const label = v.creatorDisplayName ? `${v.creatorDisplayName} (${v.createdBy})` : v.createdBy;
        map.set(v.createdBy, label);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [videos]);
  const uniqueModels = useMemo(() => Array.from(new Set(videos.map(v => v.model).filter(Boolean) as string[])).sort(), [videos]);
  const uniqueTags = useMemo(() => Array.from(new Set(videos.flatMap(v => v.tags || []))).sort(), [videos]);
  const uniqueResolutions = useMemo(() => Array.from(new Set(videos.map(v => `${v.width}x${v.height}`))).sort(), [videos]);
  const uniqueLoras = useMemo(() => Array.from(new Set(videos.flatMap(v => v.loras?.map(l => l.name) || []))).sort(), [videos]);
  const uniqueVaes = useMemo(() => Array.from(new Set(videos.map(v => v.videoVae).filter(Boolean) as string[])).sort(), [videos]);
  const uniqueEncoders = useMemo(() => Array.from(new Set(videos.map(v => v.textEncoder).filter(Boolean) as string[])).sort(), [videos]);
  const uniquePrecisions = useMemo(() => Array.from(new Set(videos.map(v => v.precision).filter(Boolean) as string[])).sort(), [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        const matchesSearch = video.prompt.toLowerCase().includes(lower) ||
          video.model.toLowerCase().includes(lower) ||
          (video.tags && video.tags.some((t) => t.toLowerCase().includes(lower))) ||
          (video.loras && video.loras.some((l) => l.name.toLowerCase().includes(lower))) ||
          video.steps.toString().includes(lower) ||
          (video.shift !== undefined && video.shift.toString().includes(lower)) ||
          (video.videoVae && video.videoVae.toLowerCase().includes(lower)) ||
          (video.textEncoder && video.textEncoder.toLowerCase().includes(lower)) ||
          (video.precision && video.precision.toLowerCase().includes(lower)) ||
          (video.creatorDisplayName && video.creatorDisplayName.toLowerCase().includes(lower)) ||
          (video.createdBy && video.createdBy.toLowerCase().includes(lower)) ||
          (video.hardware && video.hardware.gpu.toLowerCase().includes(lower));

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

      // 8. Resolution
      if (filterResolution !== 'Todas' && `${video.width}x${video.height}` !== filterResolution) return false;

      // 9. LoRA
      if (filterLora !== 'Todos') {
        if (!video.loras || !video.loras.some(l => l.name === filterLora)) return false;
      }

      // 10. VAE
      if (filterVae !== 'Todos' && video.videoVae !== filterVae) return false;

      // 11. Encoder
      if (filterEncoder !== 'Todos' && video.textEncoder !== filterEncoder) return false;

      // 12. Precision
      if (filterPrecision !== 'Todas' && video.precision !== filterPrecision) return false;

      return true;
    });
  }, [videos, searchTerm, filterGroup, filterUser, filterModel, filterOrientation, filterSource, filterTags, filterResolution, filterLora, filterVae, filterEncoder, filterPrecision]);

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

  const isVideoOwner = (video: VideoRecord): boolean => {
    // Si estamos en modo local y no hay usuario, permitir (para desarrollo/pruebas)
    if (usingLocal && !currentUser) {
      return true;
    }
    
    // Solo el administrador (y registros locales/mock para preview) tiene permisos de edición/borrado
    if (video.id?.startsWith('local_') || video.id?.startsWith('mock')) {
      return true;
    }

    return isAdmin;
  };

  const handleOpenDualCompare = (videoA: VideoRecord, videoB?: VideoRecord) => {
    if (videoB) {
      setDualComparePair({ videoA, videoB });
    } else {
      const other = filteredVideos.find(v => v.id !== videoA.id) || videos.find(v => v.id !== videoA.id);
      if (other) {
        setDualComparePair({ videoA, videoB: other });
      }
    }
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
    // Security check: Only delete videos created by current user
    const targetVideos = videos.filter(v => ids.includes(v.id!));
    const authorizedVideos = targetVideos.filter(isVideoOwner);
    const authorizedIds = authorizedVideos.map(v => v.id!).filter(Boolean);

    if (authorizedIds.length === 0) {
      setVideosToDelete(null);
      return;
    }

    // Separate Firestore IDs vs local IDs
    const firestoreIds = authorizedIds.filter(id => !id.startsWith('local_') && !id.startsWith('mock'));

    // Optimistically update state & local storage immediately
    const updated = videos.filter(v => !authorizedIds.includes(v.id!));
    setVideos(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    // Delete authorized records from Firestore
    if (db && !usingLocal && firestoreIds.length > 0) {
      try {
        await Promise.all(firestoreIds.map(id => deleteDoc(doc(db, COLLECTION_NAME, id))));
      } catch (err) {
        console.error("Error al borrar de Firestore", err);
      }
    }

    // Update selected IDs
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      authorizedIds.forEach(id => next.delete(id));
      return next;
    });

    if (selectionMode && authorizedIds.length >= ids.length) {
      setSelectionMode(false);
    }
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

  const handleNavigateToVideo = (id: string) => {
    setView('detail');
    setTimeout(() => {
      document.getElementById(`video-card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <AccessGate />;
  }

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
              {/* Botón de Autenticación / Estado de Usuario */}
              <div className="flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-800 rounded-full p-1 shadow-sm">
                <button
                  onClick={() => setIsNickModalOpen(true)}
                  title="Haz clic para ver y editar tu perfil y dataset de Hugging Face"
                  className="flex items-center gap-2 text-xs text-neutral-200 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-full px-3 py-1.5 transition-all shadow-inner group/profile"
                >
                  <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 border border-teal-500/30 group-hover/profile:border-teal-400/60 transition-colors">
                    <UserIcon className="w-3 h-3" />
                  </div>
                  <span className="max-w-[140px] truncate font-medium">
                    {userDisplayName || currentUser.email}
                  </span>
                  <Edit3 className="w-3 h-3 text-neutral-400 group-hover/profile:text-teal-300 transition-colors shrink-0" />
                </button>
                
                {isAdmin && (
                  <button
                    onClick={() => setIsHardwareModalOpen(true)}
                    title="Perfil de Hardware"
                    className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  >
                    <Cpu className={`w-3.5 h-3.5 ${userProfile?.hardware ? 'text-teal-400' : 'text-amber-500'}`} />
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="p-1.5 rounded-full text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Botones de acción principales */}
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (selectionMode) {
                        setSelectionMode(false);
                        setSelectedVideoIds(new Set());
                      } else {
                        setSelectionMode(true);
                      }
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold transition-all border ${
                       selectionMode 
                        ? 'bg-teal-950/70 text-teal-300 border-teal-600 shadow-md shadow-teal-950/40' 
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 text-neutral-300'
                    }`}
                    title="Activar/desactivar modo de selección para borrar o comparar"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-teal-400" />
                    <span>{selectionMode ? 'Seleccionando...' : 'Seleccionar'}</span>
                    {selectedVideoIds.size > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-teal-500 text-neutral-950 text-[10px] font-bold rounded-full">
                        {selectedVideoIds.size}
                      </span>
                    )}
                  </button>
                )}

                {isAdmin ? (
                  <>
                    <button
                      onClick={() => setIsBatchModalOpen(true)}
                      className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-neutral-950 px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-md shadow-teal-950/40"
                      title="Importar varios vídeos desde URLs"
                    >
                      <Database className="w-4 h-4" /> <span>Batch Import</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingVideo(undefined);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 px-3 py-2 rounded-full text-xs sm:text-sm font-medium transition-all"
                      title="Crear registro individual de vídeo manualmente"
                    >
                      <Plus className="w-4 h-4" /> <span className="hidden md:inline">Nuevo Registro</span>
                    </button>
                  </>
                ) : (
                  <div className="relative group">
                    <button
                      disabled
                      className="flex items-center gap-2 bg-neutral-900/50 border border-neutral-800/80 text-neutral-600 px-4 py-2 rounded-full text-sm font-medium cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 text-neutral-600" /> Nuevo Registro
                    </button>
                    <div className="absolute right-0 top-full mt-2 hidden group-hover:block z-50 whitespace-nowrap bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs px-3 py-1.5 rounded-lg shadow-xl">
                      Solo los administradores pueden añadir vídeos
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Sub-navegación para vistas */}
        <div className="border-b border-neutral-900 bg-neutral-950/50">
          <div className="max-w-[1600px] mx-auto px-6">
            <div className="flex items-center gap-1 py-3 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setView('detail')} 
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${view === 'detail' ? 'bg-neutral-800 text-teal-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'}`}
              >
                Vista Detallada
              </button>
              <button 
                onClick={() => setView('compare')} 
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${view === 'compare' ? 'bg-neutral-800 text-teal-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'}`}
              >
                Comparativa Visual
              </button>
              <button 
                onClick={() => setView('dashboard')} 
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${view === 'dashboard' ? 'bg-neutral-800 text-teal-400 shadow-sm' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'}`}
              >
                Métricas y Rendimiento
              </button>
              {videos.length >= 2 && (
                <button 
                  onClick={() => handleOpenDualCompare(videos[0], videos[1])} 
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 ml-auto shadow-sm"
                  title="Abrir comparativa 1 vs 1 a pantalla completa (permite elegir cualquier vídeo del catálogo)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  <span>Comparativa 1 vs 1</span>
                </button>
              )}
            </div>
          </div>
        </div>

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
                {userOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                <option value="Anónimo">Anónimo</option>
              </select>

              <select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500">
                <option value="Todos">Todos los modelos</option>
                {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              {uniqueVaes.length > 0 && (
                <select value={filterVae} onChange={e => setFilterVae(e.target.value)} className="bg-neutral-950 border border-purple-900/50 rounded-lg px-3 py-1.5 text-xs text-purple-300 focus:outline-none focus:border-purple-500">
                  <option value="Todos">VAE (Todos)</option>
                  {uniqueVaes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}

              {uniqueEncoders.length > 0 && (
                <select value={filterEncoder} onChange={e => setFilterEncoder(e.target.value)} className="bg-neutral-950 border border-blue-900/50 rounded-lg px-3 py-1.5 text-xs text-blue-300 focus:outline-none focus:border-blue-500">
                  <option value="Todos">Encoder (Todos)</option>
                  {uniqueEncoders.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                </select>
              )}

              {uniquePrecisions.length > 0 && (
                <select value={filterPrecision} onChange={e => setFilterPrecision(e.target.value)} className="bg-neutral-950 border border-amber-900/50 rounded-lg px-3 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-500">
                  <option value="Todas">Precisión (Todas)</option>
                  {uniquePrecisions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}

              <select value={filterResolution} onChange={e => setFilterResolution(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500">
                <option value="Todas">Resolución (Todas)</option>
                {uniqueResolutions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={filterLora} onChange={e => setFilterLora(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500">
                <option value="Todos">LoRAs (Todos)</option>
                {uniqueLoras.map(l => <option key={l} value={l}>{l}</option>)}
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

          {view === 'dashboard' ? (
            <DashboardView videos={filteredVideos} />
          ) : view === 'compare' ? (
            <CompareView 
              videos={filteredVideos} 
              sharedPrompt={sharedPrompt} 
              onNavigateToVideo={handleNavigateToVideo}
              onOpenDualCompare={(vA, vB) => setDualComparePair({ videoA: vA, videoB: vB })}
            />
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
                              onCompareClick={() => handleOpenDualCompare(video)}
                              onDeleteClick={isVideoOwner(video) && !selectionMode ? () => setVideosToDelete([video.id!]) : undefined}
                              onEditClick={isVideoOwner(video) && !selectionMode ? () => {
                                setEditingVideo(video);
                                setIsModalOpen(true);
                              } : undefined}
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
            <div className="flex flex-col gap-6 pb-24">
              {filteredVideos.map((video) => (
                <div key={video.id || video.videoUrl}>
                  <VideoCard 
                    video={video} 
                    selectionMode={selectionMode}
                    isSelected={selectedVideoIds.has(video.id!)}
                    onToggleSelect={() => toggleSelection(video.id!)}
                    onCompareClick={() => handleOpenDualCompare(video)}
                    onDeleteClick={isVideoOwner(video) && !selectionMode ? () => setVideosToDelete([video.id!]) : undefined}
                    onEditClick={isVideoOwner(video) && !selectionMode ? () => {
                      setEditingVideo(video);
                      setIsModalOpen(true);
                    } : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Floating Bottom Bulk Action Toolbar */}
      {isAdmin && selectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[92%] sm:w-auto animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-neutral-900/95 backdrop-blur-md border border-teal-500/40 px-4 py-3 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.6)] flex flex-wrap items-center justify-between sm:justify-start gap-3 text-sm">
            {/* Contador de seleccionados */}
            <div className="flex items-center gap-2 pr-2 border-r border-neutral-800">
              <span className="flex h-2.5 w-2.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="font-bold text-white text-xs sm:text-sm whitespace-nowrap">
                {selectedVideoIds.size} {selectedVideoIds.size === 1 ? 'vídeo seleccionado' : 'vídeos seleccionados'}
              </span>
            </div>

            {/* Acciones de selección rápida */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => {
                  if (selectedVideoIds.size === filteredVideos.length && filteredVideos.length > 0) {
                    setSelectedVideoIds(new Set());
                  } else {
                    setSelectedVideoIds(new Set(filteredVideos.map(v => v.id!).filter(Boolean)));
                  }
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-neutral-700/60"
              >
                {selectedVideoIds.size === filteredVideos.length && filteredVideos.length > 0 ? 'Desmarcar todos' : 'Marcar todos'}
              </button>

              {filteredVideos.some(v => !isVideoOwner(v)) && filteredVideos.some(isVideoOwner) && (
                <button
                  onClick={() => {
                    const myIds = filteredVideos.filter(isVideoOwner).map(v => v.id!).filter(Boolean);
                    setSelectedVideoIds(new Set(myIds));
                  }}
                  className="px-3 py-1.5 bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-800/60 rounded-lg text-xs font-medium transition-colors"
                  title="Seleccionar solo los vídeos que puedes borrar o editar"
                >
                  Marcar mis vídeos ({filteredVideos.filter(isVideoOwner).length})
                </button>
              )}
            </div>

            {/* Separador */}
            <div className="hidden sm:block h-5 w-px bg-neutral-800" />

            {/* Acciones con los elementos seleccionados */}
            <div className="flex items-center gap-2 flex-wrap ml-auto sm:ml-0">
              {selectedVideoIds.size === 2 && (
                <button
                  onClick={() => {
                    const selected = Array.from(selectedVideoIds).map(id => videos.find(v => v.id === id)).filter(Boolean) as VideoRecord[];
                    if (selected.length === 2) {
                      setDualComparePair({ videoA: selected[0], videoB: selected[1] });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-neutral-950 font-bold rounded-lg text-xs transition-all shadow-md hover:scale-105 active:scale-95"
                  title="Comparar los 2 vídeos seleccionados a pantalla completa"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Comparar 1 vs 1</span>
                </button>
              )}

              {selectedVideoIds.size > 0 && (
                <button
                  onClick={() => setVideosToDelete(Array.from(selectedVideoIds))}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 border border-rose-800/80 rounded-lg text-xs font-semibold transition-all shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Eliminar ({selectedVideoIds.size})</span>
                </button>
              )}

              {/* Botón cerrar/salir modo selección */}
              <button
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedVideoIds(new Set());
                }}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                title="Salir del modo selección"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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

      {videosToDelete && (() => {
        const targetList = videos.filter(v => videosToDelete.includes(v.id!));
        const authorized = targetList.filter(isVideoOwner);
        const unauthorized = targetList.length - authorized.length;
        const activeUserLabel = userDisplayName || currentUser?.displayName || currentUser?.email || userProfile?.displayName || undefined;

        return (
          <DeleteConfirmModal
            totalCount={videosToDelete.length}
            authorizedCount={authorized.length}
            unauthorizedCount={unauthorized}
            authorIdentifier={activeUserLabel}
            onConfirm={() => handleDeleteConfirm(videosToDelete)}
            onCancel={() => setVideosToDelete(null)}
          />
        );
      })()}

      {isModalOpen && (
        <AddVideoModal 
          onClose={() => {
            setIsModalOpen(false);
            setEditingVideo(undefined);
          }} 
          onSave={editingVideo ? handleEditVideo : handleAddVideo}
          userEmail={currentUser?.email || userProfile?.email || undefined}
          initialData={editingVideo}
          existingGroups={uniqueGroups}
          onAddCategory={handleAddCategory}
        />
      )}

      {isBatchModalOpen && (
        <BatchImportModal 
          onClose={() => setIsBatchModalOpen(false)}
          onSaveBatch={handleSaveBatch}
          userEmail={currentUser?.email || userProfile?.email || undefined}
          userDisplayName={userDisplayName || currentUser?.displayName || userProfile?.displayName || undefined}
          userUid={currentUser?.uid || userProfile?.uid || undefined}
          availableCategories={uniqueGroups}
          onAddCategory={handleAddCategory}
        />
      )}

      {isNickModalOpen && currentUser && (
        <EditProfileModal
          user={currentUser}
          userProfile={userProfile}
          videos={videos}
          canImportVideos={isAdmin}
          onSaveBatch={handleSaveBatch}
          onAddCategory={handleAddCategory}
          onClose={() => setIsNickModalOpen(false)}
          onUpdated={(newNick, newHfUrl) => {
            setUserDisplayName(newNick);
            setUserProfile(prev => prev ? {
              ...prev,
              displayName: newNick,
              huggingfaceDatasetUrl: newHfUrl !== undefined ? newHfUrl : prev.huggingfaceDatasetUrl
            } : prev);
          }}
        />
      )}

      {isHardwareModalOpen && currentUser && (
        <HardwareProfileModal
          initialData={userProfile?.hardware}
          isMandatory={!userProfile?.hardware}
          onClose={() => setIsHardwareModalOpen(false)}
          onSave={handleSaveHardware}
        />
      )}

      {dualComparePair && (
        <DualCompareModal
          initialVideoA={dualComparePair.videoA}
          initialVideoB={dualComparePair.videoB}
          allVideos={videos}
          onClose={() => setDualComparePair(null)}
        />
      )}
    </div>
  );
}