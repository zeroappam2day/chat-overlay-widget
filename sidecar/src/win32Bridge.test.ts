import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock child_process before importing module under test
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { Win32Bridge } from './win32Bridge.js';

// Helper to create a fake spawned process
function makeFakeProcess() {
  const stdin = { write: vi.fn(), end: vi.fn() } as any;
  const stdout = new EventEmitter() as any;
  stdout.setEncoding = vi.fn();
  const stderr = new EventEmitter() as any;
  const proc = new EventEmitter() as any;
  proc.stdin = stdin;
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.pid = 12345;
  proc.kill = vi.fn();
  return proc;
}

// Helper: init bridge and simulate READY
async function initBridge(bridge: Win32Bridge, fakeProc: ReturnType<typeof makeFakeProcess>) {
  const initPromise = bridge.init();
  await Promise.resolve();
  await Promise.resolve();
  fakeProc.stdout.emit('data', '---READY---\n');
  await initPromise;
}

describe('Win32Bridge', () => {
  let fakeProc: ReturnType<typeof makeFakeProcess>;
  let bridge: Win32Bridge;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    fakeProc = makeFakeProcess();
    (spawn as any).mockReturnValue(fakeProc);

    bridge = new Win32Bridge();
  });

  afterEach(() => {
    bridge.destroy();
    vi.useRealTimers();
  });

  it('Test 1: init() spawns PowerShell and resolves when READY sentinel received', async () => {
    await initBridge(bridge, fakeProc);

    expect(spawn).toHaveBeenCalledWith(
      'powershell.exe',
      expect.arrayContaining(['-NoProfile']),
      expect.any(Object)
    );
    expect(fakeProc.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('Add-Type -TypeDefinition'),
      expect.any(String)
    );
  });

  it('Test 2: getForegroundWindow() sends JSON request and returns hwnd number', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.getForegroundWindow();
    await Promise.resolve();

    // Find the request written after init
    const writes = fakeProc.stdin.write.mock.calls;
    const reqWrite = writes[writes.length - 1];
    const req = JSON.parse(reqWrite[0]);
    expect(req.cmd).toBe('getForegroundWindow');

    fakeProc.stdout.emit('data', JSON.stringify({ id: req.id, result: 12345678 }) + '\n');

    const hwnd = await callPromise;
    expect(hwnd).toBe(12345678);
  });

  it('Test 3: getWindowThreadProcessId(hwnd) returns { threadId, pid }', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.getWindowThreadProcessId(99999);
    await Promise.resolve();

    const writes = fakeProc.stdin.write.mock.calls;
    const req = JSON.parse(writes[writes.length - 1][0]);
    expect(req.cmd).toBe('getWindowThreadProcessId');
    expect(req.args[0]).toBe(99999);

    fakeProc.stdout.emit('data', JSON.stringify({ id: req.id, result: { threadId: 100, pid: 200 } }) + '\n');

    const result = await callPromise;
    expect(result).toEqual({ threadId: 100, pid: 200 });
  });

  it('Test 4: isWindow(hwnd) returns boolean', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.isWindow(12345);
    await Promise.resolve();

    const writes = fakeProc.stdin.write.mock.calls;
    const req = JSON.parse(writes[writes.length - 1][0]);
    expect(req.cmd).toBe('isWindow');

    fakeProc.stdout.emit('data', JSON.stringify({ id: req.id, result: true }) + '\n');
    const result = await callPromise;
    expect(result).toBe(true);
  });

  it('Test 5: isIconic(hwnd) returns boolean', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.isIconic(12345);
    await Promise.resolve();

    const writes = fakeProc.stdin.write.mock.calls;
    const req = JSON.parse(writes[writes.length - 1][0]);
    expect(req.cmd).toBe('isIconic');

    fakeProc.stdout.emit('data', JSON.stringify({ id: req.id, result: false }) + '\n');
    const result = await callPromise;
    expect(result).toBe(false);
  });

  it('Test 6: getOwnerWindow(hwnd) returns owner hwnd number', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.getOwnerWindow(12345);
    await Promise.resolve();

    const writes = fakeProc.stdin.write.mock.calls;
    const req = JSON.parse(writes[writes.length - 1][0]);
    expect(req.cmd).toBe('getOwnerWindow');

    fakeProc.stdout.emit('data', JSON.stringify({ id: req.id, result: 0 }) + '\n');
    const result = await callPromise;
    expect(result).toBe(0);
  });

  it('Test 7: Request with no response within 3s rejects with timeout error', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.getForegroundWindow();
    await Promise.resolve();

    vi.advanceTimersByTime(3000);

    await expect(callPromise).rejects.toThrow(/timeout/i);
  });

  it('Test 8: Process crash rejects pending requests', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.getForegroundWindow();
    await Promise.resolve();

    fakeProc.emit('exit', 1, null);

    await expect(callPromise).rejects.toThrow();
  });

  it('Test 9: destroy() kills the process and rejects pending requests', async () => {
    await initBridge(bridge, fakeProc);

    const callPromise = bridge.getForegroundWindow();
    await Promise.resolve();

    bridge.destroy();

    await expect(callPromise).rejects.toThrow();
    expect(fakeProc.kill).toHaveBeenCalled();
  });

  it('Test 10: Concurrent requests are correlated by request ID', async () => {
    await initBridge(bridge, fakeProc);

    const call1 = bridge.getForegroundWindow();
    const call2 = bridge.isWindow(999);
    await Promise.resolve();
    await Promise.resolve();

    const writes = fakeProc.stdin.write.mock.calls;
    // Find the last two command writes
    const cmdWrites = writes.slice(-2).map(w => JSON.parse(w[0]));
    const [req1, req2] = cmdWrites;
    expect(req1.id).not.toBe(req2.id);

    // Respond out of order
    fakeProc.stdout.emit('data', JSON.stringify({ id: req2.id, result: true }) + '\n');
    fakeProc.stdout.emit('data', JSON.stringify({ id: req1.id, result: 77777 }) + '\n');

    const [r1, r2] = await Promise.all([call1, call2]);
    expect(r1).toBe(77777);
    expect(r2).toBe(true);
  });
});
