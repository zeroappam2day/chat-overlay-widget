import type Database from 'better-sqlite3';
import { getDb } from './historyStore.js';

const FLUSH_INTERVAL = 500; // ms
const FLUSH_SIZE = 65536;   // 64KB

export class SessionRecorder {
  private sessionId: number;
  private buffer: Buffer[];
  private bufferSize: number;
  private flushTimer: NodeJS.Timeout | null;
  private insertChunkStmt: Database.Statement;
  private ended: boolean;

  constructor(shell: string, cwd: string) {
    const db = getDb();

    const result = db.prepare(
      'INSERT INTO sessions (shell, cwd, started_at) VALUES (?, ?, ?)'
    ).run(shell, cwd, Date.now());

    this.sessionId = Number(result.lastInsertRowid);
    this.buffer = [];
    this.bufferSize = 0;
    this.ended = false;

    this.insertChunkStmt = db.prepare(
      'INSERT INTO session_chunks (session_id, data, recorded_at) VALUES (?, ?, ?)'
    );

    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
  }

  append(data: string): void {
    const chunk = Buffer.from(data, 'utf8');
    this.buffer.push(chunk);
    this.bufferSize += chunk.byteLength;

    if (this.bufferSize >= FLUSH_SIZE) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0) return;

    const combined = Buffer.concat(this.buffer);
    this.buffer = [];
    this.bufferSize = 0;

    this.insertChunkStmt.run(this.sessionId, combined, Date.now());
  }

  end(): void {
    this.flush();

    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    getDb()
      .prepare('UPDATE sessions SET ended_at = ? WHERE id = ?')
      .run(Date.now(), this.sessionId);

    this.ended = true;
  }

  destroy(): void {
    if (!this.ended) {
      // Best-effort flush — no ended_at set (orphan per D-17)
      try { this.flush(); } catch { /* ignore */ }
    }

    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  getSessionId(): number {
    return this.sessionId;
  }
}
