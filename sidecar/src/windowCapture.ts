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

// ─── Enriched capture with metadata ────────────────────────────────────────

export interface CaptureMetadata {
  path: string;
  bounds: { x: number; y: number; w: number; h: number };
  captureSize: { w: number; h: number };
  dpiScale: number;
}

export type CaptureWithMetadataResult =
  | { ok: true; data: CaptureMetadata }
  | { ok: false; error: string };

export function buildCaptureScriptWithMetadata(titleQuery: string, outputPath: string): string {
  // Sanitize title: strip CR/LF, escape ' for PS single-quoted strings
  const safeTitle = titleQuery.replace(/[\r\n]/g, '').replace(/'/g, "''");
  // Escape backslashes and single quotes for embedding in C# string literal via string.Format
  const escapedPath = outputPath.replace(/\\/g, '\\\\');

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

            return string.Format(
                CultureInfo.InvariantCulture,
                "{{\"ok\":true,\"path\":\"{0}\",\"bx\":{1},\"by\":{2},\"bw\":{3},\"bh\":{4},\"cw\":{3},\"ch\":{4},\"dpi\":\"{5}\"}}",
                outputPath.Replace("\\\\", "\\\\\\\\"),
                dmwBounds.Left, dmwBounds.Top, physW, physH,
                dpiScale.ToString("F4", CultureInfo.InvariantCulture)
            );
        } catch (Exception ex) {
            return "ERROR:" + ex.Message;
        }
    }
}
"@ -ReferencedAssemblies System.Drawing
\$result = [WinCaptureWithMetadata]::CaptureWindowWithMetadata('${safeTitle}', '${escapedPath}')
Write-Output \$result
`;
}

export function captureWindowWithMetadata(titleQuery: string): CaptureWithMetadataResult {
  const outputPath = path.join(SCREENSHOT_DIR, crypto.randomUUID() + '.png');

  // Ensure the screenshot directory exists before spawning PowerShell
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const script = buildCaptureScriptWithMetadata(titleQuery, outputPath);

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

  const raw = result.stdout.trim();

  // Skip any Add-Type diagnostic lines by finding first '{' character
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) {
    // No JSON found — check for ERROR: prefix
    if (raw.startsWith('ERROR:')) {
      return { ok: false, error: raw.slice(6) };
    }
    return { ok: false, error: `unexpected PS output: ${raw}` };
  }

  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as {
      ok: boolean;
      path: string;
      bx: number; by: number; bw: number; bh: number;
      cw: number; ch: number;
      dpi: string;
    };
    return {
      ok: true,
      data: {
        path: parsed.path,
        bounds: { x: parsed.bx, y: parsed.by, w: parsed.bw, h: parsed.bh },
        captureSize: { w: parsed.cw, h: parsed.ch },
        dpiScale: parseFloat(parsed.dpi),
      },
    };
  } catch (err) {
    return { ok: false, error: `JSON parse failed: ${err}` };
  }
}
