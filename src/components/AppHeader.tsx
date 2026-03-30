import { useState, useCallback } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/api/process';

export function AppHeader() {
  const [pinned, setPinned] = useState(false);

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
      <span className="font-medium text-gray-300">Chat Overlay</span>
      <div className="flex items-center gap-1">
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
