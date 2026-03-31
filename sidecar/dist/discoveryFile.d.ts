export declare const DISCOVERY_FILE_DIR: string;
/**
 * Remove any stale discovery file left behind by a force-killed sidecar.
 * Called at startup before writing a fresh one.
 */
export declare function cleanStaleDiscoveryFile(): void;
/**
 * Atomically write the discovery file containing port and auth token.
 * Writes to a .tmp file first, then renames for atomic replace.
 * Returns the file path for use in cleanup.
 */
export declare function writeDiscoveryFile(port: number, token: string): string;
/**
 * Synchronously delete the discovery file.
 * Safe to use in process.on('exit') handlers.
 */
export declare function deleteDiscoveryFile(filePath: string): void;
