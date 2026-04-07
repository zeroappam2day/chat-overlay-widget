import { createPortal } from 'react-dom';
import type { SessionMeta } from '../protocol';
import { Tooltip } from './Tooltip';

interface HistorySidebarProps {
  sessions: SessionMeta[];
  onSelect: (sessionId: number) => void;
  onClose: () => void;
  onRefresh: () => void;
}

function formatDuration(startedAt: number, endedAt: number | null): string {
  if (endedAt === null) return 'ongoing';
  const seconds = Math.floor((endedAt - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function HistorySidebar({ sessions, onSelect, onClose, onRefresh }: HistorySidebarProps) {
  const panel = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[999] animate-fade-in"
        onClick={onClose}
      />
      {/* Slide-out panel */}
      <div className="fixed right-0 top-0 h-full w-[320px] glass-panel border-l border-[#30363d]/80 z-[1000] flex flex-col shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.5)] animate-slide-in-right">
        {/* Header */}
        <div className="h-10 px-4 flex items-center justify-between bg-white/[0.02] backdrop-blur-md border-b border-[#30363d]/50 shrink-0">
          <span className="text-[11px] font-semibold text-[#e6edf3] tracking-wide uppercase">Session History</span>
          <div className="flex items-center gap-1">
            <Tooltip text="Refresh sessions">
              <button
                onClick={onRefresh}
                className="p-1 text-[#8b949e] hover:text-white rounded hover:bg-[#21262d] transition-all"
                aria-label="Refresh sessions"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 3a5 5 0 0 0-4.546 2.914.5.5 0 0 1-.908-.418A6 6 0 1 1 2 8a.5.5 0 0 1 1 0 5 5 0 1 0 5-5z" />
                  <path d="M3 2v3h3" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            </Tooltip>
            <Tooltip text="Close">
              <button
                onClick={onClose}
                className="p-1 text-[#8b949e] hover:text-[#f85149] rounded hover:bg-[#f85149]/10 transition-all"
                aria-label="Close session history"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Session list */}
        <div className="overflow-y-auto flex-1">
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#484f58] text-sm">
              No past sessions
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                onClick={() => onSelect(session.id)}
                className="px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer border-b border-[#30363d]/30 transition-colors"
              >
                <div className="text-[12px] text-[#e6edf3] truncate">
                  {new Date(session.startedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#8b949e] truncate font-mono">
                    {session.shell}
                  </span>
                  <span className="text-[11px] text-[#484f58] shrink-0">
                    {formatDuration(session.startedAt, session.endedAt)}
                  </span>
                  {session.isOrphan && (
                    <span className="text-[10px] text-[#d29922] shrink-0 px-1.5 py-0.5 rounded bg-[#d29922]/10 border border-[#d29922]/20">
                      orphan
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}
