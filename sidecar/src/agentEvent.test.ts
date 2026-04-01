import { describe, it, expect } from 'vitest';
import {
  AgentEvent,
  normalizeAgentEvent,
  RingBuffer,
  agentEventBuffer,
  AGENT_EVENT_BUFFER_SIZE,
} from './agentEvent.js';

describe('normalizeAgentEvent', () => {
  it('maps hook_event_name to type field for Claude Code payloads', () => {
    const raw = {
      hook_event_name: 'PreToolUse',
      session_id: 'abc123',
      transcript_path: '/home/user/.claude/projects/proj/conv.jsonl',
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    };
    const event = normalizeAgentEvent(raw);
    expect(event.type).toBe('PreToolUse');
    expect(event.tool).toBe('claude-code');
    expect(event.sessionId).toBe('abc123');
    expect(event.toolName).toBe('Bash');
  });

  it('assigns server timestamp when payload has no timestamp', () => {
    const before = new Date().toISOString();
    const event = normalizeAgentEvent({ hook_event_name: 'Stop' });
    const after = new Date().toISOString();
    expect(event.timestamp >= before).toBe(true);
    expect(event.timestamp <= after).toBe(true);
  });

  it('preserves existing timestamp from payload', () => {
    const ts = '2026-01-01T10:00:00.000Z';
    const event = normalizeAgentEvent({ hook_event_name: 'Stop', timestamp: ts });
    expect(event.timestamp).toBe(ts);
  });

  it('promotes filePath from tool_input.file_path', () => {
    const raw = {
      hook_event_name: 'PostToolUse',
      session_id: 'abc123',
      transcript_path: '/conv.jsonl',
      tool_name: 'Write',
      tool_input: { file_path: '/src/foo.ts', content: '...' },
    };
    const event = normalizeAgentEvent(raw);
    expect(event.filePath).toBe('/src/foo.ts');
  });

  it('promotes filePath from top-level file_path when tool_input absent', () => {
    const raw = {
      hook_event_name: 'PostToolUse',
      file_path: '/src/bar.ts',
    };
    const event = normalizeAgentEvent(raw);
    expect(event.filePath).toBe('/src/bar.ts');
  });

  it('promotes toolName from tool_name field', () => {
    const raw = {
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      transcript_path: '/conv.jsonl',
    };
    const event = normalizeAgentEvent(raw);
    expect(event.toolName).toBe('Read');
  });

  it('promotes status from status field', () => {
    const raw = {
      hook_event_name: 'PostToolUse',
      status: 'success',
      transcript_path: '/conv.jsonl',
    };
    const event = normalizeAgentEvent(raw);
    expect(event.status).toBe('success');
  });

  it('infers tool=unknown when no transcript_path or known heuristic', () => {
    const raw = { hook_event_name: 'SomeEvent' };
    const event = normalizeAgentEvent(raw);
    expect(event.tool).toBe('unknown');
  });

  it('maps type field when hook_event_name is absent', () => {
    const raw = { type: 'custom-event' };
    const event = normalizeAgentEvent(raw);
    expect(event.type).toBe('custom-event');
  });

  it('sets type=unknown when neither hook_event_name nor type present', () => {
    const raw = { session_id: 'xyz' };
    const event = normalizeAgentEvent(raw);
    expect(event.type).toBe('unknown');
  });

  it('preserves full raw payload in payload field', () => {
    const raw = {
      hook_event_name: 'PreToolUse',
      session_id: 'abc123',
      transcript_path: '/conv.jsonl',
      extra_field: 'extra_value',
      tool_input: { command: 'ls' },
    };
    const event = normalizeAgentEvent(raw);
    expect(event.payload).toBe(raw);
    expect(event.payload['extra_field']).toBe('extra_value');
  });

  it('infers tool=claude-code from transcript_path presence', () => {
    const raw = {
      hook_event_name: 'PreToolUse',
      transcript_path: '/home/user/.claude/projects/proj/conv.jsonl',
    };
    const event = normalizeAgentEvent(raw);
    expect(event.tool).toBe('claude-code');
  });
});

describe('RingBuffer', () => {
  it('stores items up to capacity', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.size).toBe(3);
    expect(buf.getAll()).toEqual([1, 2, 3]);
  });

  it('drops oldest entry when capacity exceeded', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.size).toBe(3);
    expect(buf.getAll()).toEqual([2, 3, 4]);
  });

  it('handles fewer items than capacity', () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    expect(buf.size).toBe(2);
    expect(buf.getAll()).toEqual([1, 2]);
  });

  it('getAll returns a copy — mutating it does not affect buffer', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    const copy = buf.getAll();
    copy.push(99);
    expect(buf.size).toBe(2);
    expect(buf.getAll()).toEqual([1, 2]);
  });
});

describe('module exports', () => {
  it('exports AGENT_EVENT_BUFFER_SIZE as 500', () => {
    expect(AGENT_EVENT_BUFFER_SIZE).toBe(500);
  });

  it('exports agentEventBuffer as a RingBuffer instance', () => {
    expect(agentEventBuffer).toBeInstanceOf(RingBuffer);
  });
});
