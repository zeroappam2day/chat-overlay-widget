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

  // Auto-focus the input when the overlay mounts
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
    <div className="absolute top-0 right-0 z-10 bg-[#3c3c3c] border border-[#555] rounded-bl shadow-lg px-2 py-1 flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="bg-[#1e1e1e] text-gray-200 text-sm outline-none rounded px-2 py-1 w-48"
      />
      {/* Previous match button (up arrow) */}
      <button
        onClick={() => findPrevious(query)}
        className="text-gray-400 hover:text-gray-200 px-1 py-1"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2L11 8H1L6 2Z" />
        </svg>
      </button>
      {/* Next match button (down arrow) */}
      <button
        onClick={() => findNext(query)}
        className="text-gray-400 hover:text-gray-200 px-1 py-1"
        title="Next match (Enter)"
        aria-label="Next match"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 10L1 4H11L6 10Z" />
        </svg>
      </button>
      {/* Close button (X) */}
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-200 px-1 py-1 ml-1"
        title="Close search (Escape)"
        aria-label="Close search"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
