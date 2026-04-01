import { describe, it, expect } from 'vitest';
import { selectAdapter } from './adapter.js';
import { claudeCodeAdapter } from './claudeCodeAdapter.js';
import { windsurfAdapter } from './windsurfAdapter.js';
import { cursorAdapter } from './cursorAdapter.js';
import { fallbackAdapter } from './fallbackAdapter.js';

// ─── selectAdapter factory ────────────────────────────────────────────────────

describe('selectAdapter', () => {
  it('returns claudeCodeAdapter for Claude Code payload (transcript_path + hook_event_name, no cursor_version)', () => {
    const raw = {
      hook_event_name: 'PreToolUse',
      transcript_path: '/tmp/t',
      session_id: 'abc',
      tool_name: 'Read',
      tool_input: { file_path: '/foo.ts' },
    };
    expect(selectAdapter(raw)).toBe(claudeCodeAdapter);
  });

  it('returns windsurfAdapter for Windsurf payload (agent_action_name + trajectory_id)', () => {
    const raw = {
      agent_action_name: 'pre_read_code',
      trajectory_id: 'traj-1',
      timestamp: '2026-01-01T00:00:00Z',
      tool_info: { file_path: '/bar.ts' },
    };
    expect(selectAdapter(raw)).toBe(windsurfAdapter);
  });

  it('returns cursorAdapter for Cursor payload (conversation_id + cursor_version)', () => {
    const raw = {
      hook_event_name: 'preToolUse',
      conversation_id: 'conv-1',
      cursor_version: '1.7.0',
      tool_name: 'Edit',
      file_path: '/baz.ts',
    };
    expect(selectAdapter(raw)).toBe(cursorAdapter);
  });

  it('returns fallbackAdapter for empty object', () => {
    expect(selectAdapter({})).toBe(fallbackAdapter);
  });

  it('returns cursorAdapter (NOT claudeCodeAdapter) for Cursor payload that has hook_event_name', () => {
    const cursorWithHookEventName = {
      hook_event_name: 'preToolUse',
      conversation_id: 'conv-123',
      cursor_version: '1.8.0',
      // NOTE: no transcript_path — but even if present, cursor_version wins
    };
    const adapter = selectAdapter(cursorWithHookEventName);
    expect(adapter).toBe(cursorAdapter);
    expect(adapter).not.toBe(claudeCodeAdapter);
  });

  it('returns fallbackAdapter for payload with hook_event_name but no transcript_path', () => {
    const raw = { hook_event_name: 'SomeEvent' };
    expect(selectAdapter(raw)).toBe(fallbackAdapter);
  });
});

// ─── ClaudeCodeAdapter ────────────────────────────────────────────────────────

