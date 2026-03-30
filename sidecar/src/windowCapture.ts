import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SCREENSHOT_DIR } from './ptySession.js';

export type CaptureResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

export function buildCaptureScript(titleQuery: string, outputPath: string): string {
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

export function captureWindow(titleQuery: string): CaptureResult {
  const outputPath = path.join(SCREENSHOT_DIR, crypto.randomUUID() + '.png');

  // Ensure the screenshot directory exists before spawning PowerShell
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const script = buildCaptureScript(titleQuery, outputPath);

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', timeout: 15_000 }
  );

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
