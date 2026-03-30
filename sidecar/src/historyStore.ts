import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import path from 'path';
import os from 'os';

export interface SessionRow {
  id: number;
  shell: string;
  cwd: string | null;
  started_at: number;
  ended_at: number | null;
  is_orphan: number;
}

const dbPath = path.join(
  process.env['LOCALAPPDATA'] || path.join(os.homedir(), 'AppData', 'Local'),
  'chat-overlay-widget',
  'sessions.db'
);

let db: Database.Database | null = null;

export function openDb(): void {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      shell      TEXT    NOT NULL,
      cwd        TEXT,
      started_at INTEGER NOT NULL,
      ended_at   INTEGER,
      is_orphan  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES sessions(id),
      data        BLOB    NOT NULL,
      recorded_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_session ON session_chunks(session_id, recorded_at);
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call openDb() first.');
  }
  return db;
}

export function markOrphans(): void {
  const database = getDb();
  database.prepare('UPDATE sessions SET is_orphan = 1 WHERE ended_at IS NULL').run();
}

export function listSessions(): SessionRow[] {
  const database = getDb();
  return database
    .prepare('SELECT id, shell, cwd, started_at, ended_at, is_orphan FROM sessions ORDER BY started_at DESC')
    .all() as SessionRow[];
}

export function getSessionChunks(sessionId: number): { data: Buffer }[] {
  const database = getDb();
  return database
    .prepare('SELECT data FROM session_chunks WHERE session_id = ? ORDER BY recorded_at ASC')
    .all(sessionId) as { data: Buffer }[];
}
