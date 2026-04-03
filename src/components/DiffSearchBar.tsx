import { useRef, useEffect } from 'react';

interface DiffSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  currentMatch: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function DiffSearchBar({
  query,
  onQueryChange,
  matchCount,
  currentMatch,
  onNext,
  onPrev,
  onClose,
}: DiffSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  let matchLabel = '';
  if (query && matchCount > 0) {
    matchLabel = `${currentMatch + 1} of ${matchCount}`;
  } else if (query && matchCount === 0) {
    matchLabel = 'No results';
  }

  return (
    <div
      className="flex items-center gap-2 px-2 border-b border-[#404040] bg-[#252525]"
      style={{ height: 32, flexShrink: 0 }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search in diff..."
        className="flex-1 h-6 rounded px-2 text-xs text-gray-300 outline-none border border-[#404040] focus:border-[#007acc] bg-[#2a2a2a]"
      />

      <span className="text-[10px] text-gray-500" style={{ minWidth: 56, textAlign: 'right' }}>
        {matchLabel}
      </span>

      {/* Prev (chevron-up) */}
      <button
        onClick={onPrev}
        className="text-gray-500 hover:text-gray-300 transition-colors"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z" />
        </svg>
      </button>

      {/* Next (chevron-down) */}
      <button
        onClick={onNext}
        className="text-gray-500 hover:text-gray-300 transition-colors"
        title="Next match (Enter)"
        aria-label="Next match"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
        </svg>
      </button>

      {/* Close (X) */}
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-300 transition-colors"
        title="Close search"
        aria-label="Close search"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
        </svg>
      </button>
    </div>
  );
}
