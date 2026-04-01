import type { AgentEvent } from '../agentEvent.js';
import type { IAdapter } from './adapter.js';

class CursorAdapter implements IAdapter {
  normalize(raw: Record<string, unknown>): AgentEvent {
    return {
      tool: 'cursor',
      type: String(raw['hook_event_name'] ?? 'unknown'),
      sessionId: typeof raw['conversation_id'] === 'string' ? raw['conversation_id'] : 'unknown',
      timestamp: new Date().toISOString(),
      filePath: typeof raw['file_path'] === 'string' ? raw['file_path'] : undefined,
      toolName: typeof raw['tool_name'] === 'string' ? raw['tool_name'] : undefined,
      status: typeof raw['status'] === 'string' ? raw['status'] : undefined,
      payload: raw,
    };
  }
}

export const cursorAdapter = new CursorAdapter();
