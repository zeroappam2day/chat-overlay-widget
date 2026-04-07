import { useState, useCallback } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/api/process';
import { useOverlayStore } from '../store/overlayStore';
import { FeatureFlagPanel } from './FeatureFlagPanel';
import { ModePanel } from './ModePanel';
import { Tooltip } from './Tooltip';

export function AppHeader() {
  const [pinned, setPinned] = useState(false);
  const toggleOverlay = useOverlayStore((state) => state.toggleOverlay);

  const togglePin = useCallback(async () => {
    const next = !pinned;
    await appWindow.setAlwaysOnTop(next);
    setPinned(next);
  }, [pinned]);

  const handleExit = useCallback(async () => {
    await appWindow.close();
    setTimeout(() => exit(0), 500);
  }, []);

  return (
    <div
      className="flex items-center justify-between h-8 px-3 bg-[#0d1117]/90 backdrop-blur border-b border-[#30363d] text-xs shrink-0 select-none"
      data-tauri-drag-region
    >
      {/* Left: Logo + Security badge */}
      <div className="flex items-center gap-1.5">
        <Tooltip text="Chat Overlay">
          <div className="p-1 text-[#8b949e] hover:text-white transition-colors rounded">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0L14.9 4v8L8 16 1.1 12V4L8 0zm0 1.6L2.5 4.8v6.4L8 14.4l5.5-3.2V4.8L8 1.6z" />
              <path d="M8 4l3.5 2v4L8 12 4.5 10V6L8 4z" fillOpacity="0.5" />
            </svg>
          </div>
        </Tooltip>

        <div className="w-px h-3 bg-[#30363d]" />

        <Tooltip text="Secret scrubbing active (best-effort)">
          <div className="p-1 text-[#3fb950]/80 hover:text-[#3fb950] transition-colors rounded cursor-default">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="hover:drop-shadow-[0_0_6px_rgba(63,185,80,0.4)]">
              <path d="M8 1L2 4v4c0 3.5 2.5 6.3 6 7 3.5-.7 6-3.5 6-7V4L8 1zm0 2.2L12 5.4V8c0 2.4-1.7 4.5-4 5.1C5.7 12.5 4 10.4 4 8V5.4L8 3.2zM7 6v4h2V6H7z" />
            </svg>
          </div>
        </Tooltip>
      </div>

      {/* Center: Mode toggles */}
      <ModePanel />

      {/* Right: Action icons */}
      <div className="flex items-center gap-0.5">
        <FeatureFlagPanel />

        <Tooltip text="Toggle annotation overlay">
          <button
            onClick={toggleOverlay}
            className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-all"
            aria-label="Toggle annotation overlay"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.89 1.45l1.66 1.66c.19.19.19.51 0 .7l-1.07 1.07-2.36-2.36 1.07-1.07c.19-.19.51-.19.7 0zM10.41 3.16l2.36 2.36L5.64 12.65l-2.91.41.41-2.91L10.41 3.16zM3.5 13.5l.5-.5H3v.5h.5zM2 11v3h3l8-8-3-3-8 8z" />
            </svg>
          </button>
        </Tooltip>

        <Tooltip text={pinned ? 'Unpin window' : 'Pin always on top'}>
          <button
            onClick={togglePin}
            className={`p-1.5 rounded transition-all ${
              pinned
                ? 'text-[#58a6ff] hover:text-[#79c0ff] drop-shadow-[0_0_6px_rgba(88,166,255,0.3)]'
                : 'text-[#8b949e] hover:text-white hover:bg-[#21262d]'
            }`}
            aria-label={pinned ? 'Unpin window' : 'Pin window always on top'}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              {pinned ? (
                <path d="M10 1L6 5H3l-1 1 3 3-4 6 6-4 3 3 1-1V10l4-4-2-5z" />
              ) : (
                <path d="M10 1L6 5H3l-1 1 3 3-4 6 6-4 3 3 1-1V10l4-4-2-5z" fillOpacity="0" stroke="currentColor" strokeWidth="1" />
              )}
            </svg>
          </button>
        </Tooltip>

        <div className="w-px h-3 bg-[#30363d] mx-0.5" />

        <Tooltip text="Exit application">
          <button
            onClick={handleExit}
            className="p-1.5 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-all"
            aria-label="Exit application"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
