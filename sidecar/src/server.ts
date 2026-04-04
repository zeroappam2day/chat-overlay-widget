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

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ClientMessage, ServerMessage, SessionMeta } from './protocol.js';
import { PTYSession, SCREENSHOT_DIR } from './ptySession.js';
import { BatchedPTYSession } from './batchedPtySession.js';
import { detectShells } from './shellDetect.js';
import { openDb, markOrphans, listSessions, getSessionChunks } from './historyStore.js';
import { crFold, stripAnsiSync, initStripAnsi } from './terminalBuffer.js';
import { scrub } from './secretScrubber.js';
import { captureSelfScreenshot } from './screenshotSelf.js';
import { writeDiscoveryFile, deleteDiscoveryFile, cleanStaleDiscoveryFile } from './discoveryFile.js';
import { normalizeAgentEvent, agentEventBuffer } from './agentEvent.js';
import type { AgentEvent } from './agentEvent.js';
import { selectAdapter } from './adapters/adapter.js';
import { listWindows } from './windowEnumerator.js';
import { captureWindow, captureWindowWithMetadata, captureWindowByHwnd } from './windowCapture.js';
import { listWindowsWithThumbnails } from './windowThumbnailBatch.js';
import { getActiveWindowRect } from './spatial_engine.js';
import { PlanWatcher } from './planWatcher.js';
import { execGitDiff } from './diffHandler.js';
import { askAboutCode, cancelAskCode } from './askCodeHandler.js';
import { annotationState, AnnotationPayloadSchema } from './annotationStore.js';
import type { Annotation } from './annotationStore.js';
import { walkthroughEngine, WalkthroughSchema } from './walkthroughEngine.js';
import { handleTerminalWrite } from './terminalWrite.js';
import { MultiPtyManager } from './multiPtyManager.js';
import { getUiElements } from './uiAutomation.js';
import { ConsentManager } from './consentManager.js';

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
  if (req.method === 'GET' && req.url === '/active-window-rect') {
    getActiveWindowRect().then(rect => {
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

  if (req.method === 'POST' && url.pathname === '/annotations') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const cleaned = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
        const raw = JSON.parse(cleaned);
        const payload = AnnotationPayloadSchema.parse(raw);
        const current = annotationState.apply(payload);
        broadcastAnnotations(current);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: current.length }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/walkthrough/start') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const cleaned = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
        const raw = JSON.parse(cleaned);
        const walkthrough = WalkthroughSchema.parse(raw);
        const result = walkthroughEngine.start(walkthrough);
        broadcastWalkthroughStep(result);
        // Agent Runtime Phase 2: Set watcher pattern for first step
        if (sidecarFlags.conditionalAdvance) {
          updateWalkthroughWatcherPattern();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/walkthrough/advance') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const result = walkthroughEngine.advance();
        if ('done' in result) {
          broadcastWalkthroughStep(null);
          // Agent Runtime Phase 2: Clear watcher pattern on walkthrough complete
          if (sidecarFlags.conditionalAdvance) {
            updateWalkthroughWatcherPattern();
          }
        } else {
          broadcastWalkthroughStep(result);
          // Agent Runtime Phase 2: Set watcher pattern for next step
          if (sidecarFlags.conditionalAdvance) {
            updateWalkthroughWatcherPattern();
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/walkthrough/stop') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        walkthroughEngine.stop();
        broadcastWalkthroughStep(null);
        // Agent Runtime Phase 2: Clear watcher pattern on stop
        if (sidecarFlags.conditionalAdvance) {
          updateWalkthroughWatcherPattern();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/hook-event') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        // Strip UTF-8 BOM if present (PowerShell Invoke-RestMethod may prepend it)
        const cleaned = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
        const raw = JSON.parse(cleaned) as Record<string, unknown>;
        const hookType = (raw['hook_event_name'] ?? raw['type'] ?? raw['agent_action_name']) as string | undefined;
        if (!hookType || typeof hookType !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'type, hook_event_name, or agent_action_name required' }));
          return;
        }
        let event: AgentEvent;
        try {
          event = selectAdapter(raw).normalize(raw);
        } catch {
          event = normalizeAgentEvent(raw);
        }
        agentEventBuffer.push(event);
        broadcastAgentEvent(event);
        console.log(`[sidecar] hook-event received: type=${event.type} source=${event.tool}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        console.error('[sidecar] hook-event error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Invalid request: ${err instanceof Error ? err.message : String(err)}` }));
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/terminal-state') {
    const paneIdParam = url.searchParams.get('paneId') ?? undefined;
    const session = getSessionByPaneId(paneIdParam);
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
    const session = getAnySession();
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

  // Agent Runtime Phase 1: Terminal write endpoint (flag-gated)
  if (req.method === 'POST' && url.pathname === '/terminal-write') {
    handleTerminalWrite(req, res, activeSessions, sidecarFlags, multiPtyManager);
    return;
  }

  // Agent Runtime Phase 4: UI Accessibility Tree endpoint (flag-gated)
  if (req.method === 'GET' && url.pathname === '/ui-elements') {
    if (!sidecarFlags.uiAccessibility) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UI accessibility tool is disabled. Enable the uiAccessibility feature flag.' }));
      return;
    }
    try {
      const hwndParam = url.searchParams.get('hwnd');
      const titleParam = url.searchParams.get('title');
      const maxDepth = Math.min(5, Math.max(1, parseInt(url.searchParams.get('maxDepth') ?? '3', 10) || 3));
      const roleFilterParam = url.searchParams.get('roleFilter');
      const roleFilter = roleFilterParam ? roleFilterParam.split(',').map(s => s.trim()).filter(Boolean) : undefined;

      let hwnd: number;
      if (hwndParam) {
        hwnd = parseInt(hwndParam, 10);
        if (isNaN(hwnd) || hwnd <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid hwnd parameter' }));
          return;
        }
      } else if (titleParam) {
        // Find window by title match
        const windows = listWindows();
        const match = windows.find(w => w.title.toLowerCase().includes(titleParam.toLowerCase()));
        if (!match) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `No window found matching title: ${titleParam}` }));
          return;
        }
        hwnd = match.hwnd;
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Either hwnd or title parameter is required' }));
        return;
      }

      const elements = getUiElements(hwnd, { maxDepth, roleFilter });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(elements));
    } catch (err) {
      console.error('[sidecar] ui-elements error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  // Agent Runtime Phase 6: Consent request endpoint (flag-gated)
  if (req.method === 'POST' && url.pathname === '/consent/request') {
    if (!sidecarFlags.consentGate) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Consent gate is disabled. Enable the consentGate feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { action?: { type?: string; description?: string; coordinates?: { x: number; y: number }; target?: string } };
        if (!parsed.action || !parsed.action.type || !parsed.action.description) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'action.type and action.description are required' }));
          return;
        }
        consentManager.requestConsent(parsed.action as { type: string; description: string; coordinates?: { x: number; y: number }; target?: string })
          .then((approved) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ approved }));
          })
          .catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

