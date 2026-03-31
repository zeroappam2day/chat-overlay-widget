import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { TerminalBuffer, crFold, initStripAnsi } from './terminalBuffer.js';

beforeAll(async () => {
  await initStripAnsi();
});

describe('crFold', () => {
  it('keeps only content after last \\r on each line', () => {
    expect(crFold('10%\r20%\r30%\n')).toBe('30%\n');
  });

  it('passes through lines with no carriage returns', () => {
    expect(crFold('no-cr-here\n')).toBe('no-cr-here\n');
  });

  it('handles multiple lines with mixed CR usage', () => {
    const result = crFold('line1\nspinner\rframe2\nline3\n');
    expect(result).toBe('line1\nframe2\nline3\n');
  });

  it('handles empty string', () => {
    expect(crFold('')).toBe('');
  });
});

describe('TerminalBuffer', () => {
  let buf: TerminalBuffer;

  beforeEach(() => {
    buf = new TerminalBuffer();
  });

  it('strips ANSI SGR codes on append', () => {
    buf.append('hello\x1b[32m world\x1b[0m\n');
    const { lines } = buf.getLines(10);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('hello world');
  });

  it('strips OSC-8 hyperlinks, preserving visible link text', () => {
    buf.append('\x1b]8;;https://x.com\x07Click\x1b]8;;\x07\n');
    const { lines } = buf.getLines(10);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Click');
  });

  it('evicts oldest lines when byte budget (64KB) is exceeded', () => {
    // Append 100 lines of ~1KB each (total ~100KB — exceeds 64KB budget)
    const line = 'x'.repeat(1000);
    for (let i = 0; i < 100; i++) {
      buf.append(`${line}\n`);
    }
    const { lines } = buf.getLines(200);
    // Buffer should contain fewer than 100 lines (oldest were evicted)
    expect(lines.length).toBeLessThan(100);
    // Total bytes held should be <= 64KB
    const totalBytes = lines.reduce((sum, l) => sum + Buffer.byteLength(l, 'utf8'), 0);
    expect(totalBytes).toBeLessThanOrEqual(65536);
  });

  it('getLines(5) returns the last 5 lines when buffer has 20 lines', () => {
    for (let i = 1; i <= 20; i++) {
      buf.append(`line${i}\n`);
    }
    const { lines } = buf.getLines(5);
    expect(lines).toHaveLength(5);
    expect(lines[4]).toBe('line20');
    expect(lines[0]).toBe('line16');
  });

  it('getLines with since= returns only lines after cursor position', () => {
    for (let i = 1; i <= 20; i++) {
      buf.append(`line${i}\n`);
    }
    const { cursor: cursor1 } = buf.getLines(10);
    // Write 5 more lines after capturing cursor
    for (let i = 21; i <= 25; i++) {
      buf.append(`line${i}\n`);
    }
    const { lines: newLines, cursor: cursor2 } = buf.getLines(50, cursor1);
    expect(newLines).toHaveLength(5);
    expect(newLines[0]).toBe('line21');
    expect(newLines[4]).toBe('line25');
    expect(cursor2).toBe(25);
  });

  it('getLines with since=0 returns all buffered lines', () => {
    for (let i = 1; i <= 10; i++) {
      buf.append(`line${i}\n`);
    }
    const { lines } = buf.getLines(100, 0);
    expect(lines).toHaveLength(10);
  });

  it('carries forward a partial chunk without trailing \\n and flushes on next append', () => {
    buf.append('partial');          // no trailing \n — not yet committed
    expect(buf.getLines(10).lines).toHaveLength(0);
    buf.append('-rest\n');          // now has \n — flushes
    const { lines } = buf.getLines(10);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('partial-rest');
  });

  it('reset() clears all lines, cursor, and byteCount', () => {
    for (let i = 1; i <= 5; i++) {
      buf.append(`line${i}\n`);
    }
    buf.reset();
    const { lines, cursor } = buf.getLines(50);
    expect(lines).toHaveLength(0);
    expect(cursor).toBe(0);
  });

  it('excludes empty lines (only whitespace after strip)', () => {
    buf.append('   \n');
    buf.append('\x1b[32m\x1b[0m\n'); // only ANSI codes — strips to empty
    buf.append('real line\n');
    const { lines } = buf.getLines(10);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('real line');
  });

  it('cursor increments monotonically and is returned by getLines', () => {
    buf.append('a\n');
    buf.append('b\n');
    const { cursor } = buf.getLines(10);
    expect(cursor).toBe(2);
    buf.append('c\n');
    const { cursor: cursor2 } = buf.getLines(10);
    expect(cursor2).toBe(3);
  });

  it('collapses CR-overwritten content (progress bar pattern) before storing', () => {
    buf.append('10%\r20%\r30%\n');
    const { lines } = buf.getLines(10);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('30%');
  });
});
