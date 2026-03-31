"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_events_1 = require("node:events");
const node_child_process_1 = require("node:child_process");
vitest_1.vi.mock('node:child_process', () => ({
    spawn: vitest_1.vi.fn(),
}));
const mockSpawn = vitest_1.vi.mocked(node_child_process_1.spawn);
function makeFakeProcess(stdout, exitCode = 0) {
    const emitter = new node_events_1.EventEmitter();
    const stdoutEmitter = new node_events_1.EventEmitter();
    const stderrEmitter = new node_events_1.EventEmitter();
    stdoutEmitter.setEncoding = vitest_1.vi.fn();
    stderrEmitter.setEncoding = vitest_1.vi.fn();
    emitter.stdout = stdoutEmitter;
    emitter.stderr = stderrEmitter;
    emitter.kill = vitest_1.vi.fn();
    setImmediate(() => {
        stdoutEmitter.emit('data', stdout);
        emitter.emit('close', exitCode);
    });
    return emitter;
}
const FAKE_WINDOW_JSON = JSON.stringify([
    { title: 'Chrome', processName: 'chrome', hwnd: 131234, pid: 4567, thumbnail: 'iVBORw0KGgoAAAANSUhEUgAA...' },
    { title: 'Minimized', processName: 'notepad', hwnd: 65790, pid: 1234, error: 'MINIMIZED' },
]);
(0, vitest_1.describe)('windowThumbnailBatch', () => {
    (0, vitest_1.beforeEach)(async () => {
        vitest_1.vi.resetAllMocks();
        const mod = await import('./windowThumbnailBatch.js');
        mod.resetCache();
    });
    (0, vitest_1.it)('Test 1 (THUMB-01): listWindowsWithThumbnails() resolves with WindowThumbnail[] — spawn called exactly once', async () => {
        mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON));
        const mod = await import('./windowThumbnailBatch.js');
        const result = await mod.listWindowsWithThumbnails();
        (0, vitest_1.expect)(Array.isArray(result)).toBe(true);
        (0, vitest_1.expect)(result).toHaveLength(2);
        (0, vitest_1.expect)(mockSpawn).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('Test 2 (THUMB-02): entry with thumbnail has title, processName, and thumbnail starting with "iVBOR"', async () => {
        mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON));
        const mod = await import('./windowThumbnailBatch.js');
        const result = await mod.listWindowsWithThumbnails();
        const chromeEntry = result.find(w => w.processName === 'chrome');
        (0, vitest_1.expect)(chromeEntry).toBeDefined();
        (0, vitest_1.expect)(typeof chromeEntry.title).toBe('string');
        (0, vitest_1.expect)(typeof chromeEntry.processName).toBe('string');
        (0, vitest_1.expect)(typeof chromeEntry.thumbnail).toBe('string');
        (0, vitest_1.expect)(chromeEntry.thumbnail.startsWith('iVBOR')).toBe(true);
        (0, vitest_1.expect)(chromeEntry.hwnd).toBe(131234);
        (0, vitest_1.expect)(typeof chromeEntry.hwnd).toBe('number');
        (0, vitest_1.expect)(chromeEntry.pid).toBe(4567);
        (0, vitest_1.expect)(typeof chromeEntry.pid).toBe('number');
    });
    (0, vitest_1.it)('Test 3 (THUMB-02): entry with error field has no thumbnail, error is a string (minimized case)', async () => {
        mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON));
        const mod = await import('./windowThumbnailBatch.js');
        const result = await mod.listWindowsWithThumbnails();
        const minimizedEntry = result.find(w => w.processName === 'notepad');
        (0, vitest_1.expect)(minimizedEntry).toBeDefined();
        (0, vitest_1.expect)(minimizedEntry.thumbnail).toBeUndefined();
        (0, vitest_1.expect)(typeof minimizedEntry.error).toBe('string');
        (0, vitest_1.expect)(minimizedEntry.error).toBe('MINIMIZED');
    });
    (0, vitest_1.it)('Test 4 (THUMB-03): second call within 5s returns cached data — spawn called once total', async () => {
        mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON));
        const mod = await import('./windowThumbnailBatch.js');
        await mod.listWindowsWithThumbnails();
        await mod.listWindowsWithThumbnails();
        (0, vitest_1.expect)(mockSpawn).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('Test 5 (THUMB-03): resetCache() forces next call to re-spawn — spawn called twice total', async () => {
        mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON));
        const mod = await import('./windowThumbnailBatch.js');
        await mod.listWindowsWithThumbnails();
        mod.resetCache();
        mockSpawn.mockReturnValue(makeFakeProcess(FAKE_WINDOW_JSON));
        await mod.listWindowsWithThumbnails();
        (0, vitest_1.expect)(mockSpawn).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)('Test 6 (THUMB-01): PowerShell exit non-zero rejects with error', async () => {
        mockSpawn.mockReturnValue(makeFakeProcess('', 1));
        const mod = await import('./windowThumbnailBatch.js');
        await (0, vitest_1.expect)(mod.listWindowsWithThumbnails()).rejects.toThrow('PS exited 1');
    });
    (0, vitest_1.it)('Test 7 (THUMB-01): empty PS output returns empty array', async () => {
        mockSpawn.mockReturnValue(makeFakeProcess(''));
        const mod = await import('./windowThumbnailBatch.js');
        const result = await mod.listWindowsWithThumbnails();
        (0, vitest_1.expect)(result).toEqual([]);
    });
    (0, vitest_1.it)('Test 8 (THUMB-02): buildBatchThumbnailScript() output contains required C# patterns', async () => {
        const mod = await import('./windowThumbnailBatch.js');
        const script = mod.buildBatchThumbnailScript();
        (0, vitest_1.expect)(script).toContain('PrintWindow');
        (0, vitest_1.expect)(script).toContain('PW_RENDERFULLCONTENT');
        (0, vitest_1.expect)(script).toContain('new Bitmap(240, 180)');
        (0, vitest_1.expect)(script).toContain('InterpolationMode');
        (0, vitest_1.expect)(script).toContain('SetProcessDpiAwarenessContext');
        (0, vitest_1.expect)(script).toContain('GetWindowLongPtr');
        (0, vitest_1.expect)(script).toContain('Convert.ToBase64String');
        (0, vitest_1.expect)(script).toContain('GetParent');
        (0, vitest_1.expect)(script).toContain('hWnd.ToInt64()');
        (0, vitest_1.expect)(script).toContain('(long)pid');
    });
});
