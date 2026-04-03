import { exec } from 'node:child_process';

export interface WindowRect {
  Left: number;
  Top: number;
  Right: number;
  Bottom: number;
}

export function getActiveWindowRect(): Promise<WindowRect | null> {
  const script = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public struct RECT { public int Left, Top, Right, Bottom; }
      public class WindowUtils {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
      }
"@
    $rect = New-Object RECT
    $handle = [WindowUtils]::GetForegroundWindow()
    if ($handle -ne [IntPtr]::Zero -and [WindowUtils]::GetWindowRect($handle, [ref]$rect)) {
      $rect | ConvertTo-Json
    }
  `;

  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, (error, stdout) => {
      if (error) {
        console.error('[spatial-engine] PowerShell error:', error);
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (e) {
        // stdout might be empty if handle is Zero
        resolve(null);
      }
    });
  });
}
