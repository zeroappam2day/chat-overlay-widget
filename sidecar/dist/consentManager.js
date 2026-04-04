"use strict";
/**
 * consentManager.ts — Agent Runtime Phase 6
 *
 * Manages consent request/response flow for OS-level actions.
 * When an MCP tool requests an OS-level action (e.g., send_input),
 * the ConsentManager sends a consent-request to the frontend via WebSocket,
 * then awaits the user's approval or denial (or timeout).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentManager = void 0;
const crypto = __importStar(require("node:crypto"));
class ConsentManager {
    constructor() {
        this.pendingRequests = new Map();
        this.TIMEOUT_MS = 30000;
        /** Broadcast function — set by server.ts to send messages to all WebSocket clients. */
        this.broadcastConsentRequest = null;
    }
    /**
     * Request user consent for an action.
     * Returns a Promise that resolves to true (approved) or false (denied/timeout).
     */
    requestConsent(action) {
        if (!this.broadcastConsentRequest) {
            // No broadcast function set — auto-deny (safety default)
            return Promise.resolve(false);
        }
        const requestId = crypto.randomUUID();
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                console.log(`[consent] request ${requestId} timed out (${this.TIMEOUT_MS}ms) — auto-denied`);
                resolve(false);
            }, this.TIMEOUT_MS);
            this.pendingRequests.set(requestId, { resolve, timer });
            // Broadcast consent request to frontend
            this.broadcastConsentRequest({ requestId, action });
            console.log(`[consent] request ${requestId} sent: ${action.description}`);
        });
    }
    /**
     * Handle a consent response from the frontend.
     * Called when a 'consent-response' WebSocket message arrives.
     */
    handleResponse(requestId, approved) {
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
    denyAll() {
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            console.log(`[consent] request ${requestId} auto-denied (cleanup)`);
            pending.resolve(false);
        }
        this.pendingRequests.clear();
    }
    /** Number of pending consent requests. */
    get pendingCount() {
        return this.pendingRequests.size;
    }
}
exports.ConsentManager = ConsentManager;
