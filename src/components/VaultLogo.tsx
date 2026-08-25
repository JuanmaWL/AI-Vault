export function VaultLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`vault-logo-svg group-hover:scale-105 transition-transform duration-300 ${className}`}
    >
      <defs>
        {/* Outer Vault gradient */}
        <linearGradient id="vaultOuterGradClean" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="50%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#115e59" />
        </linearGradient>

        {/* Core metallic dark gradient */}
        <radialGradient id="vaultCoreGradClean" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1f1f23" />
          <stop offset="70%" stopColor="#09090b" />
          <stop offset="100%" stopColor="#042f2e" />
        </radialGradient>

        {/* Play video gradient */}
        <linearGradient id="playGradClean" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="50%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>

        {/* Play glow on hover */}
        <filter id="playGlowClean" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <style>{`
        .vault-wheel {
          transform-origin: 32px 32px;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        :global(.group:hover) .vault-wheel,
        .vault-logo-svg:hover .vault-wheel {
          transform: rotate(45deg);
        }
      `}</style>

      {/* Base Heavy Octagonal Vault Door Frame */}
      <path 
        d="M20 4 L44 4 L60 20 L60 44 L44 60 L20 60 L4 44 L4 20 Z" 
        fill="url(#vaultCoreGradClean)" 
        stroke="url(#vaultOuterGradClean)" 
        strokeWidth="2.5" 
        strokeLinejoin="round"
      />

      {/* Vault Perimeter Locking Bolts / Studs */}
      <circle cx="32" cy="7" r="1.5" fill="#2dd4bf" />
      <circle cx="51" cy="13" r="1.5" fill="#2dd4bf" />
      <circle cx="57" cy="32" r="1.5" fill="#2dd4bf" />
      <circle cx="51" cy="51" r="1.5" fill="#2dd4bf" />
      <circle cx="32" cy="57" r="1.5" fill="#2dd4bf" />
      <circle cx="13" cy="51" r="1.5" fill="#2dd4bf" />
      <circle cx="7" cy="32" r="1.5" fill="#2dd4bf" />
      <circle cx="13" cy="13" r="1.5" fill="#2dd4bf" />

      {/* Inner Vault Chamber Rim (Chamber Gear Ring) */}
      <circle 
        cx="32" 
        cy="32" 
        r="20" 
        stroke="#14b8a6" 
        strokeWidth="1.5" 
        strokeDasharray="7 3"
        opacity="0.75"
      />

      {/* High-Tech Vault Spoke Wheel / Interlocking Handles */}
      <g className="vault-wheel">
        <path d="M32 14 L32 20 M32 44 L32 50 M14 32 L20 32 M44 32 L50 32" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" />
        <path d="M19.5 19.5 L24 24 M40 40 L44.5 44.5 M44.5 19.5 L40 24 M24 40 L19.5 44.5" stroke="#0f766e" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Inner Camera Aperture / Secure Core Frame */}
      <circle 
        cx="32" 
        cy="32" 
        r="13" 
        fill="#09090b" 
        stroke="#2dd4bf" 
        strokeWidth="1.75"
      />

      {/* Cinema Play Triangle (Video Vault) */}
      <path 
        d="M27.5 24.5 L40.5 32 L27.5 39.5 Z" 
        fill="url(#playGradClean)" 
      />

      {/* Center Camera Core Lens Highlight */}
      <circle cx="30" cy="30" r="1.5" fill="#ffffff" opacity="0.6" />
    </svg>
  );
}
