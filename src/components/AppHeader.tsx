import { useState, useCallback } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/api/process';
import { useOverlayStore } from '../store/overlayStore';
import { FeatureFlagPanel } from './FeatureFlagPanel';

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
    // Fallback: if close doesn't terminate (e.g. close event is intercepted), force exit
    setTimeout(() => exit(0), 500);
  }, []);

  return (
    <div
      className="flex items-center justify-between h-8 px-3 bg-[#252526] border-b border-[#404040] text-xs text-gray-400 shrink-0 select-none"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-300">Chat Overlay</span>
        <div
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#333] cursor-default ml-2"
          title="Secret scrubbing is best-effort. Do not rely on it as a security boundary."
          aria-label="Secret scrubbing active — best-effort only"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-amber-600">
            <path d="M8 1L2 4v4c0 3.5 2.5 6.3 6 7 3.5-.7 6-3.5 6-7V4L8 1zm0 2.2L12 5.4V8c0 2.4-1.7 4.5-4 5.1C5.7 12.5 4 10.4 4 8V5.4L8 3.2zM7 6v4h2V6H7z"/>
          </svg>
          <span className="text-xs text-gray-500">Scrub</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <FeatureFlagPanel />
        <button
          onClick={toggleOverlay}
          className="px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
          title="Toggle annotation overlay"
          aria-label="Toggle overlay"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.89 1.45l1.66 1.66c.19.19.19.51 0 .7l-1.07 1.07-2.36-2.36 1.07-1.07c.19-.19.51-.19.7 0zM10.41 3.16l2.36 2.36L5.64 12.65l-2.91.41.41-2.91L10.41 3.16zM3.5 13.5l.5-.5H3v.5h.5zM2 11v3h3l8-8-3-3-8 8z" />
          </svg>
        </button>
        <button
          onClick={togglePin}
          className={`px-1.5 py-0.5 rounded transition-colors ${
            pinned
              ? 'text-[#007acc] hover:text-[#3399ff]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          title={pinned ? 'Unpin window (always on top)' : 'Pin window (always on top)'}
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
        <button
          onClick={handleExit}
          className="px-1.5 py-0.5 rounded text-gray-500 hover:text-red-400 transition-colors"
          title="Exit application"
          aria-label="Exit application"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
