/**
 * consentManager.test.ts — Unit tests for Agent Runtime Phase 6
 *
 * Tests ConsentManager class:
 * - Consent request/response flow
 * - Timeout auto-deny (30s)
 * - denyAll cleanup
 * - No broadcast function → auto-deny
 * - Unknown requestId handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsentManager } from './consentManager.js';
import type { ConsentRequest } from './consentManager.js';

describe('ConsentManager', () => {
  let cm: ConsentManager;
  let broadcastSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    cm = new ConsentManager();
    broadcastSpy = vi.fn();
    cm.broadcastConsentRequest = broadcastSpy;
  });

  afterEach(() => {
    cm.denyAll();
    vi.useRealTimers();
  });

  it('auto-denies when no broadcast function is set', async () => {
    cm.broadcastConsentRequest = null;
    const result = await cm.requestConsent({ type: 'click', description: 'test' });
    expect(result).toBe(false);
  });

  it('broadcasts consent request and resolves true on approval', async () => {
    const promise = cm.requestConsent({ type: 'click', description: 'Click Save' });
    expect(broadcastSpy).toHaveBeenCalledTimes(1);

    const { requestId } = broadcastSpy.mock.calls[0][0] as ConsentRequest;
    cm.handleResponse(requestId, true);

    const result = await promise;
    expect(result).toBe(true);
    expect(cm.pendingCount).toBe(0);
  });

  it('resolves false on user denial', async () => {
    const promise = cm.requestConsent({ type: 'type', description: 'Type text' });
    const { requestId } = broadcastSpy.mock.calls[0][0] as ConsentRequest;
    cm.handleResponse(requestId, false);

    const result = await promise;
    expect(result).toBe(false);
  });

  it('auto-denies after 30s timeout', async () => {
    const promise = cm.requestConsent({ type: 'click', description: 'test timeout' });
    expect(cm.pendingCount).toBe(1);

    vi.advanceTimersByTime(30_000);

    const result = await promise;
    expect(result).toBe(false);
    expect(cm.pendingCount).toBe(0);
  });

  it('ignores response for unknown requestId', () => {
    // Should not throw
    cm.handleResponse('nonexistent-id', true);
    expect(cm.pendingCount).toBe(0);
  });

  it('denyAll resolves all pending requests as false', async () => {
    const p1 = cm.requestConsent({ type: 'click', description: 'action 1' });
    const p2 = cm.requestConsent({ type: 'type', description: 'action 2' });
    expect(cm.pendingCount).toBe(2);

    cm.denyAll();
    expect(cm.pendingCount).toBe(0);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(false);
    expect(r2).toBe(false);
  });

  it('includes action details in broadcast', async () => {
    const action = { type: 'click', description: 'Click button', coordinates: { x: 100, y: 200 }, target: 'Save' };
    cm.requestConsent(action);

    const request = broadcastSpy.mock.calls[0][0] as ConsentRequest;
    expect(request.action).toEqual(action);
    expect(request.requestId).toBeTruthy();

    cm.denyAll(); // cleanup
  });

  it('clearTimeout is called on manual response (no lingering timers)', async () => {
    const promise = cm.requestConsent({ type: 'click', description: 'test' });
    const { requestId } = broadcastSpy.mock.calls[0][0] as ConsentRequest;

    cm.handleResponse(requestId, true);
    await promise;

    // Advancing time should not cause issues (timer was cleared)
    vi.advanceTimersByTime(60_000);
    expect(cm.pendingCount).toBe(0);
  });
});
