/**
 * inputSimulator.ts — Agent Runtime Phase 5
 *
 * Win32 SendInput wrapper via PowerShell P/Invoke.
 * Simulates mouse clicks, keyboard input, key combos, and drag operations.
 * Each action is a separate PowerShell invocation (isolated, no state leakage).
 *
 * Uses the same P/Invoke pattern as windowEnumerator.ts and windowCapture.ts.
 */

import { spawnSync } from 'node:child_process';

export interface InputResult {
  ok: boolean;
  error?: string;
}

const ACTION_TIMEOUT_MS = 5_000;

// ─── Key name → virtual key code mapping ────────────────────────────────────

const VK_MAP: Record<string, string> = {
  // Modifiers
  ctrl: '0x11',    // VK_CONTROL
  alt: '0x12',     // VK_MENU
  shift: '0x10',   // VK_SHIFT
  win: '0x5B',     // VK_LWIN
  // Navigation
  enter: '0x0D',   // VK_RETURN
  tab: '0x09',     // VK_TAB
  escape: '0x1B',  // VK_ESCAPE
  esc: '0x1B',     // VK_ESCAPE (alias)
  space: '0x20',   // VK_SPACE
  backspace: '0x08', // VK_BACK
  delete: '0x2E',  // VK_DELETE
  insert: '0x2D',  // VK_INSERT
  home: '0x24',    // VK_HOME
  end: '0x23',     // VK_END
  pageup: '0x21',  // VK_PRIOR
  pagedown: '0x22', // VK_NEXT
  // Arrow keys
  up: '0x26',      // VK_UP
  down: '0x28',    // VK_DOWN
  left: '0x25',    // VK_LEFT
  right: '0x27',   // VK_RIGHT
  // Function keys
  f1: '0x70', f2: '0x71', f3: '0x72', f4: '0x73',
  f5: '0x74', f6: '0x75', f7: '0x76', f8: '0x77',
  f9: '0x78', f10: '0x79', f11: '0x7A', f12: '0x7B',
  // Letters (a-z)
  a: '0x41', b: '0x42', c: '0x43', d: '0x44', e: '0x45',
  f: '0x46', g: '0x47', h: '0x48', i: '0x49', j: '0x4A',
  k: '0x4B', l: '0x4C', m: '0x4D', n: '0x4E', o: '0x4F',
  p: '0x50', q: '0x51', r: '0x52', s: '0x53', t: '0x54',
  u: '0x55', v: '0x56', w: '0x57', x: '0x58', y: '0x59',
  z: '0x5A',
  // Numbers (0-9)
  '0': '0x30', '1': '0x31', '2': '0x32', '3': '0x33', '4': '0x34',
  '5': '0x35', '6': '0x36', '7': '0x37', '8': '0x38', '9': '0x39',
};

// ─── PowerShell runner ──────────────────────────────────────────────────────

function runPowerShell(script: string): InputResult {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', timeout: ACTION_TIMEOUT_MS }
  );

  if (result.error) {
    return { ok: false, error: `spawn error: ${result.error.message}` };
  }

  if (result.status !== 0) {
    return { ok: false, error: `PS exited ${result.status}: ${result.stderr?.trim()}` };
  }

  const stdout = result.stdout.trim();
  if (stdout.startsWith('OK')) {
    return { ok: true };
  }
  if (stdout.startsWith('ERROR:')) {
    return { ok: false, error: stdout.slice(6) };
  }
  return { ok: false, error: `unexpected PS output: ${stdout}` };
}

// ─── Shared C# type definition for SendInput ────────────────────────────────

const SEND_INPUT_CSHARP = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class InputSim {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;

    public const int INPUT_MOUSE = 0;
    public const int INPUT_KEYBOARD = 1;

    public const uint MOUSEEVENTF_MOVE = 0x0001;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_ABSOLUTE = 0x8000;

    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_UNICODE = 0x0004;

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public int type;
        public InputUnion u;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public static int[] ToAbsolute(int x, int y) {
        int screenW = GetSystemMetrics(SM_CXSCREEN);
        int screenH = GetSystemMetrics(SM_CYSCREEN);
        int absX = (int)(((double)x * 65535) / screenW);
        int absY = (int)(((double)y * 65535) / screenH);
        return new int[] { absX, absY };
    }
}
"@
`;

// ─── Click action ───────────────────────────────────────────────────────────

export function simulateClick(x: number, y: number, button: 'left' | 'right' = 'left'): InputResult {
  const downFlag = button === 'right' ? 'InputSim.MOUSEEVENTF_RIGHTDOWN' : 'InputSim.MOUSEEVENTF_LEFTDOWN';
  const upFlag = button === 'right' ? 'InputSim.MOUSEEVENTF_RIGHTUP' : 'InputSim.MOUSEEVENTF_LEFTUP';

  const script = `${SEND_INPUT_CSHARP}
