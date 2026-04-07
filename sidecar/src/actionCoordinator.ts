import * as crypto from 'node:crypto';
import type { Annotation } from './annotationStore.js';
import type { AnnotationPayload } from './annotationStore.js';
import type { ServerMessage } from './protocol.js';

/**
 * A pending action waiting for the delay to expire (or user cancellation).
 */
export interface PendingAction {
  actionId: string;
  description: string;
  delayMs: number;
  timer: ReturnType<typeof setTimeout>;
  resolve: (cancelled: boolean) => void;
  annotationId: string;
}

interface ActionCoordinatorOpts {
  annotationState: {
    apply(payload: AnnotationPayload): Annotation[];
  };
  onBroadcast: (msg: ServerMessage) => void;
  defaultDelayMs?: number;
}

/**
 * Announce-then-act coordinator for Work With Me mode.
 *
 * Before performing any action that modifies the user's screen or application state,
 * the LLM agent should call announce(). This creates an orange highlight annotation
 * describing the intended action and waits a configurable delay. The user can cancel
 * the pending action during this window.
 */
export class ActionCoordinator {
  private pending = new Map<string, PendingAction>();
  private annotationState: ActionCoordinatorOpts['annotationState'];
  private onBroadcast: ActionCoordinatorOpts['onBroadcast'];
  private defaultDelayMs: number;

  /** Whether the coordinator is enabled (set by mode activation). */
  enabled = false;

  constructor(opts: ActionCoordinatorOpts) {
    this.annotationState = opts.annotationState;
    this.onBroadcast = opts.onBroadcast;
    this.defaultDelayMs = opts.defaultDelayMs ?? 2000;
  }

  /**
   * Announce an intended action to the user.
   *
   * Creates an orange highlight annotation with the action description,
   * broadcasts an action-announced message, then waits the configured delay.
   * Returns { cancelled: false } if the delay expires, or { cancelled: true }
   * if cancel() was called during the wait.
   */
  async announce(
    description: string,
    position?: { x: number; y: number }
  ): Promise<{ cancelled: boolean; actionId: string }> {
    const actionId = crypto.randomUUID();
    const annotationId = `action-${actionId}`;
    const delayMs = this.defaultDelayMs;

    // 1. Create the announcement annotation
    const annotation: Annotation = {
      id: annotationId,
      type: 'highlight',
      x: position?.x ?? 100,
      y: position?.y ?? 100,
      width: 400,
      height: 60,
      label: `AI Action: ${description}`,
      color: '#FF6600',
      ttl: Math.ceil(delayMs / 1000) + 1,
      group: 'action-coordinator',
    };

    // 2. Apply annotation
    this.annotationState.apply({ action: 'merge', annotations: [annotation] });

    // 3. Broadcast action-announced
    this.onBroadcast({
      type: 'action-announced',
      actionId,
      description,
      delayMs,
    });

    // 4. Wait for delay or cancellation
    const cancelled = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        // Delay expired without cancellation
        this.pending.delete(actionId);
        // Clear the annotation on successful completion
        this.annotationState.apply({ action: 'clear', ids: [annotationId] });
        resolve(false);
      }, delayMs);

      this.pending.set(actionId, {
        actionId,
        description,
        delayMs,
        timer,
        resolve,
        annotationId,
      });
    });

    return { cancelled, actionId };
  }

  /**
   * Cancel a pending action by actionId.
   *
   * Clears the timeout, resolves the announce promise with cancelled=true,
   * removes the annotation, and broadcasts action-cancelled.
   *
   * @returns true if the action was found and cancelled, false otherwise.
   */
  cancel(actionId: string): boolean {
    const action = this.pending.get(actionId);
    if (!action) return false;

    clearTimeout(action.timer);
    this.pending.delete(actionId);

    // Clear the annotation
    this.annotationState.apply({ action: 'clear', ids: [action.annotationId] });

    // Broadcast cancellation
    this.onBroadcast({ type: 'action-cancelled', actionId });

    // Resolve the announce promise with cancelled=true
    action.resolve(true);

    return true;
  }

  /**
   * Cancel all pending actions. Used during mode deactivation.
   */
  cancelAll(): void {
    for (const [actionId] of this.pending) {
      this.cancel(actionId);
    }
  }

  /**
   * Get the number of currently pending actions.
   */
  get pendingCount(): number {
    return this.pending.size;
  }
}
