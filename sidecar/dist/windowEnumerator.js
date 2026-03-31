"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PS_SCRIPT = void 0;
exports.resetCache = resetCache;
exports.listWindows = listWindows;
const node_child_process_1 = require("node:child_process");
let cache = null;
const CACHE_TTL_MS = 5000;
function resetCache() {
    cache = null;
}
exports.PS_SCRIPT = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Text;
using System.Diagnostics;

public class WinEnum {
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

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern IntPtr GetParent(IntPtr hWnd);

    private const int GWL_EXSTYLE = -20;
    private const long WS_EX_TOOLWINDOW = 0x80L;
    private const int DWMWA_CLOAKED = 14;

    public static List<object> GetVisibleWindows() {
        var windows = new List<object>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            // Filter 1: must be visible
            if (!IsWindowVisible(hWnd)) return true;

            // Filter 2: must have a non-empty title
            var sb = new StringBuilder(512);
            if (GetWindowText(hWnd, sb, 512) == 0) return true;
            var title = sb.ToString().Trim();
            if (string.IsNullOrEmpty(title)) return true;

            // Filter 3: must not be cloaked (UWP virtual desktop, MSCTFIME UI, ghost windows)
            int cloaked = 0;
            DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, 4);
            if (cloaked != 0) return true;

            // Filter 4: must not be a tool window (floating toolbars, tooltip hosts, system tray)
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

            windows.Add(new { title = title, processName = processName, hwnd = hWnd.ToInt64(), pid = (long)pid });
            return true;
        }, IntPtr.Zero);
        return windows;
    }
}
"@
@([WinEnum]::GetVisibleWindows()) | ConvertTo-Json -Compress -Depth 2
`;
function runEnumeration() {
    const result = (0, node_child_process_1.spawnSync)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', exports.PS_SCRIPT], { encoding: 'utf8', timeout: 10000 });
    if (result.error)
        throw result.error;
    if (result.status !== 0) {
        throw new Error(`PowerShell exited ${result.status}: ${result.stderr}`);
    }
    const raw = result.stdout.trim();
    if (!raw || raw === 'null')
        return [];
    return JSON.parse(raw);
}
function listWindows() {
    if (cache && (Date.now() - cache.ts) < CACHE_TTL_MS) {
        console.log('[sidecar] list-windows: cache hit');
        return cache.data;
    }
    console.log('[sidecar] list-windows: cache miss — spawning powershell');
    const data = runEnumeration();
    cache = { data, ts: Date.now() };
    return data;
}
