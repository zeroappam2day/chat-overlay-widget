/**
 * Fixed-capacity circular byte buffer.
 * Adapted from parallel-code/electron/remote/ring-buffer.ts
 *
 * Default capacity: 64KB (65536 bytes).
 * - write(data): circular write with modulo wrap
 * - read(): returns data in chronological order
 * - toBase64(): serialized form for IPC
 */
export class RingBuffer {
  private buf: Buffer;
  private capacity: number;
  private writePos = 0;
  private filled = false;

  constructor(capacity = 65536) {
    this.capacity = capacity;
    this.buf = Buffer.alloc(capacity);
  }

  write(data: Buffer): void {
    if (data.length >= this.capacity) {
      // Data exceeds capacity — keep only the tail
      data.copy(this.buf, 0, data.length - this.capacity);
      this.writePos = 0;
      this.filled = true;
      return;
    }

    const remaining = this.capacity - this.writePos;
    if (data.length <= remaining) {
      data.copy(this.buf, this.writePos);
    } else {
      // Split across boundary
      data.copy(this.buf, this.writePos, 0, remaining);
      data.copy(this.buf, 0, remaining);
    }

    const newPos = (this.writePos + data.length) % this.capacity;
    if (newPos <= this.writePos && data.length > 0) {
      this.filled = true;
    }
    this.writePos = newPos;
  }

  read(): Buffer {
    if (!this.filled) {
      // Haven't wrapped yet — data is from 0..writePos
      return Buffer.from(this.buf.subarray(0, this.writePos));
    }
    // Wrapped — chronological order: writePos..capacity then 0..writePos
    const tail = this.buf.subarray(this.writePos, this.capacity);
    const head = this.buf.subarray(0, this.writePos);
    return Buffer.concat([tail, head]);
  }

  toBase64(): string {
    return this.read().toString('base64');
  }

  clear(): void {
    this.writePos = 0;
    this.filled = false;
  }

  get size(): number {
    return this.filled ? this.capacity : this.writePos;
  }
}
