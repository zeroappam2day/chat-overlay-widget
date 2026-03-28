"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionRecorder = void 0;
const historyStore_js_1 = require("./historyStore.js");
const FLUSH_INTERVAL = 500; // ms
const FLUSH_SIZE = 65536; // 64KB
class SessionRecorder {
    constructor(shell, cwd) {
        const db = (0, historyStore_js_1.getDb)();
        const result = db.prepare('INSERT INTO sessions (shell, cwd, started_at) VALUES (?, ?, ?)').run(shell, cwd, Date.now());
        this.sessionId = Number(result.lastInsertRowid);
        this.buffer = [];
        this.bufferSize = 0;
        this.ended = false;
        this.insertChunkStmt = db.prepare('INSERT INTO session_chunks (session_id, data, recorded_at) VALUES (?, ?, ?)');
        this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
    }
    append(data) {
        const chunk = Buffer.from(data, 'utf8');
        this.buffer.push(chunk);
        this.bufferSize += chunk.byteLength;
        if (this.bufferSize >= FLUSH_SIZE) {
            this.flush();
        }
    }
    flush() {
        if (this.buffer.length === 0)
            return;
        const combined = Buffer.concat(this.buffer);
        this.buffer = [];
        this.bufferSize = 0;
        this.insertChunkStmt.run(this.sessionId, combined, Date.now());
    }
    end() {
        this.flush();
        if (this.flushTimer !== null) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        (0, historyStore_js_1.getDb)()
            .prepare('UPDATE sessions SET ended_at = ? WHERE id = ?')
            .run(Date.now(), this.sessionId);
        this.ended = true;
    }
    destroy() {
        if (!this.ended) {
            // Best-effort flush — no ended_at set (orphan per D-17)
            try {
                this.flush();
            }
            catch { /* ignore */ }
        }
        if (this.flushTimer !== null) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
    }
    getSessionId() {
        return this.sessionId;
    }
}
exports.SessionRecorder = SessionRecorder;