try {
    [InputSim]::SetProcessDpiAwarenessContext([IntPtr]::new(-4))
    $abs = [InputSim]::ToAbsolute(${x}, ${y})

    $move = New-Object InputSim+INPUT
    $move.type = [InputSim]::INPUT_MOUSE
    $move.u.mi.dx = $abs[0]
    $move.u.mi.dy = $abs[1]
    $move.u.mi.dwFlags = [InputSim]::MOUSEEVENTF_MOVE -bor [InputSim]::MOUSEEVENTF_ABSOLUTE

    $down = New-Object InputSim+INPUT
    $down.type = [InputSim]::INPUT_MOUSE
    $down.u.mi.dx = $abs[0]
    $down.u.mi.dy = $abs[1]
    $down.u.mi.dwFlags = ${downFlag} -bor [InputSim]::MOUSEEVENTF_ABSOLUTE

    $up = New-Object InputSim+INPUT
    $up.type = [InputSim]::INPUT_MOUSE
    $up.u.mi.dx = $abs[0]
    $up.u.mi.dy = $abs[1]
    $up.u.mi.dwFlags = ${upFlag} -bor [InputSim]::MOUSEEVENTF_ABSOLUTE

    $inputs = @($move, $down, $up)
    $sent = [InputSim]::SendInput(3, $inputs, [System.Runtime.InteropServices.Marshal]::SizeOf([type][InputSim+INPUT]))
    if ($sent -eq 3) { Write-Output "OK" } else { Write-Output "ERROR:SendInput returned $sent" }
} catch {
    Write-Output "ERROR:$($_.Exception.Message)"
}`;

  return runPowerShell(script);
}

// ─── Type action (Unicode text) ─────────────────────────────────────────────

export function simulateType(text: string): InputResult {
  if (text.length > 10000) {
    return { ok: false, error: 'Text exceeds 10000 character limit' };
  }

  // Escape for PS single-quoted string
  const safeText = text.replace(/'/g, "''");

  const script = `${SEND_INPUT_CSHARP}
try {
    $text = '${safeText}'
    $inputs = New-Object System.Collections.Generic.List[InputSim+INPUT]

    foreach ($char in $text.ToCharArray()) {
        $down = New-Object InputSim+INPUT
        $down.type = [InputSim]::INPUT_KEYBOARD
        $down.u.ki.wScan = [uint16][char]$char
        $down.u.ki.dwFlags = [InputSim]::KEYEVENTF_UNICODE
        $inputs.Add($down)

        $up = New-Object InputSim+INPUT
        $up.type = [InputSim]::INPUT_KEYBOARD
        $up.u.ki.wScan = [uint16][char]$char
        $up.u.ki.dwFlags = [InputSim]::KEYEVENTF_UNICODE -bor [InputSim]::KEYEVENTF_KEYUP
        $inputs.Add($up)
    }

    $arr = $inputs.ToArray()
    $sent = [InputSim]::SendInput([uint32]$arr.Length, $arr, [System.Runtime.InteropServices.Marshal]::SizeOf([type][InputSim+INPUT]))
    if ($sent -eq $arr.Length) { Write-Output "OK" } else { Write-Output "ERROR:SendInput returned $sent of $($arr.Length)" }
} catch {
    Write-Output "ERROR:$($_.Exception.Message)"
}`;

  return runPowerShell(script);
}

// ─── Key combo action (e.g., Ctrl+C) ───────────────────────────────────────

export function simulateKeyCombo(keys: string[]): InputResult {
  if (keys.length === 0) {
    return { ok: false, error: 'keys array is empty' };
  }
  if (keys.length > 10) {
    return { ok: false, error: 'keys array exceeds 10 keys' };
  }

  // Resolve VK codes
  const vkCodes: string[] = [];
  for (const key of keys) {
    const normalized = key.toLowerCase().trim();
    const vk = VK_MAP[normalized];
    if (!vk) {
      return { ok: false, error: `Unknown key: "${key}". Supported: ${Object.keys(VK_MAP).join(', ')}` };
    }
    vkCodes.push(vk);
  }

  // Build PS array of VK codes
  const vkArrayStr = vkCodes.map(vk => vk).join(', ');

  const script = `${SEND_INPUT_CSHARP}
