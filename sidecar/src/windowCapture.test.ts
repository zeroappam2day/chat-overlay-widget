import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

const mockSpawnSync = vi.mocked(spawnSync);

function makeOkResult(stdout: string, status = 0) {
  return { stdout, stderr: '', status, error: undefined };
}

describe('windowCapture', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Test 1: captureWindow("Chrome") returns { ok: true, path } when PS stdout is OK:<path>', async () => {
    const fakePath = 'C:\\Users\\test\\AppData\\Local\\Temp\\chat-overlay-screenshots\\abc123.png';
    mockSpawnSync.mockReturnValue(makeOkResult(`OK:${fakePath}`) as ReturnType<typeof spawnSync>);
    const { captureWindow } = await import('./windowCapture.js');
    const result = captureWindow('Chrome');
    expect(result).toEqual({ ok: true, path: fakePath });
  });

  it('Test 2: captureWindow("XYZZY_NO_MATCH") returns { ok: false, error: "NO_MATCH" } when PS stdout is ERROR:NO_MATCH', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('ERROR:NO_MATCH') as ReturnType<typeof spawnSync>);
    const { captureWindow } = await import('./windowCapture.js');
    const result = captureWindow('XYZZY_NO_MATCH');
    expect(result).toEqual({ ok: false, error: 'NO_MATCH' });
  });

  it('Test 3: captureWindow returns { ok: false, error: "ZERO_BOUNDS" } when PS stdout is ERROR:ZERO_BOUNDS', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('ERROR:ZERO_BOUNDS') as ReturnType<typeof spawnSync>);
    const { captureWindow } = await import('./windowCapture.js');
    const result = captureWindow('SomeWindow');
    expect(result).toEqual({ ok: false, error: 'ZERO_BOUNDS' });
  });

  it('Test 4: captureWindow returns { ok: false, error: "spawn error: ..." } when spawnSync result.error is set', async () => {
    const spawnError = new Error('ENOENT spawn');
    mockSpawnSync.mockReturnValue({ stdout: '', stderr: '', status: null, error: spawnError } as unknown as ReturnType<typeof spawnSync>);
    const { captureWindow } = await import('./windowCapture.js');
    const result = captureWindow('Chrome');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/spawn error:/);
      expect(result.error).toContain('ENOENT spawn');
    }
  });

  it('Test 5: captureWindow returns { ok: false, error: "PS exited 1: ..." } when spawnSync returns status 1', async () => {
    mockSpawnSync.mockReturnValue({ stdout: '', stderr: 'compilation error', status: 1, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindow } = await import('./windowCapture.js');
    const result = captureWindow('Chrome');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/PS exited 1/);
    }
  });

  it('Test 6: captureWindow returns { ok: false, error: "PRINTWINDOW_FAILED" } when PS stdout is ERROR:PRINTWINDOW_FAILED', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('ERROR:PRINTWINDOW_FAILED') as ReturnType<typeof spawnSync>);
    const { captureWindow } = await import('./windowCapture.js');
    const result = captureWindow('Chrome');
    expect(result).toEqual({ ok: false, error: 'PRINTWINDOW_FAILED' });
  });

  it('Test 7: buildCaptureScript output contains SetProcessDpiAwarenessContext(new IntPtr(-4))', async () => {
    const { buildCaptureScript } = await import('./windowCapture.js');
    const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
    expect(script).toContain('SetProcessDpiAwarenessContext(new IntPtr(-4))');
  });

  it('Test 8: buildCaptureScript output contains PrintWindow(target, hdc, PW_RENDERFULLCONTENT) and PW_RENDERFULLCONTENT = 0x2', async () => {
    const { buildCaptureScript } = await import('./windowCapture.js');
    const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
    expect(script).toContain('PrintWindow(target, hdc, PW_RENDERFULLCONTENT)');
    expect(script).toMatch(/PW_RENDERFULLCONTENT\s*=\s*0x2/);
  });

  it('Test 9: buildCaptureScript output contains DWMWA_EXTENDED_FRAME_BOUNDS = 9', async () => {
    const { buildCaptureScript } = await import('./windowCapture.js');
    const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
    expect(script).toMatch(/DWMWA_EXTENDED_FRAME_BOUNDS\s*=\s*9/);
  });

  it('Test 10: buildCaptureScript output contains IsIconic check that returns ERROR:MINIMIZED', async () => {
    const { buildCaptureScript } = await import('./windowCapture.js');
    const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
    expect(script).toContain('IsIconic');
    expect(script).toContain('ERROR:MINIMIZED');
  });

  it('Test 11: Title sanitization — single-quoted PS strings, apostrophe escaped to double-apostrophe', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('ERROR:NO_MATCH') as ReturnType<typeof spawnSync>);
    const { captureWindow, buildCaptureScript } = await import('./windowCapture.js');
    // Single quotes are escaped to '' (PS single-quote escaping)
    const script1 = buildCaptureScript("user's file", 'C:\\temp\\test.png');
    expect(script1).toContain("user''s file");
    // $ passes through unchanged (harmless in single-quoted PS strings)
    const script2 = buildCaptureScript('$(malicious)', 'C:\\temp\\test.png');
    expect(script2).toContain("$(malicious)");
    // " and backtick pass through unchanged (harmless in single-quoted PS strings)
    const script3 = buildCaptureScript('test"bad`title', 'C:\\temp\\test.png');
    expect(script3).toContain('test"bad`title');
    // CR/LF still stripped from title
    const script4 = buildCaptureScript('test\r\ntitle', 'C:\\temp\\test.png');
    expect(script4).not.toContain('\r');
    expect(script4).toContain('testtitle');
    // Verify CaptureWindow call uses single-quoted strings
    expect(script1).toMatch(/CaptureWindow\('/);
    // captureWindow also works end-to-end
    captureWindow("user's file");
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
  });
});
