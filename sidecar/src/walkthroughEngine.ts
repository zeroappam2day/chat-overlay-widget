import { z } from 'zod';
import { AnnotationSchema, annotationState } from './annotationStore.js';
import type { Annotation } from './annotationStore.js';

export const AdvanceWhenSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('terminal-match'),
    pattern: z.string().min(1).max(500),
  }),
  z.object({
    type: z.literal('pixel-sample'),
    regions: z.array(z.object({
      x: z.number(), y: z.number(), w: z.number(), h: z.number(),
      expectedColor: z.string().optional(), minBrightness: z.number().optional(),
    })).min(1).max(10),
  }),
  z.object({
    type: z.literal('screenshot-diff'),
    diffThreshold: z.number().min(0).max(1),
    maskRegions: z.array(z.object({
      x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    })).optional(),
  }),
  z.object({
    type: z.literal('manual'),
  }),
]).optional();

export const WalkthroughStepSchema = z.object({
  stepId: z.string().min(1).max(200),
  title: z.string().max(200),
  instruction: z.string().max(1000),
  annotations: z.array(AnnotationSchema).max(50),
  advanceWhen: AdvanceWhenSchema,
});

export type WalkthroughStep = z.infer<typeof WalkthroughStepSchema>;

export const WalkthroughSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().max(300),
  steps: z.array(WalkthroughStepSchema).min(1).max(50),
});

export type Walkthrough = z.infer<typeof WalkthroughSchema>;

interface ActiveWalkthrough {
  walkthrough: Walkthrough;
  currentIndex: number;
}

class WalkthroughEngine {
  private active: ActiveWalkthrough | null = null;
  /** Called by server.ts to broadcast annotation updates when step changes. */
  onAnnotationsChanged: ((annotations: Annotation[]) => void) | undefined;

  start(walkthrough: Walkthrough): { stepId: string; title: string; instruction: string; totalSteps: number; currentStep: number } {
    this.active = { walkthrough, currentIndex: 0 };
    const step = walkthrough.steps[0];
    // Group all walkthrough annotations for easy clearing
    const grouped = step.annotations.map(a => ({ ...a, group: `walkthrough-${walkthrough.id}` }));
    const current = annotationState.apply({ action: 'set', annotations: grouped });
    this.onAnnotationsChanged?.(current);
    return {
      stepId: step.stepId,
      title: step.title,
      instruction: step.instruction,
      totalSteps: walkthrough.steps.length,
      currentStep: 1,
    };
  }

  advance(): { stepId: string; title: string; instruction: string; totalSteps: number; currentStep: number } | { done: true; walkthroughId: string } {
    if (!this.active) throw new Error('No active walkthrough');
    this.active.currentIndex++;
    if (this.active.currentIndex >= this.active.walkthrough.steps.length) {
      const id = this.active.walkthrough.id;
      this.stop();
      return { done: true, walkthroughId: id };
    }
    const step = this.active.walkthrough.steps[this.active.currentIndex];
    const grouped = step.annotations.map(a => ({ ...a, group: `walkthrough-${this.active!.walkthrough.id}` }));
    const current = annotationState.apply({ action: 'set', annotations: grouped });
    this.onAnnotationsChanged?.(current);
    return {
      stepId: step.stepId,
      title: step.title,
      instruction: step.instruction,
      totalSteps: this.active.walkthrough.steps.length,
      currentStep: this.active.currentIndex + 1,
    };
  }

  stop(): void {
    if (this.active) {
      const current = annotationState.apply({ action: 'clear-all' });
      this.onAnnotationsChanged?.(current);
    }
    this.active = null;
  }

  /**
   * Returns a compiled RegExp for the current step's advanceWhen pattern, or null.
   * Used by WalkthroughWatcher to know what terminal output to watch for.
   */
  getCurrentAdvancePattern(): RegExp | null {
    if (!this.active) return null;
    const step = this.active.walkthrough.steps[this.active.currentIndex];
    if (!step.advanceWhen) return null;
    if (step.advanceWhen.type !== 'terminal-match') return null;
    try {
      return new RegExp(step.advanceWhen.pattern);
    } catch {
      return null;
    }
  }

  getStatus(): { active: boolean; walkthroughId?: string; currentStep?: number; totalSteps?: number } {
    if (!this.active) return { active: false };
    return {
      active: true,
      walkthroughId: this.active.walkthrough.id,
      currentStep: this.active.currentIndex + 1,
      totalSteps: this.active.walkthrough.steps.length,
    };
  }

  appendSteps(steps: WalkthroughStep[]): { totalSteps: number; currentStep: number } {
    if (!this.active) throw new Error('No active walkthrough');
    const validated = steps.map(s => WalkthroughStepSchema.parse(s));
    this.active.walkthrough.steps.push(...validated);
    if (this.active.walkthrough.steps.length > 50) throw new Error('Max 50 steps');
    return { totalSteps: this.active.walkthrough.steps.length, currentStep: this.active.currentIndex + 1 };
  }

  replaceCurrentStep(step: WalkthroughStep): { stepId: string; title: string; instruction: string; totalSteps: number; currentStep: number } {
    if (!this.active) throw new Error('No active walkthrough');
    const validated = WalkthroughStepSchema.parse(step);
    this.active.walkthrough.steps[this.active.currentIndex] = validated;
    // Re-apply annotations for the replaced step
    const grouped = validated.annotations.map(a => ({ ...a, group: `walkthrough-${this.active!.walkthrough.id}` }));
    const current = annotationState.apply({ action: 'set', annotations: grouped });
    this.onAnnotationsChanged?.(current);
    return {
      stepId: validated.stepId,
      title: validated.title,
      instruction: validated.instruction,
      totalSteps: this.active.walkthrough.steps.length,
      currentStep: this.active.currentIndex + 1,
    };
  }

  updateRemainingSteps(steps: WalkthroughStep[]): { totalSteps: number; currentStep: number } {
    if (!this.active) throw new Error('No active walkthrough');
    const validated = steps.map(s => WalkthroughStepSchema.parse(s));
    // Replace everything AFTER current index (keep current step and all before it)
    this.active.walkthrough.steps.splice(this.active.currentIndex + 1, Infinity, ...validated);
    if (this.active.walkthrough.steps.length > 50) throw new Error('Max 50 steps');
    return { totalSteps: this.active.walkthrough.steps.length, currentStep: this.active.currentIndex + 1 };
  }
}

export const walkthroughEngine = new WalkthroughEngine();