describe('ClaudeCodeAdapter.normalize', () => {
  it('produces correct AgentEvent fields', () => {
    const raw = {
      hook_event_name: 'PreToolUse',
      transcript_path: '/tmp/transcript',
      session_id: 'sess-123',
      tool_name: 'Read',
      tool_input: { file_path: '/src/foo.ts' },
      status: 'running',
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const event = claudeCodeAdapter.normalize(raw);
    expect(event.tool).toBe('claude-code');
    expect(event.type).toBe('PreToolUse');
    expect(event.sessionId).toBe('sess-123');
    expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(event.filePath).toBe('/src/foo.ts');
    expect(event.toolName).toBe('Read');
    expect(event.status).toBe('running');
    expect(event.payload).toBe(raw);
  });

  it('uses new Date().toISOString() when timestamp is missing', () => {
    const raw = {
      hook_event_name: 'Stop',
      transcript_path: '/tmp/t',
      session_id: 'sess-1',
    };
    const before = new Date().toISOString();
    const event = claudeCodeAdapter.normalize(raw);
    const after = new Date().toISOString();
    expect(event.timestamp >= before).toBe(true);
    expect(event.timestamp <= after).toBe(true);
  });

  it('returns undefined for optional fields when absent', () => {
    const raw = {
      hook_event_name: 'Stop',
      transcript_path: '/tmp/t',
    };
    const event = claudeCodeAdapter.normalize(raw);
    expect(event.filePath).toBeUndefined();
    expect(event.toolName).toBeUndefined();
    expect(event.status).toBeUndefined();
    expect(event.sessionId).toBe('unknown');
  });

  it('sets payload to the raw input object', () => {
    const raw = { hook_event_name: 'UserPromptSubmit', transcript_path: '/t' };
    const event = claudeCodeAdapter.normalize(raw);
    expect(event.payload).toBe(raw);
  });
});

// ─── WindsurfAdapter ──────────────────────────────────────────────────────────

describe('WindsurfAdapter.normalize', () => {
  it('derives status=running from pre_ prefix', () => {
    const raw = {
      agent_action_name: 'pre_read_code',
      trajectory_id: 'traj-1',
      timestamp: '2026-01-01T00:00:00Z',
      tool_info: { file_path: '/bar.ts' },
    };
    const event = windsurfAdapter.normalize(raw);
    expect(event.tool).toBe('windsurf');
    expect(event.type).toBe('pre_read_code');
    expect(event.sessionId).toBe('traj-1');
    expect(event.status).toBe('running');
    expect(event.toolName).toBe('pre_read_code');
  });

  it('derives status=complete from post_ prefix', () => {
    const raw = {
      agent_action_name: 'post_write_code',
      trajectory_id: 'traj-2',
      timestamp: '2026-01-01T01:00:00Z',
      tool_info: { file_path: '/src/out.ts' },
    };
    const event = windsurfAdapter.normalize(raw);
    expect(event.status).toBe('complete');
  });

  it('extracts filePath from tool_info.file_path (not top-level)', () => {
    const raw = {
      agent_action_name: 'pre_write_code',
      trajectory_id: 'traj-3',
      timestamp: '2026-01-01T00:00:00Z',
      tool_info: { file_path: '/nested/path.ts', edits: [] },
      file_path: '/top-level-should-be-ignored.ts',  // should NOT be used
    };
    const event = windsurfAdapter.normalize(raw);
    expect(event.filePath).toBe('/nested/path.ts');
  });

  it('returns undefined status for non-pre/post events', () => {
    const raw = {
      agent_action_name: 'post_cascade_response',
      trajectory_id: 'traj-4',
      timestamp: '2026-01-01T00:00:00Z',
    };
    const event = windsurfAdapter.normalize(raw);
    expect(event.status).toBe('complete');
  });

  it('sets payload to the raw input object', () => {
    const raw = { agent_action_name: 'pre_user_prompt', trajectory_id: 't1', timestamp: '2026-01-01T00:00:00Z' };
    const event = windsurfAdapter.normalize(raw);
    expect(event.payload).toBe(raw);
  });
});

// ─── CursorAdapter ────────────────────────────────────────────────────────────

describe('CursorAdapter.normalize', () => {
  it('produces tool=cursor and sessionId from conversation_id', () => {
    const raw = {
      hook_event_name: 'preToolUse',
      conversation_id: 'conv-abc',
      cursor_version: '1.7.0',
      tool_name: 'Edit',
      file_path: '/src/baz.ts',
      status: 'running',
    };
    const event = cursorAdapter.normalize(raw);
    expect(event.tool).toBe('cursor');
    expect(event.type).toBe('preToolUse');
    expect(event.sessionId).toBe('conv-abc');
    expect(event.filePath).toBe('/src/baz.ts');
    expect(event.toolName).toBe('Edit');
    expect(event.status).toBe('running');
    expect(event.payload).toBe(raw);
  });

  it('sets payload to the raw input object', () => {
    const raw = { hook_event_name: 'stop', conversation_id: 'c1', cursor_version: '1.7.0' };
    const event = cursorAdapter.normalize(raw);
    expect(event.payload).toBe(raw);
  });
});

// ─── FallbackAdapter ──────────────────────────────────────────────────────────

describe('FallbackAdapter.normalize', () => {
  it('does not throw on empty object and returns tool=unknown', () => {
    expect(() => fallbackAdapter.normalize({})).not.toThrow();
    const event = fallbackAdapter.normalize({});
    expect(event.tool).toBe('unknown');
    expect(event.type).toBe('unknown');
    expect(event.sessionId).toBe('unknown');
  });

  it('extracts sessionId from session_id when present', () => {
    const raw = { session_id: 'sess-99', hook_event_name: 'SomeEvent' };
    const event = fallbackAdapter.normalize(raw);
    expect(event.sessionId).toBe('sess-99');
  });

  it('extracts sessionId from trajectory_id as fallback', () => {
    const raw = { trajectory_id: 'traj-99' };
    const event = fallbackAdapter.normalize(raw);
    expect(event.sessionId).toBe('traj-99');
  });

  it('extracts sessionId from conversation_id as fallback', () => {
    const raw = { conversation_id: 'conv-99' };
    const event = fallbackAdapter.normalize(raw);
    expect(event.sessionId).toBe('conv-99');
  });

  it('sets payload to the raw input object', () => {
    const raw = { something: 'arbitrary' };
    const event = fallbackAdapter.normalize(raw);
    expect(event.payload).toBe(raw);
    expect(event.tool).toBe('unknown');
  });
});
