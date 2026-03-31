import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SCREENSHOT_DIR } from './ptySession.js';
import { listWindows } from './windowEnumerator.js';

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

// ─── HWND-based capture (Phase 22) ─────────────────────────────────────────

export function buildCaptureByHwndScript(hwnd: number, pid: number, outputPath: string): string {
  // PS single-quoted strings treat backslashes literally — only escape single quotes
  const safePath = outputPath.replace(/'/g, "''");

  return `
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;

public class WinCaptureByHwnd {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

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

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    private const uint PW_RENDERFULLCONTENT = 0x2;

    public static string CaptureByHwnd(long hwndValue, long expectedPid, string outputPath) {
        try {
            // Must be first call — DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2
            SetProcessDpiAwarenessContext(new IntPtr(-4));

            IntPtr target = new IntPtr(hwndValue);  // MUST be long cast, never int

            // HWND-02: Stale/recycled detection via GetWindowThreadProcessId
            uint actualPid = 0;
            uint threadId = GetWindowThreadProcessId(target, out actualPid);
            if (threadId == 0) return "ERROR:STALE_HWND";
            if (actualPid != (uint)expectedPid) return "ERROR:STALE_HWND";

            if (IsIconic(target)) return "ERROR:MINIMIZED";

            // Physical pixel bounds from DWM
            RECT dmwBounds;
            DwmGetWindowAttribute(target, DWMWA_EXTENDED_FRAME_BOUNDS, out dmwBounds,
                System.Runtime.InteropServices.Marshal.SizeOf(typeof(RECT)));
            int physW = dmwBounds.Right - dmwBounds.Left;
            int physH = dmwBounds.Bottom - dmwBounds.Top;
            if (physW <= 0 || physH <= 0) return "ERROR:ZERO_BOUNDS";

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
                if (!ok) return "ERROR:PRINTWINDOW_FAILED";

                // HWND-03: Blank-bitmap detection (elevated/UWP windows return all-black)
                if (IsBitmapBlank(bmp)) return "ERROR:BLANK_CAPTURE";

                bmp.Save(outputPath, ImageFormat.Png);
            }

            // Pipe-delimited format: OK|path|bx|by|bw|bh|cw|ch|dpi
            return "OK|" + outputPath + "|"
                + dmwBounds.Left.ToString() + "|" + dmwBounds.Top.ToString() + "|"
                + physW.ToString() + "|" + physH.ToString() + "|"
                + physW.ToString() + "|" + physH.ToString() + "|"
                + dpiScale.ToString("F4", CultureInfo.InvariantCulture);
        } catch (Exception ex) {
            return "ERROR:" + ex.Message;
        }
    }

    private static bool IsBitmapBlank(Bitmap bmp, int sampleCount = 100) {
        int step = (int)Math.Sqrt((double)(bmp.Width * bmp.Height) / sampleCount);
        if (step < 1) step = 1;
        long totalBrightness = 0;
        int counted = 0;
        for (int x = 0; x < bmp.Width; x += step) {
            for (int y = 0; y < bmp.Height; y += step) {
                var c = bmp.GetPixel(x, y);
                totalBrightness += (c.R + c.G + c.B);
                counted++;
            }
        }
        if (counted == 0) return true;
        double avgLuminance = (double)totalBrightness / (counted * 3);
        return avgLuminance < 5.0;
    }
}
"@ -ReferencedAssemblies System.Drawing
\$result = [WinCaptureByHwnd]::CaptureByHwnd(${hwnd}L, ${pid}L, '${safePath}')
Write-Output \$result
`;
}

function parseOkLine(raw: string): CaptureWithMetadataResult {
  const lines = raw.split(/\r?\n/);
  const okLine = [...lines].reverse().find(l => l.startsWith('OK|'));
  if (okLine) {
    const parts = okLine.split('|');
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
  const errLine = lines.find(l => l.startsWith('ERROR:'));
  if (errLine) {
    return { ok: false, error: errLine.slice(6) };
  }
  return { ok: false, error: `unexpected PS output: ${raw}` };
}

export function captureWindowByHwnd(hwnd: number, pid: number, titleLabel: string): CaptureWithMetadataResult {
  const outputPath = path.join(SCREENSHOT_DIR, crypto.randomUUID() + '.png');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const script = buildCaptureByHwndScript(hwnd, pid, outputPath);

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
  const parsed = parseOkLine(raw);

  // HWND-03: BLANK_CAPTURE is returned as-is — no fallback for elevated window black bitmaps
  // HWND-04: Stale HWND fallback — attempt processName-based single-window fallback
  if (!parsed.ok && parsed.error === 'STALE_HWND' && titleLabel) {
    console.warn(`[sidecar] HWND ${hwnd} is stale — attempting title+processName fallback`);

    const windows = listWindows();

    // Find processName by matching pid in the live window list
    const pidMatch = windows.find(w => w.pid === pid);
    if (pidMatch) {
      // Process still alive — find all windows with that processName
      const matches = windows.filter(w => w.processName === pidMatch.processName);
      if (matches.length === 1) {
        // Safe to fall back — only one window with this processName
        const fallback = captureWindowWithMetadata(matches[0].title);
        if (fallback.ok) {
          console.warn(`[sidecar] fallback capture succeeded via title "${matches[0].title}"`);
          return fallback;
        }
      } else {
        console.warn(`[sidecar] fallback skipped — ${matches.length} windows match processName`);
      }
    }
    // Process is dead or fallback conditions not met
    return { ok: false, error: 'STALE_HWND' };
  }

  return parsed;
}
