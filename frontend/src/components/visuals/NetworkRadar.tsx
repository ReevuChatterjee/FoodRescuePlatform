/**
 * NetworkRadar — SVG network visualization for the landing hero.
 * Data-driven: packets only appear when there are active simulated routes.
 * No spinning radar sweep (zero data relationship).
 * Node pulses are data-driven: donor nodes pulse only when a packet is heading to them.
 * Uses warm border-hair colors, not zinc.
 *
 * This component also serves as the React.Suspense fallback for the R3F hero scene
 * (same silhouette, visible when JS is disabled or Canvas unavailable).
 */

import { useEffect, useRef, useState, useMemo } from 'react';

// Stable node positions (generated once, not on every render)
const NODES = [
  { id: 0, x: 18, y: 22, type: 'donor' as const },
  { id: 1, x: 42, y: 12, type: 'donor' as const },
  { id: 2, x: 72, y: 28, type: 'donor' as const },
  { id: 3, x: 28, y: 62, type: 'ngo'   as const },
  { id: 4, x: 58, y: 55, type: 'ngo'   as const },
  { id: 5, x: 82, y: 72, type: 'ngo'   as const },
  { id: 6, x: 15, y: 82, type: 'ngo'   as const },
  { id: 7, x: 48, y: 85, type: 'ngo'   as const },
];

// Static edges (always shown as hairlines)
const EDGES = [
  [0, 3], [0, 4], [1, 4], [1, 3], [2, 4], [2, 5], [2, 7],
];

interface Packet {
  id: number;
  fromId: number;
  toId: number;
  progress: number;
  speed: number;
}

export function NetworkRadar() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [activeDestinations, setActiveDestinations] = useState<Set<number>>(new Set());
  const rafRef = useRef<number>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Spawn new packets on an interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (Math.random() > 0.45) {
        const donorNode = NODES.filter((n) => n.type === 'donor')[Math.floor(Math.random() * 3)];
        const ngoNode   = NODES.filter((n) => n.type === 'ngo')[Math.floor(Math.random() * 5)];
        setPackets((prev) =>
          [
            ...prev,
            {
              id: Date.now() + Math.random(),
              fromId: donorNode.id,
              toId: ngoNode.id,
              progress: 0,
              speed: 0.004 + Math.random() * 0.006,
            },
          ].slice(-6),
        );
      }
    }, 2200);

    return () => clearInterval(intervalRef.current);
  }, []);

  // Animate packets via RAF
  useEffect(() => {
    const animate = () => {
      setPackets((prev) => {
        const next = prev
          .map((p) => ({ ...p, progress: p.progress + p.speed }))
          .filter((p) => p.progress < 1);
        // Track which NGO nodes have packets heading to them (data-driven pulse)
        const dests = new Set(next.map((p) => p.toId));
        setActiveDestinations(dests);
        return next;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Compute which donor nodes have active packets departing
  const activeSources = useMemo(() => new Set(packets.map((p) => p.fromId)), [packets]);

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      style={{ opacity: 0.35 }}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {/* Warm subtle glow — not brand green radial gradient */}
          <radialGradient id="rn-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(199,155,74,0.06)" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>

          {/* Warm hairline grid */}
          <pattern id="rn-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="var(--border-hair)" strokeWidth="0.3" />
          </pattern>

          {/* Packet trail gradient */}
          <linearGradient id="rn-trail" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="var(--amber-dim)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--amber-dim)" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Grid & ambient glow */}
        <rect width="100%" height="100%" fill="url(#rn-grid)" />
        <rect width="100%" height="100%" fill="url(#rn-glow)" />

        {/* Static edges — always visible as hairlines */}
        {EDGES.map(([from, to], i) => {
          const a = NODES[from];
          const b = NODES[to];
          return (
            <line
              key={`edge-${i}`}
              x1={`${a.x}%`} y1={`${a.y}%`}
              x2={`${b.x}%`} y2={`${b.y}%`}
              stroke="var(--border-hair)"
              strokeWidth="0.3"
            />
          );
        })}

        {/* Active packet route lines */}
        {packets.map((p) => {
          const from = NODES[p.fromId];
          const to   = NODES[p.toId];
          return (
            <line
              key={`route-${p.id}`}
              x1={`${from.x}%`} y1={`${from.y}%`}
              x2={`${to.x}%`}   y2={`${to.y}%`}
              stroke="rgba(199,155,74,0.2)"
              strokeWidth="0.4"
              strokeDasharray="1.5,1.5"
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((n) => {
          const isSource = activeSources.has(n.id);
          const isDest   = activeDestinations.has(n.id);
          const nodeColor = n.type === 'donor'
            ? 'var(--moss-light)'
            : 'var(--olive-grey)';
          return (
            <g key={`node-${n.id}`}>
              {/* Pulse ring — only when data-driven (has active packet) */}
              {(isSource || isDest) && (
                <circle
                  cx={`${n.x}%`} cy={`${n.y}%`}
                  r="3.5"
                  fill="none"
                  stroke={n.type === 'donor' ? 'var(--moss-light)' : 'var(--amber-dim)'}
                  strokeWidth="0.3"
                  opacity="0.4"
                  style={{ animation: 'rn-ping 2s ease-out infinite' }}
                />
              )}
              {/* Node dot */}
              <circle
                cx={`${n.x}%`} cy={`${n.y}%`}
                r={n.type === 'donor' ? '1' : '0.7'}
                fill={nodeColor}
                opacity={isSource || isDest ? 1 : 0.5}
              />
            </g>
          );
        })}

        {/* Moving packets */}
        {packets.map((p) => {
          const from = NODES[p.fromId];
          const to   = NODES[p.toId];
          const cx = from.x + (to.x - from.x) * p.progress;
          const cy = from.y + (to.y - from.y) * p.progress;
          return (
            <g key={`packet-${p.id}`}>
              {/* Trailing circle (fades) */}
              <circle
                cx={`${cx}%`} cy={`${cy}%`}
                r="1.5"
                fill="var(--amber-dim)"
                opacity={0.15 + 0.2 * p.progress}
              />
              {/* Leading dot */}
              <circle
                cx={`${cx}%`} cy={`${cy}%`}
                r="0.7"
                fill="var(--amber-dim)"
                opacity={0.8}
              />
            </g>
          );
        })}
      </svg>

      {/* Keyframe for data-driven node pulse */}
      <style>{`
        @keyframes rn-ping {
          0%   { r: 1.5; opacity: 0.5; }
          100% { r: 5;   opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rn-animate { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
