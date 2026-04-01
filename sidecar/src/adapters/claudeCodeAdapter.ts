import type { AgentEvent } from '../agentEvent.js';
import type { IAdapter } from './adapter.js';

class ClaudeCodeAdapter implements IAdapter {
  normalize(raw: Record<string, unknown>): AgentEvent {
    const toolInput = raw['tool_input'] as Record<string, unknown> | undefined;
    return {
      tool: 'claude-code',
      type: String(raw['hook_event_name'] ?? 'unknown'),
      sessionId: typeof raw['session_id'] === 'string' ? raw['session_id'] : 'unknown',
      timestamp: typeof raw['timestamp'] === 'string' ? raw['timestamp'] : new Date().toISOString(),
      filePath: typeof toolInput?.['file_path'] === 'string' ? String(toolInput['file_path']) : undefined,
      toolName: typeof raw['tool_name'] === 'string' ? raw['tool_name'] : undefined,
      status: typeof raw['status'] === 'string' ? raw['status'] : undefined,
      payload: raw,
    };
  }
}

export const claudeCodeAdapter = new ClaudeCodeAdapter();
