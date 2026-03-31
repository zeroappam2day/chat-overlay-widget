"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCaptureScript = buildCaptureScript;
exports.captureWindow = captureWindow;
exports.buildCaptureScriptWithMetadata = buildCaptureScriptWithMetadata;
exports.captureWindowWithMetadata = captureWindowWithMetadata;
const node_child_process_1 = require("node:child_process");
const crypto = __importStar(require("node:crypto"));
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const ptySession_js_1 = require("./ptySession.js");
function buildCaptureScript(titleQuery, outputPath) {
    // Sanitize title: strip CR/LF (break script structure), escape ' for PS single-quoted strings
    const safeTitle = titleQuery.replace(/[\r\n]/g, '').replace(/'/g, "''");
    // Escape single quotes in path for PS single-quoted string (backslashes are literal)
    const safePath = outputPath.replace(/'/g, "''");
    return `
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
using System.Text;

public class WinCapture {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    private const uint PW_RENDERFULLCONTENT = 0x2;

    public static string CaptureWindow(string titleQuery, string outputPath) {
        try {
            // Must be first call — DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 (STATE.md P19)
            SetProcessDpiAwarenessContext(new IntPtr(-4));

            IntPtr target = IntPtr.Zero;

            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
                if (!IsWindowVisible(hWnd)) return true;
                var sb = new StringBuilder(512);
                if (GetWindowText(hWnd, sb, 512) == 0) return true;
                var title = sb.ToString();
                if (title.IndexOf(titleQuery, StringComparison.OrdinalIgnoreCase) >= 0) {
                    target = hWnd;
                    return false;  // stop enumeration on first match
                }
                return true;
            }, IntPtr.Zero);

            if (target == IntPtr.Zero) {
                return "ERROR:NO_MATCH";
            }

            int width, height;

            if (IsIconic(target)) {
                return "ERROR:MINIMIZED";
            } else {
                // Normal window: use DwmGetWindowAttribute for true physical pixel bounds
                RECT bounds;
                DwmGetWindowAttribute(target, DWMWA_EXTENDED_FRAME_BOUNDS, out bounds, System.Runtime.InteropServices.Marshal.SizeOf(typeof(RECT)));
                width  = bounds.Right  - bounds.Left;
                height = bounds.Bottom - bounds.Top;
            }

            if (width <= 0 || height <= 0) {
                return "ERROR:ZERO_BOUNDS";
            }

            using (var bmp = new Bitmap(width, height))
            using (var g = Graphics.FromImage(bmp)) {
                IntPtr hdc = g.GetHdc();
                bool ok = PrintWindow(target, hdc, PW_RENDERFULLCONTENT);
                g.ReleaseHdc(hdc);
                if (!ok) {
                    return "ERROR:PRINTWINDOW_FAILED";
                }
                bmp.Save(outputPath, ImageFormat.Png);
            }

            return "OK:" + outputPath;
        } catch (Exception ex) {
            return "ERROR:" + ex.Message;
        }
    }
}
"@ -ReferencedAssemblies System.Drawing
\$result = [WinCapture]::CaptureWindow('${safeTitle}', '${safePath}')
Write-Output \$result
`;
}
function captureWindow(titleQuery) {
    const outputPath = path.join(ptySession_js_1.SCREENSHOT_DIR, crypto.randomUUID() + '.png');
    // Ensure the screenshot directory exists before spawning PowerShell
    fs.mkdirSync(ptySession_js_1.SCREENSHOT_DIR, { recursive: true });
    const script = buildCaptureScript(titleQuery, outputPath);
    const result = (0, node_child_process_1.spawnSync)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 15000 });
    if (result.error) {
        return { ok: false, error: `spawn error: ${result.error.message}` };
    }
    if (result.status !== 0) {
        return { ok: false, error: `PS exited ${result.status}: ${result.stderr?.trim()}` };
    }
    const stdout = result.stdout.trim();
    if (stdout.startsWith('OK:')) {
        return { ok: true, path: stdout.slice(3) };
    }
    if (stdout.startsWith('ERROR:')) {
        return { ok: false, error: stdout.slice(6) };
    }
    return { ok: false, error: `unexpected PS output: ${stdout}` };
}
function buildCaptureScriptWithMetadata(titleQuery, outputPath) {
    // Sanitize title: strip CR/LF, escape ' for PS single-quoted strings
    const safeTitle = titleQuery.replace(/[\r\n]/g, '').replace(/'/g, "''");
    // PS single-quoted strings treat backslashes literally — only escape single quotes
    const safePath = outputPath.replace(/'/g, "''");
    return `
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
using System.Text;
using System.Globalization;

public class WinCaptureWithMetadata {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    private const uint PW_RENDERFULLCONTENT = 0x2;

    public static string CaptureWindowWithMetadata(string titleQuery, string outputPath) {
        try {
            // Must be first call — DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 (STATE.md P19)
            SetProcessDpiAwarenessContext(new IntPtr(-4));

            IntPtr target = IntPtr.Zero;

            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
                if (!IsWindowVisible(hWnd)) return true;
                var sb = new StringBuilder(512);
                if (GetWindowText(hWnd, sb, 512) == 0) return true;
                var title = sb.ToString();
                if (title.IndexOf(titleQuery, StringComparison.OrdinalIgnoreCase) >= 0) {
                    target = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);

            if (target == IntPtr.Zero) {
                return "ERROR:NO_MATCH";
            }

            if (IsIconic(target)) {
                return "ERROR:MINIMIZED";
            }

            // Physical pixel bounds from DWM
            RECT dmwBounds;
            DwmGetWindowAttribute(target, DWMWA_EXTENDED_FRAME_BOUNDS, out dmwBounds, System.Runtime.InteropServices.Marshal.SizeOf(typeof(RECT)));
            int physW = dmwBounds.Right - dmwBounds.Left;
            int physH = dmwBounds.Bottom - dmwBounds.Top;

            if (physW <= 0 || physH <= 0) {
                return "ERROR:ZERO_BOUNDS";
            }

            // Logical bounds from GetWindowRect (used to derive DPI scale)
            RECT logRect;
            GetWindowRect(target, out logRect);
            int logW = logRect.Right - logRect.Left;
            double dpiScale = logW > 0 ? (double)physW / logW : 1.0;

            using (var bmp = new Bitmap(physW, physH))
            using (var g = Graphics.FromImage(bmp)) {
                IntPtr hdc = g.GetHdc();
                bool ok = PrintWindow(target, hdc, PW_RENDERFULLCONTENT);
                g.ReleaseHdc(hdc);
                if (!ok) {
                    return "ERROR:PRINTWINDOW_FAILED";
                }
                bmp.Save(outputPath, ImageFormat.Png);
            }

            // Pipe-delimited to avoid JS->PS->C# quote/brace escaping nightmare
            // Format: OK|path|bx|by|bw|bh|cw|ch|dpi
            return "OK|" + outputPath + "|"
                + dmwBounds.Left.ToString() + "|" + dmwBounds.Top.ToString() + "|"
                + physW.ToString() + "|" + physH.ToString() + "|"
                + physW.ToString() + "|" + physH.ToString() + "|"
                + dpiScale.ToString("F4", CultureInfo.InvariantCulture);
        } catch (Exception ex) {
            return "ERROR:" + ex.Message;
        }
    }
}
"@ -ReferencedAssemblies System.Drawing
\$result = [WinCaptureWithMetadata]::CaptureWindowWithMetadata('${safeTitle}', '${safePath}')
Write-Output \$result
`;
}
function captureWindowWithMetadata(titleQuery) {
    const outputPath = path.join(ptySession_js_1.SCREENSHOT_DIR, crypto.randomUUID() + '.png');
    // Ensure the screenshot directory exists before spawning PowerShell
    fs.mkdirSync(ptySession_js_1.SCREENSHOT_DIR, { recursive: true });
    const script = buildCaptureScriptWithMetadata(titleQuery, outputPath);
    const result = (0, node_child_process_1.spawnSync)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 15000 });
    if (result.error) {
        return { ok: false, error: `spawn error: ${result.error.message}` };
    }
    if (result.status !== 0) {
        return { ok: false, error: `PS exited ${result.status}: ${result.stderr?.trim()}` };
    }
    const raw = result.stdout.trim();
    // C# returns pipe-delimited: OK|path|bx|by|bw|bh|cw|ch|dpi
    // Find the last line starting with "OK|" (skip Add-Type diagnostics)
    const lines = raw.split(/\r?\n/);
    const okLine = lines.reverse().find(l => l.startsWith('OK|'));
    if (okLine) {
        const parts = okLine.split('|');
        // parts: [OK, path, bx, by, bw, bh, cw, ch, dpi]
        if (parts.length >= 9) {
            return {
                ok: true,
                data: {
                    path: parts[1],
                    bounds: { x: +parts[2], y: +parts[3], w: +parts[4], h: +parts[5] },
                    captureSize: { w: +parts[6], h: +parts[7] },
                    dpiScale: parseFloat(parts[8]),
                },
            };
        }
        return { ok: false, error: `malformed OK response: ${okLine}` };
    }
    // Check for ERROR: prefix
    const errLine = lines.find(l => l.startsWith('ERROR:'));
    if (errLine) {
        return { ok: false, error: errLine.slice(6) };
    }
    return { ok: false, error: `unexpected PS output: ${raw}` };
}
