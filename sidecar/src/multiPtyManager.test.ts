/**
 * multiPtyManager.test.ts — Unit tests for Agent Runtime Phase 3
 *
 * Tests MultiPtyManager class:
 * - Session CRUD by WebSocket + paneId
 * - Max sessions per client (default 4)
 * - destroyAll cleanup
 * - Cross-connection findSessionByPaneId
 * - allSessions iterator
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiPtyManager } from './multiPtyManager.js';

function mockWs(id = 'ws1') {
  return { id } as unknown as import('ws').WebSocket;
}

function mockSession(label = 'session') {
  return { label, write: vi.fn(), destroy: vi.fn() } as any;
}

describe('MultiPtyManager', () => {
  let mgr: MultiPtyManager;

  beforeEach(() => {
    mgr = new MultiPtyManager({ maxSessionsPerClient: 4 });
  });

  it('stores and retrieves a session by ws + paneId', () => {
    const ws = mockWs();
    const session = mockSession();
    expect(mgr.setSession(ws, 'pane-1', session)).toBe(true);
    expect(mgr.getSession(ws, 'pane-1')).toBe(session);
  });

  it('returns undefined for unknown paneId', () => {
    const ws = mockWs();
    expect(mgr.getSession(ws, 'nonexistent')).toBeUndefined();
  });

  it('enforces max sessions per client', () => {
    const ws = mockWs();
    for (let i = 0; i < 4; i++) {
      expect(mgr.setSession(ws, `pane-${i}`, mockSession())).toBe(true);
    }
    expect(mgr.setSession(ws, 'pane-5', mockSession())).toBe(false);
    expect(mgr.sessionCount(ws)).toBe(4);
  });

  it('allows replacing existing session for same paneId', () => {
    const ws = mockWs();
    for (let i = 0; i < 4; i++) {
      mgr.setSession(ws, `pane-${i}`, mockSession());
    }
    // Replace pane-0 — should succeed even though at max
    const replacement = mockSession('replacement');
    expect(mgr.setSession(ws, 'pane-0', replacement)).toBe(true);
    expect(mgr.getSession(ws, 'pane-0')).toBe(replacement);
  });

  it('removeSession returns the removed session', () => {
    const ws = mockWs();
    const session = mockSession();
    mgr.setSession(ws, 'pane-1', session);
    expect(mgr.removeSession(ws, 'pane-1')).toBe(session);
    expect(mgr.getSession(ws, 'pane-1')).toBeUndefined();
  });

  it('removeSession returns undefined for unknown paneId', () => {
    const ws = mockWs();
    expect(mgr.removeSession(ws, 'nope')).toBeUndefined();
  });

  it('destroyAll calls destroy on all sessions for a connection', () => {
    const ws = mockWs();
    const s1 = mockSession();
    const s2 = mockSession();
    mgr.setSession(ws, 'p1', s1);
    mgr.setSession(ws, 'p2', s2);

    mgr.destroyAll(ws);
    expect(s1.destroy).toHaveBeenCalled();
    expect(s2.destroy).toHaveBeenCalled();
    expect(mgr.sessionCount(ws)).toBe(0);
  });

  it('getFirstSession returns the first session for a connection', () => {
    const ws = mockWs();
    const s1 = mockSession('first');
    mgr.setSession(ws, 'p1', s1);
    mgr.setSession(ws, 'p2', mockSession('second'));
    expect(mgr.getFirstSession(ws)).toBe(s1);
  });

  it('getFirstSession returns undefined for unknown connection', () => {
    expect(mgr.getFirstSession(mockWs('unknown'))).toBeUndefined();
  });

  it('findSessionByPaneId searches across all connections', () => {
    const ws1 = mockWs('ws1');
    const ws2 = mockWs('ws2');
    const target = mockSession('target');
    mgr.setSession(ws1, 'p1', mockSession());
    mgr.setSession(ws2, 'p2', target);

    expect(mgr.findSessionByPaneId('p2')).toBe(target);
  });

  it('findSessionByPaneId returns undefined when not found', () => {
    expect(mgr.findSessionByPaneId('nope')).toBeUndefined();
  });

  it('allSessions iterates all sessions across all connections', () => {
    const ws1 = mockWs('ws1');
    const ws2 = mockWs('ws2');
    mgr.setSession(ws1, 'p1', mockSession());
    mgr.setSession(ws1, 'p2', mockSession());
    mgr.setSession(ws2, 'p3', mockSession());

    const all = [...mgr.allSessions()];
    expect(all).toHaveLength(3);
  });

  it('getAllSessions returns empty map for unknown connection', () => {
    const result = mgr.getAllSessions(mockWs('unknown'));
    expect(result.size).toBe(0);
  });

  it('has returns false for unknown connection', () => {
    expect(mgr.has(mockWs('unknown'))).toBe(false);
  });

  it('has returns true for connection with sessions', () => {
    const ws = mockWs();
    mgr.setSession(ws, 'p1', mockSession());
    expect(mgr.has(ws)).toBe(true);
  });

  it('deleteConnection removes connection entry', () => {
    const ws = mockWs();
    mgr.setSession(ws, 'p1', mockSession());
    mgr.deleteConnection(ws);
    expect(mgr.has(ws)).toBe(false);
  });
});
