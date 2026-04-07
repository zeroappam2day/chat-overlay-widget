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
import { WebFetcher } from './webFetcher.js';
import { BatchConsentManager } from './batchConsentManager.js';
import type { ActionPlan } from './batchConsentManager.js';
import { focusAndVerify } from './windowFocusManager.js';
import { readClipboard, writeClipboard, pasteFromClipboard } from './clipboardManager.js';
import { TaskOrchestrator } from './taskOrchestrator.js';
import type { AgentTask } from './taskOrchestrator.js';
import { ScreenshotVerifier } from './screenshotVerifier.js';
import { searchElements, invokeElement, setElementValue, getElementPatterns } from './enhancedAccessibility.js';
import { WorkflowRecorder } from './workflowRecorder.js';
import { ModeManager } from './modeManager.js';
import { ActionCoordinator } from './actionCoordinator.js';
import { skillDiscoveryBridge } from './skillDiscoveryBridge.js';
import { streamOllamaChat, cancelOllamaChat, checkOllamaHealth } from './pmChat.js';

// Initialize SQLite and mark orphaned sessions from previous crashes (D-17)
openDb();
markOrphans();
sweepScreenshotTempFiles();
// Pre-load strip-ansi ESM module so stripAnsiSync is ready before any request
initStripAnsi().catch(err => console.error('[sidecar] initStripAnsi failed:', err));
console.log('[sidecar] SQLite session database initialized');

// Clean any stale discovery file from a previous force-killed session
cleanStaleDiscoveryFile();

// Web fetcher instance (EAC-5)
const webFetcher = new WebFetcher();

