/**
 * batchConsentManager.test.ts — EAC-2: Batch Consent & Trust Escalation tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BatchConsentManager } from './batchConsentManager.js';
import type { ActionPlan } from './batchConsentManager.js';

describe('BatchConsentManager', () => {
  let mgr: BatchConsentManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = new BatchConsentManager();
  });

  afterEach(() => {
    mgr.revokeAll();
    vi.useRealTimers();
  });

  // ── Batch Consent: Submit → Approve → Consume ────────────────────────

  describe('submitPlan — approve flow', () => {
    const plan: ActionPlan = {
      planId: 'plan-1',
      description: 'Test plan',
      actions: [
        { type: 'click', description: 'Click button A' },
        { type: 'type', description: 'Type hello' },
        { type: 'click', description: 'Click button B' },
      ],
      targetWindow: 'Notepad',
    };

    it('approves plan and marks all actions as pre-approved', async () => {
      mgr.onPlanRequest = async () => true;
      const result = await mgr.submitPlan(plan);
      expect(result.approved).toBe(true);
      expect(result.planId).toBe('plan-1');
      expect(mgr.isActionPreApproved('plan-1', 0)).toBe(true);
      expect(mgr.isActionPreApproved('plan-1', 1)).toBe(true);
      expect(mgr.isActionPreApproved('plan-1', 2)).toBe(true);
    });

    it('consume each action exactly once', async () => {
      mgr.onPlanRequest = async () => true;
      await mgr.submitPlan(plan);

      expect(mgr.isActionPreApproved('plan-1', 0)).toBe(true);
      mgr.consumeAction('plan-1', 0);
      expect(mgr.isActionPreApproved('plan-1', 0)).toBe(false);

      // Second consume is a no-op (already consumed)
      mgr.consumeAction('plan-1', 0);
      expect(mgr.isActionPreApproved('plan-1', 0)).toBe(false);

      // Other actions still available
      expect(mgr.isActionPreApproved('plan-1', 1)).toBe(true);
      expect(mgr.isActionPreApproved('plan-1', 2)).toBe(true);
    });

    it('plan removed after all actions consumed', async () => {
      mgr.onPlanRequest = async () => true;
      await mgr.submitPlan(plan);

      mgr.consumeAction('plan-1', 0);
      mgr.consumeAction('plan-1', 1);
      mgr.consumeAction('plan-1', 2);

      // Plan fully consumed — isActionPreApproved returns false for all
      expect(mgr.isActionPreApproved('plan-1', 0)).toBe(false);
      expect(mgr.isActionPreApproved('plan-1', 1)).toBe(false);
    });
  });

  // ── Batch Consent: Submit → Deny ─────────────────────────────────────

  describe('submitPlan — deny flow', () => {
    it('denied plan has no pre-approved actions', async () => {
      mgr.onPlanRequest = async () => false;
      const result = await mgr.submitPlan({
        planId: 'plan-deny',
        description: 'Denied plan',
        actions: [{ type: 'click', description: 'Click X' }],
      });
      expect(result.approved).toBe(false);
      expect(mgr.isActionPreApproved('plan-deny', 0)).toBe(false);
    });

    it('returns false when no onPlanRequest callback', async () => {
      const result = await mgr.submitPlan({
        planId: 'plan-nocb',
        description: 'No callback',
        actions: [{ type: 'click', description: 'Click' }],
      });
      expect(result.approved).toBe(false);
    });
  });

  // ── Plan Expiry ──────────────────────────────────────────────────────

  describe('plan expiry after 5 minutes', () => {
    it('plan expires and actions become unavailable', async () => {
      mgr.onPlanRequest = async () => true;
      await mgr.submitPlan({
        planId: 'plan-exp',
        description: 'Expiring plan',
        actions: [{ type: 'click', description: 'Click' }],
      });

      expect(mgr.isActionPreApproved('plan-exp', 0)).toBe(true);

      // Advance 5 minutes + 1ms
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(mgr.isActionPreApproved('plan-exp', 0)).toBe(false);
    });

    it('consumeAction on expired plan is a no-op', async () => {
      mgr.onPlanRequest = async () => true;
      await mgr.submitPlan({
        planId: 'plan-exp2',
        description: 'Expiring',
        actions: [{ type: 'click', description: 'Click' }],
      });

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      // Should not throw
      mgr.consumeAction('plan-exp2', 0);
      expect(mgr.isActionPreApproved('plan-exp2', 0)).toBe(false);
    });
  });

  // ── Time-Limited Trust: Grant / Check / Revoke ───────────────────────

  describe('time-limited trust', () => {
    it('grant trust and check isTrusted', () => {
      const trustId = mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: 30,
        allowedActions: ['click', 'type'],
      });
      expect(trustId).toBeTruthy();
      expect(mgr.isTrusted('Notepad', 'click')).toBe(true);
      expect(mgr.isTrusted('Notepad', 'type')).toBe(true);
      expect(mgr.isTrusted('Notepad', 'drag')).toBe(false);
      expect(mgr.isTrusted('Other Window', 'click')).toBe(false);
    });

    it('trust expires after duration', () => {
      const expiredCb = vi.fn();
      mgr.onTrustExpired = expiredCb;

      const trustId = mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: 10,
        allowedActions: ['click'],
      });

      expect(mgr.isTrusted('Notepad', 'click')).toBe(true);

      vi.advanceTimersByTime(10_001);

      expect(mgr.isTrusted('Notepad', 'click')).toBe(false);
      expect(expiredCb).toHaveBeenCalledWith(trustId);
    });

    it('revokeTrust removes specific grant', () => {
      const trustId = mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: 60,
        allowedActions: ['click'],
      })!;

      expect(mgr.isTrusted('Notepad', 'click')).toBe(true);
      mgr.revokeTrust(trustId);
      expect(mgr.isTrusted('Notepad', 'click')).toBe(false);
    });
  });

  // ── Hard Cap at 120 seconds ──────────────────────────────────────────

  describe('trust hard cap at 120 seconds', () => {
    it('rejects duration > 120', () => {
      const trustId = mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: 121,
        allowedActions: ['click'],
      });
      expect(trustId).toBeNull();
    });

    it('rejects duration <= 0', () => {
      expect(mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: 0,
        allowedActions: ['click'],
      })).toBeNull();

      expect(mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: -5,
        allowedActions: ['click'],
      })).toBeNull();
    });

    it('accepts duration exactly 120', () => {
      const trustId = mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: 120,
        allowedActions: ['click'],
      });
      expect(trustId).toBeTruthy();
    });
  });

  // ── revokeAll ────────────────────────────────────────────────────────

  describe('revokeAll', () => {
    it('clears all trusts and plans', async () => {
      mgr.onPlanRequest = async () => true;
      await mgr.submitPlan({
        planId: 'plan-all',
        description: 'Plan',
        actions: [{ type: 'click', description: 'Click' }],
      });

      mgr.grantTimeLimitedTrust({
        targetTitle: 'Notepad',
        durationSec: 60,
        allowedActions: ['click'],
      });

      expect(mgr.isActionPreApproved('plan-all', 0)).toBe(true);
      expect(mgr.isTrusted('Notepad', 'click')).toBe(true);

      mgr.revokeAll();

      expect(mgr.isActionPreApproved('plan-all', 0)).toBe(false);
      expect(mgr.isTrusted('Notepad', 'click')).toBe(false);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('isActionPreApproved returns false for unknown plan', () => {
      expect(mgr.isActionPreApproved('nonexistent', 0)).toBe(false);
    });

    it('isActionPreApproved returns false for out-of-bounds index', async () => {
      mgr.onPlanRequest = async () => true;
      await mgr.submitPlan({
        planId: 'plan-bounds',
        description: 'Bounds',
        actions: [{ type: 'click', description: 'Click' }],
      });
      expect(mgr.isActionPreApproved('plan-bounds', -1)).toBe(false);
      expect(mgr.isActionPreApproved('plan-bounds', 5)).toBe(false);
    });

    it('consumeAction on unknown plan is a no-op', () => {
      // Should not throw
      mgr.consumeAction('nonexistent', 0);
    });

    it('revokeTrust on unknown trustId is a no-op', () => {
      // Should not throw
      mgr.revokeTrust('nonexistent');
    });
  });
});
