/**
 * MCP stdio server for Chat Overlay Widget.
 * Loaded via require('./mcp-server.js') from server.ts when process.argv[2] === 'mcp'.
 * Self-contained — no imports from server.ts, protocol.ts, or any native addon.
 * All logging to stderr (stdout is reserved for MCP JSON-RPC protocol).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
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
  'Capture a screenshot of the Chat Overlay Widget window. Returns a PNG image with sensitive areas blurred. The screenshot shows the current state of the terminal and any UI elements.',
  {},
  async () => {
    try {
      const resp = await callSidecar('/screenshot?blur=true');
      if (resp.status !== 200) {
        const errText = resp.body.toString('utf-8');
        return { content: [{ type: 'text' as const, text: `HTTP ${resp.status}: ${errText}` }], isError: true };
      }
      const base64 = resp.body.toString('base64');
      return { content: [{ type: 'image' as const, data: base64, mimeType: 'image/png' }] };
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
