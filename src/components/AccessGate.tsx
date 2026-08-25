import { LoginForm } from './LoginForm';
import { VaultLogo } from './VaultLogo';
import { AISparkle } from './AISparkle';
import { CRTBackground } from './CRTBackground';
import pkg from '../../package.json';

interface AccessGateProps {
  onLoginStart?: () => void;
  onLoginComplete?: () => void;
}

export function AccessGate({ onLoginStart, onLoginComplete }: AccessGateProps) {
  return (
    <div className="relative min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
      {/* Background Effect */}
      <CRTBackground />

      <div className="relative z-10 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="relative group cursor-pointer mb-6">
            <div className="w-20 h-20 bg-neutral-900/80 backdrop-blur-md border border-teal-900/40 group-hover:border-teal-400/60 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(20,184,166,0.15)] group-hover:shadow-[0_0_40px_rgba(168,85,247,0.25)] transition-all duration-500 relative">
              {/* Inner glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/15 via-indigo-500/10 to-pink-500/15 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <VaultLogo className="w-12 h-12 text-teal-500 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)] relative z-10" />
            </div>

            {/* AI Sparkle badge overlapping top-right corner */}
            <div className="absolute -top-2.5 -right-2.5 z-20 pointer-events-none">
              <AISparkle size="lg" />
            </div>
          </div>
          <h1 
            className="text-3xl font-bold text-white tracking-tight"
            style={{ textShadow: '2px 0px 1px rgba(255,0,0,0.6), -2px 0px 1px rgba(0,255,255,0.6)' }}
          >
            AI Video Vault
          </h1>
          <div className="flex items-center gap-2 mt-3">
            <span className="flex h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
            <p className="text-teal-500/80 text-xs uppercase tracking-[0.2em] font-medium">System Locked</p>
          </div>
        </div>
        
        <div className="bg-neutral-900/90 backdrop-blur-2xl border border-teal-900/50 rounded-3xl p-6 shadow-[0_0_40px_rgba(20,184,166,0.1)] relative overflow-hidden">
          {/* Subtle noise texture over the form card */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPHBhdGggZD0iTTAgMGg0djRIMHoiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPgo8L3N2Zz4=')]" />
          
          <LoginForm onLoginStart={onLoginStart} onSuccess={onLoginComplete} />
        </div>
        
        {/* App Version */}
        <div className="mt-8 text-center">
          <span className="text-[10px] text-teal-600/40 font-mono tracking-[0.3em] uppercase mix-blend-screen select-none">
            Sys.Ver // v{pkg.version}
          </span>
        </div>
      </div>
    </div>
  );
}
