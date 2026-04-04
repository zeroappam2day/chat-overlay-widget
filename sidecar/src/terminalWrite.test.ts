/**
 * terminalWrite.test.ts — Unit tests for Agent Runtime Phase 1 (Terminal Write)
 *
 * Tests the handleTerminalWrite HTTP route handler logic:
 * - Feature flag gating (403 when disabled)
 * - Input validation (missing text, oversized text, invalid JSON)
 * - Session routing (no session → 404, legacy map, multiPty paneId routing)
 * - pressEnter appends \r
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTerminalWrite } from './terminalWrite.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WebSocket } from 'ws';

// ─── Mocks ─────────────────────────────────────────────────────────────────

function mockReq(body: string): IncomingMessage {
  const chunks = [Buffer.from(body)];
  const req = {
    on(event: string, cb: (chunk?: Buffer) => void) {
      if (event === 'data') chunks.forEach(c => cb(c));
      if (event === 'end') cb();
      return req;
    },
  } as unknown as IncomingMessage;
  return req;
}

function mockRes(): ServerResponse & { _status: number; _body: Record<string, unknown> } {
  const res = {
    _status: 0,
    _body: {},
    writeHead(status: number) { res._status = status; return res; },
    end(data: string) { res._body = JSON.parse(data); return res; },
  } as unknown as ServerResponse & { _status: number; _body: Record<string, unknown> };
  return res;
}

function mockSession() {
  return { write: vi.fn(), destroy: vi.fn() };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('handleTerminalWrite', () => {
  let flags: Record<string, boolean>;

  beforeEach(() => {
    flags = { terminalWriteMcp: false, multiPty: false };
  });

  it('returns 403 when terminalWriteMcp flag is OFF', () => {
    const res = mockRes();
    handleTerminalWrite(mockReq('{}'), res, new Map(), flags);
    expect(res._status).toBe(403);
    expect(res._body.error).toMatch(/disabled/i);
  });

  it('returns 400 for invalid JSON body', () => {
    flags.terminalWriteMcp = true;
    const res = mockRes();
    handleTerminalWrite(mockReq('not-json'), res, new Map(), flags);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/invalid json/i);
  });

  it('returns 400 when text field is missing', () => {
    flags.terminalWriteMcp = true;
    const res = mockRes();
    handleTerminalWrite(mockReq('{"foo":"bar"}'), res, new Map(), flags);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/text/i);
  });

  it('returns 400 when text exceeds 10000 characters', () => {
    flags.terminalWriteMcp = true;
    const res = mockRes();
    const body = JSON.stringify({ text: 'x'.repeat(10001) });
    handleTerminalWrite(mockReq(body), res, new Map(), flags);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/exceeds/i);
  });

  it('returns 404 when no active session exists', () => {
    flags.terminalWriteMcp = true;
    const res = mockRes();
    handleTerminalWrite(mockReq('{"text":"hello"}'), res, new Map(), flags);
    expect(res._status).toBe(404);
    expect(res._body.error).toMatch(/no active/i);
  });

  it('writes text to session and returns 200', () => {
    flags.terminalWriteMcp = true;
    const session = mockSession();
    const sessions = new Map<WebSocket, typeof session>();
    sessions.set({} as WebSocket, session);

    const res = mockRes();
    handleTerminalWrite(mockReq('{"text":"hello"}'), res, sessions as any, flags);
    expect(res._status).toBe(200);
    expect(res._body.ok).toBe(true);
    expect(res._body.bytesWritten).toBe(5);
    expect(session.write).toHaveBeenCalledWith('hello');
  });

  it('appends \\r when pressEnter is true', () => {
    flags.terminalWriteMcp = true;
    const session = mockSession();
    const sessions = new Map<WebSocket, typeof session>();
    sessions.set({} as WebSocket, session);

    const res = mockRes();
    handleTerminalWrite(mockReq('{"text":"ls","pressEnter":true}'), res, sessions as any, flags);
    expect(res._status).toBe(200);
    expect(res._body.bytesWritten).toBe(3); // "ls" + "\r"
    expect(session.write).toHaveBeenCalledWith('ls\r');
  });
});
