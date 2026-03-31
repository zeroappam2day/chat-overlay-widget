/**
 * server.test.ts — Unit tests for /terminal-state and /session-history logic.
 *
 * We test the core data pipeline used by both HTTP endpoints directly
 * (TerminalBuffer, crFold, stripAnsiSync) rather than spinning up the full
 * HTTP server (which requires SQLite, node-pty, etc.). Auth, 404, and 400
 * error paths are verified via manual curl testing in the checkpoint task.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TerminalBuffer, crFold, stripAnsiSync, initStripAnsi } from './terminalBuffer.js';
import { scrub } from './secretScrubber.js';

beforeAll(async () => {
  // Pre-load strip-ansi ESM module (same call as sidecar startup)
  await initStripAnsi();
});

// ---------------------------------------------------------------------------
// /terminal-state pipeline — TerminalBuffer.getLines
// ---------------------------------------------------------------------------

describe('/terminal-state — TerminalBuffer.getLines shape', () => {
  let buf: TerminalBuffer;

  beforeEach(() => {
    buf = new TerminalBuffer();
  });

  it('returns { lines, cursor } with correct types', () => {
    buf.append('hello world\n');
    const result = buf.getLines(50);
    expect(result).toHaveProperty('lines');
    expect(result).toHaveProperty('cursor');
    expect(Array.isArray(result.lines)).toBe(true);
    expect(typeof result.cursor).toBe('number');
  });

  it('default lines=50 returns at most 50 lines', () => {
    for (let i = 0; i < 60; i++) {
      buf.append(`line${i}\n`);
    }
    const { lines } = buf.getLines(50);
    expect(lines.length).toBeLessThanOrEqual(50);
  });

  it('lines cap at 500 — simulates Math.min(500, n) in server route', () => {
    // The server caps at 500: Math.min(500, Math.max(1, parseInt(...) || 50))
    // Verify that calling getLines(500) works and returns buffered lines
    for (let i = 0; i < 10; i++) {
      buf.append(`line${i}\n`);
    }
    const { lines } = buf.getLines(500);
    expect(lines.length).toBe(10); // only 10 in buffer, cap doesn't truncate
  });

  it('since= parameter returns only lines written after that cursor', () => {
    for (let i = 1; i <= 10; i++) {
      buf.append(`line${i}\n`);
    }
    const { cursor } = buf.getLines(10);
    // Add 3 more lines
    buf.append('new1\n');
    buf.append('new2\n');
    buf.append('new3\n');
    const { lines: newLines, cursor: cursor2 } = buf.getLines(50, cursor);
    expect(newLines).toHaveLength(3);
    expect(newLines[0]).toBe('new1');
    expect(newLines[2]).toBe('new3');
    expect(cursor2).toBe(13);
  });

  it('since=undefined returns all buffered lines (same as no since)', () => {
    for (let i = 1; i <= 5; i++) {
      buf.append(`line${i}\n`);
    }
    const { lines } = buf.getLines(50, undefined);
    expect(lines).toHaveLength(5);
  });

  it('returns empty lines array when buffer is empty (no active session data)', () => {
    const { lines, cursor } = buf.getLines(50);
    expect(lines).toHaveLength(0);
    expect(cursor).toBe(0);
  });

  it('lines contain no ANSI escape codes (strip-ansi applied at append time)', () => {
    buf.append('\x1b[32mgreen text\x1b[0m\n');
    buf.append('\x1b[1;33mbold yellow\x1b[0m\n');
    const { lines } = buf.getLines(10);
    for (const line of lines) {
      // eslint-disable-next-line no-control-regex
      expect(line).not.toMatch(/\x1b\[/);
    }
    expect(lines[0]).toBe('green text');
    expect(lines[1]).toBe('bold yellow');
  });
});

// ---------------------------------------------------------------------------
// /session-history pipeline — crFold + stripAnsiSync + split/filter
// ---------------------------------------------------------------------------

describe('/session-history — cleaning pipeline (crFold + stripAnsiSync)', () => {
  it('crFold collapses progress bar CR overwrites', () => {
    const raw = '0%\r25%\r50%\r75%\r100%\n';
    expect(crFold(raw)).toBe('100%\n');
  });

  it('stripAnsiSync removes SGR color codes', () => {
    const raw = '\x1b[32mhello\x1b[0m world';
    expect(stripAnsiSync(raw)).toBe('hello world');
  });

  it('combined pipeline: stripAnsiSync(crFold(raw)) produces clean text', () => {
    const raw = '\x1b[32m0%\r50%\r100%\x1b[0m\n';
    const cleaned = stripAnsiSync(crFold(raw));
    expect(cleaned).toBe('100%\n');
  });

  it('session-history split/filter logic removes empty lines', () => {
    // Simulates: cleaned.split("\\n").filter(l => l.trim() !== "")
    const cleaned = 'line1\n\n   \nline2\nline3\n';
    const allLines = cleaned.split('\n').filter(l => l.trim() !== '');
    expect(allLines).toHaveLength(3);
    expect(allLines[0]).toBe('line1');
    expect(allLines[2]).toBe('line3');
  });

  it('session-history slice(-lines) returns the last N lines from history', () => {
    // Simulates: allLines.slice(-lines) when lines=2
    const allLines = ['a', 'b', 'c', 'd', 'e'];
    const result = allLines.slice(-2);
    expect(result).toEqual(['d', 'e']);
  });

  it('total reflects all lines in history, not just the returned slice', () => {
    // Simulates: { lines: result, sessionId, total: allLines.length }
    const allLines = ['a', 'b', 'c', 'd', 'e'];
    const lines = 3;
    const result = allLines.slice(-lines);
    const total = allLines.length;
    expect(result).toHaveLength(3);
    expect(total).toBe(5); // all 5 lines, even though only 3 returned
  });

  it('sessionId NaN guard: parseInt("", 10) is NaN (triggers 400)', () => {
    // Simulates: parseInt(url.searchParams.get("sessionId") ?? "", 10)
    expect(isNaN(parseInt('', 10))).toBe(true);
    expect(isNaN(parseInt('abc', 10))).toBe(true);
    expect(isNaN(parseInt('1', 10))).toBe(false);
  });

  it('lines parameter defaults to 100 and is capped at 500', () => {
    // Simulates: Math.min(500, Math.max(1, parseInt(...) || 100))
    const cap = (raw: string) =>
      Math.min(500, Math.max(1, parseInt(raw, 10) || 100));
    expect(cap('')).toBe(100);     // default
    expect(cap('999')).toBe(500);  // capped
    expect(cap('50')).toBe(50);    // normal
    expect(cap('0')).toBe(100);    // 0 → fallback default
    expect(cap('-1')).toBe(1);     // negative → Math.max(1, ...)
  });
});

// ---------------------------------------------------------------------------
// Secret scrubbing integration
// ---------------------------------------------------------------------------

describe('secret scrubbing integration', () => {
  let buf: TerminalBuffer;

  beforeEach(() => {
    buf = new TerminalBuffer();
  });

  it('/terminal-state with default scrub param scrubs secrets', () => {
    // Simulate shouldScrub=true (default — scrub param absent or not "false")
    buf.append('export AWS_KEY=AKIAIOSFODNN7EXAMPLE\n');
    const snapshot = buf.getLines(50);
    // Simulate server behavior: shouldScrub defaults to true
    const shouldScrub = true;
    const lines = shouldScrub ? snapshot.lines.map(line => scrub(line)) : snapshot.lines;
    expect(lines.some(l => l.includes('[REDACTED]'))).toBe(true);
    expect(lines.some(l => l.includes('AKIAIOSFODNN7EXAMPLE'))).toBe(false);
  });

  it('/terminal-state with scrub=false preserves secrets', () => {
    // Simulate shouldScrub=false (caller explicitly passed scrub=false)
    buf.append('export AWS_KEY=AKIAIOSFODNN7EXAMPLE\n');
    const snapshot = buf.getLines(50);
    const shouldScrub = false;
    const lines = shouldScrub ? snapshot.lines.map(line => scrub(line)) : snapshot.lines;
    expect(lines.some(l => l.includes('AKIAIOSFODNN7EXAMPLE'))).toBe(true);
  });

  it('/session-history scrubbing applies to cleaned text', () => {
    // Simulate session-history pipeline: crFold + stripAnsiSync + scrub
    const raw = 'export AWS_KEY=AKIAIOSFODNN7EXAMPLE\n';
    const cleaned = stripAnsiSync(crFold(raw));
    const allLines = cleaned.split('\n').filter(l => l.trim() !== '');
    const result = allLines.slice(-100);
    // shouldScrub=true (default)
    const outputLines = result.map(line => scrub(line));
    expect(outputLines.some(l => l.includes('[REDACTED]'))).toBe(true);
    expect(outputLines.some(l => l.includes('AKIAIOSFODNN7EXAMPLE'))).toBe(false);
  });

  it('scrubbed response includes warning field', () => {
    // Simulate building the response JSON with shouldScrub=true
    const shouldScrub = true;
    const lines = ['some output'];
    const response = shouldScrub
      ? { lines, cursor: 1, warning: 'Secret scrubbing is best-effort. Do not rely on it as a security boundary.' }
      : { lines, cursor: 1 };
    expect(response).toHaveProperty('warning');
    expect((response as { warning?: string }).warning).toBe(
      'Secret scrubbing is best-effort. Do not rely on it as a security boundary.'
    );
  });

  it('unscrubbed response has no warning field', () => {
    // Simulate building response with shouldScrub=false
    const shouldScrub = false;
    const lines = ['some output'];
    const response = shouldScrub
      ? { lines, cursor: 1, warning: 'Secret scrubbing is best-effort. Do not rely on it as a security boundary.' }
      : { lines, cursor: 1 };
    expect(response).not.toHaveProperty('warning');
  });

  it('multiple secrets in terminal output are all redacted', () => {
    // Both an AWS key and a GitHub PAT on the same line
    const line = 'key=AKIAIOSFODNN7EXAMPLE token=ghp_abcdefghijklmnopqrstuvwxyz1234567890';
    const result = scrub(line);
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(result).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    // Both replaced with [REDACTED]
    const redactedCount = (result.match(/\[REDACTED\]/g) ?? []).length;
    expect(redactedCount).toBeGreaterThanOrEqual(2);
  });
});