// EAC-9: Workflow recorder instance
import * as os from 'node:os';
const workflowStorageDir = path.join(process.env.APPDATA || os.homedir(), 'chat-overlay-widget', 'workflows');
const workflowRecorder = new WorkflowRecorder({ storageDir: workflowStorageDir });

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
    if (!sidecarFlags.externalWindowCapture) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'External window capture is disabled. Enable the externalWindowCapture feature flag.' }));
      return;
    }
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
    if (!sidecarFlags.externalWindowCapture) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'External window capture is disabled. Enable the externalWindowCapture feature flag.' }));
      return;
    }
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

  if (req.method === 'POST' && url.pathname === '/walkthrough/modify') {
    if (!sidecarFlags.guidedWalkthrough) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'guidedWalkthrough flag is disabled' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const cleaned = body.charCodeAt(0) === 0xFEFF ? body.slice(1) : body;
        const parsed = JSON.parse(cleaned) as { action?: string; steps?: unknown[]; step?: unknown };
        const { action, steps, step } = parsed;
        let result: unknown;

        switch (action) {
          case 'append_steps': {
            if (!Array.isArray(steps)) throw new Error('steps array is required for append_steps');
            result = walkthroughEngine.appendSteps(steps as any);
            break;
          }
          case 'replace_current_step': {
            if (!step || typeof step !== 'object') throw new Error('step object is required for replace_current_step');
            result = walkthroughEngine.replaceCurrentStep(step as any);
            // Broadcast updated step to UI
            const stepResult = result as { stepId: string; title: string; instruction: string; totalSteps: number; currentStep: number };
            broadcastWalkthroughStep(stepResult);
            // Update watcher pattern for the replaced step
            if (sidecarFlags.conditionalAdvance) {
              updateWalkthroughWatcherPattern();
            }
            break;
          }
          case 'update_remaining_steps': {
            if (!Array.isArray(steps)) throw new Error('steps array is required for update_remaining_steps');
            result = walkthroughEngine.updateRemainingSteps(steps as any);
            // Update watcher pattern since remaining steps changed
            if (sidecarFlags.conditionalAdvance) {
              updateWalkthroughWatcherPattern();
            }
            break;
          }
          default:
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown action: ${action}. Use append_steps, replace_current_step, or update_remaining_steps.` }));
            return;
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

  // Agent Runtime Phase 1: Terminal write endpoint (flag-gated)
  if (req.method === 'POST' && url.pathname === '/terminal-write') {
    handleTerminalWrite(req, res, activeSessions, sidecarFlags);
    return;
  }

  // EAC-5: Web fetch endpoint (flag-gated)
  if (req.method === 'POST' && url.pathname === '/web-fetch') {
    if (!sidecarFlags.webFetchTool) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Web fetch tool is disabled. Enable the webFetchTool feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { url?: string; extractText?: boolean };
        const fetchUrl = typeof parsed.url === 'string' ? parsed.url.trim() : '';
        if (!fetchUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'url is required' }));
          return;
        }
        webFetcher.fetch(fetchUrl, { extractText: parsed.extractText ?? true })
          .then(result => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          })
          .catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(err) }));
          });
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // EAC-2: Batch Consent — Submit action plan
  if (req.method === 'POST' && url.pathname === '/consent/submit-plan') {
    if (!sidecarFlags.batchConsent) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Batch consent is disabled. Enable the batchConsent feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const plan = JSON.parse(body) as ActionPlan;
        const result = await batchConsentMgr.submitPlan(plan);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  // EAC-2: Batch Consent — Grant time-limited trust
  if (req.method === 'POST' && url.pathname === '/consent/grant-trust') {
    if (!sidecarFlags.batchConsent) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Batch consent is disabled. Enable the batchConsent feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const opts = JSON.parse(body) as { targetTitle: string; durationSec: number; allowedActions: string[] };
        const trustId = batchConsentMgr.grantTimeLimitedTrust(opts);
        if (!trustId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid duration. Must be 1-120 seconds.' }));
          return;
        }
        const grant = batchConsentMgr.isTrusted(opts.targetTitle, opts.allowedActions[0]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ approved: true, trustId, expiresAt: Date.now() + opts.durationSec * 1000 }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  // EAC-2: Batch Consent — Revoke trust or plan
  if (req.method === 'POST' && url.pathname === '/consent/revoke') {
    if (!sidecarFlags.batchConsent) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Batch consent is disabled. Enable the batchConsent feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { trustId?: string; all?: boolean };
        if (parsed.all) {
          batchConsentMgr.revokeAll();
        } else if (parsed.trustId) {
          batchConsentMgr.revokeTrust(parsed.trustId);
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

  // EAC-3: Window Focus Manager endpoint (flag-gated)
  if (req.method === 'POST' && url.pathname === '/focus-window') {
    if (!sidecarFlags.windowFocusManager) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Window focus manager is disabled. Enable the windowFocusManager feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { hwnd?: unknown; title?: unknown };
        let targetHwnd: number | undefined;

        if (typeof parsed.hwnd === 'number' && parsed.hwnd > 0) {
          targetHwnd = parsed.hwnd;
        } else if (typeof parsed.title === 'string' && parsed.title.trim()) {
          // Look up hwnd by window title via windowEnumerator
          const windows = listWindows();
          const match = windows.find(w => w.title.toLowerCase().includes((parsed.title as string).toLowerCase()));
          if (!match) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `No window found matching title: ${parsed.title}` }));
            return;
          }
          targetHwnd = match.hwnd;
        }

        if (!targetHwnd) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'hwnd (number) or title (string) required' }));
          return;
        }

        focusAndVerify(targetHwnd).then((result) => {
          if (result.ok) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, hwnd: targetHwnd }));
          } else {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: result.error, hwnd: targetHwnd }));
          }
        }).catch((err: unknown) => {
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

  // EAC-4: Clipboard read endpoint (flag-gated)
  if (req.method === 'GET' && url.pathname === '/clipboard') {
    if (!sidecarFlags.clipboardAccess) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Clipboard access is disabled. Enable the clipboardAccess feature flag.' }));
      return;
    }
    try {
      const result = readClipboard();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[sidecar] clipboard read error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Clipboard read failed' }));
    }
    return;
  }

  // EAC-4: Clipboard write endpoint (flag-gated)
  if (req.method === 'POST' && url.pathname === '/clipboard') {
    if (!sidecarFlags.clipboardAccess) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Clipboard access is disabled. Enable the clipboardAccess feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { text?: unknown };
        const text = typeof parsed.text === 'string' ? parsed.text : '';
        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'text is required' }));
          return;
        }
        const result = writeClipboard(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('[sidecar] clipboard write error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Clipboard write failed' }));
      }
    });
    return;
  }

  // EAC-4: Clipboard paste endpoint (flag-gated: clipboardAccess + osInputSimulation + consentGate)
  if (req.method === 'POST' && url.pathname === '/clipboard/paste') {
    if (!sidecarFlags.clipboardAccess) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Clipboard access is disabled. Enable the clipboardAccess feature flag.' }));
      return;
    }
    if (!sidecarFlags.osInputSimulation) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OS input simulation is disabled. Enable the osInputSimulation feature flag.' }));
      return;
    }
    if (!sidecarFlags.consentGate) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Consent gate is disabled. Enable the consentGate feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body) as { text?: unknown; clearAfterPaste?: unknown };
        const text = typeof parsed.text === 'string' ? parsed.text : '';
        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'text is required' }));
          return;
        }
        const clearAfterPaste = parsed.clearAfterPaste === true;
        pasteFromClipboard(text, clearAfterPaste).then(result => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }).catch(err => {
          console.error('[sidecar] clipboard paste error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Clipboard paste failed' }));
        });
      } catch (err) {
        console.error('[sidecar] clipboard paste error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Clipboard paste failed' }));
      }
    });
    return;
  }

  // EAC-6: Task Orchestrator endpoints
  if (req.method === 'POST' && url.pathname === '/tasks/submit') {
    if (!sidecarFlags.agentTaskOrchestrator) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent Task Orchestrator is disabled' }));
      return;
    }
    if (!sidecarFlags.multiPty || !sidecarFlags.terminalWriteMcp) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Requires multiPty and terminalWriteMcp flags' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const result = taskOrchestrator.submitTask({
          name: parsed.name,
          command: parsed.command,
          paneId: parsed.paneId ?? 'default',
          exitPattern: parsed.exitPattern,
          failPattern: parsed.failPattern,
          timeoutMs: parsed.timeoutMs,
        });
        if ('error' in result) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: result.error }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Invalid request: ${err instanceof Error ? err.message : String(err)}` }));
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tasks') {
    if (!sidecarFlags.agentTaskOrchestrator) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent Task Orchestrator is disabled' }));
      return;
    }
    const tasks = taskOrchestrator.getAllTasks();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tasks }));
    return;
  }

  if (url.pathname.startsWith('/tasks/') && url.pathname !== '/tasks/submit') {
    if (!sidecarFlags.agentTaskOrchestrator) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent Task Orchestrator is disabled' }));
      return;
    }
    const parts = url.pathname.split('/');
    // /tasks/:taskId or /tasks/:taskId/cancel
    const taskId = parts[2];

    if (req.method === 'GET' && parts.length === 3 && taskId) {
      const task = taskOrchestrator.getTask(taskId);
      if (!task) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Task not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(task));
      return;
    }

    if (req.method === 'POST' && parts.length === 4 && parts[3] === 'cancel' && taskId) {
      taskOrchestrator.cancelTask(taskId).then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }
  }

  // EAC-7: Screenshot-based step verification endpoint
  if (req.method === 'POST' && url.pathname === '/walkthrough/verify-step') {
    if (!sidecarFlags.screenshotVerification) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'screenshotVerification flag is disabled' }));
      return;
    }
    if (!sidecarFlags.guidedWalkthrough) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'guidedWalkthrough flag is disabled' }));
      return;
    }
    const status = walkthroughEngine.getStatus();
    if (!status.active) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No active walkthrough' }));
      return;
    }
    // Get current step's advanceWhen
    const currentStep = (walkthroughEngine as any).active?.walkthrough.steps[(walkthroughEngine as any).active.currentIndex];
    if (!currentStep?.advanceWhen) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ passed: false, details: 'No advanceWhen defined for current step' }));
      return;
    }
    const advanceWhen = currentStep.advanceWhen;
    const session = [...activeSessions.values()][0];

    if (advanceWhen.type === 'terminal-match') {
      // Terminal match — check against terminal buffer
      if (!session) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ passed: false, details: 'No active terminal session' }));
        return;
      }
      try {
        const pattern = new RegExp(advanceWhen.pattern);
        const snapshot = session.terminalBuffer.getLines(100);
        const matched = snapshot.lines.some((line: string) => pattern.test(line));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ passed: matched, strategy: 'terminal-match', details: { pattern: advanceWhen.pattern } }));
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ passed: false, strategy: 'terminal-match', details: { error: String(err) } }));
      }
      return;
    }

    if (advanceWhen.type === 'pixel-sample') {
      const verifier = new ScreenshotVerifier({
        screenshotFn: async () => {
          const result = await captureSelfScreenshot(session!.terminalBuffer, false);
          if (!result.ok) throw new Error(result.error);
          return result.buffer;
        },
      });
      verifier.verifyPixelSample({ regions: advanceWhen.regions }).then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ passed: result.passed, strategy: 'pixel-sample', details: result }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      });
      return;
    }

    if (advanceWhen.type === 'screenshot-diff') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ passed: false, strategy: 'screenshot-diff', details: 'screenshot-diff requires a reference screenshot passed at runtime' }));
      return;
    }

    if (advanceWhen.type === 'manual') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ passed: false, strategy: 'manual', details: 'Manual verification — advance manually' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ passed: false, details: `Unknown advanceWhen type: ${(advanceWhen as any).type}` }));
    return;
  }

  // EAC-8: Enhanced Accessibility Bridge endpoints
  if (req.method === 'POST' && url.pathname === '/ui-elements/search') {
    if (!sidecarFlags.enhancedAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'enhancedAccessibility flag is disabled' })); return; }
    if (!sidecarFlags.uiAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'uiAccessibility flag is disabled' })); return; }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        searchElements(parsed).then(elements => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ elements }));
        }).catch(err => {
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

  if (req.method === 'POST' && url.pathname === '/ui-elements/invoke') {
    if (!sidecarFlags.enhancedAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'enhancedAccessibility flag is disabled' })); return; }
    if (!sidecarFlags.uiAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'uiAccessibility flag is disabled' })); return; }
    if (!sidecarFlags.consentGate) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'consentGate flag is disabled' })); return; }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        invokeElement(parsed).then(result => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }).catch(err => {
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

  if (req.method === 'POST' && url.pathname === '/ui-elements/set-value') {
    if (!sidecarFlags.enhancedAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'enhancedAccessibility flag is disabled' })); return; }
    if (!sidecarFlags.uiAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'uiAccessibility flag is disabled' })); return; }
    if (!sidecarFlags.consentGate) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'consentGate flag is disabled' })); return; }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        setElementValue(parsed).then(result => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }).catch(err => {
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

  if (req.method === 'GET' && url.pathname === '/ui-elements/patterns') {
    if (!sidecarFlags.enhancedAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'enhancedAccessibility flag is disabled' })); return; }
    if (!sidecarFlags.uiAccessibility) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'uiAccessibility flag is disabled' })); return; }
    const hwnd = parseInt(url.searchParams.get('hwnd') ?? '0', 10);
    const automationId = url.searchParams.get('automationId') ?? undefined;
    const name = url.searchParams.get('name') ?? undefined;
    if (!hwnd) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'hwnd is required' })); return; }
    getElementPatterns({ hwnd, automationId, name }).then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    });
    return;
  }

  // ─── EAC-9: Workflow Recording & Replay endpoints ────────────────────────────

  if (req.method === 'POST' && url.pathname === '/workflows/start-recording') {
    if (!sidecarFlags.workflowRecording) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workflow recording is disabled. Enable the workflowRecording feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { name, description } = JSON.parse(body) as { name: string; description: string };
        const workflowId = workflowRecorder.startRecording(name, description);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ workflowId, recording: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/workflows/add-step') {
    if (!sidecarFlags.workflowRecording) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workflow recording is disabled. Enable the workflowRecording feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const step = JSON.parse(body);
        workflowRecorder.addStep(step);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stepCount: workflowRecorder.stepCount }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/workflows/stop-recording') {
    if (!sidecarFlags.workflowRecording) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workflow recording is disabled. Enable the workflowRecording feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const workflow = workflowRecorder.stopRecording();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(workflow));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/workflows') {
    if (!sidecarFlags.workflowRecording) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workflow recording is disabled. Enable the workflowRecording feature flag.' }));
      return;
    }
    const list = workflowRecorder.listWorkflows();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // Workflow by ID routes: GET /workflows/:id, DELETE /workflows/:id, POST /workflows/:id/replay
  if (url.pathname.startsWith('/workflows/')) {
    if (!sidecarFlags.workflowRecording) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workflow recording is disabled. Enable the workflowRecording feature flag.' }));
      return;
    }
    const parts = url.pathname.split('/').filter(Boolean); // ['workflows', id, maybe 'replay']
    const workflowId = parts[1];

    if (req.method === 'GET' && parts.length === 2 && workflowId) {
      const workflow = workflowRecorder.getWorkflow(workflowId);
      if (!workflow) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Workflow not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(workflow));
      return;
    }

    if (req.method === 'DELETE' && parts.length === 2 && workflowId) {
      const deleted = workflowRecorder.deleteWorkflow(workflowId);
      if (!deleted) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Workflow not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && parts.length === 3 && parts[2] === 'replay' && workflowId) {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const opts = body ? JSON.parse(body) : {};
          const results: Array<{ stepIndex: number; tool: string; status: string; error?: string }> = [];
          for await (const y of workflowRecorder.replayWorkflow(workflowId, opts)) {
            if (y.status === 'completed' || y.status === 'failed') {
              results.push({
                stepIndex: y.step.stepIndex,
                tool: y.step.tool,
                status: y.status,
                ...(y.error ? { error: y.error } : {}),
              });
            }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ workflowId, results }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }
  }

  // Action Coordinator — announce an intended action before executing
  if (req.method === 'POST' && url.pathname === '/action/announce') {
    if (!sidecarFlags.batchConsent) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Action coordination is disabled. Enable the batchConsent feature flag.' }));
      return;
    }
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body) as { description: string; position?: { x: number; y: number } };
        if (!parsed.description || typeof parsed.description !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'description is required' }));
          return;
        }
        const result = await actionCoordinator.announce(parsed.description, parsed.position);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
    });
    return;
  }

  // Skill Discovery Bridge — Postgres full-text search (flag-gated)
  if (req.method === 'GET' && url.pathname === '/skill-discovery') {
    if (!sidecarFlags.skillDiscovery) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Skill discovery is disabled. Enable the skillDiscovery feature flag.' }));
      return;
    }
    const query = url.searchParams.get('query') ?? '';
    if (!query.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'query parameter is required' }));
      return;
    }
    const windowTitle = url.searchParams.get('windowTitle') ?? undefined;
    skillDiscoveryBridge.discoverSkills(query, windowTitle).then(skills => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(skills));
    }).catch(err => {
      console.error('[sidecar] skill-discovery error:', err);
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
const planWatchers = new Map<WebSocket, PlanWatcher>();

// EAC-6: Task Orchestrator
const taskOrchestrator = new TaskOrchestrator({
  getSession: (_paneId: string) => {
    // Currently single-pane: return first active session
    return [...activeSessions.values()][0];
  },
  writeToSession: (_paneId: string, data: string) => {
    const session = [...activeSessions.values()][0];
    if (!session) return false;
    session.write(data);
    return true;
  },
});

taskOrchestrator.onTaskStateChange = (task) => broadcastTaskStateChange(task);

// EAC-2: Batch Consent Manager instance
const batchConsentMgr = new BatchConsentManager();

// Sidecar-side feature flags (synced from frontend via 'set-flags' message)
const sidecarFlags: Record<string, boolean> = {
  outputBatching: true,
  autoTrust: false,
  planWatcher: true,
  terminalWriteMcp: false,
  conditionalAdvance: false,
  webFetchTool: false,
  batchConsent: false,
  windowFocusManager: false,
  clipboardAccess: false,
  agentTaskOrchestrator: false,
  screenshotVerification: false,
  enhancedAccessibility: false,
  workflowRecording: false,
  guidedWalkthrough: false,
  externalWindowCapture: false,
  skillDiscovery: false,
  multiPty: false,
  consentGate: false,
};

function sendMsg(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Mode Manager — lifecycle, flag snapshot/restore, crash recovery
const modeManager = new ModeManager({
  sidecarFlags,
  onFlagsChanged: (flags) => {
    // Broadcast updated flags to all connected clients
    for (const client of wss.clients) {
      sendMsg(client, { type: 'flags-updated', flags } as any);
    }
    console.log(`[modeManager] flags broadcast: ${JSON.stringify(flags)}`);
  },
  onModeChanged: (state) => {
    const msg = state
      ? { type: 'mode-status' as const, active: true, modeId: state.modeId, activatedAt: state.activatedAt }
      : { type: 'mode-status' as const, active: false };
    for (const client of wss.clients) {
      sendMsg(client, msg as any);
    }

    if (state && state.modeId === 'walkMeThrough') {
      // Walk Me Through activated: enable walkthrough watcher on all active PTY sessions
      // so conditional advance works immediately when mode starts
      const pattern = walkthroughEngine.getCurrentAdvancePattern();
      for (const session of activeSessions.values()) {
        if (session instanceof BatchedPTYSession) {
          session.walkthroughWatcherInstance.setPattern(pattern);
        }
      }
      console.log(`[modeManager] walkMeThrough activated — walkthrough watcher enabled on ${activeSessions.size} session(s)`);
    }

    if (state && state.modeId === 'workWithMe') {
      // Work With Me activated: enable action coordinator + walkthrough watcher
      actionCoordinator.enabled = true;
      // Enable walkthrough watcher on all active PTY sessions (same as walkMeThrough)
      const pattern = walkthroughEngine.getCurrentAdvancePattern();
      for (const session of activeSessions.values()) {
        if (session instanceof BatchedPTYSession) {
          session.walkthroughWatcherInstance.setPattern(pattern);
        }
      }
      console.log(`[modeManager] workWithMe activated — actionCoordinator enabled, walkthrough watcher enabled on ${activeSessions.size} session(s)`);
    }

    if (!state) {
      // Mode deactivated: clean up any active walkthrough
      if (walkthroughEngine.getStatus().active) {
        walkthroughEngine.stop();
        // stop() already clears annotations via annotationState.apply({ action: 'clear-all' })
        // and triggers onAnnotationsChanged which broadcasts to clients
        updateWalkthroughWatcherPattern(); // clears watcher pattern (engine has no active walkthrough now)
        console.log('[modeManager] mode deactivated — stopped active walkthrough and cleared annotations');
      }
      // Broadcast walkthrough-step null to clear the walkthrough panel in frontend
      broadcastWalkthroughStep(null);

      // Work With Me cleanup: disable action coordinator and cancel pending actions
      actionCoordinator.enabled = false;
      actionCoordinator.cancelAll();
      // Revoke all batch consent grants so no stale trust windows remain
      batchConsentMgr.revokeAll();
      console.log('[modeManager] mode deactivated — actionCoordinator disabled, pending actions cancelled, batch consent revoked');
    }
  },
});

// Action Coordinator — announce-then-act protocol for Work With Me mode
const actionCoordinator = new ActionCoordinator({
  annotationState,
  onBroadcast: (msg) => {
    for (const client of wss.clients) {
      sendMsg(client, msg);
    }
  },
  defaultDelayMs: 2000,
});

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

function broadcastTaskStateChange(task: AgentTask): void {
  for (const client of wss.clients) {
    sendMsg(client, {
      type: 'task-state-change',
      task: {
        taskId: task.taskId,
        name: task.name,
        status: task.status,
        paneId: task.paneId,
        lastOutput: task.lastOutput,
      },
    });
  }
}

function broadcastWalkthroughStep(step: { stepId: string; title: string; instruction: string; currentStep: number; totalSteps: number } | null): void {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'walkthrough-step', step });
  }
}

