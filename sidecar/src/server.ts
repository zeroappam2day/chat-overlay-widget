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
import { writeDiscoveryFile, deleteDiscoveryFile } from './discoveryFile.js';

// Initialize SQLite and mark orphaned sessions from previous crashes (D-17)
openDb();
markOrphans();
sweepScreenshotTempFiles();
console.log('[sidecar] SQLite session database initialized');

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
process.on('exit', () => {
  for (const session of activeSessions.values()) {
    session.destroy();
  }
  if (portFilePath) {
    deleteDiscoveryFile(portFilePath);
  }
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
