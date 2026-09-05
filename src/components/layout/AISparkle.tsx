interface AISparkleProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AISparkle({ size = 'md', className = "" }: AISparkleProps) {
  const sizeMap = {
    sm: {
      container: 'w-4 h-4',
      badge: 'p-0.5',
      svg: 'w-3.5 h-3.5',
    },
    md: {
      container: 'w-5 h-5',
      badge: 'p-0.5',
      svg: 'w-4 h-4',
    },
    lg: {
      container: 'w-7 h-7',
      badge: 'p-1',
      svg: 'w-5 h-5',
    }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`relative flex items-center justify-center ${currentSize.container} ${className}`}>
      {/* Background radial glow on hover */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-40 blur-[3px] group-hover:opacity-100 group-hover:blur-[6px] group-hover:scale-150 transition-all duration-500" />
      
      {/* Sparkle container with rotation and scaling */}
      <div className="relative z-10 transition-transform duration-500 ease-out group-hover:scale-125 group-hover:rotate-12">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${currentSize.svg} drop-shadow-[0_0_4px_rgba(56,189,248,0.6)] group-hover:drop-shadow-[0_0_8px_rgba(236,72,153,0.9)] transition-all duration-300`}
        >
          <defs>
            {/* Gemini Multi-Color Iridescent Sparkle Gradient */}
            <linearGradient id={`geminiSparkGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />    {/* Sky Cyan */}
              <stop offset="35%" stopColor="#818cf8" />   {/* Indigo */}
              <stop offset="70%" stopColor="#c084fc" />   {/* Purple */}
              <stop offset="100%" stopColor="#f472b6" />  {/* Pink / Rose */}
            </linearGradient>

            {/* Core highlight gradient */}
            <radialGradient id={`coreHighlight-${size}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Dark backing silhouette for sharp contrast on any background */}
          <path
            d="M16 2 C16 10 22 16 30 16 C22 16 16 22 16 30 C16 22 10 16 2 16 C10 16 16 10 16 2 Z"
            fill="#09090b"
            stroke="#09090b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Primary 4-pointed Gemini AI Spark */}
          <path
            d="M16 2 C16 10 22 16 30 16 C22 16 16 22 16 30 C16 22 10 16 2 16 C10 16 16 10 16 2 Z"
            fill={`url(#geminiSparkGrad-${size})`}
            stroke="#ffffff"
            strokeWidth="0.75"
            strokeLinejoin="round"
          />

          {/* Central ultra-bright flare */}
          <circle cx="16" cy="16" r="2.5" fill={`url(#coreHighlight-${size})`} />
          <circle cx="16" cy="16" r="1.2" fill="#ffffff" />

          {/* Tiny Satellite Sparkle (top right) */}
          <g className="transition-all duration-300 opacity-80 group-hover:opacity-100 group-hover:scale-125 origin-[26px_6px]">
            <path
              d="M26 3 C26 5 28 6 30 6 C28 6 26 7 26 9 C26 7 24 6 22 6 C24 6 26 5 26 3 Z"
              fill="#f472b6"
              stroke="#ffffff"
              strokeWidth="0.4"
            />
            <circle cx="26" cy="6" r="0.6" fill="#ffffff" />
          </g>
        </svg>
      </div>
    </div>
  );
}