function broadcastPmChatToken(requestId: string, token: string): void {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'pm-chat-token', requestId, token });
  }
}

function broadcastPmChatDone(requestId: string): void {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'pm-chat-done', requestId });
  }
}

function broadcastPmChatError(requestId: string, error: string): void {
  for (const client of wss.clients) {
    sendMsg(client, { type: 'pm-chat-error', requestId, error });
  }
}

/** Agent Runtime Phase 2: Update watcher pattern on all active sessions */
function updateWalkthroughWatcherPattern(): void {
  const pattern = walkthroughEngine.getCurrentAdvancePattern();
  for (const session of activeSessions.values()) {
    if (session instanceof BatchedPTYSession) {
      session.walkthroughWatcherInstance.setPattern(pattern);
    }
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

  // Send crash recovery info to first connecting client (if sidecar recovered from a crash)
  const crashInfo = modeManager.getCrashRecoveryInfo();
  if (crashInfo) {
    sendMsg(ws, {
      type: 'mode-crash-recovery' as const,
      previousMode: crashInfo.previousMode,
      flagsRestored: crashInfo.flagsRestored,
    } as any);
    console.log(`[sidecar] sent crash recovery info: previousMode=${crashInfo.previousMode}`);
  }

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
          const session = new BatchedPTYSession(ws, shellExe, msg.cols ?? 80, msg.rows ?? 24, sidecarFlags.outputBatching ?? true);
          activeSessions.set(ws, session);
          console.log(`[sidecar] PTY session created successfully (batching=${sidecarFlags.outputBatching ?? true})`);
          console.log(`[sidecar] session started: id=${session.sessionId}`);
          sendMsg(ws, { type: 'session-start', sessionId: session.sessionId });
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
          // Live-update batching on active sessions
          if ('outputBatching' in flags) {
            for (const session of activeSessions.values()) {
              if (session instanceof BatchedPTYSession) {
                session.batchingEnabled = flags.outputBatching;
              }
            }
          }
          // Live-update autoTrust on active sessions
          if ('autoTrust' in flags) {
            for (const session of activeSessions.values()) {
              if (session instanceof BatchedPTYSession) {
                session.autoTrustEnabled = flags.autoTrust;
              }
            }
          }
          // Agent Runtime Phase 2: Live-update conditionalAdvance on active sessions
          if ('conditionalAdvance' in flags) {
            for (const session of activeSessions.values()) {
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
      case 'mode-activate': {
        const { modeId } = msg as { type: 'mode-activate'; modeId: string };
        const result = modeManager.activate(modeId);
        if (!result.success) {
          sendMsg(ws, { type: 'error', message: result.error! });
        }
        break;
      }
      case 'mode-deactivate': {
        const result = modeManager.deactivate();
        if (!result.success) {
          sendMsg(ws, { type: 'error', message: result.error! });
        }
        break;
      }
      case 'cancel-pending-action': {
        const { actionId } = msg as { type: 'cancel-pending-action'; actionId: string };
        actionCoordinator.cancel(actionId);
        break;
      }
      case 'pm-chat': {
        const pmMsg = msg as { type: 'pm-chat'; requestId: string; message: string; model: string; temperature: number; systemPrompt: string };
        console.log(`[sidecar] pm-chat request: requestId=${pmMsg.requestId} model=${pmMsg.model}`);
        streamOllamaChat(pmMsg.requestId, {
          message: pmMsg.message,
          model: pmMsg.model,
          temperature: pmMsg.temperature,
          systemPrompt: pmMsg.systemPrompt,
        }, {
          onToken: (token) => broadcastPmChatToken(pmMsg.requestId, token),
          onDone: () => broadcastPmChatDone(pmMsg.requestId),
          onError: (error) => broadcastPmChatError(pmMsg.requestId, error),
        });
        break;
      }
      case 'pm-chat-cancel': {
        const cancelMsg = msg as { type: 'pm-chat-cancel'; requestId: string };
        cancelOllamaChat(cancelMsg.requestId);
        break;
      }
      case 'pm-chat-health-check': {
        checkOllamaHealth().then(result => {
          sendMsg(ws, { type: 'pm-chat-health', ok: result.ok, error: result.error });
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
    planWatchers.get(ws)?.stop();
    planWatchers.delete(ws);
    // EAC-2: Revoke all batch consent grants on disconnect
    batchConsentMgr.revokeAll();
    // Mode cleanup on disconnect: deactivate if mode was active
    if (modeManager.getStatus().active) {
      modeManager.deactivate();
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
  skillDiscoveryBridge.destroy().catch(() => {});
  if (portFilePath) {
    deleteDiscoveryFile(portFilePath);
    portFilePath = null;
  }
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
