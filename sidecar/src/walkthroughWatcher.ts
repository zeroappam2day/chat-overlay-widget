/**
 * Walkthrough Watcher — monitors terminal output and auto-advances walkthrough
 * when the current step's advanceWhen pattern matches.
 *
 * Reuses the proven AutoTrustDetector pattern from autoTrust.ts:
 *   - Feed raw PTY output chunks
 *   - Strip ANSI escape sequences
 *   - Append to tail buffer (4KB cap)
 *   - Match against current step's regex pattern
 *   - Three-phase timing: detect delay → settle → cooldown
 *
 * Agent Runtime Phase 2 — Conditional Walkthrough Advancement
 */

export interface WalkthroughWatcherEvent {
  action: 'advanced' | 'pattern-set' | 'pattern-cleared';
  pattern: string | null;
  timestamp: string;
}

const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g;

const DETECTION_DELAY_MS = 50;
const SETTLE_MS = 1000;
const COOLDOWN_MS = 3000;
const TAIL_BUFFER_SIZE = 4096; // 4KB

export class WalkthroughWatcher {
  private _enabled: boolean;
  onAdvance: () => void;
  private onEvent?: (event: WalkthroughWatcherEvent) => void;

  private tailBuffer: string = '';
  private currentPattern: RegExp | null = null;
  private detectionTimer: ReturnType<typeof setTimeout> | null = null;
  private settleUntil: number = 0;
  private cooldownUntil: number = 0;

  constructor(opts: {
    onAdvance: () => void;
    onEvent?: (event: WalkthroughWatcherEvent) => void;
    enabled?: boolean;
  }) {
    this.onAdvance = opts.onAdvance;
    this.onEvent = opts.onEvent;
    this._enabled = opts.enabled ?? false;
  }

  /**
   * Set the regex pattern for the current walkthrough step.
   * Called when walkthrough starts, advances, or stops.
   */
  setPattern(pattern: RegExp | null): void {
    this.currentPattern = pattern;
    // Clear tail buffer and timers when pattern changes to avoid stale matches
    this.tailBuffer = '';
    if (this.detectionTimer !== null) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }
    this.settleUntil = 0;
    this.cooldownUntil = 0;

    this.onEvent?.({
      action: pattern ? 'pattern-set' : 'pattern-cleared',
      pattern: pattern?.source ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Feed raw PTY output chunks. Strips ANSI, appends to tail buffer (4KB cap),
   * runs pattern matching with three-phase timing.
   */
  feed(rawChunk: string): void {
    if (!this._enabled) return;
    if (!this.currentPattern) return;

    // Strip ANSI escape sequences
    const stripped = rawChunk.replace(ANSI_REGEX, '');

    // Append to tail buffer; evict oldest data if over 4KB
    this.tailBuffer += stripped;
    if (this.tailBuffer.length > TAIL_BUFFER_SIZE) {
      this.tailBuffer = this.tailBuffer.slice(this.tailBuffer.length - TAIL_BUFFER_SIZE);
    }

    // Skip if currently settling (walkthrough just advanced)
    if (Date.now() < this.settleUntil) return;

    // Skip if currently in cooldown (prevent double-advance)
    if (Date.now() < this.cooldownUntil) return;

    // Test against current pattern
    if (!this.currentPattern.test(this.tailBuffer)) return;

    // Clear any existing detection timer and schedule a new one
    if (this.detectionTimer !== null) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }

    this.detectionTimer = setTimeout(() => {
      this.detectionTimer = null;

      // Fire advance callback
      this.onAdvance();
      this.onEvent?.({
        action: 'advanced',
        pattern: this.currentPattern?.source ?? null,
        timestamp: new Date().toISOString(),
      });

      this.settleUntil = Date.now() + SETTLE_MS;
      this.cooldownUntil = Date.now() + COOLDOWN_MS;
      this.tailBuffer = ''; // clear to prevent re-matching
    }, DETECTION_DELAY_MS);
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) {
      this.destroy();
    }
  }

  /** Clears all timers and resets state. */
  destroy(): void {
    if (this.detectionTimer !== null) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }
    this.currentPattern = null;
    this.tailBuffer = '';
    this.settleUntil = 0;
    this.cooldownUntil = 0;
  }
}
