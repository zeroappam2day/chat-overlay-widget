import { execSync } from 'node:child_process';

const MAX_OUTPUT_BYTES = 512_000; // 500KB cap

/**
 * Execute `git diff HEAD` in the given directory and return the raw unified diff.
 * Combines staged + unstaged changes. Returns empty string if not a git repo
 * or no changes found. Output capped at 500KB.
 */
export function execGitDiff(cwd: string): { raw: string; error?: string } {
  try {
    // Combine staged and unstaged diffs
    const raw = execSync('git diff HEAD', {
      cwd,
      encoding: 'utf-8',
      maxBuffer: MAX_OUTPUT_BYTES,
      timeout: 10_000,
      windowsHide: true,
    });
    return { raw: raw || '' };
  } catch (err: unknown) {
    // If git diff HEAD fails (no HEAD commit yet), try just git diff
    try {
      const raw = execSync('git diff', {
        cwd,
        encoding: 'utf-8',
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: 10_000,
        windowsHide: true,
      });
      return { raw: raw || '' };
    } catch (innerErr: unknown) {
      const message = innerErr instanceof Error ? innerErr.message : String(innerErr);
      return { raw: '', error: message };
    }
  }
}
