import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

function makeFakeProcess(stdout: string, exitCode = 0) {
  const emitter = new EventEmitter() as NodeJS.EventEmitter & { stdout: EventEmitter & { setEncoding: () => void }; kill: () => void };
  const stdoutEmitter = new EventEmitter() as EventEmitter & { setEncoding: () => void };
  stdoutEmitter.setEncoding = vi.fn(); // satisfy proc.stdout.setEncoding('utf8') call
  (emitter as any).stdout = stdoutEmitter;
  (emitter as any).kill = vi.fn();
  setImmediate(() => {
    stdoutEmitter.emit('data', stdout);
    emitter.emit('close', exitCode);
  });
  return emitter;
}

const FAKE_WINDOW_JSON = JSON.stringify([
  { title: 'Chrome', processName: 'chrome', thumbnail: 'iVBORw0KGgoAAAANSUhEUgAA...' },
  { title: 'Minimized', processName: 'notepad', error: 'MINIMIZED' },
]);

describe('windowThumbnailBatch', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import('./windowThumbnailBatch.js');
    mod.resetCache();
  });

  it('Test 1 (THUMB-01): listWindowsWithThumbnails() resolves with WindowThumbnail[] — spawn called exactly once', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON) as any);
    const mod = await import('./windowThumbnailBatch.js');
    const result = await mod.listWindowsWithThumbnails();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('Test 2 (THUMB-02): entry with thumbnail has title, processName, and thumbnail starting with "iVBOR"', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON) as any);
    const mod = await import('./windowThumbnailBatch.js');
    const result = await mod.listWindowsWithThumbnails();
    const chromeEntry = result.find(w => w.processName === 'chrome');
    expect(chromeEntry).toBeDefined();
    expect(typeof chromeEntry!.title).toBe('string');
    expect(typeof chromeEntry!.processName).toBe('string');
    expect(typeof chromeEntry!.thumbnail).toBe('string');
    expect(chromeEntry!.thumbnail!.startsWith('iVBOR')).toBe(true);
  });

  it('Test 3 (THUMB-02): entry with error field has no thumbnail, error is a string (minimized case)', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON) as any);
    const mod = await import('./windowThumbnailBatch.js');
    const result = await mod.listWindowsWithThumbnails();
    const minimizedEntry = result.find(w => w.processName === 'notepad');
    expect(minimizedEntry).toBeDefined();
    expect(minimizedEntry!.thumbnail).toBeUndefined();
    expect(typeof minimizedEntry!.error).toBe('string');
    expect(minimizedEntry!.error).toBe('MINIMIZED');
  });

  it('Test 4 (THUMB-03): second call within 5s returns cached data — spawn called once total', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON) as any);
    const mod = await import('./windowThumbnailBatch.js');
    await mod.listWindowsWithThumbnails();
    await mod.listWindowsWithThumbnails();
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('Test 5 (THUMB-03): resetCache() forces next call to re-spawn — spawn called twice total', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON) as any);
    const mod = await import('./windowThumbnailBatch.js');
    await mod.listWindowsWithThumbnails();
    mod.resetCache();
    mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON) as any);
    await mod.listWindowsWithThumbnails();
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });

  it('Test 6 (THUMB-01): PowerShell exit non-zero rejects with error', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess('', 1) as any);
    const mod = await import('./windowThumbnailBatch.js');
    await expect(mod.listWindowsWithThumbnails()).rejects.toThrow('PS exited 1');
  });

  it('Test 7 (THUMB-01): empty PS output returns empty array', async () => {
    mockSpawn.mockReturnValue(makeFakeProcess('') as any);
    const mod = await import('./windowThumbnailBatch.js');
    const result = await mod.listWindowsWithThumbnails();
    expect(result).toEqual([]);
  });

  it('Test 8 (THUMB-02): buildBatchThumbnailScript() output contains required C# patterns', async () => {
    const mod = await import('./windowThumbnailBatch.js');
    const script = mod.buildBatchThumbnailScript();
    expect(script).toContain('PrintWindow');
    expect(script).toContain('PW_RENDERFULLCONTENT');
    expect(script).toContain('new Bitmap(240, 180)');
    expect(script).toContain('InterpolationMode');
    expect(script).toContain('SetProcessDpiAwarenessContext');
    expect(script).toContain('GetWindowLongPtr');
    expect(script).toContain('Convert.ToBase64String');
  });
});