try {
    $vkCodes = @(${vkArrayStr})
    $inputs = New-Object System.Collections.Generic.List[InputSim+INPUT]

    # Key down in order
    foreach ($vk in $vkCodes) {
        $down = New-Object InputSim+INPUT
        $down.type = [InputSim]::INPUT_KEYBOARD
        $down.u.ki.wVk = [uint16]$vk
        $down.u.ki.dwFlags = 0
        $inputs.Add($down)
    }

    # Key up in reverse order
    $reversed = $vkCodes.Clone()
    [Array]::Reverse($reversed)
    foreach ($vk in $reversed) {
        $up = New-Object InputSim+INPUT
        $up.type = [InputSim]::INPUT_KEYBOARD
        $up.u.ki.wVk = [uint16]$vk
        $up.u.ki.dwFlags = [InputSim]::KEYEVENTF_KEYUP
        $inputs.Add($up)
    }

    $arr = $inputs.ToArray()
    $sent = [InputSim]::SendInput([uint32]$arr.Length, $arr, [System.Runtime.InteropServices.Marshal]::SizeOf([type][InputSim+INPUT]))
    if ($sent -eq $arr.Length) { Write-Output "OK" } else { Write-Output "ERROR:SendInput returned $sent of $($arr.Length)" }
} catch {
    Write-Output "ERROR:$($_.Exception.Message)"
}`;

  return runPowerShell(script);
}

// ─── Drag action ────────────────────────────────────────────────────────────

export function simulateDrag(fromX: number, fromY: number, toX: number, toY: number): InputResult {
  const script = `${SEND_INPUT_CSHARP}
try {
    [InputSim]::SetProcessDpiAwarenessContext([IntPtr]::new(-4))
    $from = [InputSim]::ToAbsolute(${fromX}, ${fromY})
    $to = [InputSim]::ToAbsolute(${toX}, ${toY})

    # Move to start position
    $moveStart = New-Object InputSim+INPUT
    $moveStart.type = [InputSim]::INPUT_MOUSE
    $moveStart.u.mi.dx = $from[0]
    $moveStart.u.mi.dy = $from[1]
    $moveStart.u.mi.dwFlags = [InputSim]::MOUSEEVENTF_MOVE -bor [InputSim]::MOUSEEVENTF_ABSOLUTE

    # Press left button
    $down = New-Object InputSim+INPUT
    $down.type = [InputSim]::INPUT_MOUSE
    $down.u.mi.dx = $from[0]
    $down.u.mi.dy = $from[1]
    $down.u.mi.dwFlags = [InputSim]::MOUSEEVENTF_LEFTDOWN -bor [InputSim]::MOUSEEVENTF_ABSOLUTE

    $inputs1 = @($moveStart, $down)
    $sent1 = [InputSim]::SendInput(2, $inputs1, [System.Runtime.InteropServices.Marshal]::SizeOf([type][InputSim+INPUT]))

    # Small delay for drag recognition
    Start-Sleep -Milliseconds 50

    # Move to end position
    $moveEnd = New-Object InputSim+INPUT
    $moveEnd.type = [InputSim]::INPUT_MOUSE
    $moveEnd.u.mi.dx = $to[0]
    $moveEnd.u.mi.dy = $to[1]
    $moveEnd.u.mi.dwFlags = [InputSim]::MOUSEEVENTF_MOVE -bor [InputSim]::MOUSEEVENTF_ABSOLUTE

    $inputs2 = @($moveEnd)
    $sent2 = [InputSim]::SendInput(1, $inputs2, [System.Runtime.InteropServices.Marshal]::SizeOf([type][InputSim+INPUT]))

    # Small delay before release
    Start-Sleep -Milliseconds 50

    # Release left button
    $up = New-Object InputSim+INPUT
    $up.type = [InputSim]::INPUT_MOUSE
    $up.u.mi.dx = $to[0]
    $up.u.mi.dy = $to[1]
    $up.u.mi.dwFlags = [InputSim]::MOUSEEVENTF_LEFTUP -bor [InputSim]::MOUSEEVENTF_ABSOLUTE

    $inputs3 = @($up)
    $sent3 = [InputSim]::SendInput(1, $inputs3, [System.Runtime.InteropServices.Marshal]::SizeOf([type][InputSim+INPUT]))

    if ($sent1 -eq 2 -and $sent2 -eq 1 -and $sent3 -eq 1) { Write-Output "OK" }
    else { Write-Output "ERROR:SendInput partial failure ($sent1,$sent2,$sent3)" }
} catch {
    Write-Output "ERROR:$($_.Exception.Message)"
}`;

  return runPowerShell(script);
}
