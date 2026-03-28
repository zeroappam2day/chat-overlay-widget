import type { SessionMeta } from '../protocol';

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
  return (
    <div className="flex flex-col w-72 shrink-0 bg-[#252526] border-r border-[#404040] h-full">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between bg-[#2d2d2d] border-b border-[#404040] text-sm text-gray-300 shrink-0">
        <span className="font-medium">History</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1 hover:text-white rounded text-gray-400"
            title="Refresh session list"
          >
            &#8635;
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-white rounded text-gray-400 text-lg leading-none"
            title="Close sidebar"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="overflow-y-auto flex-1">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No past sessions
          </div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              onClick={() => onSelect(session.id)}
              className="px-3 py-2 hover:bg-[#2a2d2e] cursor-pointer border-b border-[#333]"
            >
              <div className="text-xs text-gray-300 truncate">
                {new Date(session.startedAt).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 truncate">
                  {session.shell}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {formatDuration(session.startedAt, session.endedAt)}
                </span>
                {session.isOrphan && (
                  <span className="text-xs text-yellow-600 shrink-0" title="Session ended unexpectedly">
                    orphan
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