const httpServer = http.createServer(handleHttpRequest);
const wss = new WebSocketServer({ server: httpServer });

annotationState._onExpire = () => {
  broadcastAnnotations(annotationState.getAll());
};

walkthroughEngine.onAnnotationsChanged = (annotations) => {
  broadcastAnnotations(annotations);
};

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

const activeSessions = new Map<WebSocket, PTYSession | BatchedPTYSession>();
const multiPtyManager = new MultiPtyManager({ maxSessionsPerClient: 4 });
const consentManager = new ConsentManager();
const planWatchers = new Map<WebSocket, PlanWatcher>();

// Sidecar-side feature flags (synced from frontend via 'set-flags' message)
const sidecarFlags: Record<string, boolean> = {
  outputBatching: true,
  autoTrust: false,
  planWatcher: true,
  terminalWriteMcp: false,
  conditionalAdvance: false,
  multiPty: false,
  uiAccessibility: false,
  consentGate: false,
};

function sendMsg(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastAgentEvent(event: AgentEvent): void {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'agent-event', event });
  }
}

function broadcastAnnotations(annotations: Annotation[]): void {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'annotation-update', annotations });
  }
}

function broadcastWalkthroughStep(step: { stepId: string; title: string; instruction: string; currentStep: number; totalSteps: number } | null): void {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'walkthrough-step', step });
  }
}

// Agent Runtime Phase 6: Wire consent manager broadcast to WebSocket clients
consentManager.broadcastConsentRequest = (request) => {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'consent-request', requestId: request.requestId, action: request.action });
  }
};

/** Agent Runtime Phase 2: Update watcher pattern on all active sessions */
function updateWalkthroughWatcherPattern(): void {
  const pattern = walkthroughEngine.getCurrentAdvancePattern();
  const sessions = sidecarFlags.multiPty
    ? multiPtyManager.allSessions()
    : activeSessions.values();
  for (const session of sessions) {
    if (session instanceof BatchedPTYSession) {
      session.walkthroughWatcherInstance.setPattern(pattern);
    }
  }
}

