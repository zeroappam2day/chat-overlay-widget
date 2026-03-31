import stripAnsi from 'strip-ansi';

const MAX_BYTES = 65536; // 64KB

/**
 * Collapses carriage-return overwrites on each line.
 * Splits on \n, keeps only content after the last \r on each segment,
 * then rejoins with \n. This removes spinner/progress-bar intermediate frames.
 */
export function crFold(raw: string): string {
  return raw.split('\n').map(line => {
    const lastCr = line.lastIndexOf('\r');
    return lastCr >= 0 ? line.slice(lastCr + 1) : line;
  }).join('\n');
}

/**
 * A 64KB rolling ring buffer that stores clean PTY output lines.
 * Strips ANSI/OSC escape codes and collapses CR-overwritten content at write time.
 * Exposes cursor-paginated reads via getLines().
 */
export class TerminalBuffer {
  private lines: string[] = [];
  private byteCount = 0;
  private totalLinesWritten = 0; // monotone cursor
  private partial = '';          // incomplete line accumulator

  readonly MAX_BYTES = MAX_BYTES;

  /**
   * Append raw PTY output to the buffer.
   * Carries forward any chunk that doesn't end with \n.
   */
  append(raw: string): void {
    const combined = this.partial + raw;
    const segments = combined.split('\n');
    // Last segment is incomplete (no trailing \n) — carry forward
    this.partial = segments.pop() ?? '';

    for (const seg of segments) {
      // Two-step pipeline: CR-fold then ANSI strip
      const clean = stripAnsi(crFold(seg)).trimEnd();
      if (clean === '') continue; // skip empty/whitespace-only lines

      const bytes = Buffer.byteLength(clean, 'utf8');

      // Evict oldest lines until byte budget fits the new line
      while (this.byteCount + bytes > MAX_BYTES && this.lines.length > 0) {
        const evicted = this.lines.shift()!;
        this.byteCount -= Buffer.byteLength(evicted, 'utf8');
      }

      this.lines.push(clean);
      this.byteCount += bytes;
      this.totalLinesWritten++;
    }
  }

  /**
   * Return up to `n` lines from the buffer.
   * If `since` is provided, only lines written after that cursor position
   * are returned (cursor-paginated read).
   *
   * @param n      Max lines to return (default 50). Use 0 for all available.
   * @param since  Cursor position to start from. Lines at or before this
   *               position are excluded. Pass 0 or omit for all buffered lines.
   * @returns      { lines: string[], cursor: number } where cursor is the
   *               total lines written so far (use as `since` on next call).
   */
  getLines(n = 50, since?: number): { lines: string[]; cursor: number } {
    const bufferStartCursor = this.totalLinesWritten - this.lines.length;
    const sinceOffset = since !== undefined
      ? Math.max(0, since - bufferStartCursor)
      : 0;
    const available = this.lines.slice(sinceOffset);
    const result = n > 0 ? available.slice(-n) : available;
    return {
      lines: result,
      cursor: this.totalLinesWritten,
    };
  }

  /**
   * Reset the buffer — clear all lines, reset cursor and byte count.
   * Called when a new PTY session starts.
   */
  reset(): void {
    this.lines = [];
    this.byteCount = 0;
    this.totalLinesWritten = 0;
    this.partial = '';
  }
}
