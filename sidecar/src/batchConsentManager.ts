/**
 * batchConsentManager.ts — EAC-2: Batch Consent & Trust Escalation
 *
 * Manages batch consent plans (approve N actions at once) and
 * time-limited trust windows (approve all actions for N seconds).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConsentAction {
  type: string;
  description: string;
  coordinates?: { x: number; y: number };
  target?: string;
}

export interface ActionPlan {
  planId: string;
  description: string;
  actions: ConsentAction[];
  targetWindow?: string;
}

export interface BatchConsentResult {
  approved: boolean;
  planId: string;
}

interface ApprovedPlan {
  planId: string;
  actions: boolean[];   // true = still available, false = consumed
  expiresAt: number;    // plan expires 5 minutes after approval
}

interface TrustGrant {
  trustId: string;
  targetTitle: string;
  allowedActions: string[];
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PLAN_EXPIRY_MS = 5 * 60 * 1000;        // 5 minutes
const MAX_TRUST_DURATION_SEC = 120;           // hard cap

// ── Manager ──────────────────────────────────────────────────────────────────

export class BatchConsentManager {
  private plans = new Map<string, ApprovedPlan>();
  private trusts = new Map<string, TrustGrant>();

  /**
   * Callback to broadcast a consent-plan-request to the frontend.
   * Set by server.ts when wiring up WebSocket broadcasts.
   */
  onPlanRequest: ((plan: ActionPlan) => Promise<boolean>) | null = null;

  /**
   * Callback to broadcast trust grant/expiry events.
   */
  onTrustActive: ((trustId: string, expiresAt: number) => void) | null = null;
  onTrustExpired: ((trustId: string) => void) | null = null;

  // ── Batch Consent ────────────────────────────────────────────────────────

  async submitPlan(plan: ActionPlan): Promise<BatchConsentResult> {
    if (!this.onPlanRequest) {
      return { approved: false, planId: plan.planId };
    }

    const approved = await this.onPlanRequest(plan);

    if (approved) {
      this.plans.set(plan.planId, {
        planId: plan.planId,
        actions: plan.actions.map(() => true),
        expiresAt: Date.now() + PLAN_EXPIRY_MS,
      });
    }

    return { approved, planId: plan.planId };
  }

  isActionPreApproved(planId: string, actionIndex: number): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;
    if (Date.now() > plan.expiresAt) {
      this.plans.delete(planId);
      return false;
    }
    if (actionIndex < 0 || actionIndex >= plan.actions.length) return false;
    return plan.actions[actionIndex] === true;
  }

  consumeAction(planId: string, actionIndex: number): void {
    const plan = this.plans.get(planId);
    if (!plan) return;
    if (Date.now() > plan.expiresAt) {
      this.plans.delete(planId);
      return;
    }
    if (actionIndex >= 0 && actionIndex < plan.actions.length) {
      plan.actions[actionIndex] = false;
    }
    // If all actions consumed, remove the plan
    if (plan.actions.every(a => a === false)) {
      this.plans.delete(planId);
    }
  }

  // ── Time-Limited Trust ───────────────────────────────────────────────────

  grantTimeLimitedTrust(opts: {
    targetTitle: string;
    durationSec: number;
    allowedActions: string[];
  }): string | null {
    if (opts.durationSec <= 0 || opts.durationSec > MAX_TRUST_DURATION_SEC) {
      return null;
    }

    const trustId = `trust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = Date.now() + opts.durationSec * 1000;

    const timer = setTimeout(() => {
      this.trusts.delete(trustId);
      this.onTrustExpired?.(trustId);
    }, opts.durationSec * 1000);

    this.trusts.set(trustId, {
      trustId,
      targetTitle: opts.targetTitle,
      allowedActions: opts.allowedActions,
      expiresAt,
      timer,
    });

    this.onTrustActive?.(trustId, expiresAt);

    return trustId;
  }

  isTrusted(targetTitle: string, actionType: string): boolean {
    for (const grant of this.trusts.values()) {
      if (Date.now() > grant.expiresAt) {
        clearTimeout(grant.timer);
        this.trusts.delete(grant.trustId);
        continue;
      }
      if (grant.targetTitle === targetTitle && grant.allowedActions.includes(actionType)) {
        return true;
      }
    }
    return false;
  }

  revokeTrust(trustId: string): void {
    const grant = this.trusts.get(trustId);
    if (grant) {
      clearTimeout(grant.timer);
      this.trusts.delete(trustId);
    }
  }

  revokeAll(): void {
    for (const grant of this.trusts.values()) {
      clearTimeout(grant.timer);
    }
    this.trusts.clear();
    this.plans.clear();
  }
}
