import { useEffect, useState } from 'react';

// Randomly generate positions for "nodes" and "vehicles"
const NODES = Array.from({ length: 8 }).map((_, i) => ({
  id: i,
  x: Math.random() * 80 + 10,
  y: Math.random() * 80 + 10,
  type: i < 3 ? 'donor' : 'ngo', // Some donors, some NGOs
}));

interface Packet {
  id: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
  progress: number;
  speed: number;
}

export function NetworkRadar() {
  const [packets, setPackets] = useState<Packet[]>([]);

  useEffect(() => {
    // Generate new packets over time
    const interval = setInterval(() => {
      if (Math.random() > 0.5) {
        const startNode = NODES[Math.floor(Math.random() * 3)];
        const endNode = NODES[3 + Math.floor(Math.random() * 5)];
        
        setPackets((prev) => [
          ...prev,
          {
            id: Date.now(),
            start: { x: startNode.x, y: startNode.y },
            end: { x: endNode.x, y: endNode.y },
            progress: 0,
            speed: 0.005 + Math.random() * 0.01,
          },
        ].slice(-5)); // Keep max 5 packets
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Animate packets
    let animationFrame: number;
    const animate = () => {
      setPackets((prev) => 
        prev.map((p) => ({ ...p, progress: p.progress + p.speed }))
            .filter((p) => p.progress < 1)
      );
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden opacity-40 pointer-events-none mix-blend-screen">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          
          <linearGradient id="grid-fade" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="transparent" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--border-strong)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </linearGradient>

          {/* Grid Pattern */}
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="url(#grid-fade)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Background Grid & Glow */}
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#radar-glow)" />

        {/* Static Nodes */}
        {NODES.map((n) => (
          <g key={`node-${n.id}`}>
            <circle 
              cx={`${n.x}%`} 
              cy={`${n.y}%`} 
              r="0.5" 
              fill={n.type === 'donor' ? 'var(--brand)' : 'var(--text-secondary)'} 
              className={n.type === 'donor' ? 'animate-pulse' : ''}
            />
            {n.type === 'donor' && (
              <circle 
                cx={`${n.x}%`} 
                cy={`${n.y}%`} 
                r="3" 
                fill="none" 
                stroke="var(--brand)" 
                strokeWidth="0.2" 
                className="animate-ping opacity-20"
              />
            )}
          </g>
        ))}

        {/* Active Routes / Packets */}
        {packets.map((p) => {
          const currentX = p.start.x + (p.end.x - p.start.x) * p.progress;
          const currentY = p.start.y + (p.end.y - p.start.y) * p.progress;

          return (
            <g key={`packet-${p.id}`}>
              {/* Route line */}
              <line 
                x1={`${p.start.x}%`} 
                y1={`${p.start.y}%`} 
                x2={`${p.end.x}%`} 
                y2={`${p.end.y}%`} 
                stroke="var(--brand)" 
                strokeWidth="0.2" 
                strokeDasharray="1, 1"
                opacity="0.3"
              />
              {/* Moving data packet */}
              <circle 
                cx={`${currentX}%`} 
                cy={`${currentY}%`} 
                r="0.8" 
                fill="var(--success)" 
              />
              <circle 
                cx={`${currentX}%`} 
                cy={`${currentY}%`} 
                r="2" 
                fill="none"
                stroke="var(--success)"
                strokeWidth="0.4"
                opacity="0.5"
              />
            </g>
          );
        })}

        {/* Sweeping Radar Line */}
        <line 
          x1="50%" 
          y1="50%" 
          x2="100%" 
          y2="50%" 
          stroke="var(--brand)" 
          strokeWidth="0.2" 
          opacity="0.5"
          style={{ transformOrigin: '50% 50%', animation: 'spin 10s linear infinite' }}
        />
        
      </svg>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
