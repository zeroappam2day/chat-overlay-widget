import { useState, useEffect, useRef } from 'react';
import type { SearchAddon } from '@xterm/addon-search';

interface SearchOverlayProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

const SEARCH_DECORATIONS = {
  matchBackground: '#ffff0040',
  matchBorder: '#ffff00',
  matchOverviewRuler: '#ffff00',
  activeMatchBackground: '#ff8c0080',
  activeMatchBorder: '#ff8c00',
  activeMatchColorOverviewRuler: '#ff8c00',
};

export function SearchOverlay({ searchAddon, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleClose = () => {
    searchAddon?.clearDecorations();
    onClose();
  };

  const findNext = (value: string) => {
    if (!value) return;
    searchAddon?.findNext(value, {
      caseSensitive: false,
      decorations: SEARCH_DECORATIONS,
    });
  };

  const findPrevious = (value: string) => {
    if (!value) return;
    searchAddon?.findPrevious(value, {
      caseSensitive: false,
      decorations: SEARCH_DECORATIONS,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    console.log(`[search] query="${value}", searchAddon=${searchAddon ? 'loaded' : 'null'}`);
    if (value && searchAddon) {
      const result = searchAddon.findNext(value, {
        incremental: true,
        caseSensitive: false,
        decorations: SEARCH_DECORATIONS,
      });
      console.log(`[search] findNext result:`, result);
    } else if (!value) {
      searchAddon?.clearDecorations();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        findPrevious(query);
      } else {
        findNext(query);
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      handleClose();
      e.preventDefault();
    }
  };

  return (
    <div className="absolute top-2 right-2 z-10 glass-panel border border-[#30363d]/80 rounded-full shadow-2xl px-3 py-1.5 flex items-center gap-1.5 animate-slide-down">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="#8b949e" className="shrink-0">
        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.406a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="bg-transparent text-[#e6edf3] text-sm outline-none w-44 placeholder-[#484f58]"
      />
      <button
        onClick={() => findPrevious(query)}
        className="p-1 text-[#8b949e] hover:text-white rounded hover:bg-white/10 transition-all"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 2L11 8H1L6 2Z" />
        </svg>
      </button>
      <button
        onClick={() => findNext(query)}
        className="p-1 text-[#8b949e] hover:text-white rounded hover:bg-white/10 transition-all"
        title="Next match (Enter)"
        aria-label="Next match"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 10L1 4H11L6 10Z" />
        </svg>
      </button>
      <button
        onClick={handleClose}
        className="p-1 text-[#8b949e] hover:text-[#f85149] rounded hover:bg-[#f85149]/10 transition-all ml-0.5"
        title="Close search (Escape)"
        aria-label="Close search"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
