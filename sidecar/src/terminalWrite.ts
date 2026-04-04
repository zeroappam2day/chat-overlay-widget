/**
 * HTTP route handler for terminal write requests (Agent Runtime Phase 1).
 * Exposes the existing PTY write path as an HTTP endpoint for the MCP tool.
 * Gated behind the terminalWriteMcp feature flag.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PTYSession } from './ptySession';
import type { BatchedPTYSession } from './batchedPtySession';
import type { WebSocket } from 'ws';

const MAX_TEXT_LENGTH = 10000;

function respond(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function handleTerminalWrite(
  req: IncomingMessage,
  res: ServerResponse,
  activeSessions: Map<WebSocket, PTYSession | BatchedPTYSession>,
  sidecarFlags: Record<string, boolean>
): void {
  if (!sidecarFlags.terminalWriteMcp) {
    respond(res, 403, { error: 'Terminal write MCP tool is disabled' });
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    let body: { text?: unknown; paneId?: unknown; pressEnter?: unknown };
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      respond(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    const { text, pressEnter } = body;

    if (typeof text !== 'string') {
      respond(res, 400, { error: 'Missing or invalid "text" field (must be a string)' });
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      respond(res, 400, { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` });
      return;
    }

    const session = [...activeSessions.values()][0];
    if (!session) {
      respond(res, 404, { error: 'No active terminal session' });
      return;
    }

    const toWrite = pressEnter ? text + '\r' : text;
    session.write(toWrite);

    respond(res, 200, { ok: true, bytesWritten: toWrite.length });
  });
}
