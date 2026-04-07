import { createPortal } from 'react-dom';
import { useAgentEventStore } from '../store/agentEventStore';
import type { AgentEvent } from '../protocol';
import { Tooltip } from './Tooltip';

function statusDotClass(status: string | undefined): string {
  switch (status) {
    case 'running':  return 'bg-[#d29922]';
    case 'complete': return 'bg-[#3fb950]';
    case 'error':    return 'bg-[#f85149]';
    default:         return 'bg-[#484f58]';
  }
}

function statusRingClass(status: string | undefined): string {
  switch (status) {
    case 'running':  return 'border-[#d29922]/30';
    case 'complete': return 'border-[#3fb950]/30';
    case 'error':    return 'border-[#f85149]/30';
    default:         return 'border-[#30363d]';
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
  return '...' + p.slice(p.length - maxLen + 1);
}

interface AgentEventRowProps {
  event: AgentEvent;
}

function AgentEventRow({ event }: AgentEventRowProps) {
  const dotClass = statusDotClass(event.status);
  const ringClass = statusRingClass(event.status);
  const displayName = event.toolName ?? event.type;
  const isActive = event.status === 'running';

  return (
    <div className="relative flex gap-3 mb-4 last:mb-0">
      {/* Timeline dot */}
      <div className={`w-6 h-6 rounded-full border-2 ${ringClass} bg-[#0d1117] flex items-center justify-center shrink-0 z-10`}>
        <div className={`w-2 h-2 rounded-full ${dotClass} ${isActive ? 'animate-pulse' : ''}`} />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5 hover:bg-white/[0.02] -mx-2 px-2 py-1 -mt-1 rounded transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-[#0d1117] text-[#8b949e] px-1.5 py-0.5 rounded border border-[#30363d]/50">{event.tool}</span>
          <span className="text-[12px] text-[#e6edf3] truncate">{displayName}</span>
        </div>
        {event.filePath && (
          <div className="mt-0.5 text-[11px] text-[#8b949e]/70 truncate font-mono" title={event.filePath}>
            {truncateFilePath(event.filePath)}
          </div>
        )}
        <div className="mt-0.5 text-[10px] text-[#484f58] font-mono">
          {formatTimestamp(event.timestamp)}
        </div>
      </div>
    </div>
  );
}

export function AgentSidebar() {
  const events = useAgentEventStore((s) => s.events);
  const collapsed = useAgentEventStore((s) => s.collapsed);
  const toggleCollapsed = useAgentEventStore((s) => s.toggleCollapsed);

  // Collapsed state: thin icon strip
  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-8 shrink-0 bg-[#0d1117] border-r border-[#30363d] h-full">
        <Tooltip text="Expand Agent Activity" position="right">
          <button
            onClick={toggleCollapsed}
            className="mt-2 p-1.5 text-[#8b949e] hover:text-white rounded hover:bg-[#21262d] transition-all"
            aria-label="expand agent sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 3l5 5-5 5V3z" />
            </svg>
          </button>
        </Tooltip>
      </div>
    );
  }

  // Expanded: slide-out glassmorphism panel via portal
  const panel = createPortal(
    <>
      {/* Subtle backdrop - clickable to close */}
      <div
        className="fixed inset-0 z-[998] animate-fade-in"
        onClick={toggleCollapsed}
      />
      {/* Glass panel */}
      <div className="fixed left-0 top-8 bottom-0 w-[300px] glass-panel border-r border-[#30363d]/80 z-[999] flex flex-col shadow-[20px_0_40px_-10px_rgba(0,0,0,0.5)] animate-slide-in-right"
        style={{ animationDirection: 'normal', transform: 'none' }}
      >
        {/* Frosted header */}
        <div className="h-10 px-4 border-b border-[#30363d]/50 bg-white/[0.02] backdrop-blur-md flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative w-2 h-2">
              {events.some(e => e.status === 'running') && (
                <div className="absolute inset-0 bg-[#58a6ff] rounded-full animate-ping opacity-60" />
              )}
              <div className={`absolute inset-0 rounded-full ${events.some(e => e.status === 'running') ? 'bg-[#58a6ff]' : 'bg-[#484f58]'}`} />
            </div>
            <span className="text-[11px] font-semibold text-[#e6edf3] tracking-wide uppercase">Agent Activity</span>
          </div>
          <button
            onClick={toggleCollapsed}
            className="p-1 text-[#8b949e] hover:text-white transition-colors rounded hover:bg-[#21262d]"
            aria-label="collapse agent sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 3l-5 5 5 5V3z" />
            </svg>
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-4 relative">
          {/* Vertical timeline line */}
          {events.length > 1 && (
            <div className="absolute left-[27px] top-6 bottom-6 w-px bg-[#30363d]" />
          )}

          {events.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[#484f58] text-sm">
              No agent events
            </div>
          ) : (
            [...events].reverse().map((event, i) => (
              <AgentEventRow key={`${event.sessionId}-${event.timestamp}-${i}`} event={event} />
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  );

  return (
    <>
      {/* Thin collapsed strip remains for layout consistency */}
      <div className="flex flex-col items-center w-8 shrink-0 bg-[#0d1117] border-r border-[#30363d] h-full">
        <Tooltip text="Collapse Agent Activity" position="right">
          <button
            onClick={toggleCollapsed}
            className="mt-2 p-1.5 text-[#58a6ff] hover:text-white rounded hover:bg-[#21262d] transition-all"
            aria-label="collapse agent sidebar"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 3l-5 5 5 5V3z" />
            </svg>
          </button>
        </Tooltip>
      </div>
      {panel}
    </>
  );
}
