import { useEffect, useState, useMemo } from 'react';
import { db, auth } from './lib/firebase';
import { collection, addDoc, onSnapshot, orderBy, query, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { VideoRecord, UserProfile, UserHardware } from './types';
import { VideoCard } from './components/VideoCard';
import { VideoGridCard } from './components/VideoGridCard';
import { CompareView } from './components/CompareView';
import { DashboardView } from './components/DashboardView';
import { AddVideoModal } from './components/AddVideoModal';
import { BatchImportModal } from './components/BatchImportModal';
import { AccessGate } from './components/AccessGate';
import { EditProfileModal } from './components/EditProfileModal';
import { HardwareProfileModal } from './components/HardwareProfileModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { DualCompareModal } from './components/DualCompareModal';
import { VaultLogo } from './components/VaultLogo';
import { AISparkle } from './components/AISparkle';
import { calculateOrientation, cleanForFirestore, extractTechnicalDetails } from './lib/utils';
import { Search, Plus, Database, LogOut, User as UserIcon, Edit3, Trash2, CheckSquare, Cpu, Sparkles, SplitSquareVertical, X, Check, LayoutList, LayoutGrid, Columns3, BarChart3, Filter, ChevronDown, ChevronUp, SlidersHorizontal, RotateCcw, Folder, FolderOpen, ArrowLeftRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import pkg from '../package.json';

const COLLECTION_NAME = 'videos';
const STORAGE_KEY = 'local_ai_videos_v2';

// Normaliza registros antiguos si existían en localStorage o Firestore
function normalizeRecord(raw: any): VideoRecord {
  const width = typeof raw.width === 'number' ? raw.width : 1920;
  const height = typeof raw.height === 'number' ? raw.height : 1080;
  const videoUrl = raw.videoUrl || '';
  const orientation = raw.orientation || calculateOrientation(width, height);

  let localTool = typeof raw.localTool === 'string' && raw.localTool.trim() ? raw.localTool.trim() : undefined;
  let softwareSource = raw.softwareSource;

  // Auto-evaluar desde rawMetadata para corrección precisa de Maestro vs Wan2GP
  if (raw.rawMetadata) {
    try {
      const parsed = typeof raw.rawMetadata === 'string' ? JSON.parse(raw.rawMetadata) : raw.rawMetadata;
      const tech = extractTechnicalDetails(
        parsed,
        typeof raw.rawMetadata === 'string' ? raw.rawMetadata : JSON.stringify(raw.rawMetadata),
        parsed?.model_type || parsed?.type || raw.model || ''
      );
      if (tech.softwareSource) {
        softwareSource = tech.softwareSource;
        localTool = tech.localTool;
      }
    } catch {}
  }

  // Fallback de consistencia entre softwareSource y localTool si no hay rawMetadata
  if (!softwareSource && localTool) {
    if (localTool.toLowerCase().includes('maestro')) {
      softwareSource = 'maestro';
      localTool = 'Maestro';
    } else if (localTool.toLowerCase().includes('comfy')) {
      softwareSource = 'comfyui';
      localTool = 'ComfyUI';
    } else {
      softwareSource = 'wan2gp';
      localTool = 'Wan2GP';
    }
  } else if (softwareSource && !localTool) {
    localTool = softwareSource === 'maestro' ? 'Maestro' : (softwareSource === 'comfyui' ? 'ComfyUI' : 'Wan2GP');
  }

  return {
    id: raw.id,
    schemaVersion: 2,
    videoUrl,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : undefined,
    prompt: raw.prompt || '',
    negativePrompt: raw.negativePrompt,
    model: raw.model || 'Desconocido',
    modelSizeB: typeof raw.modelSizeB === 'number' ? raw.modelSizeB : undefined,
    modelVariant: typeof raw.modelVariant === 'string' && raw.modelVariant.trim() ? raw.modelVariant.trim() : undefined,
    modelTypeRaw: typeof raw.modelTypeRaw === 'string' ? raw.modelTypeRaw : undefined,
    softwareSource,
    source: raw.source === 'cloud' ? 'cloud' : 'local',
    localTool,
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
    creatorUid: typeof raw.creatorUid === 'string' ? raw.creatorUid : undefined,
    creatorDisplayName: typeof raw.creatorDisplayName === 'string' ? raw.creatorDisplayName : undefined,
    videoVae: typeof raw.videoVae === 'string' && raw.videoVae !== 'Not Found' ? raw.videoVae : 'Original VAE',
    textEncoder: typeof raw.textEncoder === 'string' ? raw.textEncoder : undefined,
    precision: typeof raw.precision === 'string' ? raw.precision : undefined,
    renderSeconds: typeof raw.renderSeconds === 'number' ? raw.renderSeconds : undefined,
    fileSizeBytes: typeof raw.fileSizeBytes === 'number' ? raw.fileSizeBytes : undefined,
    generatedAt: typeof raw.generatedAt === 'number' ? raw.generatedAt : undefined,
    rawMetadata: typeof raw.rawMetadata === 'string' ? raw.rawMetadata : undefined,
    hardware: raw.hardware,
    turboPreset: typeof raw.turboPreset === 'string' ? raw.turboPreset : undefined,
    turboMode: typeof raw.turboMode === 'boolean' ? raw.turboMode : undefined,
    skipStepsMultiplier: typeof raw.skipStepsMultiplier === 'number' ? raw.skipStepsMultiplier : undefined,
    skipStepsCacheType: typeof raw.skipStepsCacheType === 'string' ? raw.skipStepsCacheType : undefined,
    overrideAttention: typeof raw.overrideAttention === 'string' ? raw.overrideAttention : undefined,
    slidingWindowSize: typeof raw.slidingWindowSize === 'number' ? raw.slidingWindowSize : undefined,
    slidingWindowOverlap: typeof raw.slidingWindowOverlap === 'number' ? raw.slidingWindowOverlap : undefined,
    cfg: typeof raw.cfg === 'number' ? raw.cfg : undefined,
    jobId: typeof raw.jobId === 'string' ? raw.jobId : undefined,
    jobElapsedTimeSeconds: typeof raw.jobElapsedTimeSeconds === 'number' ? raw.jobElapsedTimeSeconds : undefined,
    generationTimeBasis: typeof raw.generationTimeBasis === 'string' ? raw.generationTimeBasis : undefined,
    settingsVersion: typeof raw.settingsVersion === 'number' ? raw.settingsVersion : undefined,
  };
}

const MOCK_DATA: VideoRecord[] = [
  {
    id: 'mock1',
    schemaVersion: 2,
    videoUrl: 'https://huggingface.co/datasets/example/videos/resolve/main/cyberpunk_street.mp4',
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

  // Layout mode for catalog: list (full detail card) vs grid (mosaico/cuadrícula)
  const [catalogLayout, setCatalogLayout] = useState<'list' | 'grid'>(() => {
    try {
      return (localStorage.getItem('ai_vault_catalog_layout') as 'list' | 'grid') || 'list';
    } catch {
      return 'list';
    }
  });

  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(() => {
    try {
      const saved = localStorage.getItem('ai_vault_grid_columns');
      if (saved === '2' || saved === '3' || saved === '4') {
        return Number(saved) as 2 | 3 | 4;
      }
      return 3;
    } catch {
      return 3;
    }
  });

  const handleSetCatalogLayout = (layout: 'list' | 'grid') => {
    setCatalogLayout(layout);
    try {
      localStorage.setItem('ai_vault_catalog_layout', layout);
    } catch {}
  };

  const handleSetGridColumns = (cols: 2 | 3 | 4) => {
    setGridColumns(cols);
    try {
      localStorage.setItem('ai_vault_grid_columns', String(cols));
    } catch {}
  };

  // Filters state
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filterGroup, setFilterGroup] = useState<string>('Todas');
  const [filterUser, setFilterUser] = useState<string>('Todos');
  const [filterModel, setFilterModel] = useState<string>('Todos');
  const [filterModelSizeB, setFilterModelSizeB] = useState<string>('Todos');
  const [filterOrientation, setFilterOrientation] = useState<string>('Todas');
  const [filterLocalTool, setFilterLocalTool] = useState<string>('Todos');
  const [filterResolution, setFilterResolution] = useState<string>('Todas');
  const [filterLora, setFilterLora] = useState<string>('Todos');
  const [filterVae, setFilterVae] = useState<string>('Todos');
  const [filterEncoder, setFilterEncoder] = useState<string>('Todos');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [groupByFolder, setGroupByFolder] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterGroup !== 'Todas') count++;
    if (filterUser !== 'Todos') count++;
    if (filterModel !== 'Todos') count++;
    if (filterModelSizeB !== 'Todos') count++;
    if (filterOrientation !== 'Todas') count++;
    if (filterLocalTool !== 'Todos') count++;
    if (filterResolution !== 'Todas') count++;
    if (filterLora !== 'Todos') count++;
    if (filterVae !== 'Todos') count++;
    if (filterEncoder !== 'Todos') count++;
    if (filterTags.length > 0) count += filterTags.length;
    if (groupByFolder) count++;
    return count;
  }, [filterGroup, filterUser, filterModel, filterModelSizeB, filterOrientation, filterLocalTool, filterResolution, filterLora, filterVae, filterEncoder, filterTags, groupByFolder]);

  const handleResetFilters = () => {
    setFilterGroup('Todas');
    setFilterUser('Todos');
    setFilterModel('Todos');
    setFilterModelSizeB('Todos');
    setFilterOrientation('Todas');
    setFilterLocalTool('Todos');
    setFilterResolution('Todas');
    setFilterLora('Todos');
    setFilterVae('Todos');
    setFilterEncoder('Todos');
    setFilterTags([]);
    setGroupByFolder(false);
  };

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [dualComparePair, setDualComparePair] = useState<{ videoA: VideoRecord; videoB: VideoRecord } | null>(null);
  const [videosToDelete, setVideosToDelete] = useState<string[] | null>(null);
  const [dbErrorToast, setDbErrorToast] = useState<string | null>(null);

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

  const [isLoginAnimating, setIsLoginAnimating] = useState(false);

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
      console.log(`[AI Video Vault] Iniciando guardado de lote (${records.length} vídeos) en Firestore...`, {
        user: currentUser?.email,
        uid: currentUser?.uid,
        isAdmin
      });
      try {
        const batchPromises = records.map(async (record, index) => {
          const cleanRecord = cleanForFirestore(record);
          console.log(`[AI Video Vault] Guardando registro #${index + 1}:`, cleanRecord);
          return await addDoc(collection(db, COLLECTION_NAME), cleanRecord);
        });
        const docRefs = await Promise.all(batchPromises);
        console.log(`[AI Video Vault] ✓ Guardados con éxito ${docRefs.length} documentos en Firestore.`);
      } catch (err: any) {
        console.error("[AI Video Vault] ❌ Error crítico al escribir en Firestore batch:", err);
        const errMsg = err?.code ? `Firebase [${err.code}]: ${err.message}` : (err?.message || 'Error desconocido de Firestore');
        setDbErrorToast(`Error al guardar en Firebase: ${errMsg}`);
        throw new Error(errMsg);
      }
    } else {
      console.log(`[AI Video Vault] Guardando lote de ${records.length} vídeos en modo local...`);
      const recordsWithIds = records.map(r => ({ ...r, id: `local_${crypto.randomUUID()}` }));
      const newVids = [...recordsWithIds, ...videos];
      setVideos(newVids);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newVids));
      } catch (e) {
        console.error("[AI Video Vault] Error al guardar en localStorage:", e);
      }
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

    const cleanRecord = cleanForFirestore(record);
    if (db && !usingLocal) {
      console.log("[AI Video Vault] Guardando nuevo vídeo en Firestore:", cleanRecord);
      try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanRecord);
        console.log("[AI Video Vault] ✓ Guardado con éxito con ID:", docRef.id);
      } catch (err: any) {
        console.error("[AI Video Vault] ❌ Error al escribir en Firestore:", err);
        const errMsg = err?.code ? `Firebase [${err.code}]: ${err.message}` : (err?.message || 'Error al guardar en Firestore');
        setDbErrorToast(`Error al guardar en Firebase: ${errMsg}`);
        throw new Error(errMsg);
      }
    } else {
      const newRecord = { ...record, id: `local_${Date.now()}` };
      const updated = [newRecord, ...videos];
      setVideos(updated);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("[AI Video Vault] Error al guardar en localStorage:", e);
      }
    }
  };

  const isVideoOwner = (video: VideoRecord): boolean => {
    // Si estamos en modo local y no hay usuario autenticado (desarrollo offline)
    if (usingLocal && !currentUser && !userProfile) {
      return true;
    }
    
    // Registros locales en memoria o de prueba
    if (video.id?.startsWith('local_') || video.id?.startsWith('mock')) {
      return true;
    }

    if (!currentUser && !userProfile) {
      return false;
    }

    // Administrador del sistema
    if (isAdmin) {
      return true;
    }

    const currentUid = (currentUser?.uid || userProfile?.uid)?.trim();
    const currentEmail = (currentUser?.email || userProfile?.email)?.trim().toLowerCase();
    const currentNick = (userDisplayName || currentUser?.displayName || userProfile?.displayName)?.trim().toLowerCase();

    // 1. Comprobación por UID de Firebase (la más estricta y segura)
    if (video.creatorUid && currentUid && video.creatorUid.trim() === currentUid) {
      return true;
    }

    // 2. Comprobación por Email del creador
    if (video.createdBy && currentEmail && video.createdBy.trim().toLowerCase() === currentEmail) {
      return true;
    }

    // 3. Comprobación por Apodo / Display Name si no hay UID/email registrado
    if (video.creatorDisplayName && currentNick && video.creatorDisplayName.trim().toLowerCase() === currentNick) {
      return true;
    }

    return false;
  };

  const handleEditVideo = async (record: VideoRecord) => {
    // Verificación estricta de permisos de edición
    const originalVideo = videos.find(v => v.id === record.id);
    const videoToCheck = originalVideo || record;
    if (!isVideoOwner(videoToCheck)) {
      const errMsg = "Permiso denegado: No puedes editar un vídeo que no es de tu propiedad.";
      setDbErrorToast(errMsg);
      throw new Error(errMsg);
    }

    const cleanRecord = cleanForFirestore(record);
    if (db && !usingLocal && record.id && !record.id.startsWith('local_')) {
      try {
        await updateDoc(doc(db, COLLECTION_NAME, record.id), cleanRecord);
        console.log("[AI Video Vault] ✓ Vídeo actualizado en Firestore:", record.id);
      } catch (err: any) {
        console.error("[AI Video Vault] ❌ Error al actualizar en Firestore:", err);
        const errMsg = err?.code ? `Firebase [${err.code}]: ${err.message}` : (err?.message || 'Error al actualizar');
        setDbErrorToast(`Error al actualizar en Firebase: ${errMsg}`);
        throw new Error(errMsg);
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
    return Array.from(new Set([...fromVideos, ...customCategories])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [videos, customCategories]);

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    videos.forEach(v => {
      if (v.createdBy) {
        const label = v.creatorDisplayName ? `${v.creatorDisplayName} (${v.createdBy})` : v.createdBy;
        map.set(v.createdBy, label);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [videos]);

  const uniqueModels = useMemo(() => 
    Array.from(new Set(videos.map(v => v.model).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), 
    [videos]
  );

  const uniqueModelSizes = useMemo(() => {
    const rawSizes = videos
      .map(v => v.modelSizeB)
      .filter((s): s is number => typeof s === 'number');
    const unique = Array.from(new Set(rawSizes)).sort((a, b) => a - b);
    return unique;
  }, [videos]);

  const uniqueTags = useMemo(() => 
    Array.from(new Set(videos.flatMap(v => v.tags || [])))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), 
    [videos]
  );

  const uniqueResolutions = useMemo(() => {
    const rawResolutions = Array.from(new Set(videos.map(v => `${v.width}x${v.height}`)));
    return rawResolutions.sort((a, b) => {
      const [wA, hA] = a.split('x').map(Number);
      const [wB, hB] = b.split('x').map(Number);
      const areaA = (wA || 0) * (hA || 0);
      const areaB = (wB || 0) * (hB || 0);
      if (areaA !== areaB) return areaA - areaB;
      return (wA || 0) - (wB || 0);
    });
  }, [videos]);

  const uniqueLoras = useMemo(() => 
    Array.from(new Set(videos.flatMap(v => v.loras?.map(l => l.name) || [])))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), 
    [videos]
  );

  const uniqueVaes = useMemo(() => 
    Array.from(new Set(videos.map(v => v.videoVae).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })), 
    [videos]
  );

  const uniqueEncoders = useMemo(() => {
    const set = new Set<string>();
    videos.forEach(v => {
      if (v.textEncoder && v.textEncoder !== 'Not Found') set.add(v.textEncoder);
      if (v.precision) set.add(v.precision);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [videos]);

  const uniqueLocalTools = useMemo(() => 
    Array.from(new Set(videos.map(v => v.localTool).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [videos]
  );

  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        const matchesSearch = video.prompt.toLowerCase().includes(lower) ||
          video.model.toLowerCase().includes(lower) ||
          (video.modelSizeB !== undefined && `${video.modelSizeB}b`.includes(lower)) ||
          (video.localTool && video.localTool.toLowerCase().includes(lower)) ||
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

      // 4.1 Model Size (Parámetros: 20B, 33B, etc.)
      if (filterModelSizeB !== 'Todos') {
        if (filterModelSizeB === 'Sin especificar') {
          if (video.modelSizeB !== undefined) return false;
        } else {
          const targetSize = Number(filterModelSizeB);
          if (video.modelSizeB !== targetSize) return false;
        }
      }

      // 5. Orientation
      if (filterOrientation !== 'Todas' && video.orientation !== filterOrientation) return false;

      // 6. Herramienta (Wan2GP, ComfyUI, etc.)
      if (filterLocalTool !== 'Todos' && video.localTool !== filterLocalTool) return false;

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

      // 10. Video VAE (Técnico)
      if (filterVae !== 'Todos' && video.videoVae !== filterVae) return false;

      // 11. Text Encoder & Precisión (Técnico: Qwen3-VL INT8/FP8/BF16/GGUF...)
      if (filterEncoder !== 'Todos') {
        const matchEncoder = video.textEncoder === filterEncoder;
        const matchPrecision = video.precision === filterEncoder;
        if (!matchEncoder && !matchPrecision) return false;
      }

      return true;
    });
  }, [videos, searchTerm, filterGroup, filterUser, filterModel, filterModelSizeB, filterOrientation, filterLocalTool, filterTags, filterResolution, filterLora, filterVae, filterEncoder]);

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

  if (!currentUser || isLoginAnimating) {
    return (
      <AccessGate 
        onLoginStart={() => setIsLoginAnimating(true)}
        onLoginComplete={() => setIsLoginAnimating(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-teal-900/50 flex flex-col justify-between">
      <div>
        {/* Banner de error de base de datos */}
        {dbErrorToast && (
          <div className="bg-rose-950/90 border-b border-rose-800/80 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3 sticky top-0 z-50 backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5 max-w-5xl mx-auto flex-1">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold text-rose-100">{dbErrorToast}</span>
            </div>
            <button
              onClick={() => setDbErrorToast(null)}
              className="p-1 hover:bg-rose-900/50 rounded-lg text-rose-300 hover:text-white cursor-pointer transition-colors"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Fijo */}
        <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-xl border-b border-neutral-800">
          <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 shrink-0 group cursor-default">
              <div className="relative">
                <div className="w-10 h-10 bg-neutral-900/90 border border-teal-500/30 group-hover:border-teal-400/60 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.15)] group-hover:shadow-[0_0_20px_rgba(45,212,191,0.25)] transition-all duration-300 relative">
                  <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/10 via-purple-500/10 to-pink-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <VaultLogo className="w-6 h-6 drop-shadow-[0_0_6px_rgba(45,212,191,0.4)] relative z-10" />
                </div>
                {/* AI Sparkle badge overlapping top-right corner */}
                <div className="absolute -top-1.5 -right-1.5 z-20 pointer-events-none">
                  <AISparkle size="sm" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white group-hover:text-teal-100 transition-colors">AI Video Vault</h1>
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
                      className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all"
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
            <div className="flex items-center justify-between gap-4 py-2.5 overflow-x-auto no-scrollbar">
              {/* Segmented Control de Vistas */}
              <div className="flex items-center bg-neutral-900/90 border border-neutral-800 p-1 rounded-full shadow-inner">
                <button 
                  onClick={() => setView('detail')} 
                  className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                    view === 'detail' ? 'text-teal-300' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Vista Detallada del Catálogo"
                >
                  {view === 'detail' && (
                    <motion.div
                      layoutId="activeViewTab"
                      className="absolute inset-0 bg-neutral-800 border border-neutral-700/80 rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <LayoutList className="w-4 h-4 relative z-10 shrink-0" />
                  <span className="relative z-10 hidden sm:inline">Catálogo</span>
                </button>

                <button 
                  onClick={() => setView('compare')} 
                  className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                    view === 'compare' ? 'text-teal-300' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Comparativa Visual Cuadrícula"
                >
                  {view === 'compare' && (
                    <motion.div
                      layoutId="activeViewTab"
                      className="absolute inset-0 bg-neutral-800 border border-neutral-700/80 rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <Columns3 className="w-4 h-4 relative z-10 shrink-0" />
                  <span className="relative z-10 hidden sm:inline">Comparar</span>
                </button>

                <button 
                  onClick={() => setView('dashboard')} 
                  className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors duration-200 cursor-pointer whitespace-nowrap ${
                    view === 'dashboard' ? 'text-teal-300' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Métricas y Rendimiento"
                >
                  {view === 'dashboard' && (
                    <motion.div
                      layoutId="activeViewTab"
                      className="absolute inset-0 bg-neutral-800 border border-neutral-700/80 rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <BarChart3 className="w-4 h-4 relative z-10 shrink-0" />
                  <span className="relative z-10 hidden sm:inline">Métricas</span>
                </button>
              </div>

              {/* Acción rápida separada: Comparativa 1 vs 1 */}
              {videos.length >= 2 && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden md:block h-5 w-px bg-neutral-850" />
                  <button 
                    onClick={() => handleOpenDualCompare(videos[0], videos[1])} 
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:border-teal-400/50 flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    title="Abrir comparativa 1 vs 1 a pantalla completa (permite elegir cualquier vídeo del catálogo)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>Comparativa 1 vs 1</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-[1600px] mx-auto px-6 py-8">
          
          {/* Barra de Controles y Filtros */}
          <div className="mb-6 bg-neutral-900/50 rounded-2xl border border-neutral-800/80 overflow-hidden shadow-sm backdrop-blur-sm">
            {/* Barra superior de controles */}
            <div className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                {/* Botón para desplegar filtros */}
                <button
                  onClick={() => setShowFilters(prev => !prev)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                    showFilters || activeFiltersCount > 0
                      ? 'bg-neutral-800 text-teal-300 border-neutral-700 shadow-sm'
                      : 'bg-neutral-950/70 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white'
                  }`}
                  title={showFilters ? 'Ocultar panel de filtros' : 'Desplegar panel de filtros'}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Filtros</span>
                  {activeFiltersCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-teal-500 text-neutral-950 text-[10px] font-bold rounded-full ml-0.5">
                      {activeFiltersCount}
                    </span>
                  )}
                  {showFilters ? (
                    <ChevronUp className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-0.5" />
                  )}
                </button>

                {/* Contador de resultados */}
                <span className="text-xs sm:text-sm text-neutral-400">
                  Mostrando <strong className="text-neutral-200">{filteredVideos.length}</strong> de {videos.length} vídeos
                </span>
              </div>

              {/* Controles de la derecha: Agrupar por carpeta y Gestión por lote */}
              <div className="flex items-center gap-3 sm:gap-4">
                <label className="flex items-center gap-2 text-xs sm:text-sm text-neutral-300 hover:text-white cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={groupByFolder} 
                    onChange={e => setGroupByFolder(e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-950 text-teal-500 focus:ring-teal-500/20 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Agrupar por carpeta</span>
                </label>

                {/* Selector de modo de vista: Lista vs Cuadrícula */}
                {view === 'detail' && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5" title="Cambiar disposición del catálogo">
                      <button
                        onClick={() => handleSetCatalogLayout('list')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          catalogLayout === 'list'
                            ? 'bg-neutral-800 text-teal-300 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="Vista Lista / Detalle"
                      >
                        <LayoutList className="w-3.5 h-3.5" />
                        <span className="hidden md:inline text-[11px]">Lista</span>
                      </button>
                      <button
                        onClick={() => handleSetCatalogLayout('grid')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          catalogLayout === 'grid'
                            ? 'bg-neutral-800 text-teal-300 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                        title="Vista Cuadrícula / Mosaico"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="hidden md:inline text-[11px]">Mosaico</span>
                      </button>
                    </div>

                    {/* Selector de columnas en Mosaico */}
                    {catalogLayout === 'grid' && (
                      <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 text-xs" title="Vídeos por fila">
                        {([2, 3, 4] as const).map((cols) => (
                          <button
                            key={cols}
                            onClick={() => handleSetGridColumns(cols)}
                            className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              gridColumns === cols
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                                : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                            }`}
                            title={`${cols} columnas por fila`}
                          >
                            {cols}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Botón de Gestión por Lote (Solo Admin) */}
                {isAdmin && view === 'detail' && (
                  <>
                    <div className="h-4 w-px bg-neutral-800 hidden sm:block" />
                    <button
                      onClick={() => {
                        if (selectionMode) {
                          setSelectionMode(false);
                          setSelectedVideoIds(new Set());
                        } else {
                          setSelectionMode(true);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                        selectionMode 
                          ? 'bg-teal-950/80 text-teal-300 border-teal-500/60 shadow-sm' 
                          : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200'
                      }`}
                      title={selectionMode ? 'Salir del modo selección' : 'Activar selección para borrar o comparar en lote'}
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span className="hidden sm:inline">{selectionMode ? 'Seleccionando' : 'Gestión por lote'}</span>
                      <span className="sm:hidden">{selectionMode ? 'Salir' : 'Seleccionar'}</span>
                      {selectedVideoIds.size > 0 && (
                        <span className="px-1.5 py-0.2 bg-teal-500 text-neutral-950 text-[10px] font-bold rounded-full">
                          {selectedVideoIds.size}
                        </span>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Panel de Filtros Desplegable */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 1 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="border-t border-neutral-800/80 bg-neutral-950/70"
                >
                  <div className="p-4 sm:p-5 flex flex-col gap-4">
                    
                    {/* BLOQUE 1: Filtros Principales / Habituales */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3 h-3 text-teal-400" />
                          Filtros Principales
                        </span>
                        {activeFiltersCount > 0 && (
                          <button
                            onClick={handleResetFilters}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/50 transition-colors cursor-pointer"
                            title="Restablecer todos los filtros"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Limpiar filtros ({activeFiltersCount})</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2.5 items-center">
                        {/* Carpeta */}
                        <select 
                          value={filterGroup} 
                          onChange={e => setFilterGroup(e.target.value)} 
                          className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="Todas">📁 Todas las carpetas</option>
                          {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                          <option value="Sin carpeta">Sin carpeta</option>
                        </select>

                        {/* Modelo AI */}
                        <select 
                          value={filterModel} 
                          onChange={e => setFilterModel(e.target.value)} 
                          className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="Todos">🧠 Todos los modelos</option>
                          {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>

                        {/* Tamaño de Parámetros (20B, 33B...) */}
                        {uniqueModelSizes.length > 0 && (
                          <select 
                            value={filterModelSizeB} 
                            onChange={e => setFilterModelSizeB(e.target.value)} 
                            className="bg-neutral-900 border border-teal-900/60 hover:border-teal-700 rounded-lg px-3 py-1.5 text-xs text-teal-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                          >
                            <option value="Todos">⚡ Parámetros (Todos)</option>
                            {uniqueModelSizes.map(s => <option key={s} value={String(s)}>{s}B parámetros</option>)}
                          </select>
                        )}

                        {/* Resolución */}
                        <select 
                          value={filterResolution} 
                          onChange={e => setFilterResolution(e.target.value)} 
                          className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="Todas">📐 Resolución (Todas)</option>
                          {uniqueResolutions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>

                        {/* LoRAs */}
                        <select 
                          value={filterLora} 
                          onChange={e => setFilterLora(e.target.value)} 
                          className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="Todos">🧩 LoRAs (Todos)</option>
                          {uniqueLoras.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>

                        {/* Usuario */}
                        <select 
                          value={filterUser} 
                          onChange={e => setFilterUser(e.target.value)} 
                          className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="Todos">👤 Todos los usuarios</option>
                          {userOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                          <option value="Anónimo">Anónimo</option>
                        </select>

                        {/* Selector de Orientación */}
                        <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                          {['Todas', '16:9', '9:16', '1:1'].map(o => (
                            <button 
                              key={o} 
                              onClick={() => setFilterOrientation(o)} 
                              className={`px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                filterOrientation === o ? 'bg-neutral-800 text-teal-300 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                              }`}
                            >
                              {o}
                            </button>
                          ))}
                        </div>

                        {/* Herramienta (Wan2GP, ComfyUI, etc.) */}
                        {uniqueLocalTools.length > 0 && (
                          <select 
                            value={filterLocalTool} 
                            onChange={e => setFilterLocalTool(e.target.value)} 
                            className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-teal-500 cursor-pointer"
                          >
                            <option value="Todos">🔧 Herramienta (Todas)</option>
                            {uniqueLocalTools.map(tool => <option key={tool} value={tool}>{tool}</option>)}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* BLOQUE 2: Componentes Técnicos Avanzados (VAE de Vídeo y Text Encoder / Precisión) */}
                    {(uniqueVaes.length > 0 || uniqueEncoders.length > 0) && (
                      <div className="pt-3 border-t border-neutral-850 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3 h-3 text-indigo-400" />
                          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                            Arquitectura Técnica & Encoders
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2.5 items-center">
                          {/* Video VAE */}
                          {uniqueVaes.length > 0 && (
                            <select 
                              value={filterVae} 
                              onChange={e => setFilterVae(e.target.value)} 
                              className="bg-neutral-900 border border-purple-900/50 hover:border-purple-700 rounded-lg px-3 py-1.5 text-xs text-purple-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                              title="Filtro por Video VAE (FP8 Mixed Precision, Original VAE...)"
                            >
                              <option value="Todos">🔮 Video VAE (Todos)</option>
                              {uniqueVaes.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          )}

                          {/* Text Encoder & Precisión Cuantizada */}
                          {uniqueEncoders.length > 0 && (
                            <select 
                              value={filterEncoder} 
                              onChange={e => setFilterEncoder(e.target.value)} 
                              className="bg-neutral-900 border border-blue-900/50 hover:border-blue-700 rounded-lg px-3 py-1.5 text-xs text-blue-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                              title="Filtro por Text Encoder y Precisión (Qwen3-VL INT8, BF16, GGUF...)"
                            >
                              <option value="Todos">🔤 Text Encoder / Precisión (Todos)</option>
                              {uniqueEncoders.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    )}

                    {/* BLOQUE 3: Etiquetas (Tags) */}
                    {uniqueTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center pt-3 border-t border-neutral-850">
                        <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold mr-1.5">Tags:</span>
                        {uniqueTags.map(tag => {
                          const isActive = filterTags.includes(tag);
                          return (
                            <button 
                              key={tag}
                              onClick={() => {
                                setFilterTags(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag]);
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border cursor-pointer ${
                                isActive 
                                  ? 'bg-teal-950/80 border-teal-700 text-teal-300 shadow-sm' 
                                  : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                              }`}
                            >
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                    <div className="flex items-center justify-between bg-neutral-900/80 backdrop-blur-md p-3.5 px-5 rounded-2xl border border-neutral-800/90 shadow-sm hover:border-neutral-700/80 transition-all">
                      <button 
                        onClick={() => toggleGroupCollapse(groupName)} 
                        className="flex items-center gap-3 text-left cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/20 transition-all">
                          {isCollapsed ? <Folder className="w-4 h-4" /> : <FolderOpen className="w-4 h-4 text-teal-300" />}
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-neutral-100 text-sm sm:text-base tracking-tight group-hover:text-teal-300 transition-colors">
                            {groupName}
                          </span>
                          <span className="text-[11px] font-bold font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 py-0.5 rounded-full">
                            {groupVideos.length} {groupVideos.length === 1 ? 'vídeo' : 'vídeos'}
                          </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                      </button>
                      <button 
                        onClick={() => {
                          setFilterGroup(groupName);
                          setView('compare');
                        }}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-neutral-800/90 hover:bg-teal-500/15 text-neutral-300 hover:text-teal-300 border border-neutral-700/70 hover:border-teal-500/40 transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Ver comparativa de esta carpeta"
                      >
                        <Columns3 className="w-3.5 h-3.5 text-teal-400" />
                        <span>Comparar carpeta</span>
                      </button>
                    </div>
                    {!isCollapsed && (
                      <div className="pl-3 sm:pl-4 border-l-2 border-teal-500/20">
                        {catalogLayout === 'grid' ? (
                          <div className={`grid gap-5 ${
                            gridColumns === 2 
                              ? 'grid-cols-1 sm:grid-cols-2' 
                              : gridColumns === 4 
                              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                          }`}>
                            {groupVideos.map((video) => (
                              <VideoGridCard 
                                key={video.id || video.videoUrl}
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
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-6">
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
                    )}
                  </div>
                );
              })}
            </div>
          ) : catalogLayout === 'grid' ? (
            <div className={`grid gap-5 pb-24 ${
              gridColumns === 2 
                ? 'grid-cols-1 sm:grid-cols-2' 
                : gridColumns === 4 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {filteredVideos.map((video) => (
                <VideoGridCard 
                  key={video.id || video.videoUrl}
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
              ))}
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

      {/* Floating Bottom Bulk Action Toolbar with Animated RGB Glow Border */}
      <AnimatePresence>
        {isAdmin && selectionMode && (
          <motion.div 
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[94%] sm:w-auto"
          >
            {/* RGB Glow Animated Outer Wrapper */}
            <div className="relative p-[2px] rounded-2xl animate-rgb-glow shadow-[0_0_30px_rgba(20,184,166,0.35)]">
              <div className="bg-neutral-950/95 backdrop-blur-xl px-4 py-3 rounded-[14px] flex flex-wrap items-center justify-between sm:justify-start gap-3 text-sm">
                
                {/* Badge de estado y contador de seleccionados */}
                <div className="flex items-center gap-2.5 pr-2.5 sm:border-r sm:border-neutral-800">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Modo Selección</span>
                    <span className="font-extrabold text-white text-xs sm:text-sm whitespace-nowrap">
                      {selectedVideoIds.size} {selectedVideoIds.size === 1 ? 'vídeo marcado' : 'vídeos marcados'}
                    </span>
                  </div>
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
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-neutral-750 cursor-pointer active:scale-95 shadow-sm"
                  >
                    {selectedVideoIds.size === filteredVideos.length && filteredVideos.length > 0 ? 'Desmarcar todos' : 'Marcar todos'}
                  </button>

                  {filteredVideos.some(v => !isVideoOwner(v)) && filteredVideos.some(isVideoOwner) && (
                    <button
                      onClick={() => {
                        const myIds = filteredVideos.filter(isVideoOwner).map(v => v.id!).filter(Boolean);
                        setSelectedVideoIds(new Set(myIds));
                      }}
                      className="px-3 py-1.5 bg-teal-950/70 hover:bg-teal-900/80 text-teal-300 border border-teal-800/70 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
                      title="Seleccionar solo los vídeos que puedes borrar o editar"
                    >
                      Mis vídeos ({filteredVideos.filter(isVideoOwner).length})
                    </button>
                  )}
                </div>

                {/* Separador */}
                <div className="hidden sm:block h-6 w-px bg-neutral-800" />

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
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-neutral-950 font-extrabold rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(20,184,166,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                      title="Comparar los 2 vídeos seleccionados a pantalla completa"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-950 stroke-[2.5]" />
                      <span>Comparar 1 vs 1</span>
                    </button>
                  )}

                  {selectedVideoIds.size > 0 && (
                    <button
                      onClick={() => setVideosToDelete(Array.from(selectedVideoIds))}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 border border-rose-800/80 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
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
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                    title="Salir del modo selección"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


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