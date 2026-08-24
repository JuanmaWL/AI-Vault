import { useState, FormEvent } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, Mail, AlertCircle, LogIn, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      await signInWithEmailAndPassword(auth, email.trim(), password);
      onSuccess?.();
    } catch (err: any) {
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
    } finally {
      setLoading(false);
    }
  };

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
