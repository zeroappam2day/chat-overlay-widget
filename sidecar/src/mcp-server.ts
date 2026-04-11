/**
 * MCP stdio server for Chat Overlay Widget.
 * Loaded via require('./mcp-server.js') from server.ts when process.argv[2] === 'mcp'.
 * Self-contained — no imports from server.ts, protocol.ts, or any native addon.
 * All logging to stderr (stdout is reserved for MCP JSON-RPC protocol).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';

// ─── Discovery file helper (per D-17) ────────────────────────────────────────

function readDiscovery(): { port: number; token: string } {
  const dir = path.join(process.env['APPDATA'] ?? os.homedir(), 'chat-overlay-widget');
  const filePath = path.join(dir, 'api.port');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as { port: number; token: string };
}

// ─── HTTP helper — makes GET requests to sidecar (per D-15, D-16) ────────────

function sidecarGet(
  endpoint: string,
  token: string,
  port: number
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `http://127.0.0.1:${port}${endpoint}`,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 500, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ─── HTTP helper — makes POST requests to sidecar ──────────────────────────

function sidecarPost(
  endpoint: string,
  token: string,
  port: number,
  body: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${port}${endpoint}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 500, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(body);
    req.end();
  });
}

// ─── Error wrapper — reads discovery + calls sidecar (per D-18) ──────────────

async function callSidecar(
  endpoint: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  let discovery: { port: number; token: string };
  try {
    discovery = readDiscovery();
  } catch {
    throw new Error('Chat Overlay Widget not running. Start the app first.');
  }
  try {
    return await sidecarGet(endpoint, discovery.token, discovery.port);
  } catch (err) {
    throw new Error(
      `Chat Overlay Widget not reachable: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── Vision-model image optimization ────────────────────────────────────────
// Resize + encode for Claude/Gemini vision:
//   - Long edge ≤ 1568px, short edge ≥ 200px
//   - Total pixels ≤ 1,150,000
//   - WebP lossy quality 85, no upscaling

const LONG_EDGE_MAX = 1568;
const SHORT_EDGE_MIN = 200;
const MAX_PIXELS = 1_150_000;
const WEBP_QUALITY = 85;

async function optimizeForVision(pngBuffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const meta = await sharp(pngBuffer).metadata();
  let w = meta.width!;
  let h = meta.height!;

  // Only downscale, never upscale
  if (w * h > MAX_PIXELS || Math.max(w, h) > LONG_EDGE_MAX) {
    const longEdge = Math.max(w, h);
    const shortEdge = Math.min(w, h);

    // Scale by long edge constraint
    let scale = Math.min(1, LONG_EDGE_MAX / longEdge);

    // Check total pixel constraint
    const pixelScale = Math.sqrt(MAX_PIXELS / (w * h));
    if (pixelScale < scale) scale = pixelScale;

    let newW = Math.round(w * scale);
    let newH = Math.round(h * scale);

    // Enforce short edge minimum (only matters for extreme aspect ratios)
    const newShortEdge = Math.min(newW, newH);
    if (newShortEdge < SHORT_EDGE_MIN && shortEdge >= SHORT_EDGE_MIN) {
      const minScale = SHORT_EDGE_MIN / Math.min(w, h);
      newW = Math.round(w * minScale);
      newH = Math.round(h * minScale);
    }

    w = newW;
    h = newH;
  }

  const output = await sharp(pngBuffer)
    .resize(w, h, { fit: 'fill' })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { buffer: output, width: w, height: h };
}

// ─── MCP Server setup (per D-06, D-07) ───────────────────────────────────────

const server = new McpServer({
  name: 'chat-overlay-widget',
  version: '1.0.0',
});

// ─── Tool 1: read_terminal_output (per D-12) ─────────────────────────────────

server.tool(
  'read_terminal_output',
  'Read the current terminal buffer from Chat Overlay Widget. Returns the most recent lines of terminal output with ANSI codes stripped and secrets scrubbed. Use the "since" cursor for pagination — pass the cursor value from a previous call to get only new lines.',
  {
    lines: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50)
      .describe('Number of lines to return (1-500, default 50)'),
    since: z
      .number()
      .int()
      .optional()
      .describe('Cursor from previous call — returns only lines after this point'),
  },
  async ({ lines, since }) => {
    try {
      const qs = since !== undefined ? `lines=${lines}&since=${since}&scrub=true` : `lines=${lines}&scrub=true`;
      const resp = await callSidecar(`/terminal-state?${qs}`);
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const parsed: unknown = JSON.parse(resp.body.toString('utf-8'));
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 2: query_session_history (per D-13) ────────────────────────────────

server.tool(
  'query_session_history',
  'Query historical terminal output from a past session stored in Chat Overlay Widget\'s SQLite database. Returns the most recent lines from the specified session with secrets scrubbed.',
  {
    sessionId: z.number().int().describe('Session ID to query'),
    lines: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(100)
      .describe('Number of lines to return (1-500, default 100)'),
  },
  async ({ sessionId, lines }) => {
    try {
      const resp = await callSidecar(`/session-history?sessionId=${sessionId}&lines=${lines}&scrub=true`);
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const parsed: unknown = JSON.parse(resp.body.toString('utf-8'));
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 3: capture_screenshot (per D-14) ───────────────────────────────────

server.tool(
  'capture_screenshot',
  'Capture a screenshot of the Chat Overlay Widget window. Returns a WebP image optimized for vision models (≤1568px long edge, ≤1.15MP, quality 85) with sensitive areas blurred.',
  {},
  async () => {
    try {
      const resp = await callSidecar('/screenshot?blur=true');
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const { buffer, width, height } = await optimizeForVision(resp.body);
      const base64 = buffer.toString('base64');
      const tokens = Math.ceil((width * height) / 750);
      return {
        content: [
          { type: 'image' as const, data: base64, mimeType: 'image/webp' },
          { type: 'text' as const, text: `${width}×${height} webp (${(buffer.length / 1024).toFixed(0)}KB, ~${tokens} tokens)` },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 4: send_annotation ────────────────────────────────────────────────

server.tool(
  'send_annotation',
  `Draw visual annotations on the Chat Overlay Widget's transparent overlay window.
Use this to highlight areas on screen, point to UI elements, or display step-by-step guidance.

Actions:
- "set": Replace all current annotations with the provided list.
- "merge": Add or update annotations by id (existing ids are updated, new ids are added).
- "clear": Remove specific annotations by their ids.
- "clear-group": Remove all annotations sharing the same group name.
- "clear-all": Remove every annotation from the overlay.

Each annotation has: id (unique string), type (box/arrow/text/highlight), x, y coordinates,
optional width/height, optional label text, optional color (#RRGGBB), optional ttl (seconds),
optional group (for batch clearing).

Example — draw a red box around a button:
  { "action": "set", "annotations": [{ "id": "step1", "type": "box", "x": 100, "y": 200, "width": 150, "height": 40, "label": "Click here" }] }

Example — clear all annotations:
  { "action": "clear-all" }`,
  {
    action: z.enum(['set', 'merge', 'clear', 'clear-group', 'clear-all'])
      .describe('What to do with the annotations'),
    annotations: z.array(z.object({
      id: z.string().min(1).max(200).describe('Unique identifier for this annotation'),
      type: z.enum(['box', 'arrow', 'text', 'highlight']).describe('Visual type'),
      x: z.number().int().min(0).max(10000).describe('X coordinate in pixels from left'),
      y: z.number().int().min(0).max(10000).describe('Y coordinate in pixels from top'),
      width: z.number().int().min(0).max(10000).optional().describe('Width in pixels (for box/highlight)'),
      height: z.number().int().min(0).max(10000).optional().describe('Height in pixels (for box/highlight)'),
      label: z.string().max(500).optional().describe('Text label to display'),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe('Color as hex (#RRGGBB), default #ff3e00'),
      ttl: z.number().int().min(0).max(3600).optional().describe('Auto-expire after N seconds (0 = never)'),
      group: z.string().max(100).optional().describe('Group name for batch clearing'),
    })).max(200).optional().describe('Array of annotations (required for set/merge)'),
    ids: z.array(z.string().min(1).max(200)).max(200).optional()
      .describe('Array of annotation ids to remove (required for clear action)'),
    group: z.string().min(1).max(100).optional()
      .describe('Group name to clear (required for clear-group action)'),
  },
  async ({ action, annotations, ids, group }) => {
    try {
      const payload: Record<string, unknown> = { action };
      if (annotations) payload.annotations = annotations;
      if (ids) payload.ids = ids;
      if (group) payload.group = group;

      const bodyStr = JSON.stringify(payload);
      const discovery = readDiscovery();
      const resp = await sidecarPost('/annotations', discovery.token, discovery.port, bodyStr);

      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const parsed = JSON.parse(resp.body.toString('utf-8'));
      return { content: [{ type: 'text' as const, text: `Annotations updated. ${parsed.count} active.` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 5: start_guided_walkthrough ──────────────────────────────────────────

server.tool(
  'start_guided_walkthrough',
  `Start a multi-step guided walkthrough on the Chat Overlay Widget.
Each step has a title, instruction text, and visual annotations that highlight areas on screen.
The walkthrough renders one step at a time. Call advance_walkthrough to move to the next step,
or use advanceWhen to auto-advance when terminal output matches a regex pattern.

advanceWhen requires the conditionalAdvance feature flag to be enabled. When the flag is off,
advanceWhen fields are accepted but ignored (manual advance still works).

Use this when guiding a user through a multi-step process like deploying an app,
configuring a tool, or navigating a complex UI.

Example with auto-advance:
{
  "id": "deploy-guide",
  "title": "Deploy to Production",
  "steps": [
    {
      "stepId": "step1",
      "title": "Run Build",
      "instruction": "Building the project...",
      "annotations": [{ "id": "s1-box", "type": "box", "x": 0, "y": 700, "width": 1200, "height": 50 }],
      "advanceWhen": { "type": "terminal-match", "pattern": "Build completed successfully" }
    },
    {
      "stepId": "step2",
      "title": "Run Deploy Command",
      "instruction": "Type 'npm run deploy' and press Enter",
      "annotations": [{ "id": "s2-text", "type": "text", "x": 100, "y": 730, "label": "Type: npm run deploy" }]
    }
  ]
}`,
  {
    id: z.string().min(1).max(200).describe('Unique walkthrough identifier'),
    title: z.string().max(300).describe('Walkthrough title'),
    steps: z.array(z.object({
      stepId: z.string().min(1).max(200).describe('Unique step identifier'),
      title: z.string().max(200).describe('Step title'),
      instruction: z.string().max(1000).describe('What the user should do'),
      annotations: z.array(z.object({
        id: z.string().min(1).max(200),
        type: z.enum(['box', 'arrow', 'text', 'highlight']),
        x: z.number().int().min(0).max(10000),
        y: z.number().int().min(0).max(10000),
        width: z.number().int().min(0).max(10000).optional(),
        height: z.number().int().min(0).max(10000).optional(),
        label: z.string().max(500).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })).max(50).describe('Visual annotations for this step'),
      advanceWhen: z.object({
        type: z.literal('terminal-match'),
        pattern: z.string().min(1).max(500).describe('Regex pattern to match against terminal output'),
      }).optional().describe('Auto-advance when terminal output matches this pattern. Requires conditionalAdvance feature flag.'),
    })).min(1).max(50).describe('Ordered list of walkthrough steps'),
    targetHwnd: z.number().int().positive().optional()
      .describe('Windows HWND of the target application window. Binds the walkthrough to this window for focus tracking and verification in subsequent phases.'),
  },
  async ({ id, title, steps, targetHwnd }) => {
    try {
      const body = JSON.stringify({ id, title, steps, targetHwnd });
      const discovery = readDiscovery();
      const resp = await sidecarPost('/walkthrough/start', discovery.token, discovery.port, body);
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 6: advance_walkthrough ───────────────────────────────────────────────

server.tool(
  'advance_walkthrough',
  'Move to the next step in the active guided walkthrough. Returns the next step details or indicates the walkthrough is complete.',
  {},
  async () => {
    try {
      const discovery = readDiscovery();
      const resp = await sidecarPost('/walkthrough/advance', discovery.token, discovery.port, '{}');
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 7: stop_walkthrough ──────────────────────────────────────────────────

server.tool(
  'stop_walkthrough',
  'Stop the active guided walkthrough and clear all its annotations from the overlay.',
  {},
  async () => {
    try {
      const discovery = readDiscovery();
      const resp = await sidecarPost('/walkthrough/stop', discovery.token, discovery.port, '{}');
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: 'Walkthrough stopped. Annotations cleared.' }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 8: modify_walkthrough ──────────────────────────────────────────────

server.tool(
  'modify_walkthrough',
  `Dynamically modify an active walkthrough — append new steps, replace the current step, or update all remaining steps.
Use this for adaptive real-time guidance when screen observation reveals the user needs different instructions.

Actions:
- append_steps: Add new steps to the end of the walkthrough. Requires 'steps' array.
- replace_current_step: Replace the current step with new content and re-render annotations. Requires 'step' object.
- update_remaining_steps: Replace all steps after the current one. Requires 'steps' array.

Max 50 steps total enforced across all operations.`,
  {
    action: z.enum(['append_steps', 'replace_current_step', 'update_remaining_steps']).describe('The modification action to perform'),
    steps: z.array(z.object({
      stepId: z.string().min(1).max(200).describe('Unique step identifier'),
      title: z.string().max(200).describe('Step title'),
      instruction: z.string().max(1000).describe('What the user should do'),
      annotations: z.array(z.object({
        id: z.string().min(1).max(200),
        type: z.enum(['box', 'arrow', 'text', 'highlight']),
        x: z.number().int().min(0).max(10000),
        y: z.number().int().min(0).max(10000),
        width: z.number().int().min(0).max(10000).optional(),
        height: z.number().int().min(0).max(10000).optional(),
        label: z.string().max(500).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })).max(50).describe('Visual annotations for this step'),
      advanceWhen: z.object({
        type: z.literal('terminal-match'),
        pattern: z.string().min(1).max(500).describe('Regex pattern to match against terminal output'),
      }).optional().describe('Auto-advance condition'),
    })).min(1).max(50).optional().describe('Steps array (required for append_steps and update_remaining_steps)'),
    step: z.object({
      stepId: z.string().min(1).max(200).describe('Unique step identifier'),
      title: z.string().max(200).describe('Step title'),
      instruction: z.string().max(1000).describe('What the user should do'),
      annotations: z.array(z.object({
        id: z.string().min(1).max(200),
        type: z.enum(['box', 'arrow', 'text', 'highlight']),
        x: z.number().int().min(0).max(10000),
        y: z.number().int().min(0).max(10000),
        width: z.number().int().min(0).max(10000).optional(),
        height: z.number().int().min(0).max(10000).optional(),
        label: z.string().max(500).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })).max(50).describe('Visual annotations for this step'),
      advanceWhen: z.object({
        type: z.literal('terminal-match'),
        pattern: z.string().min(1).max(500).describe('Regex pattern to match against terminal output'),
      }).optional().describe('Auto-advance condition'),
    }).optional().describe('Single step (required for replace_current_step)'),
  },
  async ({ action, steps, step }) => {
    try {
      const body = JSON.stringify({ action, steps, step });
      const discovery = readDiscovery();
      const resp = await sidecarPost('/walkthrough/modify', discovery.token, discovery.port, body);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Walkthrough modify is disabled. Enable the guidedWalkthrough feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 9: write_terminal (Agent Runtime Phase 1) ──────────────────────────

server.tool(
  'write_terminal',
  'Send text to the active terminal session. WARNING: This sends keystrokes to the terminal. The command will execute immediately if pressEnter is true. Use with caution. Gated behind the terminalWriteMcp feature flag.',
  {
    text: z.string().min(1).max(10000).describe('Text to send to the terminal'),
    paneId: z.string().optional().describe('Target pane ID (for future multi-PTY support)'),
    pressEnter: z.boolean().optional().default(false).describe('Append Enter (\\r) after text'),
  },
  async ({ text, paneId, pressEnter }) => {
    try {
      const discovery = readDiscovery();
      const body = JSON.stringify({ text, paneId, pressEnter });
      const resp = await sidecarPost('/terminal-write', discovery.token, discovery.port, body);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Terminal write MCP tool is disabled. Enable the terminalWriteMcp feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        const msg = JSON.parse(resp.body.toString()).error ?? resp.body.toString();
        return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: `Sent ${result.bytesWritten} bytes to terminal.` }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 9: web_fetch (EAC-5) ──────────────────────────────────────────────

server.tool(
  'web_fetch',
  'Fetch a web page and extract readable text. Use for documentation lookups, API references, tutorials. HTTPS only, max 50KB text, 5-minute cache.',
  {
    url: z.string().min(1).describe('URL to fetch (must be https://)'),
    extractText: z.boolean().optional().default(true).describe('Extract readable text from HTML (default true)'),
  },
  async ({ url, extractText }) => {
    try {
      const discovery = readDiscovery();
      const body = JSON.stringify({ url, extractText });
      const resp = await sidecarPost('/web-fetch', discovery.token, discovery.port, body);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Web fetch tool is disabled. Enable the webFetchTool feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        const msg = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${msg}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString('utf-8'));
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Fetch failed: ${result.error ?? 'Unknown error'}` }], isError: true };
      }
      const meta = `URL: ${result.url}\nStatus: ${result.statusCode}\nTruncated: ${result.truncated}\nCached: ${result.cached}\n\n`;
      return { content: [{ type: 'text' as const, text: meta + result.text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 12: submit_action_plan (EAC-2) ────────────────────────────────────

server.tool(
  'submit_action_plan',
  'Submit a batch action plan for user approval. All actions in the plan are approved or denied as a group. Each approved action can be consumed exactly once. Plans expire after 5 minutes. Requires the batchConsent feature flag.',
  {
    planId: z.string().min(1).max(200).describe('Unique plan identifier'),
    description: z.string().max(1000).describe('Human-readable plan description'),
    actions: z.array(z.object({
      type: z.string().min(1).max(50).describe('Action type (click, type, keyCombo, drag)'),
      description: z.string().max(500).describe('Human-readable action description'),
      coordinates: z.object({
        x: z.number().int(),
        y: z.number().int(),
      }).optional().describe('Screen coordinates for the action'),
      target: z.string().max(200).optional().describe('Target element identifier'),
    })).min(1).max(100).describe('Ordered list of actions to approve'),
    targetWindow: z.string().max(200).optional().describe('Target window title'),
  },
  async ({ planId, description, actions, targetWindow }) => {
    try {
      const body = JSON.stringify({ planId, description, actions, targetWindow });
      const discovery = readDiscovery();
      const resp = await sidecarPost('/consent/submit-plan', discovery.token, discovery.port, body);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Batch consent is disabled. Enable the batchConsent feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString('utf-8'));
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 13: request_trust_window (EAC-2) ──────────────────────────────────

server.tool(
  'request_trust_window',
  'Request a time-limited trust window for a specific target window. While active, specified action types are auto-approved without individual consent prompts. Hard-capped at 120 seconds. Requires the batchConsent feature flag.',
  {
    targetTitle: z.string().min(1).max(200).describe('Target window title to trust'),
    durationSec: z.number().int().min(1).max(120).describe('Trust duration in seconds (1-120)'),
    allowedActions: z.array(z.string().min(1).max(50)).min(1).max(10).describe('Action types to allow (click, type, keyCombo, drag)'),
  },
  async ({ targetTitle, durationSec, allowedActions }) => {
    try {
      const body = JSON.stringify({ targetTitle, durationSec, allowedActions });
      const discovery = readDiscovery();
      const resp = await sidecarPost('/consent/grant-trust', discovery.token, discovery.port, body);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Batch consent is disabled. Enable the batchConsent feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString('utf-8'));
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 14: focus_window (EAC-3) ──────────────────────────────────────────────

server.tool(
  'focus_window',
  'Focus a target window by hwnd or title. Brings the window to the foreground using SetForegroundWindow. Gated behind the windowFocusManager feature flag. Provide either hwnd (window handle as number) or title (partial title match).',
  {
    hwnd: z.number().int().positive().optional().describe('Window handle (hwnd) to focus'),
    title: z.string().min(1).max(500).optional().describe('Partial window title to search for and focus'),
  },
  async ({ hwnd, title }) => {
    if (!hwnd && !title) {
      return { content: [{ type: 'text' as const, text: 'Either hwnd or title is required.' }], isError: true };
    }
    try {
      const discovery = readDiscovery();
      const body = JSON.stringify({ hwnd, title });
      const resp = await sidecarPost('/focus-window', discovery.token, discovery.port, body);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Window focus manager is disabled. Enable the windowFocusManager feature flag.' }], isError: true };
      }
      if (resp.status === 404) {
        const msg = JSON.parse(resp.body.toString()).error ?? 'Window not found';
        return { content: [{ type: 'text' as const, text: msg }], isError: true };
      }
      if (resp.status === 409) {
        const parsed = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: `Could not focus window: ${parsed.error}` }], isError: true };
      }
      if (resp.status !== 200) {
        const msg = resp.body.toString();
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${msg}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: `Window focused. hwnd: ${result.hwnd}` }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 15: clipboard (EAC-4) ──────────────────────────────────────────────

server.tool(
  'clipboard',
  `Read, write, or paste text via the Windows clipboard.

Actions:
- "read": Read current clipboard text content. Returns { ok, text }.
- "write": Write text to clipboard. Requires 'text' parameter.
- "paste": Write text to clipboard then simulate Ctrl+V keystroke. Requires 'text' parameter.
  Paste action requires osInputSimulation and consentGate feature flags in addition to clipboardAccess.

Maximum text size: 100KB. Clipboard contents are never logged for security.`,
  {
    action: z.enum(['read', 'write', 'paste']).describe('Clipboard operation to perform'),
    text: z.string().max(102400).optional().describe('Text to write/paste (required for write and paste actions)'),
    clearAfterPaste: z.boolean().optional().default(false).describe('Clear clipboard after paste (only for paste action)'),
  },
  async ({ action, text, clearAfterPaste }) => {
    try {
      const discovery = readDiscovery();

      if (action === 'read') {
        const resp = await sidecarGet('/clipboard', discovery.token, discovery.port);
        if (resp.status === 403) {
          return { content: [{ type: 'text' as const, text: 'Clipboard access is disabled. Enable the clipboardAccess feature flag.' }], isError: true };
        }
        if (resp.status !== 200) {
          return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      }

      if (action === 'write') {
        if (!text) {
          return { content: [{ type: 'text' as const, text: 'text parameter is required for write action' }], isError: true };
        }
        const body = JSON.stringify({ text });
        const resp = await sidecarPost('/clipboard', discovery.token, discovery.port, body);
        if (resp.status === 403) {
          return { content: [{ type: 'text' as const, text: 'Clipboard access is disabled. Enable the clipboardAccess feature flag.' }], isError: true };
        }
        if (resp.status !== 200) {
          return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: result.ok ? 'Clipboard updated.' : `Error: ${result.error}` }] };
      }

      if (action === 'paste') {
        if (!text) {
          return { content: [{ type: 'text' as const, text: 'text parameter is required for paste action' }], isError: true };
        }
        const body = JSON.stringify({ text, clearAfterPaste });
        const resp = await sidecarPost('/clipboard/paste', discovery.token, discovery.port, body);
        if (resp.status === 403) {
          const errBody = JSON.parse(resp.body.toString());
          return { content: [{ type: 'text' as const, text: errBody.error || 'Paste action requires clipboardAccess, osInputSimulation, and consentGate feature flags.' }], isError: true };
        }
        if (resp.status !== 200) {
          return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: result.ok ? 'Paste completed.' : `Error: ${result.error}` }] };
      }

      return { content: [{ type: 'text' as const, text: `Unknown action: ${action}` }], isError: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 16: manage_tasks (EAC-6) ───────────────────────────────────────────────

server.tool(
  'manage_tasks',
  `Manage agent tasks in the Chat Overlay Widget. Tasks are shell commands submitted to PTY sessions with lifecycle tracking (pending, running, completed, failed, timeout).

Actions:
- "submit": Submit a new task. Requires name, command, paneId. Optional: exitPattern (regex for completion), failPattern (regex for failure), timeoutMs (default 300000).
- "list": List all tasks.
- "get": Get a specific task by taskId.
- "cancel": Cancel a running task (sends Ctrl+C).

Requires agentTaskOrchestrator, multiPty, and terminalWriteMcp feature flags enabled.`,
  {
    action: z.enum(['submit', 'list', 'get', 'cancel']).describe('Action to perform'),
    taskId: z.string().optional().describe('Task ID (required for get/cancel)'),
    name: z.string().max(200).optional().describe('Human-readable task name (required for submit)'),
    command: z.string().max(10000).optional().describe('Shell command to execute (required for submit)'),
    paneId: z.string().optional().describe('Target PTY pane ID (default: "default")'),
    exitPattern: z.string().max(500).optional().describe('Regex to detect task completion in output'),
    failPattern: z.string().max(500).optional().describe('Regex to detect task failure in output'),
    timeoutMs: z.number().int().min(1000).max(3600000).optional().describe('Task timeout in ms (default 300000)'),
  },
  async ({ action, taskId, name, command, paneId, exitPattern, failPattern, timeoutMs }) => {
    try {
      const discovery = readDiscovery();

      if (action === 'submit') {
        if (!name || !command) {
          return { content: [{ type: 'text' as const, text: 'Error: name and command are required for submit' }], isError: true };
        }
        const body = JSON.stringify({ name, command, paneId: paneId ?? 'default', exitPattern, failPattern, timeoutMs });
        const resp = await sidecarPost('/tasks/submit', discovery.token, discovery.port, body);
        if (resp.status !== 200) {
          const msg = JSON.parse(resp.body.toString()).error ?? resp.body.toString();
          return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      }

      if (action === 'list') {
        const resp = await sidecarGet('/tasks', discovery.token, discovery.port);
        if (resp.status !== 200) {
          return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      }

      if (action === 'get') {
        if (!taskId) {
          return { content: [{ type: 'text' as const, text: 'Error: taskId is required for get' }], isError: true };
        }
        const resp = await sidecarGet(`/tasks/${taskId}`, discovery.token, discovery.port);
        if (resp.status !== 200) {
          const msg = JSON.parse(resp.body.toString()).error ?? resp.body.toString();
          return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      }

      if (action === 'cancel') {
        if (!taskId) {
          return { content: [{ type: 'text' as const, text: 'Error: taskId is required for cancel' }], isError: true };
        }
        const resp = await sidecarPost(`/tasks/${taskId}/cancel`, discovery.token, discovery.port, '{}');
        if (resp.status !== 200) {
          return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: 'Task cancelled.' }] };
      }

      return { content: [{ type: 'text' as const, text: `Unknown action: ${action}` }], isError: true };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 17: verify_walkthrough_step (EAC-7) ───────────────────────────────

server.tool(
  'verify_walkthrough_step',
  'Verify the current walkthrough step using its configured advanceWhen strategy (pixel-sample, screenshot-diff, terminal-match, or manual). Requires both screenshotVerification and guidedWalkthrough feature flags to be enabled. Returns whether the step passed verification and strategy details.',
  {},
  async () => {
    try {
      const discovery = readDiscovery();
      const resp = await sidecarPost('/walkthrough/verify-step', discovery.token, discovery.port, '{}');
      if (resp.status === 403) {
        const errBody = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text' as const, text: `Feature flag disabled: ${errBody.error}` }], isError: true };
      }
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 18: interact_with_element (EAC-8) ──────────────────────────────────

server.tool(
  'interact_with_element',
  `Interact with UI elements via UI Automation. Supports searching the element tree, invoking buttons,
setting text values, and querying supported patterns — all without SendInput.

Actions:
- "search": Search UI Automation tree by name, automationId, or className. Returns matching elements with bounding rects.
- "invoke": Activate an element using IInvokePattern (native click). Requires consentGate flag.
- "setValue": Set text in an input field using IValuePattern. Requires consentGate flag.
- "getPatterns": Query which UI Automation patterns an element supports.

Requires enhancedAccessibility and uiAccessibility feature flags to be enabled.
Invoke and setValue actions additionally require the consentGate flag.`,
  {
    action: z.enum(['search', 'invoke', 'setValue', 'getPatterns']).describe('Action to perform'),
    hwnd: z.number().int().optional().describe('Window handle (provide hwnd or title)'),
    title: z.string().optional().describe('Window title to find (provide hwnd or title)'),
    automationId: z.string().optional().describe('UI Automation AutomationId of the target element'),
    name: z.string().optional().describe('UI Automation Name of the target element'),
    role: z.string().optional().describe('UI Automation ControlType role'),
    searchText: z.string().optional().describe('Text to search for (required for search action)'),
    searchProperty: z.enum(['name', 'automationId', 'className']).optional().describe('Property to search by (required for search action)'),
    value: z.string().optional().describe('Value to set (required for setValue action)'),
    maxResults: z.number().int().min(1).max(100).optional().describe('Max results for search (default 10)'),
    maxDepth: z.number().int().min(1).max(20).optional().describe('Max tree depth for search (default 8)'),
  },
  async ({ action, hwnd, title, automationId, name, role, searchText, searchProperty, value, maxResults, maxDepth }) => {
    try {
      const discovery = readDiscovery();
      let endpoint: string;
      let method: 'GET' | 'POST' = 'POST';
      let bodyStr = '';

      switch (action) {
        case 'search': {
          if (!searchText || !searchProperty) {
            return { content: [{ type: 'text' as const, text: 'searchText and searchProperty are required for search action' }], isError: true };
          }
          endpoint = '/ui-elements/search';
          bodyStr = JSON.stringify({ hwnd, title, searchText, searchProperty, maxResults, maxDepth });
          break;
        }
        case 'invoke': {
          if (!hwnd) {
            return { content: [{ type: 'text' as const, text: 'hwnd is required for invoke action' }], isError: true };
          }
          endpoint = '/ui-elements/invoke';
          bodyStr = JSON.stringify({ hwnd, automationId, name, role });
          break;
        }
        case 'setValue': {
          if (!hwnd || value === undefined) {
            return { content: [{ type: 'text' as const, text: 'hwnd and value are required for setValue action' }], isError: true };
          }
          endpoint = '/ui-elements/set-value';
          bodyStr = JSON.stringify({ hwnd, automationId, name, value });
          break;
        }
        case 'getPatterns': {
          if (!hwnd) {
            return { content: [{ type: 'text' as const, text: 'hwnd is required for getPatterns action' }], isError: true };
          }
          method = 'GET';
          const params = new URLSearchParams();
          params.set('hwnd', String(hwnd));
          if (automationId) params.set('automationId', automationId);
          if (name) params.set('name', name);
          endpoint = `/ui-elements/patterns?${params.toString()}`;
          break;
        }
      }

      let resp: { status: number; headers: http.IncomingHttpHeaders; body: Buffer };
      if (method === 'GET') {
        resp = await sidecarGet(endpoint, discovery.token, discovery.port);
      } else {
        resp = await sidecarPost(endpoint, discovery.token, discovery.port, bodyStr);
      }

      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: `Feature flag disabled: ${resp.body.toString()}` }], isError: true };
      }
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      const parsed = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 19: workflow (EAC-9) ────────────────────────────────────────────────

server.tool(
  'workflow',
  `Manage workflow recordings in Chat Overlay Widget. Record sequences of tool calls as replayable workflows.

Actions:
- "startRecording": Begin recording a new workflow. Requires name and description.
- "addStep": Add a step to the current recording. Requires tool, params, description.
- "stopRecording": Stop recording and save the workflow.
- "list": List all saved workflows.
- "get": Get a workflow by ID. Requires workflowId.
- "delete": Delete a workflow by ID. Requires workflowId.
- "replay": Replay a workflow. Requires workflowId. Optional: startFromStep, dryRun, pauseBeforeEach.

Gated behind the workflowRecording feature flag.`,
  {
    action: z.enum(['startRecording', 'addStep', 'stopRecording', 'list', 'get', 'delete', 'replay'])
      .describe('Which workflow action to perform'),
    workflowId: z.string().optional().describe('Workflow ID (for get, delete, replay)'),
    name: z.string().optional().describe('Workflow name (for startRecording)'),
    description: z.string().optional().describe('Workflow description (for startRecording)'),
    tool: z.string().optional().describe('MCP tool name (for addStep)'),
    params: z.record(z.unknown()).optional().describe('Tool parameters (for addStep)'),
    delayAfterMs: z.number().optional().describe('Delay after step in ms (for addStep)'),
    verification: z.object({
      strategy: z.enum(['terminal-match', 'pixel-sample', 'manual']),
      config: z.record(z.unknown()),
    }).optional().describe('Verification config (for addStep)'),
    startFromStep: z.number().optional().describe('Step index to start replay from'),
    dryRun: z.boolean().optional().describe('Dry run mode for replay'),
    pauseBeforeEach: z.boolean().optional().describe('Pause before each step during replay'),
  },
  async ({ action, workflowId, name, description: desc, tool: toolName, params: toolParams, delayAfterMs, verification, startFromStep, dryRun, pauseBeforeEach }) => {
    try {
      const discovery = readDiscovery();
      let resp: { status: number; headers: http.IncomingHttpHeaders; body: Buffer };

      switch (action) {
        case 'startRecording': {
          const body = JSON.stringify({ name: name ?? 'Untitled', description: desc ?? '' });
          resp = await sidecarPost('/workflows/start-recording', discovery.token, discovery.port, body);
          break;
        }
        case 'addStep': {
          const stepBody: Record<string, unknown> = {
            tool: toolName ?? 'unknown',
            params: toolParams ?? {},
            description: desc ?? '',
          };
          if (delayAfterMs !== undefined) stepBody.delayAfterMs = delayAfterMs;
          if (verification) stepBody.verification = verification;
          resp = await sidecarPost('/workflows/add-step', discovery.token, discovery.port, JSON.stringify(stepBody));
          break;
        }
        case 'stopRecording': {
          resp = await sidecarPost('/workflows/stop-recording', discovery.token, discovery.port, '{}');
          break;
        }
        case 'list': {
          resp = await sidecarGet('/workflows', discovery.token, discovery.port);
          break;
        }
        case 'get': {
          if (!workflowId) return { content: [{ type: 'text' as const, text: 'workflowId is required for get action' }], isError: true };
          resp = await sidecarGet(`/workflows/${workflowId}`, discovery.token, discovery.port);
          break;
        }
        case 'delete': {
          if (!workflowId) return { content: [{ type: 'text' as const, text: 'workflowId is required for delete action' }], isError: true };
          // Use a DELETE request via raw http
          resp = await new Promise((resolve, reject) => {
            const req = http.request(
              `http://127.0.0.1:${discovery.port}/workflows/${workflowId}`,
              {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${discovery.token}` },
              },
              (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => resolve({ status: res.statusCode ?? 500, headers: res.headers, body: Buffer.concat(chunks) }));
              }
            );
            req.on('error', reject);
            req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timeout')); });
            req.end();
          });
          break;
        }
        case 'replay': {
          if (!workflowId) return { content: [{ type: 'text' as const, text: 'workflowId is required for replay action' }], isError: true };
          const replayBody: Record<string, unknown> = {};
          if (startFromStep !== undefined) replayBody.startFromStep = startFromStep;
          if (dryRun !== undefined) replayBody.dryRun = dryRun;
          if (pauseBeforeEach !== undefined) replayBody.pauseBeforeEach = pauseBeforeEach;
          resp = await sidecarPost(`/workflows/${workflowId}/replay`, discovery.token, discovery.port, JSON.stringify(replayBody));
          break;
        }
        default:
          return { content: [{ type: 'text' as const, text: `Unknown action: ${action}` }], isError: true };
      }

      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Workflow recording is disabled. Enable the workflowRecording feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      const parsed = JSON.parse(resp.body.toString());
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Tool 20: list_external_windows ──────────────────────────────────────────

server.tool(
  'list_external_windows',
  'List all visible windows on the desktop with their titles, process names, and handles. Use this to discover what applications the user has open before capturing a specific window. Gated behind the externalWindowCapture feature flag.',
  {},
  async () => {
    try {
      const { port, token } = readDiscovery();
      const resp = await sidecarGet('/list-windows', token, port);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'External window capture is disabled. Enable the externalWindowCapture feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const windows = JSON.parse(resp.body.toString('utf-8')) as Array<{ title: string; processName: string; hwnd: number; pid: number }>;
      const formatted = windows.map((w, i) => `${i + 1}. [${w.processName}] ${w.title} (hwnd: ${w.hwnd})`).join('\n');
      return { content: [{ type: 'text' as const, text: `Found ${windows.length} windows:\n${formatted}` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 21: capture_external_window ────────────────────────────────────────

server.tool(
  'capture_external_window',
  'Capture a screenshot of an external application window by title. Returns an optimized image suitable for vision analysis. Use list_external_windows first to discover available windows. Gated behind the externalWindowCapture feature flag.',
  {
    title: z.string().min(1).max(500).describe('Window title or substring to match — case-insensitive partial match'),
  },
  async ({ title }) => {
    try {
      const { port, token } = readDiscovery();
      const resp = await sidecarPost('/capture/window', token, port, JSON.stringify({ title }));
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'External window capture is disabled. Enable the externalWindowCapture feature flag.' }], isError: true };
      }
      if (resp.status === 404) {
        const err = JSON.parse(resp.body.toString('utf-8'));
        return { content: [{ type: 'text' as const, text: `Window not found: ${err.error}` }], isError: true };
      }
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString('utf-8')) as { path: string };
      // Read PNG from disk and optimize for vision (same pattern as capture_screenshot)
      const pngBuffer = fs.readFileSync(result.path);
      try { fs.unlinkSync(result.path); } catch {} // cleanup temp file
      const { buffer, width, height } = await optimizeForVision(pngBuffer);
      const base64 = buffer.toString('base64');
      const sizeKB = Math.round(buffer.length / 1024);
      const tokens = Math.ceil((width * height) / 750);
      return {
        content: [
          { type: 'image' as const, data: base64, mimeType: 'image/webp' },
          { type: 'text' as const, text: `${width}x${height} webp (${sizeKB}KB, ~${tokens} tokens) — captured: ${title}` },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 22: discover_skills (Skill Discovery Bridge) ──────────────────────

server.tool(
  'discover_skills',
  `Discover available skills from the Postgres skill index based on context.
Use this in Work With Me mode to find relevant skills for the user's active application or task.
Returns ranked skill matches with descriptions, use cases, taxonomy, and instruction summaries.
Gated behind the skillDiscovery feature flag.`,
  {
    query: z.string().min(1).max(500).describe("Natural language description of what you need — e.g., Google Sheets automation, email management, data processing"),
    windowTitle: z.string().max(200).optional().describe("Title of the user's active window for context-aware matching"),
  },
  async ({ query, windowTitle }) => {
    try {
      const { port, token } = readDiscovery();
      const params = new URLSearchParams({ query });
      if (windowTitle) params.set('windowTitle', windowTitle);
      const resp = await sidecarGet(`/skill-discovery?${params}`, token, port);
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Skill discovery is disabled. Enable the skillDiscovery feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const skills = JSON.parse(resp.body.toString('utf-8')) as Array<{
        skillName: string;
        description: string;
        usecases: string[];
        taxonomy: { l1: string; l2: string; l3: string };
        score: number;
        instructionsSummary: string;
      }>;
      if (skills.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No matching skills found.' }] };
      }
      const formatted = skills.map((s, i) =>
        `${i + 1}. **${s.skillName}** (${s.taxonomy.l1}/${s.taxonomy.l2}/${s.taxonomy.l3})\n   ${s.description}\n   Use cases: ${s.usecases.slice(0, 3).join(', ')}\n   Instructions: ${s.instructionsSummary}...`
      ).join('\n\n');
      return { content: [{ type: 'text' as const, text: `Found ${skills.length} matching skills:\n\n${formatted}` }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: msg }], isError: true };
    }
  }
);

// ─── Tool 23: announce_action (Action Coordinator) ──────────────────────────

server.tool(
  'announce_action',
  `Announce an intended action to the user before executing it. Shows a highlighted orange annotation with the action description. The user has the configured delay (default 2 seconds) to cancel via the UI. Use this in Work With Me mode before performing any action that modifies the user's screen or application state.

Returns { cancelled: boolean, actionId: string }. If cancelled is true, do NOT proceed with the action.

Gated behind the batchConsent feature flag.`,
  {
    description: z.string().min(1).max(500).describe('Human-readable description of the action you are about to take'),
    x: z.number().min(0).max(10000).optional().describe('X position for announcement overlay'),
    y: z.number().min(0).max(10000).optional().describe('Y position for announcement overlay'),
  },
  async ({ description, x, y }) => {
    try {
      const { port, token } = readDiscovery();
      const bodyObj: { description: string; position?: { x: number; y: number } } = { description };
      if (x !== undefined) {
        bodyObj.position = { x, y: y ?? 100 };
      }
      const resp = await sidecarPost('/action/announce', token, port, JSON.stringify(bodyObj));
      if (resp.status === 403) {
        return { content: [{ type: 'text' as const, text: 'Action coordination is disabled. Enable the batchConsent feature flag.' }], isError: true };
      }
      if (resp.status !== 200) {
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
      }
      const result = JSON.parse(resp.body.toString()) as { cancelled: boolean; actionId: string };
      if (result.cancelled) {
        return { content: [{ type: 'text' as const, text: `Action CANCELLED by user (actionId: ${result.actionId}). Do NOT proceed with: ${description}` }] };
      }
      return { content: [{ type: 'text' as const, text: `Action approved (actionId: ${result.actionId}). Proceed with: ${description}` }] };
    } catch (err) {
      return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
  }
);

// ─── Server startup ───────────────────────────────────────────────────────────

// server.ts throws 'mcp-server should not return' after require()ing this module
// to prevent native addon initialization. We install an uncaughtException handler
// to swallow that specific error and let the MCP server's event loop continue.
process.on('uncaughtException', (err: Error) => {
  if (err.message === 'mcp-server should not return') {
    // Expected — server.ts guard prevents native addon loading. Ignore.
    return;
  }
  console.error('[mcp] Uncaught exception:', err);
  process.exit(1);
});

async function main(): Promise<void> {
  console.error('[mcp] Chat Overlay Widget MCP server starting...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp] MCP server connected via stdio');
}

main().catch((err) => {
  console.error('[mcp] Fatal error:', err);
  process.exit(1);
});
