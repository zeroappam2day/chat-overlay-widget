import { useState, useEffect, useRef, useMemo } from 'react';
import type { WindowThumbnail } from '../protocol';

interface WindowPickerProps {
  windows: WindowThumbnail[];
  onClose: () => void;
  onRefresh: () => void;
  onSelect?: (window: WindowThumbnail) => void; // Phase 20 hook — noop for now
}

const COLS = 3;

export function WindowPicker({ windows, onClose, onRefresh, onSelect }: WindowPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Reset selectedIndex when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const filtered = useMemo(() => {
    if (!search) return windows;
    const lower = search.toLowerCase();
    return windows.filter(
      (w) =>
        w.title.toLowerCase().includes(lower) ||
        w.processName.toLowerCase().includes(lower)
    );
  }, [windows, search]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (e.key === 'ArrowRight') {
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowLeft') {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'ArrowDown') {
      setSelectedIndex((i) => Math.min(i + COLS, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex((i) => Math.max(i - COLS, 0));
    } else if (e.key === 'Escape') {
      onClose();
      (document.querySelector('.chat-input-textarea') as HTMLElement | null)?.focus();
    } else if (e.key === 'Enter') {
      if (filtered[selectedIndex]) {
        onSelect?.(filtered[selectedIndex]);
      }
    }
  };

  return (
    <div
      className="absolute inset-0 z-10 bg-[#1e1e1e]/95 flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#404040]">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title or process..."
          className="flex-1 bg-[#2d2d2d] text-gray-200 text-sm outline-none rounded px-2 py-1 border border-[#555]"
        />
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-gray-200 text-sm px-2 py-1 rounded border border-[#404040] bg-[#2d2d2d]"
        >
          Refresh
        </button>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 text-sm px-2 py-1 rounded border border-[#404040] bg-[#2d2d2d]"
          aria-label="Close window picker"
        >
          X
        </button>
      </div>

      {/* Grid */}
      <div
        className="flex-1 overflow-auto p-3"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '8px',
          alignContent: 'start',
        }}
      >
        {filtered.length === 0 ? (
          <div className="col-span-full flex items-center justify-center text-gray-500 text-sm py-8">
            No matching windows
          </div>
        ) : (
          filtered.map((w, i) => (
            <div
              key={`${w.processName}-${w.title}-${i}`}
              data-testid="picker-card"
              className={`rounded border p-2 cursor-pointer bg-[#252526] ${
                i === selectedIndex
                  ? 'border-[#007acc]'
                  : 'border-[#404040]'
              }`}
              onClick={() => {
                setSelectedIndex(i);
                onSelect?.(w);
              }}
            >
              {/* Thumbnail or error placeholder */}
              {w.thumbnail ? (
                <img
                  src={`data:image/png;base64,${w.thumbnail}`}
                  alt={w.title}
                  className="w-full h-[120px] object-cover rounded mb-1"
                />
              ) : (
                <div className="w-full h-[120px] flex items-center justify-center bg-[#1e1e1e] rounded mb-1 text-gray-500 text-xs">
                  {w.error ?? 'No preview'}
                </div>
              )}
              {/* Title */}
              <div className="text-gray-300 text-xs truncate" title={w.title}>
                {w.title}
              </div>
              {/* Process name */}
              <div className="text-gray-500 text-xs truncate" title={w.processName}>
                {w.processName}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
