import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock external dependencies
vi.mock('./windowEnumerator.js', () => ({
  listWindows: vi.fn(() => []),
}));

vi.mock('./windowCapture.js', () => ({
  captureWindowByHwnd: vi.fn(() => ({ ok: false, error: 'MOCK_DEFAULT' })),
}));

vi.mock('./secretScrubber.js', () => ({
  detectSecrets: vi.fn(() => []),
}));

import { captureSelf, blurSecretLines, captureSelfScreenshot, TERMINAL_TOP_OFFSET, LINE_HEIGHT } from './screenshotSelf.js';
import { listWindows } from './windowEnumerator.js';
import { captureWindowByHwnd } from './windowCapture.js';
import { detectSecrets } from './secretScrubber.js';
import { TerminalBuffer, initStripAnsi } from './terminalBuffer.js';

const tmpDir = os.tmpdir();
let testPngPath: string;

beforeAll(async () => {
  await initStripAnsi();
  // Create a real 100x200 red PNG for blurSecretLines tests
  testPngPath = path.join(tmpDir, 'screenshotSelf-test.png');
  await sharp({
    create: { width: 100, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  }).png().toFile(testPngPath);
});

afterAll(async () => {
  await fs.promises.unlink(testPngPath).catch(() => {});
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('TERMINAL_TOP_OFFSET is 48', () => {
    expect(TERMINAL_TOP_OFFSET).toBe(48);
  });
  it('LINE_HEIGHT is 17', () => {
    expect(LINE_HEIGHT).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// captureSelf
// ---------------------------------------------------------------------------

describe('captureSelf', () => {
  it('returns SELF_NOT_FOUND when listWindows returns no Chat Overlay match', () => {
    vi.mocked(listWindows).mockReturnValue([]);
    const result = captureSelf();
    expect(result).toEqual({ ok: false, error: 'SELF_NOT_FOUND' });
  });

  it('returns SELF_NOT_FOUND when windows exist but none match Chat Overlay', () => {
    vi.mocked(listWindows).mockReturnValue([
      { title: 'Notepad', hwnd: 1, pid: 2, processName: 'notepad.exe' },
    ]);
    const result = captureSelf();
    expect(result).toEqual({ ok: false, error: 'SELF_NOT_FOUND' });
  });

  it('calls captureWindowByHwnd with correct hwnd/pid from match', () => {
    vi.mocked(listWindows).mockReturnValue([
      { title: 'Chat Overlay Widget', hwnd: 12345, pid: 999, processName: 'test.exe' },
    ]);
    vi.mocked(captureWindowByHwnd).mockReturnValue({
      ok: true,
      data: { path: '/tmp/test.png', bounds: { x: 0, y: 0, w: 100, h: 200 }, captureSize: { w: 100, h: 200 }, dpiScale: 1 },
    });
    const result = captureSelf();
    expect(captureWindowByHwnd).toHaveBeenCalledWith(12345, 999, 'Chat Overlay Widget');
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// blurSecretLines
// ---------------------------------------------------------------------------

describe('blurSecretLines', () => {
  it('returns unmodified PNG when secretLineNumbers is empty', async () => {
    const original = await sharp(testPngPath).png().toBuffer();
    const result = await blurSecretLines(testPngPath, []);
    expect(result.length).toBe(original.length);
  });

  it('returns modified buffer when secret lines are provided', async () => {
    const original = await sharp(testPngPath).png().toBuffer();
    const result = await blurSecretLines(testPngPath, [0], { topOffset: 0, lineHeight: 17 });
    // Buffer should differ because black rect was composited
    expect(Buffer.compare(original, result)).not.toBe(0);
  });

  it('respects custom lineHeight and topOffset opts', async () => {
    // Should not throw with custom opts
    const result = await blurSecretLines(testPngPath, [0], { lineHeight: 20, topOffset: 10 });
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('skips lines that exceed image height', async () => {
    // Line 1000 at default offset would be way past 200px height
    const result = await blurSecretLines(testPngPath, [1000]);
    // Should still return a valid buffer (no rects composited)
    expect(result).toBeInstanceOf(Buffer);
  });
});

// ---------------------------------------------------------------------------
// captureSelfScreenshot
// ---------------------------------------------------------------------------

describe('captureSelfScreenshot', () => {
  it('returns error when captureSelf fails', async () => {
    vi.mocked(listWindows).mockReturnValue([]);
    const buf = new TerminalBuffer();
    const result = await captureSelfScreenshot(buf, false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('SELF_NOT_FOUND');
  });

  it('blur=false returns raw PNG without calling detectSecrets', async () => {
    const tmpPng = path.join(tmpDir, `screenshotSelf-raw-${Date.now()}.png`);
    await sharp({ create: { width: 100, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile(tmpPng);

    vi.mocked(listWindows).mockReturnValue([
      { title: 'Chat Overlay Widget', hwnd: 1, pid: 1, processName: 'test' },
    ]);
    vi.mocked(captureWindowByHwnd).mockReturnValue({
      ok: true,
      data: { path: tmpPng, bounds: { x: 0, y: 0, w: 100, h: 200 }, captureSize: { w: 100, h: 200 }, dpiScale: 1 },
    });
    const buf = new TerminalBuffer();
    const result = await captureSelfScreenshot(buf, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blurred).toBe(false);
      expect(result.buffer).toBeInstanceOf(Buffer);
    }
    expect(detectSecrets).not.toHaveBeenCalled();
  });

  it('blur=true calls detectSecrets and returns blurred=true', async () => {
    const tmpPng = path.join(tmpDir, `screenshotSelf-blur-${Date.now()}.png`);
    await sharp({ create: { width: 100, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile(tmpPng);

    vi.mocked(listWindows).mockReturnValue([
      { title: 'Chat Overlay Widget', hwnd: 1, pid: 1, processName: 'test' },
    ]);
    vi.mocked(captureWindowByHwnd).mockReturnValue({
      ok: true,
      data: { path: tmpPng, bounds: { x: 0, y: 0, w: 100, h: 200 }, captureSize: { w: 100, h: 200 }, dpiScale: 1 },
    });
    vi.mocked(detectSecrets).mockReturnValue([
      { line: 2, startIndex: 0, endIndex: 20, patternName: 'aws-access-key' },
    ]);

    const buf = new TerminalBuffer();
    buf.append('line0\nline1\nAKIAIOSFODNN7EXAMPLE\nline3\n');
    const result = await captureSelfScreenshot(buf, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blurred).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
    }
    expect(detectSecrets).toHaveBeenCalled();
  });

  it('blur=true with no secrets still returns blurred=true', async () => {
    const tmpPng = path.join(tmpDir, `screenshotSelf-nosecret-${Date.now()}.png`);
    await sharp({ create: { width: 100, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile(tmpPng);

    vi.mocked(listWindows).mockReturnValue([
      { title: 'Chat Overlay Widget', hwnd: 1, pid: 1, processName: 'test' },
    ]);
    vi.mocked(captureWindowByHwnd).mockReturnValue({
      ok: true,
      data: { path: tmpPng, bounds: { x: 0, y: 0, w: 100, h: 200 }, captureSize: { w: 100, h: 200 }, dpiScale: 1 },
    });
    vi.mocked(detectSecrets).mockReturnValue([]);

    const buf = new TerminalBuffer();
    buf.append('safe line\n');
    const result = await captureSelfScreenshot(buf, true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blurred).toBe(true);
  });
});
