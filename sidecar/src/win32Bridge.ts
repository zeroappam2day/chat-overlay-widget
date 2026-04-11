/**
 * win32Bridge.ts — Persistent PowerShell Win32 bridge (Phase 40, D-01, D-03, D-04).
 *
 * Spawns a single PowerShell process at sidecar startup, compiles Add-Type once,
 * then routes JSON request/response pairs by request ID. Handles timeout, crash,
 * and auto-restart.
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

const TIMEOUT_MS = 3000;

/**
 * C# Add-Type block — compiled once per PS process lifetime.
 * Declares all Win32 P/Invoke stubs needed for focus tracking.
 */
const ADD_TYPE_BLOCK = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class Win32Focus {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
}
"@

function Invoke-Win32Command($json) {
    $req = $json | ConvertFrom-Json
    $id = $req.id
    $cmd = $req.cmd
    $args = $req.args

    try {
        switch ($cmd) {
            'getForegroundWindow' {
                $hwnd = [Win32Focus]::GetForegroundWindow()
                $result = $hwnd.ToInt64()
            }
            'getWindowThreadProcessId' {
                $hWnd = [IntPtr]::new([long]$args[0])
                $pid = [uint32]0
                $tid = [Win32Focus]::GetWindowThreadProcessId($hWnd, [ref]$pid)
                $result = @{ threadId = [int]$tid; pid = [int]$pid } | ConvertTo-Json -Compress
                Write-Output ('{"id":' + $id + ',"result":' + $result + '}')
                return
            }
            'isWindow' {
                $hWnd = [IntPtr]::new([long]$args[0])
                $result = [Win32Focus]::IsWindow($hWnd)
            }
            'isIconic' {
                $hWnd = [IntPtr]::new([long]$args[0])
                $result = [Win32Focus]::IsIconic($hWnd)
            }
            'getOwnerWindow' {
                $hWnd = [IntPtr]::new([long]$args[0])
                # GW_OWNER = 4
                $owner = [Win32Focus]::GetWindow($hWnd, 4)
                $result = $owner.ToInt64()
            }
            'getProcessName' {
                $pid = [int]$args[0]
                try {
                    $proc = [System.Diagnostics.Process]::GetProcessById($pid)
                    $result = $proc.ProcessName
                } catch {
                    $result = ''
                }
            }
            default {
                $errMsg = 'Unknown command: ' + $cmd
                Write-Output ('{"id":' + $id + ',"error":"' + $errMsg + '"}')
                return
            }
        }
        $resultJson = $result | ConvertTo-Json -Compress
        Write-Output ('{"id":' + $id + ',"result":' + $resultJson + '}')
    } catch {
        $errMsg = $_.Exception.Message -replace '"', ''
        Write-Output ('{"id":' + $id + ',"error":"' + $errMsg + '"}')
    }
}

Write-Output "---READY---"
[Console]::Out.Flush()

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if ($line -eq '') { continue }
    Invoke-Win32Command $line
    [Console]::Out.Flush()
}
`;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Win32Bridge {
  private proc: ChildProcess | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private alive = false;
  private destroyed = false;
  private initPromise: Promise<void> | null = null;
  private lineBuffer = '';

  async init(): Promise<void> {
    if (this.destroyed) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const proc = spawn(
        'powershell.exe',
        ['-NoProfile', '-NoExit', '-Command', '-'],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );
      this.proc = proc;

      let initDone = false;

      proc.stdout!.setEncoding('utf8');
      proc.stdout!.on('data', (chunk: string) => {
        this.lineBuffer += chunk;
        const lines = this.lineBuffer.split('\n');
        this.lineBuffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          if (!initDone && line === '---READY---') {
            initDone = true;
            this.alive = true;
            resolve();
            continue;
          }

          if (line.startsWith('{')) {
            this.handleResponse(line);
          }
        }
      });

      proc.on('exit', () => {
        this.alive = false;
        this.initPromise = null;
        this.rejectAllPending(new Error('PowerShell process exited'));
        if (!initDone) {
          reject(new Error('PowerShell process exited before READY'));
        }
        if (!this.destroyed) {
          // Auto-restart
          this.init().catch(() => {});
        }
      });

      proc.on('error', (err: Error) => {
        this.alive = false;
        this.initPromise = null;
        this.rejectAllPending(err);
        if (!initDone) {
          reject(err);
        }
      });

      // Send Add-Type block once PS is spawned
      proc.stdin!.write(ADD_TYPE_BLOCK, 'utf8');
    });

    return this.initPromise;
  }

  private handleResponse(line: string): void {
    let parsed: { id: number; result?: unknown; error?: string };
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }

    const pending = this.pending.get(parsed.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(parsed.id);

    if (parsed.error !== undefined) {
      pending.reject(new Error(parsed.error));
    } else {
      pending.resolve(parsed.result);
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private async sendRequest<T>(cmd: string, args: unknown[] = []): Promise<T> {
    if (!this.alive || !this.initPromise) {
      await this.init();
    } else {
      await this.initPromise;
    }

    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`win32Bridge timeout: command '${cmd}' did not respond within ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      const msg = JSON.stringify({ id, cmd, args }) + '\n';
      this.proc!.stdin!.write(msg, 'utf8');
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.alive = false;
    this.initPromise = null;
    this.rejectAllPending(new Error('win32Bridge destroyed'));
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }

  async getForegroundWindow(): Promise<number> {
    return this.sendRequest<number>('getForegroundWindow');
  }

  async getWindowThreadProcessId(hwnd: number): Promise<{ threadId: number; pid: number }> {
    return this.sendRequest<{ threadId: number; pid: number }>('getWindowThreadProcessId', [hwnd]);
  }

  async isWindow(hwnd: number): Promise<boolean> {
    return this.sendRequest<boolean>('isWindow', [hwnd]);
  }

  async isIconic(hwnd: number): Promise<boolean> {
    return this.sendRequest<boolean>('isIconic', [hwnd]);
  }

  async getOwnerWindow(hwnd: number): Promise<number> {
    return this.sendRequest<number>('getOwnerWindow', [hwnd]);
  }

  async getProcessName(pid: number): Promise<string> {
    return this.sendRequest<string>('getProcessName', [pid]);
  }
}

// Singleton instance — initialized at module load
export const win32Bridge = new Win32Bridge();
win32Bridge.init().catch(err => {
  console.error('[win32Bridge] init failed:', err.message);
});

// Convenience re-exports
export function getForegroundWindow(): Promise<number> {
  return win32Bridge.getForegroundWindow();
}

export function getWindowThreadProcessId(hwnd: number): Promise<{ threadId: number; pid: number }> {
  return win32Bridge.getWindowThreadProcessId(hwnd);
}

export function isWindow(hwnd: number): Promise<boolean> {
  return win32Bridge.isWindow(hwnd);
}

export function isIconic(hwnd: number): Promise<boolean> {
  return win32Bridge.isIconic(hwnd);
}

export function getOwnerWindow(hwnd: number): Promise<number> {
  return win32Bridge.getOwnerWindow(hwnd);
}

export function getProcessName(pid: number): Promise<string> {
  return win32Bridge.getProcessName(pid);
}

export function init(): Promise<void> {
  return win32Bridge.init();
}

export function destroy(): void {
  win32Bridge.destroy();
}
