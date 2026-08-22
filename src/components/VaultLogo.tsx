export function VaultLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Hexagon / Lens ring */}
      <path
        d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      
      {/* Inner aperture blades */}
      <path
        d="M50 25 L80 40 L65 75 L35 75 L20 40 Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
        opacity="0.7"
      />
      
      {/* Center eye/core */}
      <circle 
        cx="50" 
        cy="50" 
        r="10" 
        fill="currentColor" 
      />
      
      {/* Tech accents */}
      <circle cx="50" cy="15" r="2" fill="currentColor" />
      <circle cx="50" cy="85" r="2" fill="currentColor" />
    </svg>
  );
}
