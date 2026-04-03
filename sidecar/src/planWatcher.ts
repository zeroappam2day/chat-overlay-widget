/**
 * PlanWatcher — watches .claude/plans/ and docs/plans/ for engineering plan files.
 * Finds the newest .md file by mtime and pushes its content via onPlanUpdate callback.
 *
 * Phase 3 of the Parallel Features Plan.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PlanContent {
  fileName: string;
  content: string;
  mtime: number;
}

const PLAN_DIRS = ['.claude/plans', 'docs/plans'];
const DIR_POLL_INTERVAL = 3000; // ms — poll for directory creation
const CHANGE_DEBOUNCE = 200;    // ms — debounce file change events

export class PlanWatcher {
  private onPlanUpdate: (plan: PlanContent | null) => void;
  private _enabled: boolean;
  private cwd: string | null = null;

  // Active fs.FSWatcher instances per directory
  private dirWatchers = new Map<string, fs.FSWatcher>();
  // Debounce timer for file change events
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Poll timer for directory discovery
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: {
    onPlanUpdate: (plan: PlanContent | null) => void;
    enabled?: boolean;
  }) {
    this.onPlanUpdate = opts.onPlanUpdate;
    this._enabled = opts.enabled ?? true;
  }

  /** Start watching from the given cwd. No-op if disabled. */
  start(cwd: string): void {
    if (!this._enabled) return;
    this.cwd = cwd;

    for (const dir of PLAN_DIRS) {
      const dirPath = path.join(cwd, dir);
      if (this.dirExists(dirPath)) {
        this.watchDir(dirPath);
      }
    }

    // Start poll timer to detect directories that don't exist yet
    this.pollTimer = setInterval(() => {
      if (!this.cwd) return;
      for (const dir of PLAN_DIRS) {
        const dirPath = path.join(this.cwd, dir);
        if (!this.dirWatchers.has(dirPath) && this.dirExists(dirPath)) {
          this.watchDir(dirPath);
        }
      }
    }, DIR_POLL_INTERVAL);

    // Initial scan
    this.scanAndNotify();
  }

  /** Set up fs.watch on a directory. */
  private watchDir(dirPath: string): void {
    if (this.dirWatchers.has(dirPath)) return;
    try {
      const watcher = fs.watch(dirPath, (_eventType, _filename) => {
        // Debounce — multiple events can fire for one save
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.scanAndNotify();
        }, CHANGE_DEBOUNCE);
      });

      watcher.on('error', (err) => {
        console.error(`[planWatcher] watcher error on ${dirPath}:`, err);
        // Remove the broken watcher so poll timer can re-add it later
        try { watcher.close(); } catch { /* ignore */ }
        this.dirWatchers.delete(dirPath);
      });

      this.dirWatchers.set(dirPath, watcher);
      console.log(`[planWatcher] watching: ${dirPath}`);
    } catch (err) {
      console.error(`[planWatcher] failed to watch ${dirPath}:`, err);
    }
  }

  /** Scan all watched directories + any existing unwatched plan dirs for .md files.
   *  Find the newest by mtime and call onPlanUpdate. */
  scanAndNotify(): void {
    const plan = this.scan(this.cwd ?? process.cwd());
    this.onPlanUpdate(plan);
  }

  /** One-shot scan without starting watchers (used for plan-read messages). */
  readNow(cwd: string): PlanContent | null {
    return this.scan(cwd);
  }

  private scan(cwd: string): PlanContent | null {
    let newest: { filePath: string; mtime: number } | null = null;

    for (const dir of PLAN_DIRS) {
      const dirPath = path.join(cwd, dir);
      if (!this.dirExists(dirPath)) continue;

      try {
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
          if (!entry.endsWith('.md')) continue;
          const filePath = path.join(dirPath, entry);
          try {
            const stat = fs.statSync(filePath);
            if (!newest || stat.mtimeMs > newest.mtime) {
              newest = { filePath, mtime: stat.mtimeMs };
            }
          } catch (err) {
            console.error(`[planWatcher] stat failed for ${filePath}:`, err);
          }
        }
      } catch (err) {
        console.error(`[planWatcher] readdir failed for ${dirPath}:`, err);
      }
    }

    if (!newest) return null;

    try {
      const content = fs.readFileSync(newest.filePath, 'utf-8');
      const fileName = path.basename(newest.filePath);
      return { fileName, content, mtime: newest.mtime };
    } catch (err) {
      console.error(`[planWatcher] readFile failed for ${newest.filePath}:`, err);
      return null;
    }
  }

  /** Stop all watchers and timers. */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const [dirPath, watcher] of this.dirWatchers) {
      try { watcher.close(); } catch { /* ignore */ }
      console.log(`[planWatcher] stopped watching: ${dirPath}`);
    }
    this.dirWatchers.clear();
  }

  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) {
      this.stop();
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  private dirExists(dirPath: string): boolean {
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  }
}
