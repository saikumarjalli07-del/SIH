import React, { useMemo } from 'react';
import { getVehicleColor } from '../../data/cityData';

export const RouteLayer = ({ routes = [], nodes = [], isAnimating = false }) => {
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  if (!routes || routes.length === 0) return null;

  return (
    <g className="routes-layer">
      {routes.map((route, vIdx) => {
        if (!route || route.length < 2) return null;

        const color = getVehicleColor(vIdx);
        const marker = `url(#arrow-route-v${(vIdx % 3) + 1})`;

        // Build continuous path string M x0 y0 L x1 y1 L x2 y2 ...
        const points = route
          .map((id) => nodeMap.get(id))
          .filter(Boolean);

        if (points.length < 2) return null;

        const pathData = points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
          .join(' ');

        return (
          <g key={`v-route-${vIdx}`}>
            {/* Dark casing/outline underneath for depth separation */}
            <path
              d={pathData}
              fill="none"
              stroke="#0A0A0A"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.9 }}
            />

            {/* Main vehicle route path with optional fade-in animation */}
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={marker}
              style={{
                opacity: 1,
                animation: isAnimating ? 'fadeInRoute 600ms ease-out forwards' : 'none',
              }}
            />

            {/* Intermediate direction markers along route legs */}
            {points.map((p, idx) => {
              if (idx === 0) return null;
              const prev = points[idx - 1];
              // Offset slightly so marker doesn't hide under the node
              const dx = p.x - prev.x;
              const dy = p.y - prev.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 25) return null;
              const targetX = p.x - (dx / dist) * 12;
              const targetY = p.y - (dy / dist) * 12;

              return (
                <line
                  key={`leg-marker-${vIdx}-${idx}`}
                  x1={prev.x}
                  y1={prev.y}
                  x2={targetX}
                  y2={targetY}
                  stroke="transparent"
                  markerEnd={marker}
                />
              );
            })}
          </g>
        );
      })}

      <style>{`
        @keyframes fadeInRoute {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </g>
  );
};
