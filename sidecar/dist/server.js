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
// MCP subcommand routing — must be FIRST, before any imports (per D-03)
// This guard runs before native addon initialization (node-pty, better-sqlite3, sharp).
// mcp-server.ts installs an uncaughtException handler to swallow the throw below,
// allowing the async stdio transport to stay alive.
if (process.argv[2] === 'mcp') {
    require('./mcp-server.js');
    // Throw to prevent execution from falling through to native addon initialization.
    // mcp-server.ts handles this specific error via uncaughtException handler.
    throw new Error('mcp-server should not return');
}
const http = __importStar(require("node:http"));
const crypto = __importStar(require("node:crypto"));
const ws_1 = require("ws");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const ptySession_js_1 = require("./ptySession.js");
const batchedPtySession_js_1 = require("./batchedPtySession.js");
const shellDetect_js_1 = require("./shellDetect.js");
const historyStore_js_1 = require("./historyStore.js");
const terminalBuffer_js_1 = require("./terminalBuffer.js");
const secretScrubber_js_1 = require("./secretScrubber.js");
const screenshotSelf_js_1 = require("./screenshotSelf.js");
const discoveryFile_js_1 = require("./discoveryFile.js");
const agentEvent_js_1 = require("./agentEvent.js");
const adapter_js_1 = require("./adapters/adapter.js");
const windowEnumerator_js_1 = require("./windowEnumerator.js");
const windowCapture_js_1 = require("./windowCapture.js");
const windowThumbnailBatch_js_1 = require("./windowThumbnailBatch.js");
const spatial_engine_js_1 = require("./spatial_engine.js");
const planWatcher_js_1 = require("./planWatcher.js");
const diffHandler_js_1 = require("./diffHandler.js");
const askCodeHandler_js_1 = require("./askCodeHandler.js");
const annotationStore_js_1 = require("./annotationStore.js");
const walkthroughEngine_js_1 = require("./walkthroughEngine.js");
const terminalWrite_js_1 = require("./terminalWrite.js");
// Initialize SQLite and mark orphaned sessions from previous crashes (D-17)
(0, historyStore_js_1.openDb)();
(0, historyStore_js_1.markOrphans)();
sweepScreenshotTempFiles();
// Pre-load strip-ansi ESM module so stripAnsiSync is ready before any request
(0, terminalBuffer_js_1.initStripAnsi)().catch(err => console.error('[sidecar] initStripAnsi failed:', err));
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
    if (req.method === 'GET' && req.url === '/active-window-rect') {
        (0, spatial_engine_js_1.getActiveWindowRect)().then(rect => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(rect));
        }).catch(err => {
            console.error('[sidecar] active-window-rect error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
        });
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
    // Parse URL for new routes that use query parameters
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/annotations') {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const cleaned = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
                const raw = JSON.parse(cleaned);
                const payload = annotationStore_js_1.AnnotationPayloadSchema.parse(raw);
                const current = annotationStore_js_1.annotationState.apply(payload);
                broadcastAnnotations(current);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, count: current.length }));
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: msg }));
            }
        });
        return;
    }
    if (req.method === 'POST' && url.pathname === '/walkthrough/start') {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const cleaned = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
                const raw = JSON.parse(cleaned);
                const walkthrough = walkthroughEngine_js_1.WalkthroughSchema.parse(raw);
                const result = walkthroughEngine_js_1.walkthroughEngine.start(walkthrough);
                broadcastWalkthroughStep(result);
                // Agent Runtime Phase 2: Set watcher pattern for first step
                if (sidecarFlags.conditionalAdvance) {
                    updateWalkthroughWatcherPattern();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            }
            catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
        });
        return;
    }
    if (req.method === 'POST' && url.pathname === '/walkthrough/advance') {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const result = walkthroughEngine_js_1.walkthroughEngine.advance();
                if ('done' in result) {
                    broadcastWalkthroughStep(null);
                    // Agent Runtime Phase 2: Clear watcher pattern on walkthrough complete
                    if (sidecarFlags.conditionalAdvance) {
                        updateWalkthroughWatcherPattern();
                    }
                }
                else {
                    broadcastWalkthroughStep(result);
                    // Agent Runtime Phase 2: Set watcher pattern for next step
                    if (sidecarFlags.conditionalAdvance) {
                        updateWalkthroughWatcherPattern();
                    }
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            }
            catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
        });
        return;
    }
    if (req.method === 'POST' && url.pathname === '/walkthrough/stop') {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                walkthroughEngine_js_1.walkthroughEngine.stop();
                broadcastWalkthroughStep(null);
                // Agent Runtime Phase 2: Clear watcher pattern on stop
                if (sidecarFlags.conditionalAdvance) {
                    updateWalkthroughWatcherPattern();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            }
            catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
        });
        return;
    }
    if (req.method === 'POST' && url.pathname === '/hook-event') {
        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                // Strip UTF-8 BOM if present (PowerShell Invoke-RestMethod may prepend it)
                const cleaned = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
                const raw = JSON.parse(cleaned);
                const hookType = (raw['hook_event_name'] ?? raw['type'] ?? raw['agent_action_name']);
                if (!hookType || typeof hookType !== 'string') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'type, hook_event_name, or agent_action_name required' }));
                    return;
                }
                let event;
                try {
                    event = (0, adapter_js_1.selectAdapter)(raw).normalize(raw);
                }
                catch {
                    event = (0, agentEvent_js_1.normalizeAgentEvent)(raw);
                }
                agentEvent_js_1.agentEventBuffer.push(event);
                broadcastAgentEvent(event);
                console.log(`[sidecar] hook-event received: type=${event.type} source=${event.tool}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            }
            catch (err) {
                console.error('[sidecar] hook-event error:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Invalid request: ${err instanceof Error ? err.message : String(err)}` }));
            }
        });
        return;
    }
    if (req.method === 'GET' && url.pathname === '/terminal-state') {
        const session = [...activeSessions.values()][0];
        if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No active session' }));
            return;
        }
        const n = Math.min(500, Math.max(1, parseInt(url.searchParams.get('lines') ?? '50', 10) || 50));
        const sinceParam = url.searchParams.get('since');
        const since = sinceParam !== null ? parseInt(sinceParam, 10) : undefined;
        const snapshot = session.terminalBuffer.getLines(n, since);
        const shouldScrub = url.searchParams.get('scrub') !== 'false';
        const lines = shouldScrub ? snapshot.lines.map(line => (0, secretScrubber_js_1.scrub)(line)) : snapshot.lines;
        if (shouldScrub) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Scrub-Warning': 'best-effort' });
            res.end(JSON.stringify({ lines, cursor: snapshot.cursor, warning: 'Secret scrubbing is best-effort. Do not rely on it as a security boundary.' }));
        }
        else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ lines, cursor: snapshot.cursor }));
        }
        return;
    }
    if (req.method === 'GET' && url.pathname === '/session-history') {
        const sessionIdParam = url.searchParams.get('sessionId') ?? '';
        const sessionId = parseInt(sessionIdParam, 10);
        if (isNaN(sessionId)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId required' }));
            return;
        }
        const lines = Math.min(500, Math.max(1, parseInt(url.searchParams.get('lines') ?? '100', 10) || 100));
        const chunks = (0, historyStore_js_1.getSessionChunks)(sessionId);
        const raw = chunks.map(c => c.data.toString('utf8')).join('');
        const cleaned = (0, terminalBuffer_js_1.stripAnsiSync)((0, terminalBuffer_js_1.crFold)(raw));
        const allLines = cleaned.split('\n').filter(l => l.trim() !== '');
        const result = allLines.slice(-lines);
        const shouldScrub = url.searchParams.get('scrub') !== 'false';
        const outputLines = shouldScrub ? result.map(line => (0, secretScrubber_js_1.scrub)(line)) : result;
        if (shouldScrub) {
            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Scrub-Warning': 'best-effort' });
            res.end(JSON.stringify({ lines: outputLines, sessionId, total: allLines.length, warning: 'Secret scrubbing is best-effort. Do not rely on it as a security boundary.' }));
        }
        else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ lines: outputLines, sessionId, total: allLines.length }));
        }
        return;
    }
    if (req.method === 'GET' && url.pathname === '/screenshot') {
        const session = [...activeSessions.values()][0];
        if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No active session' }));
            return;
        }
        const shouldBlur = url.searchParams.get('blur') !== 'false';
        const lineHeight = url.searchParams.has('lineHeight')
            ? parseInt(url.searchParams.get('lineHeight'), 10)
            : undefined;
        const topOffset = url.searchParams.has('topOffset')
            ? parseInt(url.searchParams.get('topOffset'), 10)
            : undefined;
        const opts = (lineHeight || topOffset)
            ? { lineHeight: lineHeight || undefined, topOffset: topOffset || undefined }
            : undefined;
        (0, screenshotSelf_js_1.captureSelfScreenshot)(session.terminalBuffer, shouldBlur, opts)
            .then(result => {
            if (!result.ok) {
                const status = result.error === 'SELF_NOT_FOUND' ? 404
                    : result.error === 'MINIMIZED' ? 409
                        : result.error === 'BLANK_CAPTURE' ? 502
                            : 500;
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: result.error }));
                return;
            }
            const headers = {
                'Content-Type': 'image/png',
                'Content-Length': String(result.buffer.length),
            };
            if (result.blurred) {
                headers['X-Blur-Warning'] = 'best-effort';
            }
            res.writeHead(200, headers);
            res.end(result.buffer);
        })
            .catch(err => {
            console.error('[sidecar] screenshot error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
        });
        return;
    }
    // Agent Runtime Phase 1: Terminal write endpoint (flag-gated)
    if (req.method === 'POST' && url.pathname === '/terminal-write') {
        (0, terminalWrite_js_1.handleTerminalWrite)(req, res, activeSessions, sidecarFlags);
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}
const httpServer = http.createServer(handleHttpRequest);
const wss = new ws_1.WebSocketServer({ server: httpServer });
annotationStore_js_1.annotationState._onExpire = () => {
    broadcastAnnotations(annotationStore_js_1.annotationState.getAll());
};
walkthroughEngine_js_1.walkthroughEngine.onAnnotationsChanged = (annotations) => {
    broadcastAnnotations(annotations);
};
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
const planWatchers = new Map();
// Sidecar-side feature flags (synced from frontend via 'set-flags' message)
const sidecarFlags = {
    outputBatching: true,
    autoTrust: false,
    planWatcher: true,
    terminalWriteMcp: false,
    conditionalAdvance: false,
};
function sendMsg(ws, msg) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
function broadcastAgentEvent(event) {
    for (const client of wss.clients) {
        sendMsg(client, { type: 'agent-event', event });
    }
}
function broadcastAnnotations(annotations) {
    for (const client of wss.clients) {
        sendMsg(client, { type: 'annotation-update', annotations });
    }
}
function broadcastWalkthroughStep(step) {
    for (const client of wss.clients) {
        sendMsg(client, { type: 'walkthrough-step', step });
    }
}
/** Agent Runtime Phase 2: Update watcher pattern on all active sessions */
function updateWalkthroughWatcherPattern() {
    const pattern = walkthroughEngine_js_1.walkthroughEngine.getCurrentAdvancePattern();
    for (const session of activeSessions.values()) {
        if (session instanceof batchedPtySession_js_1.BatchedPTYSession) {
            session.walkthroughWatcherInstance.setPattern(pattern);
        }
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
                    const session = new batchedPtySession_js_1.BatchedPTYSession(ws, shellExe, msg.cols ?? 80, msg.rows ?? 24, sidecarFlags.outputBatching ?? true);
                    activeSessions.set(ws, session);
                    console.log(`[sidecar] PTY session created successfully (batching=${sidecarFlags.outputBatching ?? true})`);
                    console.log(`[sidecar] session started: id=${session.sessionId}`);
                    sendMsg(ws, { type: 'session-start', sessionId: session.sessionId });
                    // Agent Runtime Phase 2: Wire walkthrough watcher to auto-advance
                    session.walkthroughWatcherInstance.onAdvance = () => {
                        try {
                            const result = walkthroughEngine_js_1.walkthroughEngine.advance();
                            if ('done' in result) {
                                broadcastWalkthroughStep(null);
                                session.walkthroughWatcherInstance.setPattern(null);
                            }
                            else {
                                broadcastWalkthroughStep(result);
                                // Set pattern for next step
                                session.walkthroughWatcherInstance.setPattern(walkthroughEngine_js_1.walkthroughEngine.getCurrentAdvancePattern());
                            }
                        }
                        catch (err) {
                            console.error('[sidecar] walkthrough watcher advance error:', err);
                        }
                    };
                    session.walkthroughWatcherEnabled = sidecarFlags.conditionalAdvance ?? false;
                    // Start PlanWatcher if flag is enabled (Phase 3)
                    if (sidecarFlags.planWatcher ?? true) {
                        const planWatcher = new planWatcher_js_1.PlanWatcher({
                            onPlanUpdate: (plan) => {
                                sendMsg(ws, {
                                    type: 'plan-update',
                                    fileName: plan?.fileName ?? null,
                                    content: plan?.content ?? null,
                                    mtime: plan?.mtime ?? 0,
                                });
                            },
                            enabled: true,
                        });
                        planWatcher.start(process.cwd());
                        planWatchers.set(ws, planWatcher);
                    }
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
                planWatchers.get(ws)?.stop();
                planWatchers.delete(ws);
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
                session.saveImage(msg.base64)
                    .then(filePath => {
                    sendMsg(ws, { type: 'save-image-result', path: filePath });
                })
                    .catch(err => {
                    sendMsg(ws, { type: 'error', message: `Failed to save image: ${err}` });
                });
                break;
            }
            case 'list-windows-with-thumbnails': {
                (0, windowThumbnailBatch_js_1.listWindowsWithThumbnails)()
                    .then(windows => {
                    sendMsg(ws, { type: 'window-thumbnails', windows });
                })
                    .catch(err => {
                    console.error('[sidecar] list-windows-with-thumbnails error:', err);
                    sendMsg(ws, { type: 'error', message: `Thumbnail batch failed: ${err}` });
                });
                break;
            }
            case 'capture-window-with-metadata': {
                console.log(`[sidecar] capture-window-with-metadata: hwnd=${msg.hwnd} pid=${msg.pid} title="${msg.title}"`);
                const result = (0, windowCapture_js_1.captureWindowByHwnd)(msg.hwnd, msg.pid, msg.title);
                if (result.ok) {
                    console.log(`[sidecar] capture-window-with-metadata success: ${result.data.path}`);
                    sendMsg(ws, {
                        type: 'capture-result-with-metadata',
                        path: result.data.path,
                        title: msg.title,
                        hwnd: msg.hwnd,
                        pid: msg.pid,
                        bounds: result.data.bounds,
                        captureSize: result.data.captureSize,
                        dpiScale: result.data.dpiScale,
                    });
                }
                else {
                    console.log(`[sidecar] capture-window-with-metadata failed: ${result.error}`);
                    sendMsg(ws, { type: 'error', message: `capture failed: ${result.error}` });
                }
                break;
            }
            case 'set-flags': {
                const flags = msg.flags;
                if (flags && typeof flags === 'object') {
                    Object.assign(sidecarFlags, flags);
                    console.log(`[sidecar] feature flags updated: ${JSON.stringify(sidecarFlags)}`);
                    // Live-update batching on active sessions
                    if ('outputBatching' in flags) {
                        for (const session of activeSessions.values()) {
                            if (session instanceof batchedPtySession_js_1.BatchedPTYSession) {
                                session.batchingEnabled = flags.outputBatching;
                            }
                        }
                    }
                    // Live-update autoTrust on active sessions
                    if ('autoTrust' in flags) {
                        for (const session of activeSessions.values()) {
                            if (session instanceof batchedPtySession_js_1.BatchedPTYSession) {
                                session.autoTrustEnabled = flags.autoTrust;
                            }
                        }
                    }
                    // Agent Runtime Phase 2: Live-update conditionalAdvance on active sessions
                    if ('conditionalAdvance' in flags) {
                        for (const session of activeSessions.values()) {
                            if (session instanceof batchedPtySession_js_1.BatchedPTYSession) {
                                session.walkthroughWatcherEnabled = flags.conditionalAdvance;
                                if (flags.conditionalAdvance) {
                                    // Set pattern for current step if walkthrough is active
                                    session.walkthroughWatcherInstance.setPattern(walkthroughEngine_js_1.walkthroughEngine.getCurrentAdvancePattern());
                                }
                                else {
                                    session.walkthroughWatcherInstance.setPattern(null);
                                }
                            }
                        }
                    }
                    // Live-update planWatcher (Phase 3)
                    if ('planWatcher' in flags) {
                        if (flags.planWatcher) {
                            // Turn ON: create watcher for any connected clients that don't have one
                            for (const client of wss.clients) {
                                if (!planWatchers.has(client)) {
                                    const planWatcher = new planWatcher_js_1.PlanWatcher({
                                        onPlanUpdate: (plan) => {
                                            sendMsg(client, {
                                                type: 'plan-update',
                                                fileName: plan?.fileName ?? null,
                                                content: plan?.content ?? null,
                                                mtime: plan?.mtime ?? 0,
                                            });
                                        },
                                        enabled: true,
                                    });
                                    planWatcher.start(process.cwd());
                                    planWatchers.set(client, planWatcher);
                                }
                            }
                        }
                        else {
                            // Turn OFF: stop all plan watchers
                            for (const [client, planWatcher] of planWatchers) {
                                planWatcher.stop();
                                planWatchers.delete(client);
                            }
                        }
                    }
                }
                break;
            }
            case 'plan-read': {
                const cwd = msg.cwd ?? process.cwd();
                const existingWatcher = planWatchers.get(ws);
                const result = existingWatcher
                    ? existingWatcher.readNow(cwd)
                    : new planWatcher_js_1.PlanWatcher({ onPlanUpdate: () => { } }).readNow(cwd);
                sendMsg(ws, {
                    type: 'plan-update',
                    fileName: result?.fileName ?? null,
                    content: result?.content ?? null,
                    mtime: result?.mtime ?? 0,
                });
                break;
            }
            case 'request-diff': {
                const cwd = msg.cwd ?? process.cwd();
                const { raw, error } = (0, diffHandler_js_1.execGitDiff)(cwd);
                sendMsg(ws, { type: 'diff-result', raw, cwd, error });
                break;
            }
            case 'ask-code': {
                const askMsg = msg;
                (0, askCodeHandler_js_1.askAboutCode)(ws, askMsg.requestId, askMsg.prompt, askMsg.cwd ?? process.cwd());
                break;
            }
            case 'cancel-ask-code': {
                const cancelMsg = msg;
                (0, askCodeHandler_js_1.cancelAskCode)(cancelMsg.requestId);
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
        planWatchers.get(ws)?.stop();
        planWatchers.delete(ws);
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