/** Get any first session across connection modes (for HTTP endpoints that don't specify paneId). */
function getAnySession(): (PTYSession | BatchedPTYSession) | undefined {
  if (sidecarFlags.multiPty) {
    return multiPtyManager.allSessions().next().value;
  }
  return [...activeSessions.values()][0];
}

/** Get a session by paneId (multiPty) or fall back to first session. */
function getSessionByPaneId(paneId?: string): (PTYSession | BatchedPTYSession) | undefined {
  if (sidecarFlags.multiPty && paneId) {
    return multiPtyManager.findSessionByPaneId(paneId);
  }
  return getAnySession();
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
        const spawnPaneId = (msg as { paneId?: string }).paneId;
        console.log(`[sidecar] spawn requested: shell=${msg.shell}, cols=${msg.cols}, rows=${msg.rows}, paneId=${spawnPaneId ?? '(none)'}`);

        if (sidecarFlags.multiPty && spawnPaneId) {
          // Agent Runtime Phase 3: Multi-PTY mode — destroy only the session for this paneId
          const existingMulti = multiPtyManager.getSession(ws, spawnPaneId);
          if (existingMulti) {
            console.log(`[sidecar] multiPty: destroying existing session for pane ${spawnPaneId}`);
            existingMulti.destroy();
            multiPtyManager.removeSession(ws, spawnPaneId);
          }
        } else {
          // Legacy mode: destroy existing session if any
          const existing = activeSessions.get(ws);
          if (existing) {
            console.log('[sidecar] destroying existing session');
            existing.destroy();
            activeSessions.delete(ws);
          }
        }

        // Find shell executable from detected shells
        const shellInfo = shells.find(s => s.name === msg.shell);
        const shellExe = shellInfo?.exe ?? msg.shell;
        console.log(`[sidecar] resolved shell exe: ${shellExe}`);
        try {
          const session = new BatchedPTYSession(ws, shellExe, msg.cols ?? 80, msg.rows ?? 24, sidecarFlags.outputBatching ?? true, sidecarFlags.multiPty ? spawnPaneId : undefined);

          if (sidecarFlags.multiPty && spawnPaneId) {
            const ok = multiPtyManager.setSession(ws, spawnPaneId, session);
            if (!ok) {
              session.destroy();
              sendMsg(ws, { type: 'error', message: 'Maximum PTY sessions reached (4)' });
              break;
            }
          } else {
            activeSessions.set(ws, session);
          }

          console.log(`[sidecar] PTY session created successfully (batching=${sidecarFlags.outputBatching ?? true})`);
          console.log(`[sidecar] session started: id=${session.sessionId}`);
          sendMsg(ws, { type: 'session-start', sessionId: session.sessionId, ...(spawnPaneId ? { paneId: spawnPaneId } : {}) });
          // Agent Runtime Phase 2: Wire walkthrough watcher to auto-advance
          session.walkthroughWatcherInstance.onAdvance = () => {
            try {
              const result = walkthroughEngine.advance();
              if ('done' in result) {
                broadcastWalkthroughStep(null);
                session.walkthroughWatcherInstance.setPattern(null);
              } else {
                broadcastWalkthroughStep(result);
                // Set pattern for next step
                session.walkthroughWatcherInstance.setPattern(walkthroughEngine.getCurrentAdvancePattern());
              }
            } catch (err) {
              console.error('[sidecar] walkthrough watcher advance error:', err);
            }
          };
          session.walkthroughWatcherEnabled = sidecarFlags.conditionalAdvance ?? false;
          // Start PlanWatcher if flag is enabled (Phase 3)
          if (sidecarFlags.planWatcher ?? true) {
            const planWatcher = new PlanWatcher({
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
        } catch (err) {
          console.error(`[sidecar] PTY spawn failed: ${err}`);
          sendMsg(ws, { type: 'error', message: `Failed to spawn shell: ${err}` });
        }
        break;
      }
      case 'input': {
        const inputPaneId = (msg as { paneId?: string }).paneId;
        if (sidecarFlags.multiPty && inputPaneId) {
          const session = multiPtyManager.getSession(ws, inputPaneId);
          session?.write(msg.data);
        } else {
          const session = activeSessions.get(ws);
          session?.write(msg.data);
        }
        break;
      }
      case 'resize': {
        const resizePaneId = (msg as { paneId?: string }).paneId;
        if (sidecarFlags.multiPty && resizePaneId) {
          const session = multiPtyManager.getSession(ws, resizePaneId);
          session?.resize(msg.cols, msg.rows);
        } else {
          const session = activeSessions.get(ws);
          session?.resize(msg.cols, msg.rows);
        }
        break;
      }
      case 'kill': {
        const killPaneId = (msg as { paneId?: string }).paneId;
        if (sidecarFlags.multiPty && killPaneId) {
          const session = multiPtyManager.removeSession(ws, killPaneId);
          if (session) {
            session.destroy();
          }
        } else {
          const session = activeSessions.get(ws);
          if (session) {
            session.destroy();
            activeSessions.delete(ws);
          }
        }
        planWatchers.get(ws)?.stop();
        planWatchers.delete(ws);
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
      case 'set-flags': {
        const flags = (msg as unknown as { type: 'set-flags'; flags: Record<string, boolean> }).flags;
        if (flags && typeof flags === 'object') {
          Object.assign(sidecarFlags, flags);
          console.log(`[sidecar] feature flags updated: ${JSON.stringify(sidecarFlags)}`);
          // Helper: iterate all active sessions (legacy + multiPty)
          const iterAllSessions = function* () {
            yield* activeSessions.values();
            yield* multiPtyManager.allSessions();
          };
          // Live-update batching on active sessions
          if ('outputBatching' in flags) {
            for (const session of iterAllSessions()) {
              if (session instanceof BatchedPTYSession) {
                session.batchingEnabled = flags.outputBatching;
              }
            }
          }
          // Live-update autoTrust on active sessions
          if ('autoTrust' in flags) {
            for (const session of iterAllSessions()) {
              if (session instanceof BatchedPTYSession) {
                session.autoTrustEnabled = flags.autoTrust;
              }
            }
          }
          // Agent Runtime Phase 2: Live-update conditionalAdvance on active sessions
          if ('conditionalAdvance' in flags) {
            for (const session of iterAllSessions()) {
              if (session instanceof BatchedPTYSession) {
                session.walkthroughWatcherEnabled = flags.conditionalAdvance;
                if (flags.conditionalAdvance) {
                  // Set pattern for current step if walkthrough is active
                  session.walkthroughWatcherInstance.setPattern(walkthroughEngine.getCurrentAdvancePattern());
                } else {
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
                  const planWatcher = new PlanWatcher({
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
            } else {
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
        const cwd = (msg as { type: 'plan-read'; cwd?: string }).cwd ?? process.cwd();
        const existingWatcher = planWatchers.get(ws);
        const result = existingWatcher
          ? existingWatcher.readNow(cwd)
          : new PlanWatcher({ onPlanUpdate: () => { /* one-shot */ } }).readNow(cwd);
        sendMsg(ws, {
          type: 'plan-update',
          fileName: result?.fileName ?? null,
          content: result?.content ?? null,
          mtime: result?.mtime ?? 0,
        });
        break;
      }
      case 'request-diff': {
        const cwd = (msg as { type: 'request-diff'; cwd?: string }).cwd ?? process.cwd();
        const { raw, error } = execGitDiff(cwd);
        sendMsg(ws, { type: 'diff-result', raw, cwd, error });
        break;
      }
      case 'ask-code': {
        const askMsg = msg as { type: 'ask-code'; requestId: string; prompt: string; cwd?: string };
        askAboutCode(ws, askMsg.requestId, askMsg.prompt, askMsg.cwd ?? process.cwd());
        break;
      }
      case 'cancel-ask-code': {
        const cancelMsg = msg as { type: 'cancel-ask-code'; requestId: string };
        cancelAskCode(cancelMsg.requestId);
        break;
      }
      // Agent Runtime Phase 6: Handle consent response from frontend
      case 'consent-response': {
        const consentMsg = msg as { type: 'consent-response'; requestId: string; approved: boolean };
        consentManager.handleResponse(consentMsg.requestId, consentMsg.approved);
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log('[sidecar] client disconnected');
    // Cleanup legacy single-session
    const session = activeSessions.get(ws);
    if (session) {
      session.destroy();
      activeSessions.delete(ws);
    }
    // Agent Runtime Phase 3: Cleanup multiPty sessions
    multiPtyManager.destroyAll(ws);
    // Agent Runtime Phase 6: Auto-deny pending consent requests on disconnect
    consentManager.denyAll();
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
  // Agent Runtime Phase 3: Cleanup multiPty sessions on exit
  for (const client of wss.clients) {
    multiPtyManager.destroyAll(client as WebSocket);
  }
  if (portFilePath) {
    deleteDiscoveryFile(portFilePath);
    portFilePath = null;
  }
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
