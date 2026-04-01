import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ClientMessage, ServerMessage, SessionMeta } from './protocol.js';
import { PTYSession, SCREENSHOT_DIR } from './ptySession.js';
import { detectShells } from './shellDetect.js';
import { openDb, markOrphans, listSessions, getSessionChunks } from './historyStore.js';
import { crFold, stripAnsiSync, initStripAnsi } from './terminalBuffer.js';
import { scrub } from './secretScrubber.js';
import { captureSelfScreenshot } from './screenshotSelf.js';
import { writeDiscoveryFile, deleteDiscoveryFile, cleanStaleDiscoveryFile } from './discoveryFile.js';
import { listWindows } from './windowEnumerator.js';
import { captureWindow, captureWindowWithMetadata, captureWindowByHwnd } from './windowCapture.js';
import { listWindowsWithThumbnails } from './windowThumbnailBatch.js';

// Initialize SQLite and mark orphaned sessions from previous crashes (D-17)
openDb();
markOrphans();
sweepScreenshotTempFiles();
// Pre-load strip-ansi ESM module so stripAnsiSync is ready before any request
initStripAnsi().catch(err => console.error('[sidecar] initStripAnsi failed:', err));
console.log('[sidecar] SQLite session database initialized');

// Clean any stale discovery file from a previous force-killed session
cleanStaleDiscoveryFile();

const authToken = crypto.randomBytes(32).toString('hex');
let portFilePath: string | null = null;

function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
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
      const windows = listWindows();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(windows));
    } catch (err) {
      console.error('[sidecar] list-windows error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Window enumeration failed' }));
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/capture/window') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { title?: unknown };
        const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
        if (!title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'title is required' }));
          return;
        }
        console.log(`[sidecar] capture/window requested: title="${title}"`);
        const result = captureWindow(title);
        if (result.ok) {
          console.log(`[sidecar] capture/window success: ${result.path}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ path: result.path }));
        } else {
          console.log(`[sidecar] capture/window failed: ${result.error}`);
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: result.error }));
        }
      } catch (err) {
        console.error('[sidecar] capture/window error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }
  // Parse URL for new routes that use query parameters
  const url = new URL(req.url!, 'http://localhost');

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
    const lines = shouldScrub ? snapshot.lines.map(line => scrub(line)) : snapshot.lines;
    if (shouldScrub) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Scrub-Warning': 'best-effort' });
      res.end(JSON.stringify({ lines, cursor: snapshot.cursor, warning: 'Secret scrubbing is best-effort. Do not rely on it as a security boundary.' }));
    } else {
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
    const chunks = getSessionChunks(sessionId);
    const raw = chunks.map(c => c.data.toString('utf8')).join('');
    const cleaned = stripAnsiSync(crFold(raw));
    const allLines = cleaned.split('\n').filter(l => l.trim() !== '');
    const result = allLines.slice(-lines);
    const shouldScrub = url.searchParams.get('scrub') !== 'false';
    const outputLines = shouldScrub ? result.map(line => scrub(line)) : result;
    if (shouldScrub) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Scrub-Warning': 'best-effort' });
      res.end(JSON.stringify({ lines: outputLines, sessionId, total: allLines.length, warning: 'Secret scrubbing is best-effort. Do not rely on it as a security boundary.' }));
    } else {
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
      ? parseInt(url.searchParams.get('lineHeight')!, 10)
      : undefined;
    const topOffset = url.searchParams.has('topOffset')
      ? parseInt(url.searchParams.get('topOffset')!, 10)
      : undefined;
    const opts = (lineHeight || topOffset)
      ? { lineHeight: lineHeight || undefined, topOffset: topOffset || undefined }
      : undefined;

    captureSelfScreenshot(session.terminalBuffer, shouldBlur, opts)
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

        const headers: Record<string, string> = {
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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

const httpServer = http.createServer(handleHttpRequest);
const wss = new WebSocketServer({ server: httpServer });

// Heartbeat: ping every 30s, terminate if no pong within 10s (Phase 5 hardening)
const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT = 10_000;
const aliveClients = new WeakMap<WebSocket, boolean>();

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
  const addr = httpServer.address() as { port: number };
  // PORT: prefix — Tauri Rust core reads this via CommandEvent::Stdout
  process.stdout.write(`PORT:${addr.port}\n`);
  console.log(`[sidecar] server listening on 127.0.0.1:${addr.port}`);
  console.log(`[sidecar] auth token generated (${authToken.length} chars)`);
  portFilePath = writeDiscoveryFile(addr.port, authToken);
});

const activeSessions = new Map<WebSocket, PTYSession>();

function sendMsg(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function sweepScreenshotTempFiles(): Promise<void> {
  try {
    const files = await fs.promises.readdir(SCREENSHOT_DIR);
    await Promise.all(
      files.map(f => fs.promises.unlink(path.join(SCREENSHOT_DIR, f)).catch(() => {}))
    );
    if (files.length > 0) {
      console.log(`[sidecar] swept ${files.length} orphan screenshot temp files`);
    }
  } catch {
    /* directory doesn't exist — that's fine */
  }
}

wss.on('connection', (ws: WebSocket) => {
  console.log('[sidecar] client connected');
  aliveClients.set(ws, true);
  ws.on('pong', () => { aliveClients.set(ws, true); });

  // Send available shells immediately on connection (D-01)
  const shells = detectShells();
  console.log(`[sidecar] detected shells: ${JSON.stringify(shells)}`);
  const shellListMsg = { type: 'shell-list' as const, shells: shells.map(s => s.name) };
  console.log(`[sidecar] sending shell-list: ${JSON.stringify(shellListMsg)}`);
  sendMsg(ws, shellListMsg);

  ws.on('message', (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
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
          const session = new PTYSession(ws, shellExe, msg.cols ?? 80, msg.rows ?? 24);
          activeSessions.set(ws, session);
          console.log(`[sidecar] PTY session created successfully`);
          console.log(`[sidecar] session started: id=${session.sessionId}`);
          sendMsg(ws, { type: 'session-start', sessionId: session.sessionId });
        } catch (err) {
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
        const rows = listSessions();
        const sessions: SessionMeta[] = rows.map(r => ({
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
        const chunks = getSessionChunks(msg.sessionId);
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
        listWindowsWithThumbnails()
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
        const result = captureWindowByHwnd(msg.hwnd, msg.pid, msg.title);
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
        } else {
          console.log(`[sidecar] capture-window-with-metadata failed: ${result.error}`);
          sendMsg(ws, { type: 'error', message: `capture failed: ${result.error}` });
        }
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
    deleteDiscoveryFile(portFilePath);
    portFilePath = null;
  }
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
