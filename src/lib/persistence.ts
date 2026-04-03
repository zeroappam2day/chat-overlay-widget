import {
  writeTextFile,
  readTextFile,
  renameFile,
  copyFile,
  createDir,
  exists,
} from '@tauri-apps/api/fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { LayoutNode } from '../store/paneStore';
import type { Bookmark } from '../store/bookmarkStore';
import type { PromptEntry } from '../store/promptHistoryStore';
import type { FeatureFlags } from '../store/featureFlagStore';

const STATE_FILE = 'chat-overlay-state.json';
const BACKUP_FILE = 'chat-overlay-state.json.bak';
const TEMP_FILE = 'chat-overlay-state.json.tmp';
const AUTOSAVE_DEBOUNCE = 30_000;

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

export interface PersistedState {
  version: 1;
  layout: LayoutNode;
  activePaneId: string;
  bookmarks: Bookmark[];
  notes: string;
  promptHistory: PromptEntry[];
  featureFlags: FeatureFlags;
  windowState: WindowState | null;
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureDir(): Promise<string> {
  const dir = await appDataDir();
  const dirExists = await exists(dir);
  if (!dirExists) {
    await createDir(dir, { recursive: true });
  }
  return dir;
}

async function filePath(name: string): Promise<string> {
  const dir = await ensureDir();
  return await join(dir, name);
}

export async function saveState(state: PersistedState): Promise<void> {
  const json = JSON.stringify(state, null, 2);
  // Validate round-trip
  JSON.parse(json);

  const tempPath = await filePath(TEMP_FILE);
  const statePath = await filePath(STATE_FILE);
  const backupPath = await filePath(BACKUP_FILE);

  // 1. Write to temp
  await writeTextFile(tempPath, json);

  // 2. Backup existing state file (if it exists)
  try {
    const stateExists = await exists(statePath);
    if (stateExists) {
      await copyFile(statePath, backupPath);
    }
  } catch {
    // Backup failure is non-fatal
  }

  // 3. Atomic rename: temp -> state
  await renameFile(tempPath, statePath);
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    const statePath = await filePath(STATE_FILE);
    const stateExists = await exists(statePath);
    if (stateExists) {
      const raw = await readTextFile(statePath);
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // Primary corrupted — try backup
  }

  try {
    const backupPath = await filePath(BACKUP_FILE);
    const backupExists = await exists(backupPath);
    if (backupExists) {
      const raw = await readTextFile(backupPath);
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // Backup also corrupted
  }

  return null;
}

export function debouncedSave(state: PersistedState): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    saveState(state).catch(() => {});
  }, AUTOSAVE_DEBOUNCE);
}

export function flushSave(state: PersistedState): void {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  saveState(state).catch(() => {});
}
