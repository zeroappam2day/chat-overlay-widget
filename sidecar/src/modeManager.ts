import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/** Mode IDs supported by the system */
export type ModeId = 'walkMeThrough' | 'workWithMe';

/** Definition of a mode — which flags it activates */
export interface ModeDefinition {
  id: ModeId;
  label: string;
  description: string;
  flags: Record<string, boolean>;
}

/** Runtime state of an active mode */
export interface ActiveModeState {
  modeId: ModeId;
  activatedAt: number;
  flagSnapshot: Record<string, boolean>;
}

/** Options passed to ModeManager constructor */
interface ModeManagerOptions {
  sidecarFlags: Record<string, boolean>;
  onFlagsChanged: (flags: Record<string, boolean>) => void;
  onModeChanged: (state: ActiveModeState | null) => void;
}

export class ModeManager {
  private activeState: ActiveModeState | null = null;
  private readonly markerFilePath: string;
  private readonly modes: Map<string, ModeDefinition>;
  private readonly sidecarFlags: Record<string, boolean>;
  private readonly onFlagsChanged: (flags: Record<string, boolean>) => void;
  private readonly onModeChanged: (state: ActiveModeState | null) => void;

  /** Set during construction if crash recovery occurred — consumed once by getCrashRecoveryInfo() */
  private crashRecoveryInfo: { previousMode: string; flagsRestored: boolean } | null = null;

  constructor(opts: ModeManagerOptions) {
    this.sidecarFlags = opts.sidecarFlags;
    this.onFlagsChanged = opts.onFlagsChanged;
    this.onModeChanged = opts.onModeChanged;

    const appData = process.env.APPDATA || os.homedir();
    this.markerFilePath = path.join(appData, 'chat-overlay-widget', 'active-mode.json');

    // Register mode definitions
    this.modes = new Map<string, ModeDefinition>();

    this.modes.set('walkMeThrough', {
      id: 'walkMeThrough',
      label: 'Walk Me Through',
      description: 'OBSERVATION-ONLY — LLM sees screen, guides user, researches. Does NOT act.',
      flags: {
        annotationOverlay: true,
        guidedWalkthrough: true,
        conditionalAdvance: true,
        screenshotVerification: true,
        webFetchTool: true,
        externalWindowCapture: true,
      },
    });

    this.modes.set('workWithMe', {
      id: 'workWithMe',
      label: 'Work With Me',
      description: 'ACTION-CAPABLE — LLM interacts alongside user with all available tools',
      flags: {
        annotationOverlay: true,
        guidedWalkthrough: true,
        conditionalAdvance: true,
        screenshotVerification: true,
        webFetchTool: true,
        externalWindowCapture: true,
        terminalWriteMcp: true,
        batchConsent: true,
        windowFocusManager: true,
        clipboardAccess: true,
        agentTaskOrchestrator: true,
        enhancedAccessibility: true,
        workflowRecording: true,
        skillDiscovery: true,
      },
    });

    // Check for crash recovery on construction
    this.checkCrashRecovery();
  }

  /**
   * Activate a mode — snapshots current flags, writes crash marker, applies mode flags.
   * Returns { success: false } if another mode is already active (mutual exclusion).
   */
  activate(modeId: string): { success: boolean; error?: string } {
    if (this.activeState !== null) {
      return { success: false, error: `Mode already active: ${this.activeState.modeId}` };
    }

    const mode = this.modes.get(modeId);
    if (!mode) {
      return { success: false, error: `Unknown mode: ${modeId}` };
    }

    // 1. Save snapshot of ALL current flags
    const flagSnapshot = { ...this.sidecarFlags };

    // 2. Write crash recovery marker file
    const activatedAt = Date.now();
    const markerData = { modeId, activatedAt, flagSnapshot };
    try {
      const dir = path.dirname(this.markerFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.markerFilePath, JSON.stringify(markerData, null, 2), 'utf-8');
    } catch (err) {
      console.error('[modeManager] failed to write crash marker:', err);
      // Continue anyway — crash recovery is best-effort
    }

    // 3. Apply mode flags via Object.assign (bulk-activate)
    Object.assign(this.sidecarFlags, mode.flags);

    // 4. Set active state
    this.activeState = { modeId: mode.id, activatedAt, flagSnapshot };

    // 5. Broadcast
    this.onFlagsChanged(this.sidecarFlags);
    this.onModeChanged(this.activeState);

    console.log(`[modeManager] activated mode: ${modeId} (${Object.keys(mode.flags).length} flags set)`);
    return { success: true };
  }

  /**
   * Deactivate the current mode — restores flag snapshot, deletes crash marker.
   */
  deactivate(): { success: boolean; error?: string } {
    if (this.activeState === null) {
      return { success: false, error: 'No active mode' };
    }

    const previousMode = this.activeState.modeId;

    // 1. Restore flags from snapshot
    Object.assign(this.sidecarFlags, this.activeState.flagSnapshot);

    // 2. Delete marker file
    try {
      if (fs.existsSync(this.markerFilePath)) {
        fs.unlinkSync(this.markerFilePath);
      }
    } catch (err) {
      console.error('[modeManager] failed to delete crash marker:', err);
    }

    // 3. Clear active state
    this.activeState = null;

    // 4. Broadcast
    this.onFlagsChanged(this.sidecarFlags);
    this.onModeChanged(null);

    console.log(`[modeManager] deactivated mode: ${previousMode}`);
    return { success: true };
  }

  /**
   * Check for crash recovery on startup — if marker file exists, restore flags.
   */
  private checkCrashRecovery(): void {
    try {
      if (!fs.existsSync(this.markerFilePath)) {
        return; // No marker — clean shutdown last time
      }

      const raw = fs.readFileSync(this.markerFilePath, 'utf-8');
      const marker = JSON.parse(raw) as { modeId: string; activatedAt: number; flagSnapshot: Record<string, boolean> };

      // Restore flag snapshot (pre-mode values)
      Object.assign(this.sidecarFlags, marker.flagSnapshot);

      // Delete marker file
      fs.unlinkSync(this.markerFilePath);

      // Broadcast restored flags
      this.onFlagsChanged(this.sidecarFlags);

      // Store crash recovery info for first connecting client
      this.crashRecoveryInfo = { previousMode: marker.modeId, flagsRestored: true };

      console.log(`[modeManager] crash recovery: restored flags from previous ${marker.modeId} mode session`);
    } catch (err) {
      console.error('[modeManager] crash recovery failed:', err);
      // Best-effort: delete marker even if parse failed
      try { fs.unlinkSync(this.markerFilePath); } catch { /* ignore */ }
    }
  }

  /**
   * Get current mode status for WebSocket broadcast.
   */
  getStatus(): { active: boolean; modeId?: string; activatedAt?: number } {
    if (!this.activeState) {
      return { active: false };
    }
    return {
      active: true,
      modeId: this.activeState.modeId,
      activatedAt: this.activeState.activatedAt,
    };
  }

  /**
   * Consume crash recovery info — returns the info once, then clears it.
   * Used by server.ts to send mode-crash-recovery to the first connecting client.
   */
  getCrashRecoveryInfo(): { previousMode: string; flagsRestored: boolean } | null {
    const info = this.crashRecoveryInfo;
    this.crashRecoveryInfo = null;
    return info;
  }
}
