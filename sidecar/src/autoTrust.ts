/**
 * Auto-trust dialog detection and response.
 * Adapted from parallel-code/src/store/taskStatus.ts
 *
 * TRUST_PATTERNS (detect dialog):
 *   /\btrust\b.*\?/i
 *   /\ballow\b.*\?/i
 *   /trust.*folder/i
 *
 * EXCLUSION_KEYWORDS (safety block — NEVER auto-accept if these appear):
 *   /\b(delet|remov|credential|secret|password|key|token|destro|format|drop)\b/i
 *
 * Three-phase timing:
 *   Phase 1 — Detection:  50ms delay before sending Enter (let TUI render)
 *   Phase 2 — Settling:   1000ms cooldown (block auto-send while agent initializes)
 *   Phase 3 — Cooldown:   3000ms lockout (prevent re-triggering same dialog)
 *
 * ANSI stripping regex (applied before pattern matching):
 *   /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g
 */

export interface AutoTrustEvent {
  action: 'accepted' | 'blocked';
  pattern: string;
  timestamp: string;
}

const TRUST_PATTERNS: RegExp[] = [
  /\btrust\b.*\?/i,
  /\ballow\b.*\?/i,
  /trust.*folder/i,
];

const EXCLUSION_KEYWORDS = /\b(delet|remov|credential|secret|password|key|token|destro|format|drop)\b/i;

const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g;

const DETECTION_DELAY_MS = 50;
const SETTLE_MS = 1000;
const COOLDOWN_MS = 3000;
const TAIL_BUFFER_SIZE = 4096; // 4KB

export class AutoTrustDetector {
  private _enabled: boolean;
  private onAccept: () => void;
  private onEvent?: (event: AutoTrustEvent) => void;

  private tailBuffer: string = '';
  private detectionTimer: ReturnType<typeof setTimeout> | null = null;
  private settleUntil: number = 0;
  private cooldownUntil: number = 0;

  constructor(opts: {
    onAccept: () => void;
    onEvent?: (event: AutoTrustEvent) => void;
    enabled?: boolean;
  }) {
    this.onAccept = opts.onAccept;
    this.onEvent = opts.onEvent;
    this._enabled = opts.enabled ?? false;
  }

  /**
   * Feed raw PTY output chunks. Strips ANSI, appends to tail buffer (4KB cap),
   * runs pattern matching with three-phase timing.
   */
  feed(rawChunk: string): void {
    if (!this._enabled) return;

    // Strip ANSI escape sequences
    const stripped = rawChunk.replace(ANSI_REGEX, '');

    // Append to tail buffer; evict oldest data if over 4KB
    this.tailBuffer += stripped;
    if (this.tailBuffer.length > TAIL_BUFFER_SIZE) {
      this.tailBuffer = this.tailBuffer.slice(this.tailBuffer.length - TAIL_BUFFER_SIZE);
    }

    // Skip if currently settling (agent is initializing post-accept)
    if (Date.now() < this.settleUntil) return;

    // Skip if currently in cooldown (prevent re-triggering same dialog)
    if (Date.now() < this.cooldownUntil) return;

    // Test against trust patterns
    let matchedPattern: RegExp | null = null;
    for (const pattern of TRUST_PATTERNS) {
      if (pattern.test(this.tailBuffer)) {
        matchedPattern = pattern;
        break;
      }
    }

    if (matchedPattern === null) return;

    // Safety check: exclusion keywords block auto-accept
    if (EXCLUSION_KEYWORDS.test(this.tailBuffer)) {
      this.onEvent?.({
        action: 'blocked',
        pattern: matchedPattern.source,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Clear any existing detection timer and schedule a new one
    if (this.detectionTimer !== null) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }

    const captured = matchedPattern;
    this.detectionTimer = setTimeout(() => {
      this.detectionTimer = null;

      // Accept: send Enter, fire event, set timing phases, clear buffer
      this.onAccept();
      this.onEvent?.({
        action: 'accepted',
        pattern: captured.source,
        timestamp: new Date().toISOString(),
      });

      this.settleUntil = Date.now() + SETTLE_MS;
      this.cooldownUntil = Date.now() + COOLDOWN_MS;
      this.tailBuffer = ''; // clear to prevent re-matching same dialog
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
    this.tailBuffer = '';
    this.settleUntil = 0;
    this.cooldownUntil = 0;
  }
}
