import type { AgentEvent } from '../agentEvent.js';
import type { IAdapter } from './adapter.js';

class FallbackAdapter implements IAdapter {
  normalize(raw: Record<string, unknown>): AgentEvent {
    const toolInput = raw['tool_input'] as Record<string, unknown> | undefined;
    return {
      tool: 'unknown',
      type: String(raw['hook_event_name'] ?? raw['type'] ?? 'unknown'),
      sessionId: typeof raw['session_id'] === 'string' ? raw['session_id']
        : typeof raw['trajectory_id'] === 'string' ? raw['trajectory_id']
        : typeof raw['conversation_id'] === 'string' ? raw['conversation_id']
        : 'unknown',
      timestamp: typeof raw['timestamp'] === 'string' ? raw['timestamp'] : new Date().toISOString(),
      filePath: typeof raw['file_path'] === 'string' ? raw['file_path']
        : typeof toolInput?.['file_path'] === 'string' ? String(toolInput['file_path'])
        : undefined,
      toolName: typeof raw['tool_name'] === 'string' ? raw['tool_name'] : undefined,
      status: typeof raw['status'] === 'string' ? raw['status'] : undefined,
      payload: raw,
    };
  }
}

export const fallbackAdapter = new FallbackAdapter();
