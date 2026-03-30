import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const DISCOVERY_FILE_DIR = path.join(
  process.env['APPDATA'] ?? os.homedir(),
  'chat-overlay-widget'
);

/**
 * Remove any stale discovery file left behind by a force-killed sidecar.
 * Called at startup before writing a fresh one.
 */
export function cleanStaleDiscoveryFile(): void {
  const filePath = path.join(DISCOVERY_FILE_DIR, 'api.port');
  try {
    fs.unlinkSync(filePath);
    console.log(`[sidecar] cleaned stale discovery file: ${filePath}`);
  } catch {
    // No stale file — expected on first run
  }
}

/**
 * Atomically write the discovery file containing port and auth token.
 * Writes to a .tmp file first, then renames for atomic replace.
 * Returns the file path for use in cleanup.
 */
export function writeDiscoveryFile(port: number, token: string): string {
  const filePath = path.join(DISCOVERY_FILE_DIR, 'api.port');
  const tmpPath = filePath + '.tmp';
  fs.mkdirSync(DISCOVERY_FILE_DIR, { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify({ port, token }), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  console.log('[sidecar] discovery file written: ' + filePath);
  return filePath;
}

/**
 * Synchronously delete the discovery file.
 * Safe to use in process.on('exit') handlers.
 */
export function deleteDiscoveryFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* already gone — that's fine */
  }
  console.log('[sidecar] discovery file deleted');
}
