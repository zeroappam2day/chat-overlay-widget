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
    paneId: z
      .string()
      .optional()
      .describe('Target pane ID (for multi-PTY support). If omitted, reads from the first active session.'),
  },
  async ({ lines, since, paneId }) => {
    try {
      let qs = since !== undefined ? `lines=${lines}&since=${since}&scrub=true` : `lines=${lines}&scrub=true`;
      if (paneId) qs += `&paneId=${encodeURIComponent(paneId)}`;
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
  },
  async ({ id, title, steps }) => {
    try {
      const body = JSON.stringify({ id, title, steps });
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

// ─── Tool 8: write_terminal (Agent Runtime Phase 1) ──────────────────────────

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

// ─── Tool 9: get_ui_elements (Agent Runtime Phase 4) ────────────────────────

server.tool(
  'get_ui_elements',
  `Discover UI elements in a target window using Win32 UI Automation.
Returns the accessibility tree with element names, roles (Button, Edit, MenuItem, Tab, etc.),
bounding rectangles (screen coordinates), and automation IDs.

Use this to find clickable targets before using send_input (Phase 5).
Prefer targeting elements by name/role over raw pixel coordinates.

Gated behind the uiAccessibility feature flag.

Example — find all buttons in Notepad:
  { "title": "Notepad", "maxDepth": 2, "roleFilter": ["Button"] }

Example — get full tree of a window by handle:
  { "hwnd": 12345, "maxDepth": 3 }`,
  {
    hwnd: z
      .number()
      .int()
      .optional()
      .describe('Window handle (hwnd). If omitted, use title to find the window.'),
    title: z
      .string()
      .optional()
      .describe('Find window by title substring match (case-insensitive). Ignored if hwnd is provided.'),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(3)
      .describe('Tree traversal depth (1-5, default 3). Higher = more elements but slower.'),
    roleFilter: z
      .array(z.string())
      .optional()
      .describe('Only return elements matching these control types (e.g., ["Button", "Edit", "MenuItem"]). Omit for all types.'),
  },
  async ({ hwnd, title, maxDepth, roleFilter }) => {
    try {
      let qs = `maxDepth=${maxDepth}`;
      if (hwnd !== undefined) {
        qs += `&hwnd=${hwnd}`;
      } else if (title) {
        qs += `&title=${encodeURIComponent(title)}`;
      } else {
        return {
          content: [{ type: 'text' as const, text: 'Either hwnd or title is required.' }],
          isError: true,
        };
      }
      if (roleFilter && roleFilter.length > 0) {
        qs += `&roleFilter=${encodeURIComponent(roleFilter.join(','))}`;
      }

      const resp = await callSidecar(`/ui-elements?${qs}`);
      if (resp.status === 403) {
        return {
          content: [{ type: 'text' as const, text: 'UI accessibility tool is disabled. Enable the uiAccessibility feature flag.' }],
          isError: true,
        };
      }
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
