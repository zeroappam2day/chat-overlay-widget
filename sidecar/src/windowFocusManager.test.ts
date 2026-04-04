import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

function mockExecFileSuccess(stdout: string) {
  mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback: any) => {
    callback(null, stdout, '');
    return {} as any;
  });
}

function mockExecFileError(message: string) {
  mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback: any) => {
    callback(new Error(message), '', '');
    return {} as any;
  });
}

describe('windowFocusManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('focusWindow succeeds when SetForegroundWindow returns true and hwnd matches', async () => {
    mockExecFileSuccess('{"ok":true,"activeHwnd":12345}');
    const mod = await import('./windowFocusManager.js');
    const result = await mod.focusWindow(12345);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('focusWindow retries with AllowSetForegroundWindow when first attempt fails', async () => {
    let callCount = 0;
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback: any) => {
      callCount++;
      if (callCount === 1) {
        // First call: SetForegroundWindow returns false
        callback(null, '{"ok":false,"activeHwnd":99999}', '');
      } else {
        // Second call: retry with AllowSetForegroundWindow succeeds
        callback(null, '{"ok":true,"activeHwnd":12345}', '');
      }
      return {} as any;
    });
    const mod = await import('./windowFocusManager.js');
    const result = await mod.focusWindow(12345);
    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it('focusWindow returns error when both attempts fail', async () => {
    mockExecFileSuccess('{"ok":false,"activeHwnd":99999}');
    const mod = await import('./windowFocusManager.js');
    const result = await mod.focusWindow(12345);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('99999');
    expect(result.error).toContain('12345');
  });

  it('focusWindow returns error on PowerShell failure', async () => {
    mockExecFileError('Execution timeout');
    const mod = await import('./windowFocusManager.js');
    const result = await mod.focusWindow(12345);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Execution timeout');
  });

  it('getActiveWindowHwnd returns correct value', async () => {
    mockExecFileSuccess('{"activeHwnd":67890}');
    const mod = await import('./windowFocusManager.js');
    const hwnd = await mod.getActiveWindowHwnd();
    expect(hwnd).toBe(67890);
  });

  it('verifyFocus returns true when active hwnd matches expected', async () => {
    mockExecFileSuccess('{"activeHwnd":12345}');
    const mod = await import('./windowFocusManager.js');
    const result = await mod.verifyFocus(12345);
    expect(result).toBe(true);
  });

  it('verifyFocus returns false when active hwnd does not match', async () => {
    mockExecFileSuccess('{"activeHwnd":99999}');
    const mod = await import('./windowFocusManager.js');
    const result = await mod.verifyFocus(12345);
    expect(result).toBe(false);
  });

  it('focusAndVerify retries on failure and eventually succeeds', async () => {
    let callCount = 0;
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, callback: any) => {
      callCount++;
      // focusWindow internally does: focus attempt (1 call) then retry (1 call) if first fails
      // Attempt 1: calls 1-2 fail (focus + retry both return wrong hwnd)
      // Attempt 2: calls 3-4 fail
      // Attempt 3: call 5 succeeds on first focus call
      if (callCount <= 4) {
        callback(null, '{"ok":false,"activeHwnd":99999}', '');
      } else {
        callback(null, '{"ok":true,"activeHwnd":12345}', '');
      }
      return {} as any;
    });
    const mod = await import('./windowFocusManager.js');
    const result = await mod.focusAndVerify(12345, 2);
    expect(result.ok).toBe(true);
  });

  it('focusAndVerify returns error after exhausting retries', async () => {
    mockExecFileSuccess('{"ok":false,"activeHwnd":99999}');
    const mod = await import('./windowFocusManager.js');
    const result = await mod.focusAndVerify(12345, 1);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Failed to focus window');
  });

  it('buildFocusScript contains SetForegroundWindow P/Invoke', async () => {
    const mod = await import('./windowFocusManager.js');
    const script = mod.buildFocusScript(12345);
    expect(script).toContain('SetForegroundWindow');
    expect(script).toContain('DllImport');
    expect(script).toContain('user32.dll');
    expect(script).toContain('12345');
  });

  it('buildRetryFocusScript contains AllowSetForegroundWindow', async () => {
    const mod = await import('./windowFocusManager.js');
    const script = mod.buildRetryFocusScript(12345);
    expect(script).toContain('AllowSetForegroundWindow');
    expect(script).toContain('SetForegroundWindow');
  });

  it('buildGetActiveScript contains GetForegroundWindow', async () => {
    const mod = await import('./windowFocusManager.js');
    const script = mod.buildGetActiveScript();
    expect(script).toContain('GetForegroundWindow');
  });
});
