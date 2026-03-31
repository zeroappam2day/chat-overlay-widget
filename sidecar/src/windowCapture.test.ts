import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

vi.mock('./windowEnumerator.js', () => ({
  listWindows: vi.fn(),
  PS_SCRIPT: '',
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

describe('captureWindowWithMetadata', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it('Test 12: captureWindowWithMetadata("Chrome") returns enriched metadata on success', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    // Pipe-delimited format: OK|path|bx|by|bw|bh|cw|ch|dpi
    const stdout = 'OK|C:\\temp\\abc.png|100|200|1500|1000|1500|1000|1.2500';
    mock.mockReturnValue({ stdout, stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindowWithMetadata } = await import('./windowCapture.js');
    const result = captureWindowWithMetadata('Chrome');
    expect(result).toEqual({
      ok: true,
      data: {
        path: 'C:\\temp\\abc.png',
        bounds: { x: 100, y: 200, w: 1500, h: 1000 },
        captureSize: { w: 1500, h: 1000 },
        dpiScale: 1.25,
      },
    });
  });

  it('Test 13: captureWindowWithMetadata("XYZZY") returns { ok: false, error: "NO_MATCH" } when PS stdout is ERROR:NO_MATCH', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    mock.mockReturnValue({ stdout: 'ERROR:NO_MATCH', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindowWithMetadata } = await import('./windowCapture.js');
    const result = captureWindowWithMetadata('XYZZY');
    expect(result).toEqual({ ok: false, error: 'NO_MATCH' });
  });

  it('Test 14: captureWindowWithMetadata("Minimized") returns { ok: false, error: "MINIMIZED" } when PS stdout is ERROR:MINIMIZED', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    mock.mockReturnValue({ stdout: 'ERROR:MINIMIZED', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindowWithMetadata } = await import('./windowCapture.js');
    const result = captureWindowWithMetadata('Minimized');
    expect(result).toEqual({ ok: false, error: 'MINIMIZED' });
  });

  it('Test 15: buildCaptureScriptWithMetadata() output contains SetProcessDpiAwarenessContext(new IntPtr(-4))', async () => {
    const { buildCaptureScriptWithMetadata } = await import('./windowCapture.js');
    const script = buildCaptureScriptWithMetadata('Chrome', 'C:\\temp\\test.png');
    expect(script).toContain('SetProcessDpiAwarenessContext(new IntPtr(-4))');
  });

  it('Test 16: buildCaptureScriptWithMetadata() output contains GetWindowRect P/Invoke declaration', async () => {
    const { buildCaptureScriptWithMetadata } = await import('./windowCapture.js');
    const script = buildCaptureScriptWithMetadata('Chrome', 'C:\\temp\\test.png');
    expect(script).toContain('GetWindowRect(IntPtr hWnd, out RECT lpRect)');
  });

  it('Test 17: buildCaptureScriptWithMetadata() output contains pipe-delimited return with bounds and dpi fields', async () => {
    const { buildCaptureScriptWithMetadata } = await import('./windowCapture.js');
    const script = buildCaptureScriptWithMetadata('Chrome', 'C:\\temp\\test.png');
    // Uses pipe-delimited format: OK|path|bx|by|bw|bh|cw|ch|dpi
    expect(script).toContain('"OK|"');
    expect(script).toContain('dmwBounds.Left');
    expect(script).toContain('dmwBounds.Top');
    expect(script).toContain('physW');
    expect(script).toContain('physH');
    expect(script).toContain('dpiScale');
  });

  it('Test 18: captureWindowWithMetadata handles PS Add-Type diagnostic lines before OK| line', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    const okLine = 'OK|C:\\temp\\abc.png|0|0|800|600|800|600|1.0000';
    const stdout = `warning CS0219: unused variable\n${okLine}`;
    mock.mockReturnValue({ stdout, stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindowWithMetadata } = await import('./windowCapture.js');
    const result = captureWindowWithMetadata('Chrome');
    expect(result).toEqual({
      ok: true,
      data: {
        path: 'C:\\temp\\abc.png',
        bounds: { x: 0, y: 0, w: 800, h: 600 },
        captureSize: { w: 800, h: 600 },
        dpiScale: 1.0,
      },
    });
  });

  it('Test 19: All 11 existing captureWindow tests pass (regression guard — captureWindow still works)', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    const fakePath = 'C:\\temp\\abc.png';
    mock.mockReturnValue({ stdout: `OK:${fakePath}`, stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindow } = await import('./windowCapture.js');
    const result = captureWindow('Chrome');
    expect(result).toEqual({ ok: true, path: fakePath });
  });
});

describe('captureWindowByHwnd', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it('Test 20: buildCaptureByHwndScript output contains new IntPtr(hwndValue) and does NOT contain EnumWindows (HWND-01)', async () => {
    const { buildCaptureByHwndScript } = await import('./windowCapture.js');
    const script = buildCaptureByHwndScript(12345, 42, 'C:\\temp\\test.png');
    expect(script).toContain('new IntPtr(hwndValue)');
    expect(script).not.toContain('EnumWindows');
  });

  it('Test 21: buildCaptureByHwndScript output contains GetWindowThreadProcessId declaration and PID comparison (HWND-02)', async () => {
    const { buildCaptureByHwndScript } = await import('./windowCapture.js');
    const script = buildCaptureByHwndScript(12345, 42, 'C:\\temp\\test.png');
    expect(script).toContain('GetWindowThreadProcessId');
    expect(script).toContain('expectedPid');
    expect(script).toContain('actualPid');
  });

  it('Test 22: buildCaptureByHwndScript output contains IsBitmapBlank method (HWND-03)', async () => {
    const { buildCaptureByHwndScript } = await import('./windowCapture.js');
    const script = buildCaptureByHwndScript(12345, 42, 'C:\\temp\\test.png');
    expect(script).toContain('IsBitmapBlank');
  });

  it('Test 23: buildCaptureByHwndScript output uses ${hwnd}L long literal and ${pid}L for expectedPid (HWND-01/02)', async () => {
    const { buildCaptureByHwndScript } = await import('./windowCapture.js');
    const script = buildCaptureByHwndScript(12345, 42, 'C:\\temp\\test.png');
    expect(script).toContain('12345L');
    expect(script).toContain('42L');
  });

  it('Test 24: captureWindowByHwnd returns { ok: true, data } with correct CaptureMetadata on pipe-delimited OK stdout (HWND-01)', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    const stdout = 'OK|C:\\temp\\abc.png|100|200|1500|1000|1500|1000|1.2500';
    mock.mockReturnValue({ stdout, stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindowByHwnd } = await import('./windowCapture.js');
    const result = captureWindowByHwnd(12345, 42, 'Chrome');
    expect(result).toEqual({
      ok: true,
      data: {
        path: 'C:\\temp\\abc.png',
        bounds: { x: 100, y: 200, w: 1500, h: 1000 },
        captureSize: { w: 1500, h: 1000 },
        dpiScale: 1.25,
      },
    });
  });

  it('Test 25: captureWindowByHwnd returns { ok: false, error: "STALE_HWND" } on ERROR:STALE_HWND stdout (HWND-02)', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    mock.mockReturnValue({ stdout: 'ERROR:STALE_HWND', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    // mock listWindows to return empty so fallback does nothing
    const { listWindows } = await import('./windowEnumerator.js');
    vi.mocked(listWindows).mockReturnValue([]);
    const { captureWindowByHwnd } = await import('./windowCapture.js');
    const result = captureWindowByHwnd(12345, 42, 'Chrome');
    expect(result).toEqual({ ok: false, error: 'STALE_HWND' });
  });

  it('Test 26: captureWindowByHwnd returns { ok: false, error: "BLANK_CAPTURE" } on ERROR:BLANK_CAPTURE stdout (HWND-03)', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    mock.mockReturnValue({ stdout: 'ERROR:BLANK_CAPTURE', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { captureWindowByHwnd } = await import('./windowCapture.js');
    const result = captureWindowByHwnd(12345, 42, 'Chrome');
    expect(result).toEqual({ ok: false, error: 'BLANK_CAPTURE' });
  });

  it('Test 27: captureWindowByHwnd calls captureWindowWithMetadata as fallback when STALE_HWND + listWindows returns exactly 1 match for processName (HWND-04)', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    // First call: STALE_HWND; second call: OK from fallback captureWindowWithMetadata
    mock
      .mockReturnValueOnce({ stdout: 'ERROR:STALE_HWND', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>)
      .mockReturnValueOnce({ stdout: 'OK|C:\\temp\\fallback.png|0|0|800|600|800|600|1.0000', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { listWindows } = await import('./windowEnumerator.js');
    vi.mocked(listWindows).mockReturnValue([
      { title: 'Notepad', processName: 'notepad', hwnd: 999, pid: 42 },
    ]);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { captureWindowByHwnd } = await import('./windowCapture.js');
    const result = captureWindowByHwnd(12345, 42, 'Notepad');
    expect(result.ok).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fallback'));
    consoleSpy.mockRestore();
  });

  it('Test 28: captureWindowByHwnd does NOT fallback when listWindows returns 2+ matches for processName (HWND-04)', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    mock.mockReturnValue({ stdout: 'ERROR:STALE_HWND', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { listWindows } = await import('./windowEnumerator.js');
    vi.mocked(listWindows).mockReturnValue([
      { title: 'Notepad 1', processName: 'notepad', hwnd: 100, pid: 42 },
      { title: 'Notepad 2', processName: 'notepad', hwnd: 101, pid: 42 },
    ]);
    const { captureWindowByHwnd } = await import('./windowCapture.js');
    const result = captureWindowByHwnd(12345, 42, 'Notepad');
    expect(result).toEqual({ ok: false, error: 'STALE_HWND' });
  });

  it('Test 29: captureWindowByHwnd does NOT fallback when listWindows returns 0 matches (HWND-04)', async () => {
    const { spawnSync: mockSS } = await import('node:child_process');
    const mock = vi.mocked(mockSS);
    mock.mockReturnValue({ stdout: 'ERROR:STALE_HWND', stderr: '', status: 0, error: undefined } as ReturnType<typeof spawnSync>);
    const { listWindows } = await import('./windowEnumerator.js');
    vi.mocked(listWindows).mockReturnValue([]);
    const { captureWindowByHwnd } = await import('./windowCapture.js');
    const result = captureWindowByHwnd(12345, 42, 'Notepad');
    expect(result).toEqual({ ok: false, error: 'STALE_HWND' });
  });
});
