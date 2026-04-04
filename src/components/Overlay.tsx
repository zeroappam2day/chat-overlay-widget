import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import '../styles/overlay-animations.css';

interface Annotation {
  id: string;
  type: 'box' | 'arrow' | 'text' | 'highlight';
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  color?: string;
  ttl?: number;
  group?: string;
}

export const Overlay: React.FC = () => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    // Listen for 'update-annotations' events from the Rust/Sidecar logic
    const unlisten = listen<Annotation[]>('update-annotations', (event) => {
      setAnnotations(event.payload);
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  return (
    <svg width="100%" height="100%" style={{ pointerEvents: 'none' }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
      </defs>
      {annotations.map((ann) => {
        const c = ann.color ?? '#ff3e00';
        return (
          <g key={ann.id} className="annotation-pulse" style={{ color: c }}>
            {ann.type === 'box' && (
              <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height}
                fill="none" stroke={c} strokeWidth="3" strokeDasharray="5,5" />
            )}
            {ann.type === 'highlight' && (
              <rect x={ann.x} y={ann.y} width={ann.width} height={ann.height}
                fill={c} fillOpacity="0.2" stroke={c} strokeWidth="2" />
            )}
            {ann.type === 'arrow' && (
              <line x1={ann.x} y1={ann.y}
                x2={ann.x + (ann.width ?? 100)} y2={ann.y + (ann.height ?? 0)}
                stroke={c} strokeWidth="3" markerEnd="url(#arrowhead)" />
            )}
            {ann.type === 'text' && (
              <text x={ann.x} y={ann.y} fill={c} fontSize="20" fontWeight="bold"
                style={{ filter: 'drop-shadow(0px 0px 3px black)' }}>
                {ann.label}
              </text>
            )}
            {ann.type !== 'text' && ann.label && (
              <text x={ann.x} y={ann.y - 10} fill={c} fontSize="16" fontWeight="bold"
                style={{ filter: 'drop-shadow(0px 0px 2px black)' }}>
                {ann.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
