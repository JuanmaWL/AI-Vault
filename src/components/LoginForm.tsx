import { useState, FormEvent, useEffect } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, Mail, AlertCircle, LogIn, Eye, EyeOff, CheckSquare, Square, CheckCircle2, ShieldCheck, Sparkles, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginFormProps {
  onLoginStart?: () => void;
  onSuccess?: () => void;
}

export function LoginForm({ onLoginStart, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Success animation state
  const [isSuccessAnimating, setIsSuccessAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('Verificando credenciales...');
  const [loggedEmail, setLoggedEmail] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth) {
      setError('Firebase no está configurado en las variables de entorno (.env). Configura VITE_FIREBASE_API_KEY y VITE_FIREBASE_PROJECT_ID para autenticar.');
      return;
    }
    setLoading(true);
    try {
      // Set persistence based on checkbox
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Inform parent that login sequence has started
      onLoginStart?.();
      
      setLoggedEmail(userCredential.user.email || email.trim());
      setIsSuccessAnimating(true);
    } catch (err: any) {
      setLoading(false);
      console.error('Firebase auth error detail:', err);
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Email o contraseña incorrectos. Verifica que el usuario esté creado en la pestaña Users de Firebase Authentication.');
      } else if (code === 'auth/user-not-found') {
        setError('No existe ningún usuario con este correo electrónico en Firebase.');
      } else if (code === 'auth/invalid-email') {
        setError('El formato del email no es válido.');
      } else if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
        setError('El proveedor de Email/Contraseña no está habilitado en Firebase Authentication o la configuración del proyecto está incompleta.');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Inténtalo más tarde.');
      } else {
        setError(err?.message || 'Error al iniciar sesión.');
      }
    }
  };

  // Artificial progress timer to allow the "INICIÓN SESIADA" screen to be seen with high-tech feedback
  useEffect(() => {
    if (!isSuccessAnimating) return;

    const startTime = Date.now();
    const DURATION = 2800; // 2.8 seconds total duration

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentPercent = Math.min(100, Math.round((elapsed / DURATION) * 100));
      setProgress(currentPercent);

      if (elapsed < 700) {
        setStepText('Verificando credenciales en Firebase...');
      } else if (elapsed < 1600) {
        setStepText('Sincronizando índices del catálogo...');
      } else if (elapsed < 2300) {
        setStepText('Iniciando subsistemas del Vault...');
      } else {
        setStepText('¡Acceso concedido! Entrando...');
      }

      if (elapsed >= DURATION) {
        clearInterval(interval);
        onSuccess?.();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isSuccessAnimating, onSuccess]);

  if (isSuccessAnimating) {
    return (
      <div className="py-4 px-1 text-center space-y-6">
        {/* Glowing Success Badge */}
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          className="relative flex items-center justify-center mx-auto"
        >
          <div className="absolute inset-0 rounded-full bg-teal-500/20 blur-xl animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-neutral-950 border border-teal-400/60 flex items-center justify-center text-teal-400 shadow-[0_0_30px_rgba(45,212,191,0.35)] relative z-10">
            <CheckCircle2 className="w-9 h-9 text-teal-400 stroke-[2.2]" />
          </div>
        </motion.div>

        {/* Title & Message */}
        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="space-y-1.5"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-500/30 text-teal-300 text-[11px] font-mono tracking-wider uppercase mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping shrink-0" />
            Auth OK // 200 SUCCESS
          </div>
          <h2 className="text-2xl font-black text-white tracking-wide uppercase drop-shadow-[0_0_12px_rgba(45,212,191,0.4)]">
            Inición Sesiada
          </h2>
          <p className="text-xs text-neutral-400 font-medium truncate max-w-[260px] mx-auto">
            {loggedEmail ? `Bienvenido, ${loggedEmail}` : 'Bienvenido al sistema'}
          </p>
        </motion.div>

        {/* Progress Bar & Status */}
        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="space-y-2 pt-2"
        >
          {/* Progress track */}
          <div className="w-full h-2.5 bg-neutral-950 border border-teal-900/50 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-300 rounded-full transition-all duration-75 ease-out shadow-[0_0_12px_rgba(45,212,191,0.8)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 px-0.5">
            <span className="text-teal-400/90 font-medium truncate max-w-[210px] text-left">
              {stepText}
            </span>
            <span className="text-teal-400 font-bold shrink-0">
              {progress}%
            </span>
          </div>
        </motion.div>

        {/* Console Log Lines */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="bg-neutral-950/90 border border-neutral-800/80 rounded-xl p-3 text-[10px] font-mono text-neutral-500 text-left space-y-1 shadow-inner select-none"
        >
          <div className="flex items-center gap-1.5 text-neutral-400 font-semibold border-b border-neutral-900 pb-1 mb-1.5">
            <Terminal className="w-3.5 h-3.5 text-teal-500" />
            <span>vault_security.log</span>
          </div>
          <div className="text-teal-400/80 truncate">
            &gt; AUTH_SESSION: INITIALIZED
          </div>
          {progress > 30 && (
            <div className="text-neutral-400 truncate">
              &gt; PERMISSIONS: GRANTED
            </div>
          )}
          {progress > 70 && (
            <div className="text-teal-300 truncate">
              &gt; DECRYPTING_KEYS: READY
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@ejemplo.com"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50 transition-all placeholder:text-neutral-600"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          Contraseña
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-11 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-teal-500/50 transition-all placeholder:text-neutral-600"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-300 transition-colors focus:outline-none"
            title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setRememberMe(!rememberMe)}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors focus:outline-none"
        >
          {rememberMe ? (
            <CheckSquare className="w-4 h-4 text-teal-500" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span>Recordarme</span>
        </button>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-400 hover:from-teal-300 hover:via-teal-400 hover:to-emerald-300 text-neutral-950 font-extrabold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(20,184,166,0.35)] hover:shadow-[0_0_25px_rgba(20,184,166,0.55)] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4 text-neutral-950 stroke-[2.5]" /> 
              <span className="tracking-wide">Entrar al sistema</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

