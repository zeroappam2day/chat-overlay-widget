import { useState, useRef, useEffect, useCallback } from 'react';
import { useBookmarkStore, type Bookmark } from '../store/bookmarkStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { EditableText } from './EditableText';
import { Tooltip } from './Tooltip';

interface BookmarkBarProps {
  onSendCommand: (command: string) => void;
  currentInput: string;
}

export function BookmarkBar({ onSendCommand, currentInput }: BookmarkBarProps) {
  const enabled = useFeatureFlagStore((s) => s.terminalBookmarks);
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const addBookmark = useBookmarkStore((s) => s.addBookmark);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
  const updateLabel = useBookmarkStore((s) => s.updateLabel);

  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const handleClick = useCallback(
    (bookmark: Bookmark) => {
      onSendCommand(bookmark.command + '\r');
    },
    [onSendCommand]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  const handleAdd = useCallback(() => {
    const cmd = currentInput.trim();
    if (!cmd) return;
    addBookmark(cmd);
  }, [currentInput, addBookmark]);

  if (!enabled) return null;

  return (
    <div className="shrink-0 h-8 px-3 bg-[#0d1117] border-t border-[#30363d]/50 flex items-center gap-1.5 overflow-x-auto">
      {bookmarks.map((b) => (
        <div
          key={b.id}
          onClick={() => handleClick(b)}
          onContextMenu={(e) => handleContextMenu(e, b.id)}
          className="shrink-0 px-2.5 py-0.5 text-[11px] rounded-full glass-panel text-[#e6edf3]/80 hover:text-white border border-[#30363d] hover:border-[#58a6ff]/40 hover:-translate-y-0.5 hover:shadow-[0_2px_12px_rgba(88,166,255,0.15)] transition-all whitespace-nowrap max-w-[160px] truncate cursor-pointer font-mono"
          title={b.command}
        >
          <EditableText
            value={b.label}
            onCommit={(newLabel) => updateLabel(b.id, newLabel)}
            className="text-[11px] text-inherit"
          />
        </div>
      ))}

      <Tooltip text={currentInput.trim() ? `Bookmark: ${currentInput.trim().slice(0, 40)}` : 'Type a command first'}>
        <button
          onClick={handleAdd}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[#8b949e] hover:text-white border border-dashed border-[#30363d] hover:border-[#8b949e] transition-all"
          disabled={!currentInput.trim()}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </Tooltip>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed glass-panel border border-[#30363d] rounded-lg shadow-xl z-[9999] py-1 animate-scale-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="w-full text-left px-3 py-1 text-[11px] text-[#8b949e]">
            Double-click to rename
          </div>
          <button
            onClick={() => {
              removeBookmark(contextMenu.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1 text-[11px] text-[#f85149] hover:bg-[#f85149]/10 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
