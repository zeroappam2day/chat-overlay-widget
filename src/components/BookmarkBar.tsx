import { useState, useRef, useEffect, useCallback } from 'react';
import { useBookmarkStore, type Bookmark } from '../store/bookmarkStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { EditableText } from './EditableText';

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

  // Close context menu on outside click
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
      // Send command + carriage return to PTY
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
    <div className="shrink-0 h-8 px-3 bg-[#252525] border-t border-[#404040] flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
      {bookmarks.map((b) => (
        <div
          key={b.id}
          onClick={() => handleClick(b)}
          onContextMenu={(e) => handleContextMenu(e, b.id)}
          className="shrink-0 px-2.5 py-0.5 text-[11px] rounded-full bg-[#333] text-gray-300 hover:bg-[#444] hover:text-white transition-colors border border-[#555] whitespace-nowrap max-w-[160px] truncate cursor-pointer"
          title={b.command}
        >
          <EditableText
            value={b.label}
            onCommit={(newLabel) => updateLabel(b.id, newLabel)}
            className="text-[11px] text-inherit"
          />
        </div>
      ))}

      {/* Add bookmark button */}
      <button
        onClick={handleAdd}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-300 hover:bg-[#333] transition-colors"
        title={currentInput.trim() ? `Bookmark: ${currentInput.trim().slice(0, 40)}` : 'Type a command first, then click to bookmark'}
        disabled={!currentInput.trim()}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          className="fixed bg-[#2d2d2d] border border-[#555] rounded shadow-lg z-[9999] py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="w-full text-left px-3 py-1 text-xs text-gray-500"
          >
            Double-click to rename
          </div>
          <button
            onClick={() => {
              removeBookmark(contextMenu.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1 text-xs text-red-400 hover:bg-[#444]"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
