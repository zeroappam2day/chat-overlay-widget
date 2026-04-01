import type { AgentEvent } from '../agentEvent.js';
import type { IAdapter } from './adapter.js';

class WindsurfAdapter implements IAdapter {
  normalize(raw: Record<string, unknown>): AgentEvent {
    const actionName = String(raw['agent_action_name'] ?? 'unknown');
    const toolInfo = raw['tool_info'] as Record<string, unknown> | undefined;
    let status: string | undefined;
    if (actionName.startsWith('pre_')) status = 'running';
    else if (actionName.startsWith('post_')) status = 'complete';
    return {
      tool: 'windsurf',
      type: actionName,
      sessionId: typeof raw['trajectory_id'] === 'string' ? raw['trajectory_id'] : 'unknown',
      timestamp: typeof raw['timestamp'] === 'string' ? raw['timestamp'] : new Date().toISOString(),
      filePath: typeof toolInfo?.['file_path'] === 'string' ? String(toolInfo['file_path']) : undefined,
      toolName: actionName,
      status,
      payload: raw,
    };
  }
}

export const windsurfAdapter = new WindsurfAdapter();
