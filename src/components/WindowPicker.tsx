import { useState, useEffect, useRef, useMemo } from 'react';
import type { WindowThumbnail } from '../protocol';
import { Tooltip } from './Tooltip';

interface WindowPickerProps {
  windows: WindowThumbnail[];
  onClose: () => void;
  onRefresh: () => void;
  onSelect?: (window: WindowThumbnail) => void;
}

const COLS = 3;

export function WindowPicker({ windows, onClose, onRefresh, onSelect }: WindowPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

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
      className="absolute inset-0 z-10 bg-[#0d1117]/90 backdrop-blur-md flex flex-col animate-fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#30363d]/50 bg-white/[0.02]">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="#8b949e" className="shrink-0">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.406a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title or process..."
          className="flex-1 bg-transparent text-[#e6edf3] text-sm outline-none placeholder-[#484f58]"
        />
        <Tooltip text="Refresh window list">
          <button
            onClick={onRefresh}
            className="p-1.5 text-[#8b949e] hover:text-white rounded hover:bg-[#21262d] transition-all"
            aria-label="Refresh window list"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 0 0-4.546 2.914.5.5 0 0 1-.908-.418A6 6 0 1 1 2 8a.5.5 0 0 1 1 0 5 5 0 1 0 5-5z" />
              <path d="M3 2v3h3" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </Tooltip>
        <Tooltip text="Close (Escape)">
          <button
            onClick={onClose}
            className="p-1.5 text-[#8b949e] hover:text-[#f85149] rounded hover:bg-[#f85149]/10 transition-all"
            aria-label="Close window picker"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </Tooltip>
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
          <div className="col-span-full flex items-center justify-center text-[#484f58] text-sm py-8">
            No matching windows
          </div>
        ) : (
          filtered.map((w, i) => (
            <div
              key={`${w.processName}-${w.title}-${i}`}
              data-testid="picker-card"
              className={`rounded-lg border p-2 cursor-pointer bg-[#161b22] hover:bg-[#21262d] transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                i === selectedIndex
                  ? 'border-[#58a6ff] shadow-[0_0_12px_rgba(88,166,255,0.2)]'
                  : 'border-[#30363d] hover:border-[#58a6ff]/40'
              }`}
              onClick={() => {
                setSelectedIndex(i);
                onSelect?.(w);
              }}
            >
              {w.thumbnail ? (
                <img
                  src={`data:image/png;base64,${w.thumbnail}`}
                  alt={w.title}
                  className="w-full h-[120px] object-cover rounded mb-1.5"
                />
              ) : (
                <div className="w-full h-[120px] flex items-center justify-center bg-[#0d1117] rounded mb-1.5 text-[#484f58] text-xs">
                  {w.error ?? 'No preview'}
                </div>
              )}
              <div className="text-[#e6edf3] text-xs truncate" title={w.title}>
                {w.title}
              </div>
              <div className="text-[#8b949e] text-[11px] truncate font-mono" title={w.processName}>
                {w.processName}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
