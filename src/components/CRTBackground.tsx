import { useEffect, useRef } from 'react';

export function CRTBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: { x: number; y: number; speed: number; opacity: number; size: number }[] = [];
    
    // Grid alignment for the "square" matrix feel
    const GRID_SIZE = 4;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Re-initialize particles
      particles = [];
      const numParticles = Math.floor((canvas.width * canvas.height) / 6000);
      for (let i = 0; i < numParticles; i++) {
        // Snap initial positions to grid
        const x = Math.floor((Math.random() * canvas.width) / GRID_SIZE) * GRID_SIZE;
        const y = Math.floor((Math.random() * canvas.height) / GRID_SIZE) * GRID_SIZE;
        
        particles.push({
          x,
          y,
          speed: (1 + Math.floor(Math.random() * 3)) * (GRID_SIZE / 2),
          opacity: 0.1 + Math.random() * 0.7,
          size: GRID_SIZE * (Math.random() > 0.85 ? 2 : 1),
        });
      }
    };

    window.addEventListener('resize', resize);
    resize();

    // Lower frame rate for an old terminal feel (24fps)
    let lastDrawTime = 0;
    const fps = 24;
    const interval = 1000 / fps;

    const render = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(render);
      
      const delta = timestamp - lastDrawTime;
      if (delta < interval) return;
      lastDrawTime = timestamp - (delta % interval);

      // Clear with slight trailing effect (motion blur/phosphor decay)
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.globalCompositeOperation = 'screen';

      particles.forEach(p => {
        // Dynamic aberration amount per particle
        const aberration = (Math.random() > 0.95 ? 2 : 1) * (GRID_SIZE / 2);
        
        // Faint Red shadow shifted left
        ctx.fillStyle = `rgba(255, 0, 80, ${p.opacity * 0.5})`;
        ctx.fillRect(p.x - aberration, p.y, p.size, p.size);
        
        // Faint Blue shadow shifted right
        ctx.fillStyle = `rgba(0, 80, 255, ${p.opacity * 0.5})`;
        ctx.fillRect(p.x + aberration, p.y, p.size, p.size);

        // Main teal core
        ctx.fillStyle = `rgba(20, 184, 166, ${p.opacity})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        
        // Move in chunky grid steps
        p.y -= p.speed;
        
        // Wrap around & snap to grid
        if (p.y < 0) {
          p.y = Math.floor(canvas.height / GRID_SIZE) * GRID_SIZE;
          p.x = Math.floor((Math.random() * canvas.width) / GRID_SIZE) * GRID_SIZE;
        }
        
        // Flicker effect
        if (Math.random() > 0.95) {
          p.opacity = 0.1 + Math.random() * 0.8;
        }
      });
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-neutral-950 animate-[global-glitch_12s_infinite]">
      {/* 1. Dynamic chunky particle canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen"
      />
      
      {/* 2. Static Pixel Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(20, 184, 166, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20, 184, 166, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '4px 4px'
        }}
      />
      
      {/* 3. Deep CRT Curvature/Vignette (Inset Shadow) */}
      <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.95)] bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.9)_100%)]" />
      
      {/* 4. Enhanced CRT Scanlines CSS & Chromatic Aberration */}
      <div 
        className="absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.5) 50%), 
            linear-gradient(90deg, rgba(255, 0, 0, 0.15), rgba(0, 255, 0, 0.05), rgba(0, 0, 255, 0.15))
          `,
          backgroundSize: '100% 4px, 4px 100%'
        }}
      />
      
      {/* 5. Chromatic Aberration Edge Color Bleed */}
      <div className="absolute inset-0 shadow-[inset_3px_0_10px_rgba(255,0,0,0.1),inset_-3px_0_10px_rgba(0,255,255,0.1)] opacity-70" />

      {/* 6. Scanline sweep animation */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-500/10 to-transparent h-[15%] animate-[scan_6s_linear_infinite] opacity-50 mix-blend-screen" />
      
      {/* 7. Subtle screen flicker */}
      <div className="absolute inset-0 bg-white animate-[flicker_0.15s_infinite] mix-blend-overlay pointer-events-none" />
      
      {/* 8. Occasional Glitch Artifacts */}
      <div className="absolute inset-0 mix-blend-screen opacity-30 animate-[glitch-lines_14s_infinite]">
        <div className="absolute top-[20%] left-0 w-full h-1 bg-red-500/20" />
        <div className="absolute top-[60%] left-0 w-full h-2 bg-cyan-500/20" />
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        @keyframes flicker {
          0% { opacity: 0.01; }
          50% { opacity: 0.03; }
          100% { opacity: 0.01; }
        }
        @keyframes global-glitch {
          0%, 96% { transform: translate(0, 0); filter: drop-shadow(0 0 0 transparent); }
          97% { transform: translate(-1px, 1px); filter: drop-shadow(2px 0 0 rgba(255,0,0,0.4)) drop-shadow(-2px 0 0 rgba(0,255,255,0.4)); }
          98% { transform: translate(1px, -1px); filter: drop-shadow(-2px 0 0 rgba(255,0,0,0.4)) drop-shadow(2px 0 0 rgba(0,255,255,0.4)); }
          99% { transform: translate(0, 1px); filter: drop-shadow(1px 0 0 rgba(255,0,0,0.3)); }
          100% { transform: translate(0, 0); }
        }
        @keyframes glitch-lines {
          0%, 96% { opacity: 0; transform: scaleY(1); }
          97% { opacity: 0.8; transform: scaleY(2) translateY(5px); }
          98% { opacity: 0.4; transform: scaleY(1) translateY(-5px); }
          99% { opacity: 0.8; transform: scaleY(1.5) translateY(2px); }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
