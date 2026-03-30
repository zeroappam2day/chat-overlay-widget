"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openDb = openDb;
exports.getDb = getDb;
exports.markOrphans = markOrphans;
exports.listSessions = listSessions;
exports.getSessionChunks = getSessionChunks;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const dbPath = path_1.default.join(process.env['LOCALAPPDATA'] || path_1.default.join(os_1.default.homedir(), 'AppData', 'Local'), 'chat-overlay-widget', 'sessions.db');
let db = null;
function openDb() {
    (0, fs_1.mkdirSync)(path_1.default.dirname(dbPath), { recursive: true });
    db = new better_sqlite3_1.default(dbPath);
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
function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call openDb() first.');
    }
    return db;
}
function markOrphans() {
    const database = getDb();
    database.prepare('UPDATE sessions SET is_orphan = 1 WHERE ended_at IS NULL').run();
}
function listSessions() {
    const database = getDb();
    return database
        .prepare('SELECT id, shell, cwd, started_at, ended_at, is_orphan FROM sessions ORDER BY started_at DESC')
        .all();
}
function getSessionChunks(sessionId) {
    const database = getDb();
    return database
        .prepare('SELECT data FROM session_chunks WHERE session_id = ? ORDER BY recorded_at ASC')
        .all(sessionId);
}
