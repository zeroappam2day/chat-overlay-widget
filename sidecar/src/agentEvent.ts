export const AGENT_EVENT_BUFFER_SIZE = 500;

export interface AgentEvent {
  tool: string;
  type: string;
  timestamp: string;
  sessionId: string;
  payload: Record<string, unknown>;
  filePath?: string;
  toolName?: string;
  status?: string;
}

export class RingBuffer<T> {
  private buf: T[] = [];
  constructor(private readonly capacity: number) {}

  push(item: T): void {
    if (this.buf.length >= this.capacity) this.buf.shift();
    this.buf.push(item);
  }

  getAll(): T[] {
    return [...this.buf];
  }

  get size(): number {
    return this.buf.length;
  }
}

function inferSource(raw: Record<string, unknown>): string {
  if (typeof raw['transcript_path'] === 'string') return 'claude-code';
  return 'unknown';
}

export function normalizeAgentEvent(raw: Record<string, unknown>): AgentEvent {
  const type = String(raw['hook_event_name'] ?? raw['type'] ?? 'unknown');
  const sessionId = typeof raw['session_id'] === 'string' ? raw['session_id'] : 'unknown';
  const timestamp =
    typeof raw['timestamp'] === 'string' ? raw['timestamp'] : new Date().toISOString();
  const tool = inferSource(raw);

  const filePath =
    typeof raw['file_path'] === 'string'
      ? raw['file_path']
      : typeof (raw['tool_input'] as Record<string, unknown> | undefined)?.['file_path'] === 'string'
        ? String((raw['tool_input'] as Record<string, unknown>)['file_path'])
        : undefined;

  const toolName = typeof raw['tool_name'] === 'string' ? raw['tool_name'] : undefined;
  const status = typeof raw['status'] === 'string' ? raw['status'] : undefined;

  return { tool, type, timestamp, sessionId, payload: raw, filePath, toolName, status };
}

export const agentEventBuffer = new RingBuffer<AgentEvent>(AGENT_EVENT_BUFFER_SIZE);
