/**
 * Wrapper around PTYSession that routes output through OutputBatcher.
 *
 * Composition approach: creates a standard PTYSession, then intercepts the
 * WebSocket send path by providing a proxy WebSocket that captures 'output'
 * messages and routes them through the batcher.
 *
 * When batching is disabled, output passes through unmodified.
 *
 * Phase 2 addition: AutoTrustDetector receives raw output before batching.
 * When autoTrust is disabled, detector does nothing.
 */

import type WebSocket from 'ws';
import type { ServerMessage } from './protocol.js';
import { PTYSession } from './ptySession.js';
import { OutputBatcher } from './outputBatcher.js';
import { AutoTrustDetector } from './autoTrust.js';
import { WalkthroughWatcher } from './walkthroughWatcher.js';

function sendMsg(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export class BatchedPTYSession {
  private ptySession: PTYSession;
  private batcher: OutputBatcher;
  private autoTrust: AutoTrustDetector;
  private walkthroughWatcher: WalkthroughWatcher;

  constructor(
    private ws: WebSocket,
    shellExe: string,
    cols: number = 80,
    rows: number = 24,
    batchingEnabled: boolean = true,
    private paneId?: string,
  ) {
    // 1. Create AutoTrustDetector with deferred PTY write (PTYSession not yet created)
    let ptyWrite: ((data: string) => void) | null = null;
    this.autoTrust = new AutoTrustDetector({
      onAccept: () => { ptyWrite?.('\r'); },
      onEvent: (evt) => sendMsg(ws, { type: 'auto-trust-event', ...evt }),
      enabled: false, // OFF by default — gated by autoTrust feature flag
    });
    const autoTrust = this.autoTrust;

    // 1b. Create WalkthroughWatcher (Agent Runtime Phase 2)
    // onAdvance callback is set externally by server.ts after construction
    this.walkthroughWatcher = new WalkthroughWatcher({
      onAdvance: () => { /* wired by server.ts */ },
      enabled: false, // OFF by default — gated by conditionalAdvance feature flag
    });
    const walkthroughWatcher = this.walkthroughWatcher;

    // 2. Create batcher (referenced by proxy closure)
    const pid = this.paneId;
    const batcher = new OutputBatcher({
      onFlush: (data: string) => {
        sendMsg(ws, { type: 'output', data, ...(pid ? { paneId: pid } : {}) });
      },
      enabled: batchingEnabled,
    });
    this.batcher = batcher;

    // 3. Create proxy WebSocket that intercepts 'output' messages
    //    Feed AutoTrustDetector before routing through batcher
    const proxyWs = new Proxy(ws, {
      get(target, prop, receiver) {
        if (prop === 'send') {
          return (data: string) => {
            try {
              const parsed = JSON.parse(data) as ServerMessage;
              if (parsed.type === 'output') {
                // Feed raw output to autoTrust detector before batching
                autoTrust.feed(parsed.data);
                // Feed raw output to walkthrough watcher (Agent Runtime Phase 2)
                walkthroughWatcher.feed(parsed.data);
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

    // 4. Create PTYSession with proxy — it thinks it's sending to the real ws
    this.ptySession = new PTYSession(proxyWs as WebSocket, shellExe, cols, rows, this.paneId);

    // 5. Wire deferred PTY write now that ptySession exists
    ptyWrite = (data: string) => this.ptySession.write(data);
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

  set autoTrustEnabled(v: boolean) {
    this.autoTrust.enabled = v;
  }

  get autoTrustEnabled(): boolean {
    return this.autoTrust.enabled;
  }

  /** Agent Runtime Phase 2: WalkthroughWatcher access */
  get walkthroughWatcherInstance(): WalkthroughWatcher {
    return this.walkthroughWatcher;
  }

  set walkthroughWatcherEnabled(v: boolean) {
    this.walkthroughWatcher.enabled = v;
  }

  get walkthroughWatcherEnabled(): boolean {
    return this.walkthroughWatcher.enabled;
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
    this.autoTrust.destroy();
    this.walkthroughWatcher.destroy();
    this.batcher.destroy();
    this.ptySession.destroy();
  }
}
