import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface Annotation {
  id: string;
  type: 'box' | 'arrow' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
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
      {annotations.map((ann) => (
        <g key={ann.id}>
          {ann.type === 'box' && (
            <rect
              x={ann.x}
              y={ann.y}
              width={ann.width}
              height={ann.height}
              fill="none"
              stroke="#ff3e00"
              strokeWidth="3"
              strokeDasharray="5,5"
            />
          )}
          {ann.label && (
            <text
              x={ann.x}
              y={ann.y - 10}
              fill="#ff3e00"
              fontSize="16"
              fontWeight="bold"
              style={{ filter: 'drop-shadow(0px 0px 2px black)' }}
            >
              {ann.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};
