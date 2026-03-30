"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("node:http"));
const crypto = __importStar(require("node:crypto"));
const ws_1 = require("ws");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const ptySession_js_1 = require("./ptySession.js");
const shellDetect_js_1 = require("./shellDetect.js");
const historyStore_js_1 = require("./historyStore.js");
const discoveryFile_js_1 = require("./discoveryFile.js");
const windowEnumerator_js_1 = require("./windowEnumerator.js");
const windowCapture_js_1 = require("./windowCapture.js");
// Initialize SQLite and mark orphaned sessions from previous crashes (D-17)
(0, historyStore_js_1.openDb)();
(0, historyStore_js_1.markOrphans)();
sweepScreenshotTempFiles();
console.log('[sidecar] SQLite session database initialized');
// Clean any stale discovery file from a previous force-killed session
(0, discoveryFile_js_1.cleanStaleDiscoveryFile)();
const authToken = crypto.randomBytes(32).toString('hex');
let portFilePath = null;
function handleHttpRequest(req, res) {
    const auth = req.headers['authorization'] ?? '';
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== authToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
    }
    // Route dispatch
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    if (req.method === 'GET' && req.url === '/list-windows') {
        try {
            const windows = (0, windowEnumerator_js_1.listWindows)();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(windows));
        }
        catch (err) {
            console.error('[sidecar] list-windows error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Window enumeration failed' }));
        }
        return;
    }
    if (req.method === 'POST' && req.url === '/capture/window') {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
                if (!title) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'title is required' }));
                    return;
                }
                console.log(`[sidecar] capture/window requested: title="${title}"`);
                const result = (0, windowCapture_js_1.captureWindow)(title);
                if (result.ok) {
                    console.log(`[sidecar] capture/window success: ${result.path}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ path: result.path }));
                }
                else {
                    console.log(`[sidecar] capture/window failed: ${result.error}`);
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: result.error }));
                }
            }
            catch (err) {
                console.error('[sidecar] capture/window error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: String(err) }));
            }
        });
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}
const httpServer = http.createServer(handleHttpRequest);
const wss = new ws_1.WebSocketServer({ server: httpServer });
// Heartbeat: ping every 30s, terminate if no pong within 10s (Phase 5 hardening)
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;
const aliveClients = new WeakMap();
const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
        if (aliveClients.get(ws) === false) {
            console.log('[sidecar] client failed heartbeat — terminating');
            ws.terminate();
            continue;
        }
        aliveClients.set(ws, false);
        ws.ping();
    }
}, HEARTBEAT_INTERVAL);
httpServer.on('close', () => clearInterval(heartbeatTimer));
httpServer.listen(0, '127.0.0.1', () => {
    const addr = httpServer.address();
    // PORT: prefix — Tauri Rust core reads this via CommandEvent::Stdout
    process.stdout.write(`PORT:${addr.port}\n`);
    console.log(`[sidecar] server listening on 127.0.0.1:${addr.port}`);
    console.log(`[sidecar] auth token generated (${authToken.length} chars)`);
    portFilePath = (0, discoveryFile_js_1.writeDiscoveryFile)(addr.port, authToken);
});
const activeSessions = new Map();
function sendMsg(ws, msg) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
async function sweepScreenshotTempFiles() {
    try {
        const files = await fs.promises.readdir(ptySession_js_1.SCREENSHOT_DIR);
        await Promise.all(files.map(f => fs.promises.unlink(path.join(ptySession_js_1.SCREENSHOT_DIR, f)).catch(() => { })));
        if (files.length > 0) {
            console.log(`[sidecar] swept ${files.length} orphan screenshot temp files`);
        }
    }
    catch {
        /* directory doesn't exist — that's fine */
    }
}
wss.on('connection', (ws) => {
    console.log('[sidecar] client connected');
    aliveClients.set(ws, true);
    ws.on('pong', () => { aliveClients.set(ws, true); });
    // Send available shells immediately on connection (D-01)
    const shells = (0, shellDetect_js_1.detectShells)();
    console.log(`[sidecar] detected shells: ${JSON.stringify(shells)}`);
    const shellListMsg = { type: 'shell-list', shells: shells.map(s => s.name) };
    console.log(`[sidecar] sending shell-list: ${JSON.stringify(shellListMsg)}`);
    sendMsg(ws, shellListMsg);
    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        }
        catch {
            sendMsg(ws, { type: 'error', message: 'Invalid JSON' });
            return;
        }
        console.log(`[sidecar] received message: ${JSON.stringify(msg)}`);
        switch (msg.type) {
            case 'spawn': {
                console.log(`[sidecar] spawn requested: shell=${msg.shell}, cols=${msg.cols}, rows=${msg.rows}`);
                // Destroy existing session if any
                const existing = activeSessions.get(ws);
                if (existing) {
                    console.log('[sidecar] destroying existing session');
                    existing.destroy();
                    activeSessions.delete(ws);
                }
                // Find shell executable from detected shells
                const shellInfo = shells.find(s => s.name === msg.shell);
                const shellExe = shellInfo?.exe ?? msg.shell;
                console.log(`[sidecar] resolved shell exe: ${shellExe}`);
                try {
                    const session = new ptySession_js_1.PTYSession(ws, shellExe, msg.cols ?? 80, msg.rows ?? 24);
                    activeSessions.set(ws, session);
                    console.log(`[sidecar] PTY session created successfully`);
                    console.log(`[sidecar] session started: id=${session.sessionId}`);
                    sendMsg(ws, { type: 'session-start', sessionId: session.sessionId });
                }
                catch (err) {
                    console.error(`[sidecar] PTY spawn failed: ${err}`);
                    sendMsg(ws, { type: 'error', message: `Failed to spawn shell: ${err}` });
                }
                break;
            }
            case 'input': {
                const session = activeSessions.get(ws);
                session?.write(msg.data);
                break;
            }
            case 'resize': {
                const session = activeSessions.get(ws);
                session?.resize(msg.cols, msg.rows);
                break;
            }
            case 'kill': {
                const session = activeSessions.get(ws);
                if (session) {
                    session.destroy();
                    activeSessions.delete(ws);
                }
                break;
            }
            case 'history-list': {
                const rows = (0, historyStore_js_1.listSessions)();
                const sessions = rows.map(r => ({
                    id: r.id,
                    shell: r.shell,
                    cwd: r.cwd,
                    startedAt: r.started_at,
                    endedAt: r.ended_at,
                    isOrphan: r.is_orphan === 1,
                }));
                sendMsg(ws, { type: 'history-sessions', sessions });
                break;
            }
            case 'history-replay': {
                const chunks = (0, historyStore_js_1.getSessionChunks)(msg.sessionId);
                for (const chunk of chunks) {
                    sendMsg(ws, { type: 'history-chunk', data: chunk.data.toString('utf-8') });
                }
                sendMsg(ws, { type: 'history-end', sessionId: msg.sessionId });
                break;
            }
            case 'save-image': {
                const session = activeSessions.get(ws);
                if (!session) {
                    sendMsg(ws, { type: 'error', message: 'No active session for save-image' });
                    break;
                }
                session.saveImage(msg.base64, msg.ext)
                    .then(filePath => {
                    sendMsg(ws, { type: 'save-image-result', path: filePath });
                })
                    .catch(err => {
                    sendMsg(ws, { type: 'error', message: `Failed to save image: ${err}` });
                });
                break;
            }
        }
    });
    ws.on('close', () => {
        console.log('[sidecar] client disconnected');
        const session = activeSessions.get(ws);
        if (session) {
            session.destroy();
            activeSessions.delete(ws);
        }
    });
});
// Cleanup all PTY sessions and discovery file on sidecar exit (D-08, CAPI-04)
// Note: On Windows, Tauri force-kills sidecar via taskkill /T /F, so these handlers
// only fire for graceful shutdowns. Primary cleanup is in Tauri's RunEvent::Exit (main.rs).
process.on('exit', () => {
    for (const session of activeSessions.values()) {
        session.destroy();
    }
    if (portFilePath) {
        (0, discoveryFile_js_1.deleteDiscoveryFile)(portFilePath);
        portFilePath = null;
    }
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
