/**
 * Multi-PTY session manager (Agent Runtime Phase 3).
 * Manages multiple PTY sessions per WebSocket connection, keyed by paneId.
 * When multiPty flag is OFF, callers use getFirstSession() for backward compatibility.
 */

import type WebSocket from 'ws';
import type { PTYSession } from './ptySession.js';
import type { BatchedPTYSession } from './batchedPtySession.js';

type AnySession = PTYSession | BatchedPTYSession;

const DEFAULT_MAX_SESSIONS = 4;

export class MultiPtyManager {
  private sessions = new Map<WebSocket, Map<string, AnySession>>();
  private maxSessionsPerClient: number;

  constructor(opts?: { maxSessionsPerClient?: number }) {
    this.maxSessionsPerClient = opts?.maxSessionsPerClient ?? DEFAULT_MAX_SESSIONS;
  }

  /** Get a specific session by paneId. */
  getSession(ws: WebSocket, paneId: string): AnySession | undefined {
    return this.sessions.get(ws)?.get(paneId);
  }

  /** Store a session for a given paneId. Returns false if max sessions reached. */
  setSession(ws: WebSocket, paneId: string, session: AnySession): boolean {
    let paneMap = this.sessions.get(ws);
    if (!paneMap) {
      paneMap = new Map();
      this.sessions.set(ws, paneMap);
    }
    // Allow replacing existing session for same paneId (respawn)
    if (!paneMap.has(paneId) && paneMap.size >= this.maxSessionsPerClient) {
      return false;
    }
    paneMap.set(paneId, session);
    return true;
  }

  /** Remove a specific session by paneId. Returns the removed session or undefined. */
  removeSession(ws: WebSocket, paneId: string): AnySession | undefined {
    const paneMap = this.sessions.get(ws);
    if (!paneMap) return undefined;
    const session = paneMap.get(paneId);
    paneMap.delete(paneId);
    if (paneMap.size === 0) {
      this.sessions.delete(ws);
    }
    return session;
  }

  /** Get all sessions for a WebSocket connection. */
  getAllSessions(ws: WebSocket): Map<string, AnySession> {
    return this.sessions.get(ws) ?? new Map();
  }

  /** Fallback: get the first session for a connection (for non-multiPty mode or when no paneId given). */
  getFirstSession(ws: WebSocket): AnySession | undefined {
    const paneMap = this.sessions.get(ws);
    if (!paneMap) return undefined;
    return paneMap.values().next().value;
  }

  /** Destroy all sessions for a WebSocket connection. */
  destroyAll(ws: WebSocket): void {
    const paneMap = this.sessions.get(ws);
    if (!paneMap) return;
    for (const session of paneMap.values()) {
      session.destroy();
    }
    this.sessions.delete(ws);
  }

  /** Get count of sessions for a WebSocket connection. */
  sessionCount(ws: WebSocket): number {
    return this.sessions.get(ws)?.size ?? 0;
  }

  /** Iterate all sessions across all connections (for broadcast operations). */
  *allSessions(): IterableIterator<AnySession> {
    for (const paneMap of this.sessions.values()) {
      for (const session of paneMap.values()) {
        yield session;
      }
    }
  }

  /** Find a session by paneId across all connections. */
  findSessionByPaneId(paneId: string): AnySession | undefined {
    for (const paneMap of this.sessions.values()) {
      const session = paneMap.get(paneId);
      if (session) return session;
    }
    return undefined;
  }

  /** Check if a connection has any sessions. */
  has(ws: WebSocket): boolean {
    const paneMap = this.sessions.get(ws);
    return paneMap !== undefined && paneMap.size > 0;
  }

  /** Remove the connection entry entirely (for cleanup on disconnect). */
  deleteConnection(ws: WebSocket): void {
    this.sessions.delete(ws);
  }
}
