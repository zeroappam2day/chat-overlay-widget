/**
 * agentRuntimeIntegration.test.ts — Phase 7 Integration & Hardening tests
 *
 * Cross-phase tests verifying:
 * - Feature flag defaults (all OFF)
 * - Flag independence (toggling one doesn't affect others)
 * - Flag dependency enforcement (osInputSimulation requires uiAccessibility + consentGate)
 * - Module exports exist and are callable
 * - No cross-phase state leakage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultiPtyManager } from './multiPtyManager.js';
import { WalkthroughWatcher } from './walkthroughWatcher.js';
import { ConsentManager } from './consentManager.js';

// ─── Feature flag defaults & isolation ─────────────────────────────────────

describe('Feature flag defaults and isolation', () => {
  // Simulate the sidecarFlags object as defined in server.ts
  function makeSidecarFlags() {
    return {
      terminalWriteMcp: false,
      conditionalAdvance: false,
      multiPty: false,
      uiAccessibility: false,
      osInputSimulation: false,
      consentGate: false,
    };
  }

  it('all Agent Runtime flags default to false', () => {
    const flags = makeSidecarFlags();
    for (const [key, val] of Object.entries(flags)) {
      expect(val).toBe(false);
    }
  });

  it('toggling one flag does not affect others', () => {
    const flags = makeSidecarFlags();
    flags.multiPty = true;
    expect(flags.terminalWriteMcp).toBe(false);
    expect(flags.conditionalAdvance).toBe(false);
    expect(flags.uiAccessibility).toBe(false);
    expect(flags.osInputSimulation).toBe(false);
    expect(flags.consentGate).toBe(false);
  });

  it('osInputSimulation triple-gate: all three flags required', () => {
    const flags = makeSidecarFlags();

    // Simulate the triple-gate check from server.ts POST /send-input
    function canSendInput(f: typeof flags): { allowed: boolean; missing: string[] } {
      const missing: string[] = [];
      if (!f.osInputSimulation) missing.push('osInputSimulation');
      if (!f.uiAccessibility) missing.push('uiAccessibility');
      if (!f.consentGate) missing.push('consentGate');
      return { allowed: missing.length === 0, missing };
    }

    // All off
    expect(canSendInput(flags).allowed).toBe(false);
    expect(canSendInput(flags).missing).toHaveLength(3);

    // Only osInputSimulation on
    flags.osInputSimulation = true;
    expect(canSendInput(flags).allowed).toBe(false);
    expect(canSendInput(flags).missing).toEqual(['uiAccessibility', 'consentGate']);

    // Two of three
    flags.uiAccessibility = true;
    expect(canSendInput(flags).allowed).toBe(false);
    expect(canSendInput(flags).missing).toEqual(['consentGate']);

    // All three
    flags.consentGate = true;
    expect(canSendInput(flags).allowed).toBe(true);
    expect(canSendInput(flags).missing).toHaveLength(0);
  });
});

// ─── Cross-phase: MultiPtyManager + WalkthroughWatcher isolation ───────────

describe('Cross-phase state isolation', () => {
  let mgr: MultiPtyManager;
  let watcher: WalkthroughWatcher;
  let cm: ConsentManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = new MultiPtyManager();
    watcher = new WalkthroughWatcher({ onAdvance: vi.fn(), enabled: true });
    cm = new ConsentManager();
  });

  afterEach(() => {
    watcher.destroy();
    cm.denyAll();
    vi.useRealTimers();
  });

  it('destroying WalkthroughWatcher does not affect MultiPtyManager', () => {
    const ws = { id: 'ws1' } as any;
    const session = { write: vi.fn(), destroy: vi.fn() } as any;
    mgr.setSession(ws, 'pane-1', session);

    watcher.setPattern(/test/);
    watcher.destroy();

    // MultiPtyManager should be unaffected
    expect(mgr.getSession(ws, 'pane-1')).toBe(session);
    expect(mgr.sessionCount(ws)).toBe(1);
  });

  it('ConsentManager denyAll does not affect WalkthroughWatcher', () => {
    cm.broadcastConsentRequest = vi.fn();
    cm.requestConsent({ type: 'click', description: 'test' });

    watcher.setPattern(/done/);
    const onAdvance = vi.fn();
    watcher.onAdvance = onAdvance;

    cm.denyAll();

    // Watcher should still work
    watcher.feed('done');
    vi.advanceTimersByTime(50);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('MultiPtyManager destroyAll does not affect ConsentManager', () => {
    const ws = { id: 'ws1' } as any;
    mgr.setSession(ws, 'p1', { destroy: vi.fn(), write: vi.fn() } as any);

    cm.broadcastConsentRequest = vi.fn();
    const promise = cm.requestConsent({ type: 'click', description: 'pending' });

    mgr.destroyAll(ws);

    // Consent should still be pending
    expect(cm.pendingCount).toBe(1);
    cm.denyAll(); // cleanup
  });
});

// ─── Module exports verification ───────────────────────────────────────────

describe('Phase module exports are correct', () => {
  it('Phase 1: terminalWrite exports handleTerminalWrite', async () => {
    const mod = await import('./terminalWrite.js');
    expect(typeof mod.handleTerminalWrite).toBe('function');
  });

  it('Phase 2: walkthroughWatcher exports WalkthroughWatcher class', async () => {
    const mod = await import('./walkthroughWatcher.js');
    expect(typeof mod.WalkthroughWatcher).toBe('function');
  });

  it('Phase 3: multiPtyManager exports MultiPtyManager class', async () => {
    const mod = await import('./multiPtyManager.js');
    expect(typeof mod.MultiPtyManager).toBe('function');
  });

  it('Phase 4: uiAutomation exports getUiElements and resetUiCache', async () => {
    const mod = await import('./uiAutomation.js');
    expect(typeof mod.getUiElements).toBe('function');
    expect(typeof mod.resetUiCache).toBe('function');
  });

  it('Phase 5: inputSimulator exports all action functions', async () => {
    const mod = await import('./inputSimulator.js');
    expect(typeof mod.simulateClick).toBe('function');
    expect(typeof mod.simulateType).toBe('function');
    expect(typeof mod.simulateKeyCombo).toBe('function');
    expect(typeof mod.simulateDrag).toBe('function');
  });

  it('Phase 6: consentManager exports ConsentManager class', async () => {
    const mod = await import('./consentManager.js');
    expect(typeof mod.ConsentManager).toBe('function');
  });
});

// ─── Consent + WalkthroughWatcher combined flow ────────────────────────────

describe('Consent + Watcher combined flow (Scenario A simulation)', () => {
  it('watcher auto-advance works independently of consent flow', async () => {
    vi.useFakeTimers();
    const onAdvance = vi.fn();
    const watcher = new WalkthroughWatcher({ onAdvance, enabled: true });
    const cm = new ConsentManager();
    cm.broadcastConsentRequest = vi.fn();

    // Start a consent request (simulates GUI action)
    const consentPromise = cm.requestConsent({ type: 'click', description: 'test' });

    // Meanwhile, watcher detects terminal pattern
    watcher.setPattern(/BUILD SUCCESS/);
    watcher.feed('BUILD SUCCESS');
    vi.advanceTimersByTime(50);

    // Watcher should have fired independently
    expect(onAdvance).toHaveBeenCalledTimes(1);

    // Consent is still pending
    expect(cm.pendingCount).toBe(1);

    // Cleanup
    cm.denyAll();
    watcher.destroy();
    vi.useRealTimers();
  });
});
