/**
 * Window Focus Manager (EAC-3).
 * Focuses a target window before input simulation using PowerShell P/Invoke.
 * Uses execFile (async) with Add-Type for user32.dll calls.
 */

import { execFile } from 'node:child_process';

const FOCUS_TIMEOUT_MS = 3_000;
const RETRY_DELAY_MS = 200;

export interface FocusResult {
  ok: boolean;
  error?: string;
}

/** Shared Add-Type block — single C# class for all focus operations. */
const ADD_TYPE_BLOCK = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class WinFocus {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool AllowSetForegroundWindow(int dwProcessId);
}
"@
`;

function buildFocusScript(hwnd: number): string {
  return `${ADD_TYPE_BLOCK}
$hwnd = [IntPtr]::new(${hwnd})
$result = [WinFocus]::SetForegroundWindow($hwnd)
$active = [WinFocus]::GetForegroundWindow()
@{ ok = $result; activeHwnd = $active.ToInt64() } | ConvertTo-Json -Compress
`;
}

function buildRetryFocusScript(hwnd: number): string {
  return `${ADD_TYPE_BLOCK}
$hwnd = [IntPtr]::new(${hwnd})
[WinFocus]::AllowSetForegroundWindow(-1) | Out-Null
$result = [WinFocus]::SetForegroundWindow($hwnd)
$active = [WinFocus]::GetForegroundWindow()
@{ ok = $result; activeHwnd = $active.ToInt64() } | ConvertTo-Json -Compress
`;
}

function buildGetActiveScript(): string {
  return `${ADD_TYPE_BLOCK}
$active = [WinFocus]::GetForegroundWindow()
@{ activeHwnd = $active.ToInt64() } | ConvertTo-Json -Compress
`;
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout: FOCUS_TIMEOUT_MS },
      (error, stdout) => {
        if (error) {
          reject(new Error(`PowerShell error: ${error.message}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

/**
 * Focus the window with the given hwnd via SetForegroundWindow.
 * If the initial call fails, retries with AllowSetForegroundWindow(-1).
 * Returns ok:true only when the active window matches the target hwnd.
 */
export async function focusWindow(hwnd: number): Promise<FocusResult> {
  try {
    const raw = await runPowerShell(buildFocusScript(hwnd));
    const result = JSON.parse(raw) as { ok: boolean; activeHwnd: number };
    if (result.ok && result.activeHwnd === hwnd) {
      return { ok: true };
    }
    // Retry with AllowSetForegroundWindow — bypasses foreground lock timeout
    const retryRaw = await runPowerShell(buildRetryFocusScript(hwnd));
    const retryResult = JSON.parse(retryRaw) as { ok: boolean; activeHwnd: number };
    if (retryResult.ok && retryResult.activeHwnd === hwnd) {
      return { ok: true };
    }
    return { ok: false, error: `SetForegroundWindow returned ${retryResult.ok}, active hwnd is ${retryResult.activeHwnd} (expected ${hwnd})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get the hwnd of the currently active (foreground) window.
 */
export async function getActiveWindowHwnd(): Promise<number> {
  const raw = await runPowerShell(buildGetActiveScript());
  const result = JSON.parse(raw) as { activeHwnd: number };
  return result.activeHwnd;
}

/**
 * Check whether the given hwnd is the active foreground window.
 */
export async function verifyFocus(expectedHwnd: number): Promise<boolean> {
  const activeHwnd = await getActiveWindowHwnd();
  return activeHwnd === expectedHwnd;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Focus a window and verify it became foreground. Retries up to maxRetries times
 * with a 200ms delay between attempts.
 * focusWindow already verifies activeHwnd internally, so no extra PS spawn needed.
 */
export async function focusAndVerify(hwnd: number, maxRetries: number = 2): Promise<FocusResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await focusWindow(hwnd);
    if (result.ok) return { ok: true };
    if (attempt < maxRetries) {
      await delay(RETRY_DELAY_MS);
    }
  }
  return { ok: false, error: `Failed to focus window ${hwnd} after ${maxRetries + 1} attempts` };
}

// Exported for testing
export { buildFocusScript, buildRetryFocusScript, buildGetActiveScript };
