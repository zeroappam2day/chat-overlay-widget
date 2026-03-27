import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { PTYSession } from './ptySession.js';
import { detectShells } from './shellDetect.js';
import { openDb, markOrphans } from './historyStore.js';

// Initialize SQLite and mark orphaned sessions from previous crashes (D-17)
openDb();
markOrphans();
console.log('[sidecar] SQLite session database initialized');

const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });

wss.on('listening', () => {
  const addr = wss.address() as { port: number };
  // PORT: prefix — Tauri Rust core reads this via CommandEvent::Stdout
  process.stdout.write(`PORT:${addr.port}\n`);
  console.log(`[sidecar] WebSocket server listening on 127.0.0.1:${addr.port}`);
});

const activeSessions = new Map<WebSocket, PTYSession>();

function sendMsg(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on('connection', (ws: WebSocket) => {
  console.log('[sidecar] client connected');

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

// Cleanup all PTY sessions on sidecar exit (D-08)
process.on('exit', () => {
  for (const session of activeSessions.values()) {
    session.destroy();
  }
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
