/**
 * Ask About Code backend handler (Phase 16).
 * Spawns `claude -p <prompt> --model sonnet --no-input` as a child process.
 * Streams stdout chunks back to frontend via WebSocket.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type WebSocket from 'ws';

const MAX_PROMPT_LENGTH = 50_000;
const MAX_CONCURRENT = 5;
const TIMEOUT_MS = 120_000;
const MAX_RESPONSE_CHARS = 100_000;

const activeRequests = new Map<string, ChildProcess>();
const timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function askAboutCode(
  ws: WebSocket,
  requestId: string,
  prompt: string,
  cwd: string,
): void {
  if (activeRequests.size >= MAX_CONCURRENT) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'ask-code-response',
        requestId,
        messageType: 'error',
        text: 'Too many concurrent requests (max 5)',
      }));
    }
    return;
  }

  const truncatedPrompt = prompt.slice(0, MAX_PROMPT_LENGTH);

  // Clean environment to prevent child claude from inheriting parent session
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_SESSION;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const child = spawn('claude', ['-p', truncatedPrompt, '--model', 'sonnet', '--no-input'], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: true,
  });

  activeRequests.set(requestId, child);

  let totalChars = 0;

  const timer = setTimeout(() => {
    child.kill();
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'ask-code-response',
        requestId,
        messageType: 'error',
        text: 'Request timed out (2 minutes)',
      }));
    }
    cleanup(requestId);
  }, TIMEOUT_MS);
  timeoutTimers.set(requestId, timer);

  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    totalChars += text.length;
    if (totalChars > MAX_RESPONSE_CHARS) {
      child.kill();
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'ask-code-response',
          requestId,
          messageType: 'error',
          text: 'Response too large (>100K chars). Truncated.',
        }));
      }
      cleanup(requestId);
      return;
    }
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'ask-code-response',
        requestId,
        messageType: 'chunk',
        text,
      }));
    }
  });

  child.stderr?.on('data', (_data: Buffer) => {
    // Log but don't send — stderr is noisy with progress bars
  });

  child.on('close', (exitCode) => {
    cleanup(requestId);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'ask-code-response',
        requestId,
        messageType: 'done',
        exitCode: exitCode ?? 0,
      }));
    }
  });

  child.on('error', (err) => {
    cleanup(requestId);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'ask-code-response',
        requestId,
        messageType: 'error',
        text: `Failed to spawn claude: ${err.message}`,
      }));
    }
  });
}

export function cancelAskCode(requestId: string): void {
  const child = activeRequests.get(requestId);
  if (child) {
    child.kill();
    cleanup(requestId);
  }
}

function cleanup(requestId: string): void {
  clearTimeout(timeoutTimers.get(requestId));
  timeoutTimers.delete(requestId);
  activeRequests.delete(requestId);
}
