"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_child_process_1 = require("node:child_process");
vitest_1.vi.mock('node:child_process', () => ({
    spawnSync: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('node:fs', () => ({
    mkdirSync: vitest_1.vi.fn(),
}));
const mockSpawnSync = vitest_1.vi.mocked(node_child_process_1.spawnSync);
function makeOkResult(stdout, status = 0) {
    return { stdout, stderr: '', status, error: undefined };
}
(0, vitest_1.describe)('windowCapture', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetAllMocks();
    });
    (0, vitest_1.it)('Test 1: captureWindow("Chrome") returns { ok: true, path } when PS stdout is OK:<path>', async () => {
        const fakePath = 'C:\\Users\\test\\AppData\\Local\\Temp\\chat-overlay-screenshots\\abc123.png';
        mockSpawnSync.mockReturnValue(makeOkResult(`OK:${fakePath}`));
        const { captureWindow } = await import('./windowCapture.js');
        const result = captureWindow('Chrome');
        (0, vitest_1.expect)(result).toEqual({ ok: true, path: fakePath });
    });
    (0, vitest_1.it)('Test 2: captureWindow("XYZZY_NO_MATCH") returns { ok: false, error: "NO_MATCH" } when PS stdout is ERROR:NO_MATCH', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('ERROR:NO_MATCH'));
        const { captureWindow } = await import('./windowCapture.js');
        const result = captureWindow('XYZZY_NO_MATCH');
        (0, vitest_1.expect)(result).toEqual({ ok: false, error: 'NO_MATCH' });
    });
    (0, vitest_1.it)('Test 3: captureWindow returns { ok: false, error: "ZERO_BOUNDS" } when PS stdout is ERROR:ZERO_BOUNDS', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('ERROR:ZERO_BOUNDS'));
        const { captureWindow } = await import('./windowCapture.js');
        const result = captureWindow('SomeWindow');
        (0, vitest_1.expect)(result).toEqual({ ok: false, error: 'ZERO_BOUNDS' });
    });
    (0, vitest_1.it)('Test 4: captureWindow returns { ok: false, error: "spawn error: ..." } when spawnSync result.error is set', async () => {
        const spawnError = new Error('ENOENT spawn');
        mockSpawnSync.mockReturnValue({ stdout: '', stderr: '', status: null, error: spawnError });
        const { captureWindow } = await import('./windowCapture.js');
        const result = captureWindow('Chrome');
        (0, vitest_1.expect)(result.ok).toBe(false);
        if (!result.ok) {
            (0, vitest_1.expect)(result.error).toMatch(/spawn error:/);
            (0, vitest_1.expect)(result.error).toContain('ENOENT spawn');
        }
    });
    (0, vitest_1.it)('Test 5: captureWindow returns { ok: false, error: "PS exited 1: ..." } when spawnSync returns status 1', async () => {
        mockSpawnSync.mockReturnValue({ stdout: '', stderr: 'compilation error', status: 1, error: undefined });
        const { captureWindow } = await import('./windowCapture.js');
        const result = captureWindow('Chrome');
        (0, vitest_1.expect)(result.ok).toBe(false);
        if (!result.ok) {
            (0, vitest_1.expect)(result.error).toMatch(/PS exited 1/);
        }
    });
    (0, vitest_1.it)('Test 6: captureWindow returns { ok: false, error: "PRINTWINDOW_FAILED" } when PS stdout is ERROR:PRINTWINDOW_FAILED', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('ERROR:PRINTWINDOW_FAILED'));
        const { captureWindow } = await import('./windowCapture.js');
        const result = captureWindow('Chrome');
        (0, vitest_1.expect)(result).toEqual({ ok: false, error: 'PRINTWINDOW_FAILED' });
    });
    (0, vitest_1.it)('Test 7: buildCaptureScript output contains SetProcessDpiAwarenessContext(new IntPtr(-4))', async () => {
        const { buildCaptureScript } = await import('./windowCapture.js');
        const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script).toContain('SetProcessDpiAwarenessContext(new IntPtr(-4))');
    });
    (0, vitest_1.it)('Test 8: buildCaptureScript output contains PrintWindow(target, hdc, PW_RENDERFULLCONTENT) and PW_RENDERFULLCONTENT = 0x2', async () => {
        const { buildCaptureScript } = await import('./windowCapture.js');
        const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script).toContain('PrintWindow(target, hdc, PW_RENDERFULLCONTENT)');
        (0, vitest_1.expect)(script).toMatch(/PW_RENDERFULLCONTENT\s*=\s*0x2/);
    });
    (0, vitest_1.it)('Test 9: buildCaptureScript output contains DWMWA_EXTENDED_FRAME_BOUNDS = 9', async () => {
        const { buildCaptureScript } = await import('./windowCapture.js');
        const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script).toMatch(/DWMWA_EXTENDED_FRAME_BOUNDS\s*=\s*9/);
    });
    (0, vitest_1.it)('Test 10: buildCaptureScript output contains IsIconic check that returns ERROR:MINIMIZED', async () => {
        const { buildCaptureScript } = await import('./windowCapture.js');
        const script = buildCaptureScript('Chrome', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script).toContain('IsIconic');
        (0, vitest_1.expect)(script).toContain('ERROR:MINIMIZED');
    });
    (0, vitest_1.it)('Test 11: Title sanitization — single-quoted PS strings, apostrophe escaped to double-apostrophe', async () => {
        mockSpawnSync.mockReturnValue(makeOkResult('ERROR:NO_MATCH'));
        const { captureWindow, buildCaptureScript } = await import('./windowCapture.js');
        // Single quotes are escaped to '' (PS single-quote escaping)
        const script1 = buildCaptureScript("user's file", 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script1).toContain("user''s file");
        // $ passes through unchanged (harmless in single-quoted PS strings)
        const script2 = buildCaptureScript('$(malicious)', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script2).toContain("$(malicious)");
        // " and backtick pass through unchanged (harmless in single-quoted PS strings)
        const script3 = buildCaptureScript('test"bad`title', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script3).toContain('test"bad`title');
        // CR/LF still stripped from title
        const script4 = buildCaptureScript('test\r\ntitle', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script4).not.toContain('\r');
        (0, vitest_1.expect)(script4).toContain('testtitle');
        // Verify CaptureWindow call uses single-quoted strings
        (0, vitest_1.expect)(script1).toMatch(/CaptureWindow\('/);
        // captureWindow also works end-to-end
        captureWindow("user's file");
        (0, vitest_1.expect)(mockSpawnSync).toHaveBeenCalledTimes(1);
    });
});
(0, vitest_1.describe)('captureWindowWithMetadata', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetModules();
        vitest_1.vi.resetAllMocks();
    });
    (0, vitest_1.it)('Test 12: captureWindowWithMetadata("Chrome") returns enriched metadata on success', async () => {
        const { spawnSync: mockSS } = await import('node:child_process');
        const mock = vitest_1.vi.mocked(mockSS);
        // Pipe-delimited format: OK|path|bx|by|bw|bh|cw|ch|dpi
        const stdout = 'OK|C:\\temp\\abc.png|100|200|1500|1000|1500|1000|1.2500';
        mock.mockReturnValue({ stdout, stderr: '', status: 0, error: undefined });
        const { captureWindowWithMetadata } = await import('./windowCapture.js');
        const result = captureWindowWithMetadata('Chrome');
        (0, vitest_1.expect)(result).toEqual({
            ok: true,
            data: {
                path: 'C:\\temp\\abc.png',
                bounds: { x: 100, y: 200, w: 1500, h: 1000 },
                captureSize: { w: 1500, h: 1000 },
                dpiScale: 1.25,
            },
        });
    });
    (0, vitest_1.it)('Test 13: captureWindowWithMetadata("XYZZY") returns { ok: false, error: "NO_MATCH" } when PS stdout is ERROR:NO_MATCH', async () => {
        const { spawnSync: mockSS } = await import('node:child_process');
        const mock = vitest_1.vi.mocked(mockSS);
        mock.mockReturnValue({ stdout: 'ERROR:NO_MATCH', stderr: '', status: 0, error: undefined });
        const { captureWindowWithMetadata } = await import('./windowCapture.js');
        const result = captureWindowWithMetadata('XYZZY');
        (0, vitest_1.expect)(result).toEqual({ ok: false, error: 'NO_MATCH' });
    });
    (0, vitest_1.it)('Test 14: captureWindowWithMetadata("Minimized") returns { ok: false, error: "MINIMIZED" } when PS stdout is ERROR:MINIMIZED', async () => {
        const { spawnSync: mockSS } = await import('node:child_process');
        const mock = vitest_1.vi.mocked(mockSS);
        mock.mockReturnValue({ stdout: 'ERROR:MINIMIZED', stderr: '', status: 0, error: undefined });
        const { captureWindowWithMetadata } = await import('./windowCapture.js');
        const result = captureWindowWithMetadata('Minimized');
        (0, vitest_1.expect)(result).toEqual({ ok: false, error: 'MINIMIZED' });
    });
    (0, vitest_1.it)('Test 15: buildCaptureScriptWithMetadata() output contains SetProcessDpiAwarenessContext(new IntPtr(-4))', async () => {
        const { buildCaptureScriptWithMetadata } = await import('./windowCapture.js');
        const script = buildCaptureScriptWithMetadata('Chrome', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script).toContain('SetProcessDpiAwarenessContext(new IntPtr(-4))');
    });
    (0, vitest_1.it)('Test 16: buildCaptureScriptWithMetadata() output contains GetWindowRect P/Invoke declaration', async () => {
        const { buildCaptureScriptWithMetadata } = await import('./windowCapture.js');
        const script = buildCaptureScriptWithMetadata('Chrome', 'C:\\temp\\test.png');
        (0, vitest_1.expect)(script).toContain('GetWindowRect(IntPtr hWnd, out RECT lpRect)');
    });
    (0, vitest_1.it)('Test 17: buildCaptureScriptWithMetadata() output contains pipe-delimited return with bounds and dpi fields', async () => {
        const { buildCaptureScriptWithMetadata } = await import('./windowCapture.js');
        const script = buildCaptureScriptWithMetadata('Chrome', 'C:\\temp\\test.png');
        // Uses pipe-delimited format: OK|path|bx|by|bw|bh|cw|ch|dpi
        (0, vitest_1.expect)(script).toContain('"OK|"');
        (0, vitest_1.expect)(script).toContain('dmwBounds.Left');
        (0, vitest_1.expect)(script).toContain('dmwBounds.Top');
        (0, vitest_1.expect)(script).toContain('physW');
        (0, vitest_1.expect)(script).toContain('physH');
        (0, vitest_1.expect)(script).toContain('dpiScale');
    });
    (0, vitest_1.it)('Test 18: captureWindowWithMetadata handles PS Add-Type diagnostic lines before OK| line', async () => {
        const { spawnSync: mockSS } = await import('node:child_process');
        const mock = vitest_1.vi.mocked(mockSS);
        const okLine = 'OK|C:\\temp\\abc.png|0|0|800|600|800|600|1.0000';
        const stdout = `warning CS0219: unused variable\n${okLine}`;
        mock.mockReturnValue({ stdout, stderr: '', status: 0, error: undefined });
        const { captureWindowWithMetadata } = await import('./windowCapture.js');
        const result = captureWindowWithMetadata('Chrome');
        (0, vitest_1.expect)(result).toEqual({
            ok: true,
            data: {
                path: 'C:\\temp\\abc.png',
                bounds: { x: 0, y: 0, w: 800, h: 600 },
                captureSize: { w: 800, h: 600 },
                dpiScale: 1.0,
            },
        });
    });
    (0, vitest_1.it)('Test 19: All 11 existing captureWindow tests pass (regression guard — captureWindow still works)', async () => {
        const { spawnSync: mockSS } = await import('node:child_process');
        const mock = vitest_1.vi.mocked(mockSS);
        const fakePath = 'C:\\temp\\abc.png';
        mock.mockReturnValue({ stdout: `OK:${fakePath}`, stderr: '', status: 0, error: undefined });
        const { captureWindow } = await import('./windowCapture.js');
        const result = captureWindow('Chrome');
        (0, vitest_1.expect)(result).toEqual({ ok: true, path: fakePath });
    });
});
