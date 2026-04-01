import { useAgentEventStore } from '../store/agentEventStore';
import type { AgentEvent } from '../protocol';

function statusDotClass(status: string | undefined): string {
  switch (status) {
    case 'running':  return 'bg-yellow-500';
    case 'complete': return 'bg-green-500';
    case 'error':    return 'bg-red-500';
    default:         return 'bg-gray-500';
  }
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function truncateFilePath(p: string, maxLen = 32): string {
  if (p.length <= maxLen) return p;
  return '…' + p.slice(p.length - maxLen + 1);
}

interface AgentEventRowProps {
  event: AgentEvent;
}

function AgentEventRow({ event }: AgentEventRowProps) {
  const dotClass = statusDotClass(event.status);
  const displayName = event.toolName ?? event.type;

  return (
    <div className="px-3 py-2 border-b border-[#333] hover:bg-[#2a2d2e]">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-label={`status-${event.status ?? 'undefined'}`} />
        <span className="text-xs bg-[#1e1e1e] text-gray-400 px-1 rounded shrink-0">{event.tool}</span>
        <span className="text-xs text-gray-300 truncate">{displayName}</span>
      </div>
      {event.filePath && (
        <div className="mt-0.5 text-xs text-gray-500 truncate pl-4" title={event.filePath}>
          {truncateFilePath(event.filePath)}
        </div>
      )}
      <div className="mt-0.5 text-xs text-gray-600 pl-4">
        {formatTimestamp(event.timestamp)}
      </div>
    </div>
  );
}

export function AgentSidebar() {
  const events = useAgentEventStore((s) => s.events);
  const collapsed = useAgentEventStore((s) => s.collapsed);
  const toggleCollapsed = useAgentEventStore((s) => s.toggleCollapsed);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-8 shrink-0 bg-[#252526] border-r border-[#404040] h-full">
        <button
          onClick={toggleCollapsed}
          className="mt-2 p-1 text-gray-400 hover:text-white rounded"
          title="Expand Agent Activity"
          aria-label="expand agent sidebar"
        >
          &#9654;
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-72 shrink-0 bg-[#252526] border-r border-[#404040] h-full">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between bg-[#2d2d2d] border-b border-[#404040] text-sm text-gray-300 shrink-0">
        <span className="font-medium">Agent Activity</span>
        <button
          onClick={toggleCollapsed}
          className="p-1 hover:text-white rounded text-gray-400 text-lg leading-none"
          title="Collapse sidebar"
          aria-label="collapse agent sidebar"
        >
          &#9664;
        </button>
      </div>

      {/* Event list */}
      <div className="overflow-y-auto flex-1">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No agent events
          </div>
        ) : (
          [...events].reverse().map((event, i) => (
            <AgentEventRow key={`${event.sessionId}-${event.timestamp}-${i}`} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
