import { useState, useCallback } from 'react';
import { appWindow } from '@tauri-apps/api/window';

export function AppHeader() {
  const [pinned, setPinned] = useState(false);

  const togglePin = useCallback(async () => {
    const next = !pinned;
    await appWindow.setAlwaysOnTop(next);
    setPinned(next);
  }, [pinned]);

  return (
    <div
      className="flex items-center justify-between h-8 px-3 bg-[#252526] border-b border-[#404040] text-xs text-gray-400 shrink-0 select-none"
      data-tauri-drag-region
    >
      <span className="font-medium text-gray-300">Chat Overlay</span>
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
            /* Filled pin icon — window is pinned */
            <path d="M10 1L6 5H3l-1 1 3 3-4 6 6-4 3 3 1-1V10l4-4-2-5z" />
          ) : (
            /* Outline pin icon — window is not pinned */
            <path d="M10 1L6 5H3l-1 1 3 3-4 6 6-4 3 3 1-1V10l4-4-2-5z" fillOpacity="0" stroke="currentColor" strokeWidth="1" />
          )}
        </svg>
      </button>
    </div>
  );
}
