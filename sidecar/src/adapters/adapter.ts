import type { AgentEvent } from '../agentEvent.js';
import { claudeCodeAdapter } from './claudeCodeAdapter.js';
import { windsurfAdapter } from './windsurfAdapter.js';
import { cursorAdapter } from './cursorAdapter.js';
import { fallbackAdapter } from './fallbackAdapter.js';

export interface IAdapter {
  normalize(raw: Record<string, unknown>): AgentEvent;
}

export function selectAdapter(raw: Record<string, unknown>): IAdapter {
  // Claude Code: transcript_path + hook_event_name, but NOT cursor_version
  // (Cursor also has hook_event_name, so cursor_version absence is required)
  if (
    typeof raw['transcript_path'] === 'string' &&
    typeof raw['hook_event_name'] === 'string' &&
    !('cursor_version' in raw)
  ) {
    return claudeCodeAdapter;
  }
  // Windsurf: agent_action_name + trajectory_id
  if (typeof raw['agent_action_name'] === 'string' && typeof raw['trajectory_id'] === 'string') {
    return windsurfAdapter;
  }
  // Cursor: conversation_id + cursor_version
  if (typeof raw['conversation_id'] === 'string' && typeof raw['cursor_version'] === 'string') {
    return cursorAdapter;
  }
  return fallbackAdapter;
}
