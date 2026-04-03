import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/api/notification';

const DEBOUNCE_MS = 3000;

interface ExitInfo {
  exitCode: number;
  shell: string;
  paneId: string;
}

/**
 * Desktop notification on agent/PTY exit.
 * Adapted from parallel-code/src/store/desktopNotifications.ts
 *
 * - Fires only when window is NOT focused and exitNotifications flag is ON
 * - 3s debounce batches rapid exits
 * - Uses Tauri v1 notification API
 */
export class ExitNotifier {
  private pending: ExitInfo[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _enabled: boolean;

  constructor(enabled = true) {
    this._enabled = enabled;
  }

  notify(info: ExitInfo): void {
    if (!this._enabled || document.hasFocus()) return;

    this.pending.push(info);

    // Debounce: batch multiple exits within 3s window
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DEBOUNCE_MS);
  }

  private async flush(): Promise<void> {
    if (this.pending.length === 0) return;

    const batch = [...this.pending];
    this.pending = [];
    this.timer = null;

    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      if (!granted) return;

      if (batch.length === 1) {
        const { exitCode, shell } = batch[0];
        sendNotification({
          title: 'Process Exited',
          body: `${shell} exited with code ${exitCode}`,
        });
      } else {
        const summary = batch
          .map(({ shell, exitCode }) => `${shell} (code ${exitCode})`)
          .join(', ');
        sendNotification({
          title: `${batch.length} Processes Exited`,
          body: summary,
        });
      }
    } catch (err) {
      console.warn('[exitNotifier] notification failed:', err);
    }
  }

  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) {
      // Cancel pending notifications when disabled
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.pending = [];
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = [];
  }
}
