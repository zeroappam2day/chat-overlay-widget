/**
 * Wrapper around PTYSession that routes output through OutputBatcher.
 *
 * Composition approach: creates a standard PTYSession, then intercepts the
 * WebSocket send path by providing a proxy WebSocket that captures 'output'
 * messages and routes them through the batcher.
 *
 * When batching is disabled, output passes through unmodified.
 */

import type WebSocket from 'ws';
import type { ServerMessage } from './protocol.js';
import { PTYSession } from './ptySession.js';
import { OutputBatcher } from './outputBatcher.js';

function sendMsg(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export class BatchedPTYSession {
  private ptySession: PTYSession;
  private batcher: OutputBatcher;

  constructor(
    private ws: WebSocket,
    shellExe: string,
    cols: number = 80,
    rows: number = 24,
    batchingEnabled: boolean = true,
  ) {
    // Create a proxy WebSocket that intercepts 'output' messages
    const proxyWs = new Proxy(ws, {
      get(target, prop, receiver) {
        if (prop === 'send') {
          return (data: string) => {
            try {
              const parsed = JSON.parse(data) as ServerMessage;
              if (parsed.type === 'output') {
                // Route through batcher instead of sending directly
                batcher.push(parsed.data);
                return;
              }
            } catch {
              // Not JSON — pass through
            }
            // Non-output messages pass through directly
            target.send(data);
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });

    // Create batcher first (referenced by proxy closure)
    const batcher = new OutputBatcher({
      onFlush: (data: string) => {
        sendMsg(ws, { type: 'output', data });
      },
      enabled: batchingEnabled,
    });
    this.batcher = batcher;

    // Create PTYSession with proxy — it thinks it's sending to the real ws
    this.ptySession = new PTYSession(proxyWs as WebSocket, shellExe, cols, rows);
  }

  write(data: string): void {
    this.ptySession.write(data);
  }

  resize(cols: number, rows: number): void {
    this.ptySession.resize(cols, rows);
  }

  async saveImage(base64: string): Promise<string> {
    return this.ptySession.saveImage(base64);
  }

  set batchingEnabled(v: boolean) {
    this.batcher.enabled = v;
  }

  get batchingEnabled(): boolean {
    return this.batcher.enabled;
  }

  getScrollback(): string {
    return this.batcher.getScrollback();
  }

  get terminalBuffer() {
    return this.ptySession.terminalBuffer;
  }

  get sessionId(): number {
    return this.ptySession.sessionId;
  }

  destroy(): void {
    this.batcher.destroy();
    this.ptySession.destroy();
  }
}
