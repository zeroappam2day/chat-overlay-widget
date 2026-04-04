/**
 * consentManager.ts — Agent Runtime Phase 6
 *
 * Manages consent request/response flow for OS-level actions.
 * When an MCP tool requests an OS-level action (e.g., send_input),
 * the ConsentManager sends a consent-request to the frontend via WebSocket,
 * then awaits the user's approval or denial (or timeout).
 */

import * as crypto from 'node:crypto';

export interface ConsentAction {
  type: string;
  description: string;
  coordinates?: { x: number; y: number };
  target?: string;
}

export interface ConsentRequest {
  requestId: string;
  action: ConsentAction;
}

interface PendingRequest {
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ConsentManager {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly TIMEOUT_MS = 30_000;

  /** Broadcast function — set by server.ts to send messages to all WebSocket clients. */
  public broadcastConsentRequest: ((request: ConsentRequest) => void) | null = null;

  /**
   * Request user consent for an action.
   * Returns a Promise that resolves to true (approved) or false (denied/timeout).
   */
  requestConsent(action: ConsentAction): Promise<boolean> {
    if (!this.broadcastConsentRequest) {
      // No broadcast function set — auto-deny (safety default)
      return Promise.resolve(false);
    }

    const requestId = crypto.randomUUID();

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        console.log(`[consent] request ${requestId} timed out (${this.TIMEOUT_MS}ms) — auto-denied`);
        resolve(false);
      }, this.TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, timer });

      // Broadcast consent request to frontend
      this.broadcastConsentRequest!({ requestId, action });
      console.log(`[consent] request ${requestId} sent: ${action.description}`);
    });
  }

  /**
   * Handle a consent response from the frontend.
   * Called when a 'consent-response' WebSocket message arrives.
   */
  handleResponse(requestId: string, approved: boolean): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      console.log(`[consent] response for unknown requestId ${requestId} — ignoring`);
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);
    console.log(`[consent] request ${requestId} ${approved ? 'APPROVED' : 'DENIED'} by user`);
    pending.resolve(approved);
  }

  /**
   * Auto-deny all pending requests (e.g., on WebSocket disconnect or sidecar shutdown).
   */
  denyAll(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      console.log(`[consent] request ${requestId} auto-denied (cleanup)`);
      pending.resolve(false);
    }
    this.pendingRequests.clear();
  }

  /** Number of pending consent requests. */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }
}
