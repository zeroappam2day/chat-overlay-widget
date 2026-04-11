/**
 * focusTracker.ts — Focus-aware overlay polling (Phase 40, D-02, D-05 through D-16).
 *
 * Polls GetForegroundWindow at 250ms intervals. Determines if the target app
 * (or an affiliated window — child dialog, owner chain) has focus.
 * Emits onShow/onHide/onTargetLost callbacks with debounce/dedup.
 */

import {
  getForegroundWindow,
  getWindowThreadProcessId,
  isWindow,
  isIconic,
  getOwnerWindow,
  getProcessName,
} from './win32Bridge.js';

export interface FocusTrackerOptions {
  onShow: () => void;
  onHide: () => void;
  onTargetLost: () => void;
  pollIntervalMs?: number;
  hideDebounceMs?: number;
}

export class FocusTracker {
  private readonly onShow: () => void;
  private readonly onHide: () => void;
  private readonly onTargetLost: () => void;
  private readonly pollIntervalMs: number;
  private readonly hideDebounceMs: number;

  private isTracking = false;
  private targetHwnd: number | null = null;
  private targetPid: number | null = null;
  private lastEmitted: 'show' | 'hide' | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private selfHwnds = new Set<number>();

  constructor(options: FocusTrackerOptions) {
    this.onShow = options.onShow;
    this.onHide = options.onHide;
    this.onTargetLost = options.onTargetLost;
    this.pollIntervalMs = options.pollIntervalMs ?? 250;
    this.hideDebounceMs = options.hideDebounceMs ?? 150;
  }

  /**
   * Add a self-owned hwnd (main window, overlay) to prevent hide when these are focused.
   */
  addSelfHwnd(hwnd: number): void {
    this.selfHwnds.add(hwnd);
  }

  /** Begin polling for focus changes on the given target hwnd. */
  start(targetHwnd: number): void {
    this.stop();
    this.targetHwnd = targetHwnd;
    this.targetPid = null;
    this.lastEmitted = null;
    this.isTracking = true;

    // Resolve target PID once, then start polling
    getWindowThreadProcessId(targetHwnd)
      .then(({ pid }) => {
        this.targetPid = pid;
        if (this.isTracking) {
          this.schedulePoll();
        }
      })
      .catch(() => {
        // If we can't resolve PID, start polling anyway without PID affiliation
        if (this.isTracking) {
          this.schedulePoll();
        }
      });
  }

  /** Stop polling and clear timers. */
  stop(): void {
    this.isTracking = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.targetHwnd = null;
    this.targetPid = null;
    this.lastEmitted = null;
  }

  /** Alias for stop() — full cleanup. */
  destroy(): void {
    this.stop();
  }

  private schedulePoll(): void {
    if (!this.isTracking) return;
    this.pollTimer = setTimeout(() => {
      this.doPoll().catch(err => {
        console.error('[focusTracker] poll error:', err?.message ?? err);
      });
    }, this.pollIntervalMs);
  }

  private async doPoll(): Promise<void> {
    if (!this.isTracking || this.targetHwnd === null) return;

    const targetHwnd = this.targetHwnd;

    try {
      // 1. Stale check — if target window no longer exists, emit target-lost and stop.
      const valid = await isWindow(targetHwnd);
      if (!valid) {
        this.isTracking = false;
        this.clearTimers();
        this.onTargetLost();
        return;
      }

      // 2. Get foreground window
      const fgHwnd = await getForegroundWindow();

      // 3. Self-check — overlay or main window focused, treat as show
      if (this.selfHwnds.has(fgHwnd)) {
        this.emitShow();
        this.schedulePoll();
        return;
      }

      // 4. Direct match
      if (fgHwnd === targetHwnd) {
        this.emitShow();
        this.schedulePoll();
        return;
      }

      // 5. Minimized check — immediate hide, no debounce
      const minimized = await isIconic(targetHwnd);
      if (minimized) {
        this.emitHideImmediate();
        this.schedulePoll();
        return;
      }

      // 6. Owner chain — walk up to 5 levels
      let cursor = fgHwnd;
      let affiliated = false;
      for (let i = 0; i < 5; i++) {
        const owner = await getOwnerWindow(cursor);
        if (owner === 0) break;
        if (owner === targetHwnd) {
          affiliated = true;
          break;
        }
        cursor = owner;
      }

      if (affiliated) {
        this.emitShow();
        this.schedulePoll();
        return;
      }

      // 7. PID fallback — same process = affiliated, unless ApplicationFrameHost
      if (this.targetPid !== null) {
        const { pid: fgPid } = await getWindowThreadProcessId(fgHwnd);
        if (fgPid === this.targetPid) {
          // Check process name — exclude ApplicationFrameHost
          const procName = await getProcessName(fgPid);
          if (procName !== 'ApplicationFrameHost') {
            this.emitShow();
            this.schedulePoll();
            return;
          }
        }
      }

      // 8. Not affiliated — debounced hide
      this.emitHideDebounced();
      this.schedulePoll();
    } catch (err) {
      // On error, schedule next poll anyway
      this.schedulePoll();
    }
  }

  private emitShow(): void {
    // Cancel any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.lastEmitted !== 'show') {
      this.lastEmitted = 'show';
      this.onShow();
    }
  }

  private emitHideImmediate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.lastEmitted !== 'hide') {
      this.lastEmitted = 'hide';
      this.onHide();
    }
  }

  private emitHideDebounced(): void {
    if (this.debounceTimer) return; // already pending

    if (this.lastEmitted === 'hide') return; // already hidden, no need to debounce again

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.isTracking && this.lastEmitted !== 'hide') {
        this.lastEmitted = 'hide';
        this.onHide();
      }
    }, this.hideDebounceMs);
  }

  private clearTimers(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
