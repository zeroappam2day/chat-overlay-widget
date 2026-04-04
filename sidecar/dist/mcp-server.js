"use strict";
/**
 * MCP stdio server for Chat Overlay Widget.
 * Loaded via require('./mcp-server.js') from server.ts when process.argv[2] === 'mcp'.
 * Self-contained — no imports from server.ts, protocol.ts, or any native addon.
 * All logging to stderr (stdout is reserved for MCP JSON-RPC protocol).
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const sharp_1 = __importDefault(require("sharp"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const http = __importStar(require("node:http"));
// ─── Discovery file helper (per D-17) ────────────────────────────────────────
function readDiscovery() {
    const dir = path.join(process.env['APPDATA'] ?? os.homedir(), 'chat-overlay-widget');
    const filePath = path.join(dir, 'api.port');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}
// ─── HTTP helper — makes GET requests to sidecar (per D-15, D-16) ────────────
function sidecarGet(endpoint, token, port) {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 500, headers: res.headers, body: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}
// ─── HTTP helper — makes POST requests to sidecar ──────────────────────────
function sidecarPost(endpoint, token, port, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(`http://127.0.0.1:${port}${endpoint}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 500, headers: res.headers, body: Buffer.concat(chunks) }));
        });
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
async function callSidecar(endpoint) {
    let discovery;
    try {
        discovery = readDiscovery();
    }
    catch {
        throw new Error('Chat Overlay Widget not running. Start the app first.');
    }
    try {
        return await sidecarGet(endpoint, discovery.token, discovery.port);
    }
    catch (err) {
        throw new Error(`Chat Overlay Widget not reachable: ${err instanceof Error ? err.message : String(err)}`);
    }
}
// ─── Vision-model image optimization ────────────────────────────────────────
// Resize + encode for Claude/Gemini vision:
//   - Long edge ≤ 1568px, short edge ≥ 200px
//   - Total pixels ≤ 1,150,000
//   - WebP lossy quality 85, no upscaling
const LONG_EDGE_MAX = 1568;
const SHORT_EDGE_MIN = 200;
const MAX_PIXELS = 1150000;
const WEBP_QUALITY = 85;
async function optimizeForVision(pngBuffer) {
    const meta = await (0, sharp_1.default)(pngBuffer).metadata();
    let w = meta.width;
    let h = meta.height;
    // Only downscale, never upscale
    if (w * h > MAX_PIXELS || Math.max(w, h) > LONG_EDGE_MAX) {
        const longEdge = Math.max(w, h);
        const shortEdge = Math.min(w, h);
        // Scale by long edge constraint
        let scale = Math.min(1, LONG_EDGE_MAX / longEdge);
        // Check total pixel constraint
        const pixelScale = Math.sqrt(MAX_PIXELS / (w * h));
        if (pixelScale < scale)
            scale = pixelScale;
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
    const output = await (0, sharp_1.default)(pngBuffer)
        .resize(w, h, { fit: 'fill' })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    return { buffer: output, width: w, height: h };
}
// ─── MCP Server setup (per D-06, D-07) ───────────────────────────────────────
const server = new mcp_js_1.McpServer({
    name: 'chat-overlay-widget',
    version: '1.0.0',
});
// ─── Tool 1: read_terminal_output (per D-12) ─────────────────────────────────
server.tool('read_terminal_output', 'Read the current terminal buffer from Chat Overlay Widget. Returns the most recent lines of terminal output with ANSI codes stripped and secrets scrubbed. Use the "since" cursor for pagination — pass the cursor value from a previous call to get only new lines.', {
    lines: zod_1.z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(50)
        .describe('Number of lines to return (1-500, default 50)'),
    since: zod_1.z
        .number()
        .int()
        .optional()
        .describe('Cursor from previous call — returns only lines after this point'),
    paneId: zod_1.z
        .string()
        .optional()
        .describe('Target pane ID (for multi-PTY support). If omitted, reads from the first active session.'),
}, async ({ lines, since, paneId }) => {
    try {
        let qs = since !== undefined ? `lines=${lines}&since=${since}&scrub=true` : `lines=${lines}&scrub=true`;
        if (paneId)
            qs += `&paneId=${encodeURIComponent(paneId)}`;
        const resp = await callSidecar(`/terminal-state?${qs}`);
        if (resp.status !== 200) {
            const errText = resp.body.toString('utf-8');
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${errText}` }], isError: true };
        }
        const parsed = JSON.parse(resp.body.toString('utf-8'));
        return { content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }] };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
    }
});
// ─── Tool 2: query_session_history (per D-13) ────────────────────────────────
server.tool('query_session_history', 'Query historical terminal output from a past session stored in Chat Overlay Widget\'s SQLite database. Returns the most recent lines from the specified session with secrets scrubbed.', {
    sessionId: zod_1.z.number().int().describe('Session ID to query'),
    lines: zod_1.z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(100)
        .describe('Number of lines to return (1-500, default 100)'),
}, async ({ sessionId, lines }) => {
    try {
        const resp = await callSidecar(`/session-history?sessionId=${sessionId}&lines=${lines}&scrub=true`);
        if (resp.status !== 200) {
            const errText = resp.body.toString('utf-8');
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${errText}` }], isError: true };
        }
        const parsed = JSON.parse(resp.body.toString('utf-8'));
        return { content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }] };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
    }
});
// ─── Tool 3: capture_screenshot (per D-14) ───────────────────────────────────
server.tool('capture_screenshot', 'Capture a screenshot of the Chat Overlay Widget window. Returns a WebP image optimized for vision models (≤1568px long edge, ≤1.15MP, quality 85) with sensitive areas blurred.', {}, async () => {
    try {
        const resp = await callSidecar('/screenshot?blur=true');
        if (resp.status !== 200) {
            const errText = resp.body.toString('utf-8');
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${errText}` }], isError: true };
        }
        const { buffer, width, height } = await optimizeForVision(resp.body);
        const base64 = buffer.toString('base64');
        const tokens = Math.ceil((width * height) / 750);
        return {
            content: [
                { type: 'image', data: base64, mimeType: 'image/webp' },
                { type: 'text', text: `${width}×${height} webp (${(buffer.length / 1024).toFixed(0)}KB, ~${tokens} tokens)` },
            ],
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
    }
});
// ─── Tool 4: send_annotation ────────────────────────────────────────────────
server.tool('send_annotation', `Draw visual annotations on the Chat Overlay Widget's transparent overlay window.
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
  { "action": "clear-all" }`, {
    action: zod_1.z.enum(['set', 'merge', 'clear', 'clear-group', 'clear-all'])
        .describe('What to do with the annotations'),
    annotations: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().min(1).max(200).describe('Unique identifier for this annotation'),
        type: zod_1.z.enum(['box', 'arrow', 'text', 'highlight']).describe('Visual type'),
        x: zod_1.z.number().int().min(0).max(10000).describe('X coordinate in pixels from left'),
        y: zod_1.z.number().int().min(0).max(10000).describe('Y coordinate in pixels from top'),
        width: zod_1.z.number().int().min(0).max(10000).optional().describe('Width in pixels (for box/highlight)'),
        height: zod_1.z.number().int().min(0).max(10000).optional().describe('Height in pixels (for box/highlight)'),
        label: zod_1.z.string().max(500).optional().describe('Text label to display'),
        color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe('Color as hex (#RRGGBB), default #ff3e00'),
        ttl: zod_1.z.number().int().min(0).max(3600).optional().describe('Auto-expire after N seconds (0 = never)'),
        group: zod_1.z.string().max(100).optional().describe('Group name for batch clearing'),
    })).max(200).optional().describe('Array of annotations (required for set/merge)'),
    ids: zod_1.z.array(zod_1.z.string().min(1).max(200)).max(200).optional()
        .describe('Array of annotation ids to remove (required for clear action)'),
    group: zod_1.z.string().min(1).max(100).optional()
        .describe('Group name to clear (required for clear-group action)'),
}, async ({ action, annotations, ids, group }) => {
    try {
        const payload = { action };
        if (annotations)
            payload.annotations = annotations;
        if (ids)
            payload.ids = ids;
        if (group)
            payload.group = group;
        const bodyStr = JSON.stringify(payload);
        const discovery = readDiscovery();
        const resp = await sidecarPost('/annotations', discovery.token, discovery.port, bodyStr);
        if (resp.status !== 200) {
            const errText = resp.body.toString('utf-8');
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${errText}` }], isError: true };
        }
        const parsed = JSON.parse(resp.body.toString('utf-8'));
        return { content: [{ type: 'text', text: `Annotations updated. ${parsed.count} active.` }] };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
    }
});
// ─── Tool 5: start_guided_walkthrough ──────────────────────────────────────────
server.tool('start_guided_walkthrough', `Start a multi-step guided walkthrough on the Chat Overlay Widget.
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
}`, {
    id: zod_1.z.string().min(1).max(200).describe('Unique walkthrough identifier'),
    title: zod_1.z.string().max(300).describe('Walkthrough title'),
    steps: zod_1.z.array(zod_1.z.object({
        stepId: zod_1.z.string().min(1).max(200).describe('Unique step identifier'),
        title: zod_1.z.string().max(200).describe('Step title'),
        instruction: zod_1.z.string().max(1000).describe('What the user should do'),
        annotations: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().min(1).max(200),
            type: zod_1.z.enum(['box', 'arrow', 'text', 'highlight']),
            x: zod_1.z.number().int().min(0).max(10000),
            y: zod_1.z.number().int().min(0).max(10000),
            width: zod_1.z.number().int().min(0).max(10000).optional(),
            height: zod_1.z.number().int().min(0).max(10000).optional(),
            label: zod_1.z.string().max(500).optional(),
            color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        })).max(50).describe('Visual annotations for this step'),
        advanceWhen: zod_1.z.object({
            type: zod_1.z.literal('terminal-match'),
            pattern: zod_1.z.string().min(1).max(500).describe('Regex pattern to match against terminal output'),
        }).optional().describe('Auto-advance when terminal output matches this pattern. Requires conditionalAdvance feature flag.'),
    })).min(1).max(50).describe('Ordered list of walkthrough steps'),
}, async ({ id, title, steps }) => {
    try {
        const body = JSON.stringify({ id, title, steps });
        const discovery = readDiscovery();
        const resp = await sidecarPost('/walkthrough/start', discovery.token, discovery.port, body);
        if (resp.status !== 200) {
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
});
// ─── Tool 6: advance_walkthrough ───────────────────────────────────────────────
server.tool('advance_walkthrough', 'Move to the next step in the active guided walkthrough. Returns the next step details or indicates the walkthrough is complete.', {}, async () => {
    try {
        const discovery = readDiscovery();
        const resp = await sidecarPost('/walkthrough/advance', discovery.token, discovery.port, '{}');
        if (resp.status !== 200) {
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
});
// ─── Tool 7: stop_walkthrough ──────────────────────────────────────────────────
server.tool('stop_walkthrough', 'Stop the active guided walkthrough and clear all its annotations from the overlay.', {}, async () => {
    try {
        const discovery = readDiscovery();
        const resp = await sidecarPost('/walkthrough/stop', discovery.token, discovery.port, '{}');
        if (resp.status !== 200) {
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${resp.body.toString()}` }], isError: true };
        }
        return { content: [{ type: 'text', text: 'Walkthrough stopped. Annotations cleared.' }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
});
// ─── Tool 8: write_terminal (Agent Runtime Phase 1) ──────────────────────────
server.tool('write_terminal', 'Send text to the active terminal session. WARNING: This sends keystrokes to the terminal. The command will execute immediately if pressEnter is true. Use with caution. Gated behind the terminalWriteMcp feature flag.', {
    text: zod_1.z.string().min(1).max(10000).describe('Text to send to the terminal'),
    paneId: zod_1.z.string().optional().describe('Target pane ID (for future multi-PTY support)'),
    pressEnter: zod_1.z.boolean().optional().default(false).describe('Append Enter (\\r) after text'),
}, async ({ text, paneId, pressEnter }) => {
    try {
        const discovery = readDiscovery();
        const body = JSON.stringify({ text, paneId, pressEnter });
        const resp = await sidecarPost('/terminal-write', discovery.token, discovery.port, body);
        if (resp.status === 403) {
            return { content: [{ type: 'text', text: 'Terminal write MCP tool is disabled. Enable the terminalWriteMcp feature flag.' }], isError: true };
        }
        if (resp.status !== 200) {
            const msg = JSON.parse(resp.body.toString()).error ?? resp.body.toString();
            return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString());
        return { content: [{ type: 'text', text: `Sent ${result.bytesWritten} bytes to terminal.` }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }], isError: true };
    }
});
// ─── Tool 9: get_ui_elements (Agent Runtime Phase 4) ────────────────────────
server.tool('get_ui_elements', `Discover UI elements in a target window using Win32 UI Automation.
Returns the accessibility tree with element names, roles (Button, Edit, MenuItem, Tab, etc.),
bounding rectangles (screen coordinates), and automation IDs.

Use this to find clickable targets before using send_input (Phase 5).
Prefer targeting elements by name/role over raw pixel coordinates.

Gated behind the uiAccessibility feature flag.

Example — find all buttons in Notepad:
  { "title": "Notepad", "maxDepth": 2, "roleFilter": ["Button"] }

Example — get full tree of a window by handle:
  { "hwnd": 12345, "maxDepth": 3 }`, {
    hwnd: zod_1.z
        .number()
        .int()
        .optional()
        .describe('Window handle (hwnd). If omitted, use title to find the window.'),
    title: zod_1.z
        .string()
        .optional()
        .describe('Find window by title substring match (case-insensitive). Ignored if hwnd is provided.'),
    maxDepth: zod_1.z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(3)
        .describe('Tree traversal depth (1-5, default 3). Higher = more elements but slower.'),
    roleFilter: zod_1.z
        .array(zod_1.z.string())
        .optional()
        .describe('Only return elements matching these control types (e.g., ["Button", "Edit", "MenuItem"]). Omit for all types.'),
}, async ({ hwnd, title, maxDepth, roleFilter }) => {
    try {
        let qs = `maxDepth=${maxDepth}`;
        if (hwnd !== undefined) {
            qs += `&hwnd=${hwnd}`;
        }
        else if (title) {
            qs += `&title=${encodeURIComponent(title)}`;
        }
        else {
            return {
                content: [{ type: 'text', text: 'Either hwnd or title is required.' }],
                isError: true,
            };
        }
        if (roleFilter && roleFilter.length > 0) {
            qs += `&roleFilter=${encodeURIComponent(roleFilter.join(','))}`;
        }
        const resp = await callSidecar(`/ui-elements?${qs}`);
        if (resp.status === 403) {
            return {
                content: [{ type: 'text', text: 'UI accessibility tool is disabled. Enable the uiAccessibility feature flag.' }],
                isError: true,
            };
        }
        if (resp.status !== 200) {
            const errText = resp.body.toString('utf-8');
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${errText}` }], isError: true };
        }
        const parsed = JSON.parse(resp.body.toString('utf-8'));
        return { content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }] };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
    }
});
// ─── Tool 10: send_input (Agent Runtime Phase 5) ───────────────────────────
server.tool('send_input', `CRITICAL: This tool simulates real mouse/keyboard input at the OS level. Every action requires user approval via the consent dialog. The uiAccessibility, osInputSimulation, and consentGate feature flags must ALL be enabled.

Simulates mouse clicks, keyboard typing, key combinations, and drag operations on any Windows application.

Actions:
- "click": Click at screen coordinates (x, y). Use get_ui_elements first to find precise element positions.
- "type": Type text at the current cursor/focus position using Unicode input.
- "keyCombo": Press a keyboard shortcut (e.g., ["ctrl", "s"] for Ctrl+S).
- "drag": Drag from (x, y) to (toX, toY).

Supported keys for keyCombo: ctrl, alt, shift, win, enter, tab, escape, space, backspace, delete, home, end, pageup, pagedown, up, down, left, right, f1-f12, a-z, 0-9.

Always use get_ui_elements first to discover element positions. Prefer element-based targeting over guessing from screenshots.
After each action, a verification screenshot is returned so you can confirm the result.`, {
    action: zod_1.z
        .enum(['click', 'type', 'keyCombo', 'drag'])
        .describe('The type of input action to simulate'),
    x: zod_1.z
        .number()
        .int()
        .min(0)
        .max(65535)
        .optional()
        .describe('X screen coordinate (for click/drag)'),
    y: zod_1.z
        .number()
        .int()
        .min(0)
        .max(65535)
        .optional()
        .describe('Y screen coordinate (for click/drag)'),
    toX: zod_1.z
        .number()
        .int()
        .min(0)
        .max(65535)
        .optional()
        .describe('Destination X coordinate (for drag)'),
    toY: zod_1.z
        .number()
        .int()
        .min(0)
        .max(65535)
        .optional()
        .describe('Destination Y coordinate (for drag)'),
    button: zod_1.z
        .enum(['left', 'right'])
        .optional()
        .default('left')
        .describe('Mouse button (for click, default "left")'),
    text: zod_1.z
        .string()
        .min(1)
        .max(10000)
        .optional()
        .describe('Text to type (for type action)'),
    keys: zod_1.z
        .array(zod_1.z.string())
        .max(10)
        .optional()
        .describe('Key names for keyboard shortcut (for keyCombo, e.g., ["ctrl", "s"])'),
    description: zod_1.z
        .string()
        .min(1)
        .max(500)
        .describe('Human-readable description of this action. Shown in the consent dialog. e.g., "Click the Save button in Notepad"'),
    target: zod_1.z
        .string()
        .max(200)
        .optional()
        .describe('Optional target element name (for consent dialog context)'),
}, async ({ action, x, y, toX, toY, button, text, keys, description, target }) => {
    try {
        const body = { action, description };
        if (x !== undefined)
            body.x = x;
        if (y !== undefined)
            body.y = y;
        if (toX !== undefined)
            body.toX = toX;
        if (toY !== undefined)
            body.toY = toY;
        if (button)
            body.button = button;
        if (text)
            body.text = text;
        if (keys)
            body.keys = keys;
        if (target)
            body.target = target;
        const discovery = readDiscovery();
        const resp = await sidecarPost('/send-input', discovery.token, discovery.port, JSON.stringify(body));
        if (resp.status === 403) {
            const errBody = JSON.parse(resp.body.toString('utf-8'));
            return {
                content: [{ type: 'text', text: `Feature flag error: ${errBody.error}` }],
                isError: true,
            };
        }
        if (resp.status !== 200) {
            const errText = resp.body.toString('utf-8');
            return { content: [{ type: 'text', text: `HTTP ${resp.status}: ${errText}` }], isError: true };
        }
        const result = JSON.parse(resp.body.toString('utf-8'));
        if (!result.ok) {
            return {
                content: [{ type: 'text', text: `Action failed: ${result.error}` }],
                isError: true,
            };
        }
        // Build response with optional verification screenshot
        const content = [];
        if (result.verificationScreenshot) {
            // Optimize screenshot for vision model
            const pngBuffer = Buffer.from(result.verificationScreenshot, 'base64');
            try {
                const optimized = await optimizeForVision(pngBuffer);
                content.push({
                    type: 'image',
                    data: optimized.buffer.toString('base64'),
                    mimeType: 'image/webp',
                });
                content.push({
                    type: 'text',
                    text: `Action "${action}" executed successfully. Verification screenshot: ${optimized.width}x${optimized.height} webp (${(optimized.buffer.length / 1024).toFixed(0)}KB)`,
                });
            }
            catch {
                content.push({
                    type: 'text',
                    text: `Action "${action}" executed successfully. Verification screenshot optimization failed — raw PNG attached.`,
                });
                content.push({
                    type: 'image',
                    data: result.verificationScreenshot,
                    mimeType: 'image/png',
                });
            }
        }
        else {
            content.push({
                type: 'text',
                text: `Action "${action}" executed successfully.${result.verificationError ? ` (Verification screenshot unavailable: ${result.verificationError})` : ''}`,
            });
        }
        return { content };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: msg }], isError: true };
    }
});
// ─── Server startup ───────────────────────────────────────────────────────────
// server.ts throws 'mcp-server should not return' after require()ing this module
// to prevent native addon initialization. We install an uncaughtException handler
// to swallow that specific error and let the MCP server's event loop continue.
process.on('uncaughtException', (err) => {
    if (err.message === 'mcp-server should not return') {
        // Expected — server.ts guard prevents native addon loading. Ignore.
        return;
    }
    console.error('[mcp] Uncaught exception:', err);
    process.exit(1);
});
async function main() {
    console.error('[mcp] Chat Overlay Widget MCP server starting...');
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('[mcp] MCP server connected via stdio');
}
main().catch((err) => {
    console.error('[mcp] Fatal error:', err);
    process.exit(1);
});
