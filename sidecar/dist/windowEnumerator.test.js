"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_child_process_1 = require("node:child_process");
vitest_1.vi.mock('node:child_process', () => ({
    spawnSync: vitest_1.vi.fn(),
}));
const mockSpawnSync = vitest_1.vi.mocked(node_child_process_1.spawnSync);
function makeOkResult(stdout) {
    return { stdout, stderr: '', status: 0, error: undefined };
}
(0, vitest_1.describe)('windowEnumerator', () => {
    (0, vitest_1.beforeEach)(async () => {
        vitest_1.vi.resetAllMocks();
        // Import and reset cache before each test
        const mod = await import('./windowEnumerator.js');
        mod.resetCache();
    });
    (0, vitest_1.it)('Test 1: returns cached data on second call within 5 seconds (spawnSync called once)', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome","hwnd":131234,"pid":4567}]'));
        const mod = await import('./windowEnumerator.js');
        mod.listWindows();
        mod.listWindows();
        (0, vitest_1.expect)(mockSpawnSync).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)('Test 2: calls spawnSync again when cache is expired (> 5 seconds old)', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome","hwnd":131234,"pid":4567}]'));
        const mod = await import('./windowEnumerator.js');
        let now = Date.now();
        const spy = vitest_1.vi.spyOn(Date, 'now').mockReturnValue(now);
        mod.listWindows();
        // Advance time past TTL
        spy.mockReturnValue(now + 6000);
        mod.listWindows();
        (0, vitest_1.expect)(mockSpawnSync).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });
    (0, vitest_1.it)('Test 3: returns WindowInfo[] with title and processName fields', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome","hwnd":131234,"pid":4567}]'));
        const mod = await import('./windowEnumerator.js');
        const result = mod.listWindows();
        (0, vitest_1.expect)(Array.isArray(result)).toBe(true);
        (0, vitest_1.expect)(result[0]).toHaveProperty('title', 'Chrome');
        (0, vitest_1.expect)(result[0]).toHaveProperty('processName', 'chrome');
    });
    (0, vitest_1.it)('Test 4: returns empty array when PowerShell returns empty output', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult(''));
        const mod = await import('./windowEnumerator.js');
        const result = mod.listWindows();
        (0, vitest_1.expect)(result).toEqual([]);
    });
    (0, vitest_1.it)('Test 5: throws when PowerShell exits non-zero', async () => {
        mockSpawnSync.mockReturnValue({ stdout: '', stderr: 'compilation error', status: 1, error: undefined });
        const mod = await import('./windowEnumerator.js');
        (0, vitest_1.expect)(() => mod.listWindows()).toThrow('PowerShell exited');
    });
    (0, vitest_1.it)('Test 6: resetCache forces next listWindows() to spawn PS again', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome","hwnd":131234,"pid":4567}]'));
        const mod = await import('./windowEnumerator.js');
        mod.listWindows();
        mod.resetCache();
        mod.listWindows();
        (0, vitest_1.expect)(mockSpawnSync).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)('Test 7 (PROT-01): listWindows() result includes hwnd as number', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome","hwnd":131234,"pid":4567}]'));
        const mod = await import('./windowEnumerator.js');
        const result = mod.listWindows();
        (0, vitest_1.expect)(result[0]).toHaveProperty('hwnd');
        (0, vitest_1.expect)(typeof result[0].hwnd).toBe('number');
        (0, vitest_1.expect)(result[0].hwnd).toBe(131234);
    });
    (0, vitest_1.it)('Test 8 (PROT-02): listWindows() result includes pid as number', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('[{"title":"Chrome","processName":"chrome","hwnd":131234,"pid":4567}]'));
        const mod = await import('./windowEnumerator.js');
        const result = mod.listWindows();
        (0, vitest_1.expect)(result[0]).toHaveProperty('pid');
        (0, vitest_1.expect)(typeof result[0].pid).toBe('number');
        (0, vitest_1.expect)(result[0].pid).toBe(4567);
    });
    (0, vitest_1.it)('Test 9 (PROT-03): PS_SCRIPT contains GetParent P/Invoke declaration', async () => {
        const { PS_SCRIPT } = await import('./windowEnumerator.js');
        (0, vitest_1.expect)(PS_SCRIPT).toContain('GetParent');
        (0, vitest_1.expect)(PS_SCRIPT).toContain('DllImport');
    });
    (0, vitest_1.it)('Test 10 (PROT-03): PS_SCRIPT contains GetParent filter check', async () => {
        const { PS_SCRIPT } = await import('./windowEnumerator.js');
        (0, vitest_1.expect)(PS_SCRIPT).toContain('GetParent(hWnd)');
    });
});
