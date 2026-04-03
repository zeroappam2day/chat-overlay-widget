import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePromptHistoryStore, type PromptEntry } from '../store/promptHistoryStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';

interface PromptHistoryPanelProps {
  onInsertCommand: (text: string) => void;
}

export function PromptHistoryPanel({ onInsertCommand }: PromptHistoryPanelProps) {
  const enabled = useFeatureFlagStore((s) => s.promptHistory);
  const entries = usePromptHistoryStore((s) => s.entries);
  const notes = usePromptHistoryStore((s) => s.notes);
  const setNotes = usePromptHistoryStore((s) => s.setNotes);
  const clearEntries = usePromptHistoryStore((s) => s.clearEntries);

  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'history' | 'notes'>('history');
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen for toggle event dispatched by TerminalHeader button
  useEffect(() => {
    const handler = () => setVisible((v) => !v);
    document.addEventListener('toggle-prompt-history', handler);
    return () => document.removeEventListener('toggle-prompt-history', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible]);

  const handleClick = useCallback(
    (entry: PromptEntry) => {
      onInsertCommand(entry.text + '\r');
      setVisible(false);
    },
    [onInsertCommand]
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  if (!enabled || !visible) return null;

  const filtered = search.trim()
    ? entries.filter((e) =>
        e.text.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const panel = (
    <div
      ref={panelRef}
      className="fixed right-0 top-0 h-full w-[340px] bg-[#1e1e1e] border-l border-[#404040] z-[1002] flex flex-col shadow-lg"
      style={{ fontFamily: 'inherit' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#404040] shrink-0">
        <span className="text-xs font-medium text-gray-300">Prompt History</span>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Close prompt history"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#404040] shrink-0">
        <button
          className={`flex-1 text-[11px] py-1.5 transition-colors ${
            tab === 'history'
              ? 'text-[#007acc] border-b-2 border-[#007acc]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setTab('history')}
        >
          History ({entries.length})
        </button>
        <button
          className={`flex-1 text-[11px] py-1.5 transition-colors ${
            tab === 'notes'
              ? 'text-[#007acc] border-b-2 border-[#007acc]'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setTab('notes')}
        >
          Notes
        </button>
      </div>

      {tab === 'history' && (
        <>
          {/* Search + Clear */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#333] shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts..."
              className="flex-1 bg-[#2d2d2d] text-gray-300 text-[11px] px-2 py-1 rounded border border-[#444] outline-none focus:border-[#007acc] transition-colors"
            />
            {entries.length > 0 && (
              <button
                onClick={clearEntries}
                className="text-[10px] text-gray-600 hover:text-red-400 transition-colors whitespace-nowrap"
                title="Clear all history"
              >
                Clear
              </button>
            )}
          </div>

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-xs text-gray-600 text-center">
                {search.trim() ? 'No matches' : 'No prompts yet'}
              </div>
            ) : (
              filtered.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="group flex items-start gap-2 px-3 py-2 hover:bg-[#2a2a2a] border-b border-[#2a2a2a] cursor-pointer"
                  onClick={() => handleClick(entry)}
                  title="Click to send"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-gray-300 whitespace-pre-wrap break-words line-clamp-3">
                      {entry.text}
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5">
                      {formatTime(entry.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(entry.text);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300 transition-opacity mt-0.5"
                    title="Copy to clipboard"
                    aria-label="Copy prompt"
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 4V1.5A1.5 1.5 0 0 1 5.5 0h9A1.5 1.5 0 0 1 16 1.5v9a1.5 1.5 0 0 1-1.5 1.5H12v2.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 0 14.5v-9A1.5 1.5 0 0 1 1.5 4H4zm1 0h7.5A1.5 1.5 0 0 1 14 5.5V11h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5V4z" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'notes' && (
        <div className="flex-1 flex flex-col p-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Session notes..."
            className="flex-1 bg-[#2d2d2d] text-gray-300 text-xs resize-none outline-none rounded px-3 py-2 border border-[#444] focus:border-[#007acc] transition-colors"
          />
        </div>
      )}
    </div>
  );

  return createPortal(panel, document.body);
}
