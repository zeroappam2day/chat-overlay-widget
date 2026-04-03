/**
 * Three-tier output batching for PTY data.
 * Adapted from parallel-code/electron/ipc/pty.ts lines 241-315
 *
 * Strategy:
 *   1. Large chunks (>= 64KB): flush immediately
 *   2. Small chunks (< 1024 bytes): flush immediately (interactive prompt)
 *   3. Medium chunks: schedule 8ms debounce timer then flush
 *
 * When disabled, output passes through unbatched.
 */

import { RingBuffer } from './ringBuffer.js';

const BATCH_MAX = 65536;     // 64KB — flush immediately
const SMALL_CHUNK = 1024;    // 1KB  — flush immediately (interactive)
const BATCH_INTERVAL = 8;    // ms   — debounce for medium chunks

export interface BatcherOptions {
  onFlush: (data: string) => void;
  enabled?: boolean;
}

export class OutputBatcher {
  private buffer = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private ringBuffer: RingBuffer;
  private onFlush: (data: string) => void;
  private _enabled: boolean;

  constructor(opts: BatcherOptions) {
    this.onFlush = opts.onFlush;
    this._enabled = opts.enabled ?? true;
    this.ringBuffer = new RingBuffer(BATCH_MAX);
  }

  push(chunk: string): void {
    // Always record in ring buffer regardless of batching
    this.ringBuffer.write(Buffer.from(chunk, 'utf-8'));

    if (!this._enabled) {
      this.onFlush(chunk);
      return;
    }

    const chunkBytes = Buffer.byteLength(chunk, 'utf-8');

    // Tier 1: Large chunk — flush accumulated + this chunk immediately
    if (chunkBytes >= BATCH_MAX) {
      this.cancelTimer();
      if (this.buffer) {
        this.onFlush(this.buffer);
        this.buffer = '';
      }
      this.onFlush(chunk);
      return;
    }

    // Tier 2: Small chunk — flush immediately (likely interactive prompt)
    if (chunkBytes < SMALL_CHUNK && this.buffer === '') {
      this.onFlush(chunk);
      return;
    }

    // Tier 3: Medium chunk — accumulate and debounce
    this.buffer += chunk;

    // If accumulated buffer exceeds max, flush now
    if (Buffer.byteLength(this.buffer, 'utf-8') >= BATCH_MAX) {
      this.flush();
      return;
    }

    // Schedule flush if not already pending
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), BATCH_INTERVAL);
    }
  }

  flush(): void {
    this.cancelTimer();
    if (this.buffer) {
      this.onFlush(this.buffer);
      this.buffer = '';
    }
  }

  private cancelTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  set enabled(v: boolean) {
    this._enabled = v;
    // If disabling, flush any pending data
    if (!v) this.flush();
  }

  get enabled(): boolean {
    return this._enabled;
  }

  getScrollback(): string {
    return this.ringBuffer.toBase64();
  }

  destroy(): void {
    this.cancelTimer();
    this.buffer = '';
    this.ringBuffer.clear();
  }
}
