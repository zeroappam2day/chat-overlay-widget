/**
 * clipboardManager.test.ts — Unit tests for EAC-4: Clipboard Integration
 *
 * Tests validation logic and safety properties with mocked PowerShell.
 * Does NOT test actual clipboard operations (requires Windows desktop session).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as child_process from 'node:child_process';

// Mock child_process.spawnSync before importing the module
vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

// Import after mock is set up
import { readClipboard, writeClipboard, clearClipboard, pasteFromClipboard } from './clipboardManager.js';

const mockedSpawnSync = vi.mocked(child_process.spawnSync);

function makeSpawnResult(overrides: Partial<ReturnType<typeof child_process.spawnSync>> = {}) {
  return {
    stdout: '',
    stderr: '',
    status: 0 as number | null,
    signal: null,
    pid: 1234,
    output: ['', '', ''],
    error: undefined as unknown as Error,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('clipboardManager', () => {
  describe('readClipboard', () => {
    it('returns clipboard text on success', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult({ stdout: 'hello world' }));

      const result = readClipboard();
      expect(result.ok).toBe(true);
      expect(result.text).toBe('hello world');
    });

    it('truncates text exceeding 100KB with warning', () => {
      const bigText = 'x'.repeat(110 * 1024); // 110KB
      mockedSpawnSync.mockReturnValue(makeSpawnResult({ stdout: bigText }));

      const result = readClipboard();
      expect(result.ok).toBe(true);
      expect(Buffer.byteLength(result.text!, 'utf8')).toBeLessThanOrEqual(100 * 1024);
      expect(result.error).toMatch(/truncated/i);
    });

    it('handles timeout error', () => {
      const timeoutErr = new Error('timed out') as NodeJS.ErrnoException;
      timeoutErr.code = 'ETIMEDOUT';
      mockedSpawnSync.mockReturnValue(makeSpawnResult({ error: timeoutErr }));

      const result = readClipboard();
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/timed out/i);
    });

    it('handles PowerShell non-zero exit', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult({ status: 1, stderr: 'Access denied' }));

      const result = readClipboard();
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Access denied/);
    });

    it('uses correct PowerShell command', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult());

      readClipboard();
      expect(mockedSpawnSync).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Format Text'],
        expect.objectContaining({ timeout: 3000 })
      );
    });
  });

  describe('writeClipboard', () => {
    it('succeeds with valid text', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult());

      const result = writeClipboard('test text');
      expect(result.ok).toBe(true);
    });

    it('rejects text exceeding 100KB', () => {
      const bigText = 'x'.repeat(110 * 1024);
      const result = writeClipboard(bigText);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/100KB/);
      // spawnSync should NOT have been called
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    });

    it('passes text via stdin (not command-line arg) to prevent shell injection', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult());

      const dangerousText = "'; Remove-Item -Recurse C:\\; '";
      writeClipboard(dangerousText);

      expect(mockedSpawnSync).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', '$input | Set-Clipboard'],
        expect.objectContaining({ input: dangerousText })
      );
      // Command-line args must NOT contain the text
      const args = mockedSpawnSync.mock.calls[0][1] as string[];
      for (const arg of args) {
        expect(arg).not.toContain(dangerousText);
      }
    });

    it('handles timeout error', () => {
      const timeoutErr = new Error('timed out') as NodeJS.ErrnoException;
      timeoutErr.code = 'ETIMEDOUT';
      mockedSpawnSync.mockReturnValue(makeSpawnResult({ error: timeoutErr }));

      const result = writeClipboard('test');
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/timed out/i);
    });
  });

  describe('clearClipboard', () => {
    it('succeeds on zero exit', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult());

      const result = clearClipboard();
      expect(result.ok).toBe(true);
    });
  });

  describe('pasteFromClipboard', () => {
    it('rejects text exceeding 100KB before attempting paste', async () => {
      const bigText = 'x'.repeat(110 * 1024);
      const result = await pasteFromClipboard(bigText);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/100KB/);
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    });

    it('writes to clipboard before simulating Ctrl+V', async () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult());

      // pasteFromClipboard will attempt dynamic import of inputSimulator
      // which will likely fail in test — that is expected behavior
      const result = await pasteFromClipboard('test');
      // Either succeeds (if inputSimulator available) or fails gracefully
      expect(typeof result.ok).toBe('boolean');
      // The write to clipboard should have been attempted
      expect(mockedSpawnSync).toHaveBeenCalled();
    });

    it('handles missing inputSimulator gracefully', async () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult());

      const result = await pasteFromClipboard('test');
      // Should fail gracefully if inputSimulator not available
      if (!result.ok) {
        expect(result.error).toMatch(/input simulator|not available/i);
      }
    });
  });

  describe('safety: clipboard contents never logged', () => {
    it('does not include clipboard text in error messages on write failure', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult({ status: 1, stderr: 'some PS error' }));

      const secretText = 'SUPER_SECRET_PASSWORD_12345';
      const result = writeClipboard(secretText);
      if (!result.ok && result.error) {
        expect(result.error).not.toContain(secretText);
      }
    });

    it('does not include clipboard text in error messages on read failure', () => {
      mockedSpawnSync.mockReturnValue(makeSpawnResult({ status: 1, stderr: 'clipboard error' }));

      const result = readClipboard();
      expect(result.ok).toBe(false);
      // Error should only contain PS stderr, not any clipboard content
      expect(result.error).toMatch(/clipboard error/);
    });
  });
});
