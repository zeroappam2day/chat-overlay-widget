/**
 * consentManager.ts — Agent Runtime Phase 6
 *
 * Manages consent request/response flow for OS-level actions.
 * When an MCP tool requests an OS-level action (e.g., send_input),
 * the ConsentManager sends a consent-request to the frontend via WebSocket,
 * then awaits the user's approval or denial (or timeout).
 */
export interface ConsentAction {
    type: string;
    description: string;
    coordinates?: {
        x: number;
        y: number;
    };
    target?: string;
}
export interface ConsentRequest {
    requestId: string;
    action: ConsentAction;
}
export declare class ConsentManager {
    private pendingRequests;
    private readonly TIMEOUT_MS;
    /** Broadcast function — set by server.ts to send messages to all WebSocket clients. */
    broadcastConsentRequest: ((request: ConsentRequest) => void) | null;
    /**
     * Request user consent for an action.
     * Returns a Promise that resolves to true (approved) or false (denied/timeout).
     */
    requestConsent(action: ConsentAction): Promise<boolean>;
    /**
     * Handle a consent response from the frontend.
     * Called when a 'consent-response' WebSocket message arrives.
     */
    handleResponse(requestId: string, approved: boolean): void;
    /**
     * Auto-deny all pending requests (e.g., on WebSocket disconnect or sidecar shutdown).
     */
    denyAll(): void;
    /** Number of pending consent requests. */
    get pendingCount(): number;
}
