import { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { updateProfile, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile, VideoRecord } from '../../types';
import { normalizeHuggingFaceDatasetRepoId, processVideoMetadataFromUrl, parseVideoUrlInfo } from '../../lib/utils';
import { 
  X, 
  User as UserIcon, 
  Check, 
  FolderTree, 
  FolderSync, 
  ExternalLink, 
  Save, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  DownloadCloud, 
  Square,
  Sparkles
} from 'lucide-react';

interface EditProfileModalProps {
  user: User;
  userProfile?: UserProfile | null;
  videos: VideoRecord[];
  onClose: () => void;
  onUpdated: (newNick: string, newHfUrl?: string) => void;
  onSaveBatch?: (videos: VideoRecord[]) => Promise<void>;
  onAddCategory?: (category: string) => void;
  canImportVideos?: boolean;
}

interface LogItem {
  id: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export function EditProfileModal({
  user,
  userProfile,
  videos,
  onClose,
  onUpdated,
  onSaveBatch,
  onAddCategory,
  canImportVideos = false
}: EditProfileModalProps) {
  const [nick, setNick] = useState(userProfile?.displayName || user.displayName || '');
  const [hfDatasetInput, setHfDatasetInput] = useState(userProfile?.huggingfaceDatasetUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Sync with userProfile if prop updates
  useEffect(() => {
    if (userProfile?.displayName) {
      setNick(userProfile.displayName);
    }
    if (userProfile?.huggingfaceDatasetUrl !== undefined) {
      setHfDatasetInput(userProfile.huggingfaceDatasetUrl);
    }
  }, [userProfile]);

  const currentRepoId = useMemo(() => {
    return normalizeHuggingFaceDatasetRepoId(hfDatasetInput) || normalizeHuggingFaceDatasetRepoId(userProfile?.huggingfaceDatasetUrl || '');
  }, [hfDatasetInput, userProfile?.huggingfaceDatasetUrl]);

  // Hugging Face Scan and Sync state
  const [isScanningHf, setIsScanningHf] = useState(false);
  const [scanProgressMsg, setScanProgressMsg] = useState('');
  const [scanResult, setScanResult] = useState<{
    scannedFoldersCount: number;
    newVideos: { path: string; downloadUrl: string; size?: number; category: string; fileName: string }[];
    existingCount: number;
    totalFound: number;
  } | null>(null);

  const [isImportingHf, setIsImportingHf] = useState(false);
  const cancelHfImportRef = useRef(false);
  const [hfImportProgress, setHfImportProgress] = useState({ current: 0, total: 0 });
  const [hfLogs, setHfLogs] = useState<LogItem[]>([]);
  const hfLogsEndRef = useRef<HTMLDivElement>(null);

  const addHfLog = (type: LogItem['type'], message: string) => {
    const time = new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date());

    setHfLogs(prev => [
      ...prev.slice(-150),
      {
        id: Math.random().toString(36).substring(2, 9),
        type,
        message,
        timestamp: time
      }
    ]);
  };

  useEffect(() => {
    if (isImportingHf || isScanningHf) {
      hfLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hfLogs, isImportingHf, isScanningHf]);

  const handleScanHfDataset = async () => {
    const repoId = currentRepoId;
    if (!repoId) {
      setError('Introduce un dataset de Hugging Face válido antes de escanear.');
      return;
    }

    setIsScanningHf(true);
    setScanResult(null);
    setError(null);
    setScanProgressMsg('Iniciando exploración del dataset...');
    setHfLogs([]);
    addHfLog('info', `Iniciando escaneo recursivo en tu dataset de Hugging Face: ${repoId}`);

    try {
      const directVideoUrls: { path: string; downloadUrl: string; size?: number; category: string; fileName: string }[] = [];
      let scannedFoldersCount = 0;
      const visitedPaths = new Set<string>();

      async function fetchTree(subpath: string = '') {
        if (visitedPaths.has(subpath)) return;
        visitedPaths.add(subpath);
        scannedFoldersCount++;

        const segments = subpath ? subpath.split('/').map(encodeURIComponent).join('/') : '';
        const apiUrl = `https://huggingface.co/api/datasets/${repoId}/tree/main${segments ? `/${segments}` : ''}`;
        
        setScanProgressMsg(`Explorando: /${subpath}`);

        const res = await fetch(apiUrl);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Dataset o rama "main" no encontrada (404). Verifica que el repositorio "${repoId}" existe y es público o accesible.`);
          }
          throw new Error(`Error en la API de Hugging Face (${res.status} ${res.statusText})`);
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          return;
        }

        for (const item of data) {
          if (item.type === 'directory' && item.path) {
            await fetchTree(item.path);
          } else if (item.type === 'file' && item.path && item.path.toLowerCase().endsWith('.mp4')) {
            const encodedPath = item.path.split('/').map(encodeURIComponent).join('/');
            const downloadUrl = `https://huggingface.co/datasets/${repoId}/resolve/main/${encodedPath}`;
            const info = parseVideoUrlInfo(downloadUrl);
            directVideoUrls.push({
              path: item.path,
              downloadUrl,
              size: item.size,
              category: info.suggestedGroupName || '',
              fileName: info.fileName || item.path.split('/').pop() || 'video.mp4'
            });
          }
        }
      }

      await fetchTree('');

      // Compare against existing video records in the catalog
      const existingVideoUrls = new Set(videos.map(v => v.videoUrl.trim().toLowerCase()));
      const newVideos = directVideoUrls.filter(item => !existingVideoUrls.has(item.downloadUrl.trim().toLowerCase()));
      const existingCount = directVideoUrls.length - newVideos.length;

      setScanResult({
        scannedFoldersCount,
        newVideos,
        existingCount,
        totalFound: directVideoUrls.length
      });

      addHfLog('success', `Escaneo completado: ${scannedFoldersCount} carpetas analizadas, ${newVideos.length} vídeos nuevos detectados, ${existingCount} ya existentes en el catálogo.`);
    } catch (err: any) {
      setError(err.message || 'Error al escanear dataset');
      addHfLog('error', `Error durante el escaneo: ${err.message || err}`);
    } finally {
      setIsScanningHf(false);
      setScanProgressMsg('');
    }
  };

  const handleImportNewVideos = async () => {
    if (!scanResult || scanResult.newVideos.length === 0 || !onSaveBatch) return;

    setIsImportingHf(true);
    cancelHfImportRef.current = false;
    const total = scanResult.newVideos.length;
    setHfImportProgress({ current: 0, total });
    addHfLog('info', `Iniciando importación secuencial de ${total} vídeos nuevos atribuidos a tu usuario...`);

    const importedRecords: VideoRecord[] = [];

    for (let i = 0; i < total; i++) {
      if (cancelHfImportRef.current) {
        addHfLog('warn', 'Importación cancelada por el usuario.');
        break;
      }

      const item = scanResult.newVideos[i];
      setHfImportProgress({ current: i + 1, total });
      addHfLog('info', `[${i + 1}/${total}] Descargando y analizando metadatos: ${item.fileName}`);

      try {
        const record = await processVideoMetadataFromUrl({
          url: item.downloadUrl,
          source: 'local',
          userEmail: user.email || undefined,
          userDisplayName: nick || user.displayName || undefined,
          userUid: user.uid,
          onAddCategory,
        });

        importedRecords.push(record);
        addHfLog('success', `✓ ${record.title || item.fileName} (${record.model}, ${record.width}x${record.height})${record.groupName ? ` · [${record.groupName}]` : ''}`);
      } catch (err: any) {
        addHfLog('error', `Error en ${item.fileName}: ${err.message || err}`);
      }
    }

    if (importedRecords.length > 0) {
      addHfLog('info', `Guardando ${importedRecords.length} vídeos en la base de datos...`);
      try {
        await onSaveBatch(importedRecords);
        addHfLog('success', `¡Completado! Se han guardado ${importedRecords.length} vídeos nuevos con éxito.`);
        
        setScanResult(prev => {
          if (!prev) return null;
          return {
            ...prev,
            newVideos: [],
            existingCount: prev.existingCount + importedRecords.length
          };
        });
      } catch (err: any) {
        addHfLog('error', `Error al guardar en base de datos: ${err.message || err}`);
      }
    }

    setIsImportingHf(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanNick = nick.trim();
    if (!cleanNick) {
      setError('Por favor, escribe un apodo o nombre para tu perfil.');
      return;
    }

    let normalizedHf: string | undefined = undefined;
    if (hfDatasetInput.trim()) {
      const norm = normalizeHuggingFaceDatasetRepoId(hfDatasetInput);
      if (!norm) {
        setError('El formato del dataset de Hugging Face no es válido (ej: "usuario/repo" o "https://huggingface.co/datasets/usuario/repo").');
        return;
      }
      normalizedHf = norm;
    } else {
      normalizedHf = '';
    }

    setLoading(true);
    setError(null);

    try {
      if (cleanNick !== user.displayName) {
        await updateProfile(user, {
          displayName: cleanNick
        });
      }

      if (db) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email || '',
            displayName: cleanNick,
            huggingfaceDatasetUrl: normalizedHf,
            updatedAt: Date.now()
          }, { merge: true });
        } catch (fsErr) {
          console.warn('Could not sync profile to Firestore:', fsErr);
        }
      }

      try {
        localStorage.setItem('ai_video_vault_user_display_name', cleanNick);
        if (normalizedHf !== undefined) {
          localStorage.setItem('ai_video_vault_hf_dataset_url', normalizedHf);
        }
      } catch {}

      onUpdated(cleanNick, normalizedHf);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-teal-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                Mi Perfil y Dataset
                {userProfile?.role === 'admin' && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    Admin
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400 font-mono">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isScanningHf || isImportingHf}
            className="text-neutral-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-neutral-800 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 text-sm text-neutral-300">
          
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form: Apodo & Dataset */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Nick field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
                <span>Apodo / Nombre Visible</span>
                <span className="text-[11px] font-normal text-neutral-500">Aparecerá en tus vídeos</span>
              </label>
              <input
                type="text"
                required
                maxLength={30}
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Ej: Juanma, WanMaster..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-teal-500 transition-all placeholder:text-neutral-600"
              />
            </div>

            {/* Hugging Face Private Dataset field */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tu Dataset de Hugging Face</span>
                </label>
                {currentRepoId && (
                  <a
                    href={`https://huggingface.co/datasets/${currentRepoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono transition-colors"
                  >
                    <span>{currentRepoId}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <input
                type="text"
                value={hfDatasetInput}
                onChange={(e) => setHfDatasetInput(e.target.value)}
                placeholder="ej: usuario/mi-repo o https://huggingface.co/datasets/usuario/mi-repo"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-100 focus:outline-none focus:border-amber-500 font-mono transition-all placeholder:text-neutral-600"
              />
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Cada usuario puede tener su propio dataset exclusivo. Al sincronizar, los vídeos encontrados se registrarán a tu nombre.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {savedFeedback ? (
                <span className="text-xs font-semibold text-teal-400 flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> Cambios guardados correctamente
                </span>
              ) : <div />}

              <button
                type="submit"
                disabled={loading || isScanningHf || isImportingHf}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 border border-neutral-700 shadow-sm disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-teal-400" />
                )}
                <span>Guardar Perfil</span>
              </button>
            </div>
          </form>

          {/* Section: Sincronizar Vídeos de Mi Dataset (Accessible ONLY if canImportVideos) */}
          {canImportVideos && (
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FolderSync className="w-4 h-4 text-amber-400" />
                    Sincronizar mi Dataset
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Comprueba si hay nuevos vídeos en tu dataset personal de Hugging Face e impórtalos automáticamente con sus metadatos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleScanHfDataset}
                  disabled={!currentRepoId || isScanningHf || isImportingHf}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 transition-all shrink-0 disabled:cursor-not-allowed shadow-sm"
                >
                  {isScanningHf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-950" />
                      <span>Escaneando...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-neutral-950" />
                      <span>Escanear</span>
                    </>
                  )}
                </button>
              </div>

              {/* Active Scanning Status Line */}
              {isScanningHf && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-900/90 border border-amber-500/30 text-xs text-amber-300 animate-in fade-in">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                  <span className="truncate font-mono text-[11px]">
                    {scanProgressMsg || 'Explorando estructura de carpetas en Hugging Face...'}
                  </span>
                </div>
              )}

              {/* Scan Summary & Import Trigger */}
              {scanResult && (
                <div className="space-y-3 pt-3 border-t border-neutral-850 animate-in fade-in duration-200">
                  <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-white font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                        <span>Resultados del escaneo</span>
                      </div>
                      <p className="text-neutral-400 text-xs">
                        <strong>{scanResult.scannedFoldersCount}</strong> carpetas, <strong className="text-amber-300">{scanResult.newVideos.length}</strong> nuevos detectados, <strong className="text-neutral-300">{scanResult.existingCount}</strong> ya existentes.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleImportNewVideos}
                      disabled={scanResult.newVideos.length === 0 || isImportingHf}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 transition-all disabled:cursor-not-allowed shrink-0 shadow-sm"
                    >
                      {isImportingHf ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Importando ({hfImportProgress.current}/{hfImportProgress.total})...</span>
                        </>
                      ) : (
                        <>
                          <DownloadCloud className="w-3.5 h-3.5" />
                          <span>Importar los {scanResult.newVideos.length} nuevos</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Preview of new videos */}
                  {scanResult.newVideos.length > 0 && !isImportingHf && (
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3 text-xs space-y-2 max-h-32 overflow-y-auto">
                      <div className="font-semibold text-neutral-400 text-[11px] uppercase tracking-wider">
                        Vídeos nuevos listos para importar a tu cuenta:
                      </div>
                      <div className="space-y-1 font-mono text-[11px]">
                        {scanResult.newVideos.slice(0, 6).map((v, idx) => (
                          <div key={idx} className="flex items-center justify-between text-neutral-400 gap-2">
                            <span className="truncate">{v.fileName}</span>
                            {v.category && (
                              <span className="px-2 py-0.5 rounded bg-neutral-800 text-amber-300 border border-neutral-700 text-[10px] shrink-0 font-sans">
                                {v.category}
                              </span>
                            )}
                          </div>
                        ))}
                        {scanResult.newVideos.length > 6 && (
                          <div className="text-neutral-500 text-[10px] italic text-center pt-1 font-sans">
                            + {scanResult.newVideos.length - 6} vídeos adicionales
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Progress bar during HF import */}
                  {isImportingHf && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white">Importando dataset ({hfImportProgress.current} de {hfImportProgress.total})</span>
                        <button
                          type="button"
                          onClick={() => { cancelHfImportRef.current = true; }}
                          className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300"
                        >
                          <Square className="w-3 h-3" />
                          <span>Detener</span>
                        </button>
                      </div>
                      <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-800">
                        <div 
                          className="bg-teal-500 h-full transition-all duration-300"
                          style={{ width: `${hfImportProgress.total > 0 ? (hfImportProgress.current / hfImportProgress.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Real-time Logs */}
              {hfLogs.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Registro de sincronización
                  </div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 max-h-32 overflow-y-auto font-mono text-[11px] space-y-1">
                    {hfLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-neutral-600 shrink-0">{log.timestamp}</span>
                        <span className={
                          log.type === 'error' ? 'text-rose-400' :
                          log.type === 'warn' ? 'text-amber-400' :
                          log.type === 'success' ? 'text-teal-400' :
                          'text-neutral-300'
                        }>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={hfLogsEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isScanningHf || isImportingHf}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-all disabled:opacity-40"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
