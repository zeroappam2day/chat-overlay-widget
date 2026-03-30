import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const mockSpawnSync = vi.mocked(spawnSync);

function makeOkResult(stdout: string) {
  return { stdout, stderr: '', status: 0, error: undefined };
}

describe('windowEnumerator', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    // Import and reset cache before each test
    const mod = await import('./windowEnumerator.js');
    mod.resetCache();
  });

  it('Test 1: returns cached data on second call within 5 seconds (spawnSync called once)', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome"}]') as ReturnType<typeof spawnSync>);
    const mod = await import('./windowEnumerator.js');
    mod.listWindows();
    mod.listWindows();
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
  });

  it('Test 2: calls spawnSync again when cache is expired (> 5 seconds old)', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome"}]') as ReturnType<typeof spawnSync>);
    const mod = await import('./windowEnumerator.js');
    let now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    mod.listWindows();
    // Advance time past TTL
    spy.mockReturnValue(now + 6000);
    mod.listWindows();
    expect(mockSpawnSync).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('Test 3: returns WindowInfo[] with title and processName fields', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome"}]') as ReturnType<typeof spawnSync>);
    const mod = await import('./windowEnumerator.js');
    const result = mod.listWindows();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('title', 'Chrome');
    expect(result[0]).toHaveProperty('processName', 'chrome');
  });

  it('Test 4: returns empty array when PowerShell returns empty output', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('') as ReturnType<typeof spawnSync>);
    const mod = await import('./windowEnumerator.js');
    const result = mod.listWindows();
    expect(result).toEqual([]);
  });

  it('Test 5: throws when PowerShell exits non-zero', async () => {
    mockSpawnSync.mockReturnValue({ stdout: '', stderr: 'compilation error', status: 1, error: undefined } as ReturnType<typeof spawnSync>);
    const mod = await import('./windowEnumerator.js');
    expect(() => mod.listWindows()).toThrow('PowerShell exited');
  });

  it('Test 6: resetCache forces next listWindows() to spawn PS again', async () => {
    mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome"}]') as ReturnType<typeof spawnSync>);
    const mod = await import('./windowEnumerator.js');
    mod.listWindows();
    mod.resetCache();
    mod.listWindows();
    expect(mockSpawnSync).toHaveBeenCalledTimes(2);
  });
});
