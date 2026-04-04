/**
 * clipboardManager.ts — EAC-4: Clipboard Integration
 *
 * Read/write Windows clipboard via PowerShell.
 * Each operation is a separate PowerShell invocation (isolated, no shell state).
 *
 * Safety:
 *   - NEVER log clipboard contents (may contain passwords)
 *   - Text passed via stdin pipe (not command-line arg) to avoid shell injection
 *   - All PowerShell invocations are isolated (spawnSync, no state leakage)
 */

import { spawnSync } from 'node:child_process';

export interface ClipboardResult {
  ok: boolean;
  text?: string;
  error?: string;
}

const CLIPBOARD_TIMEOUT_MS = 3_000;
const MAX_CLIPBOARD_BYTES = 100 * 1024; // 100KB

// ─── Read clipboard ─────────────────────────────────────────────────────────

export function readClipboard(): ClipboardResult {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Format Text'],
    { encoding: 'utf8', timeout: CLIPBOARD_TIMEOUT_MS }
  );

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      return { ok: false, error: 'Clipboard read timed out (3s)' };
    }
    return { ok: false, error: `spawn error: ${result.error.message}` };
  }

  if (result.status !== 0) {
    return { ok: false, error: `PowerShell exited ${result.status}: ${result.stderr?.trim() || 'unknown error'}` };
  }

  let text = result.stdout;

  // Truncate if over 100KB
  if (Buffer.byteLength(text, 'utf8') > MAX_CLIPBOARD_BYTES) {
    // Truncate at the byte level by encoding/decoding
    const buf = Buffer.from(text, 'utf8').subarray(0, MAX_CLIPBOARD_BYTES);
    text = buf.toString('utf8');
    return { ok: true, text, error: 'Clipboard content truncated to 100KB' };
  }

  return { ok: true, text };
}

// ─── Write clipboard ────────────────────────────────────────────────────────

export function writeClipboard(text: string): ClipboardResult {
  if (Buffer.byteLength(text, 'utf8') > MAX_CLIPBOARD_BYTES) {
    return { ok: false, error: 'Text exceeds 100KB limit' };
  }

  // Pass text via stdin to avoid shell injection.
  // PowerShell reads stdin and pipes to Set-Clipboard.
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', '$input | Set-Clipboard'],
    { encoding: 'utf8', timeout: CLIPBOARD_TIMEOUT_MS, input: text }
  );

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
      return { ok: false, error: 'Clipboard write timed out (3s)' };
    }
    return { ok: false, error: `spawn error: ${result.error.message}` };
  }

  if (result.status !== 0) {
    return { ok: false, error: `PowerShell exited ${result.status}: ${result.stderr?.trim() || 'unknown error'}` };
  }

  return { ok: true };
}

// ─── Clear clipboard ────────────────────────────────────────────────────────

export function clearClipboard(): ClipboardResult {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value $null'],
    { encoding: 'utf8', timeout: CLIPBOARD_TIMEOUT_MS }
  );

  if (result.error) {
    return { ok: false, error: `spawn error: ${result.error.message}` };
  }

  if (result.status !== 0) {
    return { ok: false, error: `PowerShell exited ${result.status}: ${result.stderr?.trim() || 'unknown error'}` };
  }

  return { ok: true };
}

// ─── Paste from clipboard (write + Ctrl+V) ──────────────────────────────────
// Dynamically imports simulateKeyCombo to avoid hard dependency on inputSimulator
// (which may not exist in all branches).

export async function pasteFromClipboard(
  text: string,
  clearAfterPaste = false
): Promise<ClipboardResult> {
  // Step 1: Write text to clipboard
  const writeResult = writeClipboard(text);
  if (!writeResult.ok) {
    return writeResult;
  }

  // Step 2: Send Ctrl+V via input simulator
  let simulateKeyCombo: (keys: string[]) => { ok: boolean; error?: string };
  try {
    // @ts-expect-error — inputSimulator is an optional runtime dependency (Agent Runtime Phase 5)
    const mod = await import('./inputSimulator.js');
    simulateKeyCombo = mod.simulateKeyCombo;
  } catch {
    return { ok: false, error: 'Input simulator not available. OS input simulation feature required for paste.' };
  }

  const comboResult = simulateKeyCombo(['ctrl', 'v']);
  if (!comboResult.ok) {
    return { ok: false, error: `Ctrl+V failed: ${comboResult.error}` };
  }

  // Step 3: Optionally clear clipboard after paste
  if (clearAfterPaste) {
    clearClipboard(); // Best-effort, don't fail the paste if clear fails
  }

  return { ok: true };
}
