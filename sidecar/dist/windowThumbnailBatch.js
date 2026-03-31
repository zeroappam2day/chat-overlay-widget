"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetCache = resetCache;
exports.buildBatchThumbnailScript = buildBatchThumbnailScript;
exports.listWindowsWithThumbnails = listWindowsWithThumbnails;
const node_child_process_1 = require("node:child_process");
let cache = null;
const CACHE_TTL_MS = 5000;
function resetCache() {
    cache = null;
}
function buildBatchThumbnailScript() {
    return `
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO;

public class BatchThumb {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern IntPtr GetParent(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    private const int GWL_EXSTYLE = -20;
    private const long WS_EX_TOOLWINDOW = 0x80L;
    private const int DWMWA_CLOAKED = 14;
    private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    private const uint PW_RENDERFULLCONTENT = 0x2;

    public static List<object> GetAllThumbnails() {
        // Must be first call: DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 (STATE.md P19)
        SetProcessDpiAwarenessContext(new IntPtr(-4));

        var results = new List<object>();

        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            // Filter 1: must be visible
            if (!IsWindowVisible(hWnd)) return true;

            // Filter 2: must have a non-empty title
            var sb = new StringBuilder(512);
            if (GetWindowText(hWnd, sb, 512) == 0) return true;
            var title = sb.ToString().Trim();
            if (string.IsNullOrEmpty(title)) return true;

            // Filter 3: must not be cloaked
            int cloaked = 0;
            DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, 4);
            if (cloaked != 0) return true;

            // Filter 4: must not be a tool window
            var exStyle = GetWindowLongPtr(hWnd, GWL_EXSTYLE).ToInt64();
            if ((exStyle & WS_EX_TOOLWINDOW) != 0) return true;

            // Filter 5: root windows only (PROT-03)
            if (GetParent(hWnd) != IntPtr.Zero) return true;

            // Get process name
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            string processName = "";
            try {
                var proc = Process.GetProcessById((int)pid);
                processName = proc.ProcessName;
            } catch {}

            try {
                // Handle minimized windows
                if (IsIconic(hWnd)) {
                    results.Add(new { title = title, processName = processName, hwnd = hWnd.ToInt64(), pid = (long)pid, error = "MINIMIZED" });
                    return true;
                }

                // Get true physical pixel bounds via DwmGetWindowAttribute
                RECT bounds;
                DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out bounds,
                    System.Runtime.InteropServices.Marshal.SizeOf(typeof(RECT)));
                int width  = bounds.Right  - bounds.Left;
                int height = bounds.Bottom - bounds.Top;

                if (width <= 0 || height <= 0) {
                    results.Add(new { title = title, processName = processName, hwnd = hWnd.ToInt64(), pid = (long)pid, error = "ZERO_BOUNDS" });
                    return true;
                }

                // Capture full window
                using (var fullBmp = new Bitmap(width, height))
                using (var g = Graphics.FromImage(fullBmp)) {
                    IntPtr hdc = g.GetHdc();
                    PrintWindow(hWnd, hdc, PW_RENDERFULLCONTENT);
                    g.ReleaseHdc(hdc);

                    // Scale to 240x180
                    using (var thumb = new Bitmap(240, 180))
                    using (var tg = Graphics.FromImage(thumb)) {
                        tg.InterpolationMode = InterpolationMode.HighQualityBicubic;
                        tg.DrawImage(fullBmp, 0, 0, 240, 180);

                        using (var ms = new MemoryStream()) {
                            thumb.Save(ms, ImageFormat.Png);
                            string b64 = Convert.ToBase64String(ms.ToArray());
                            results.Add(new { title = title, processName = processName, hwnd = hWnd.ToInt64(), pid = (long)pid, thumbnail = b64 });
                        }
                    }
                }
            } catch (Exception ex) {
                results.Add(new { title = title, processName = processName, hwnd = hWnd.ToInt64(), pid = (long)pid, error = ex.Message });
            }

            return true;
        }, IntPtr.Zero);

        return results;
    }
}
"@ -ReferencedAssemblies System.Drawing
\$r = [BatchThumb]::GetAllThumbnails()
ConvertTo-Json -InputObject @(\$r) -Compress -Depth 3
`;
}
function runPsAsync(script, timeoutMs) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const errChunks = [];
        const proc = (0, node_child_process_1.spawn)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
        // CRITICAL: set encoding on stream, NOT in spawn options (Pitfall 3 from research)
        proc.stdout.setEncoding('utf8');
        proc.stderr.setEncoding('utf8');
        const timer = setTimeout(() => {
            proc.kill();
            reject(new Error('PowerShell timeout'));
        }, timeoutMs);
        proc.stdout.on('data', (chunk) => chunks.push(chunk));
        proc.stderr.on('data', (chunk) => errChunks.push(chunk));
        proc.on('close', (code) => {
            clearTimeout(timer);
            const stderrText = errChunks.join('').trim();
            if (stderrText) {
                console.error('[sidecar] PowerShell stderr:', stderrText);
            }
            if (code !== 0) {
                reject(new Error(`PS exited ${code}: ${stderrText}`));
            }
            else {
                resolve(chunks.join(''));
            }
        });
        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
async function listWindowsWithThumbnails() {
    if (cache && (Date.now() - cache.ts) < CACHE_TTL_MS) {
        console.log('[sidecar] list-windows-with-thumbnails: cache hit');
        return cache.data;
    }
    console.log('[sidecar] list-windows-with-thumbnails: cache miss — spawning powershell');
    const script = buildBatchThumbnailScript();
    const stdout = await runPsAsync(script, 30000);
    const raw = stdout.trim();
    console.log(`[sidecar] PS stdout length=${raw.length}, first 200 chars: ${raw.substring(0, 200)}`);
    if (!raw || raw === 'null') {
        console.warn('[sidecar] list-windows-with-thumbnails: empty/null stdout — returning []');
        const data = [];
        cache = { data, ts: Date.now() };
        return data;
    }
    const data = JSON.parse(raw);
    console.log(`[sidecar] list-windows-with-thumbnails: parsed ${data.length} windows`);
    cache = { data, ts: Date.now() };
    return data;
}
