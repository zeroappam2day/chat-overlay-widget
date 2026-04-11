import { describe, it, expect, beforeEach } from 'vitest';
import { walkthroughEngine, WalkthroughSchema } from './walkthroughEngine.js';
import { annotationState } from './annotationStore.js';
import type { Walkthrough } from './walkthroughEngine.js';

function makeWalkthrough(stepCount: number, id = 'test-wt'): Walkthrough {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    stepId: `step-${i + 1}`,
    title: `Step ${i + 1}`,
    instruction: `Do thing ${i + 1}`,
    annotations: [
      { id: `ann-${i + 1}`, type: 'box' as const, x: 100 * (i + 1), y: 100, width: 200, height: 50, label: `Step ${i + 1} box` },
    ],
  }));
  return { id, title: 'Test Walkthrough', steps };
}

describe('WalkthroughEngine', () => {
  beforeEach(() => {
    // Reset state between tests
    walkthroughEngine.stop();
    annotationState.apply({ action: 'clear-all' });
    walkthroughEngine.onAnnotationsChanged = undefined;
  });

  it('starts a walkthrough and returns first step info', () => {
    const wt = makeWalkthrough(3);
    const result = walkthroughEngine.start(wt);

    expect(result.stepId).toBe('step-1');
    expect(result.title).toBe('Step 1');
    expect(result.instruction).toBe('Do thing 1');
    expect(result.totalSteps).toBe(3);
    expect(result.currentStep).toBe(1);
  });

  it('applies first step annotations on start', () => {
    const wt = makeWalkthrough(3);
    walkthroughEngine.start(wt);

    const annotations = annotationState.getAll();
    expect(annotations).toHaveLength(1);
    expect(annotations[0].id).toBe('ann-1');
    expect(annotations[0].group).toBe('walkthrough-test-wt');
  });

  it('advances through all steps and annotations change each time', () => {
    const wt = makeWalkthrough(3);
    walkthroughEngine.start(wt);

    // Advance to step 2
    const step2 = walkthroughEngine.advance();
    expect(step2).toMatchObject({ stepId: 'step-2', currentStep: 2, totalSteps: 3 });
    let annotations = annotationState.getAll();
    expect(annotations).toHaveLength(1);
    expect(annotations[0].id).toBe('ann-2');

    // Advance to step 3
    const step3 = walkthroughEngine.advance();
    expect(step3).toMatchObject({ stepId: 'step-3', currentStep: 3, totalSteps: 3 });
    annotations = annotationState.getAll();
    expect(annotations).toHaveLength(1);
    expect(annotations[0].id).toBe('ann-3');
  });

  it('advance past last step returns done: true', () => {
    const wt = makeWalkthrough(2);
    walkthroughEngine.start(wt);
    walkthroughEngine.advance(); // step 2

    const result = walkthroughEngine.advance(); // past end
    expect(result).toMatchObject({ done: true, walkthroughId: 'test-wt' });

    // Annotations should be cleared
    expect(annotationState.getAll()).toHaveLength(0);
  });

  it('stop clears all annotations', () => {
    const wt = makeWalkthrough(3);
    walkthroughEngine.start(wt);
    expect(annotationState.getAll()).toHaveLength(1);

    walkthroughEngine.stop();
    expect(annotationState.getAll()).toHaveLength(0);
  });

  it('getStatus returns correct state when active', () => {
    const wt = makeWalkthrough(3);
    walkthroughEngine.start(wt);
    walkthroughEngine.advance();

    const status = walkthroughEngine.getStatus();
    expect(status).toEqual({
      active: true,
      walkthroughId: 'test-wt',
      currentStep: 2,
      totalSteps: 3,
    });
  });

  it('getStatus returns inactive when no walkthrough', () => {
    const status = walkthroughEngine.getStatus();
    expect(status).toEqual({ active: false });
  });

  it('starting a new walkthrough replaces the active one', () => {
    const wt1 = makeWalkthrough(3, 'wt-1');
    const wt2 = makeWalkthrough(2, 'wt-2');

    walkthroughEngine.start(wt1);
    walkthroughEngine.advance(); // on step 2 of wt1

    walkthroughEngine.start(wt2); // replaces wt1
    const status = walkthroughEngine.getStatus();
    expect(status.walkthroughId).toBe('wt-2');
    expect(status.currentStep).toBe(1);
    expect(status.totalSteps).toBe(2);
  });

  it('advance throws when no active walkthrough', () => {
    expect(() => walkthroughEngine.advance()).toThrow('No active walkthrough');
  });

  it('WalkthroughSchema rejects empty steps array', () => {
    const result = WalkthroughSchema.safeParse({
      id: 'bad',
      title: 'Bad walkthrough',
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it('calls onAnnotationsChanged callback on start', () => {
    const calls: unknown[] = [];
    walkthroughEngine.onAnnotationsChanged = (anns) => calls.push(anns);

    const wt = makeWalkthrough(2);
    walkthroughEngine.start(wt);
    expect(calls).toHaveLength(1);
  });

  it('calls onAnnotationsChanged callback on advance', () => {
    const calls: unknown[] = [];
    walkthroughEngine.onAnnotationsChanged = (anns) => calls.push(anns);

    const wt = makeWalkthrough(3);
    walkthroughEngine.start(wt);
    walkthroughEngine.advance();
    // 1 for start + 1 for advance
    expect(calls).toHaveLength(2);
  });

  it('calls onAnnotationsChanged callback on stop', () => {
    const calls: unknown[] = [];
    walkthroughEngine.onAnnotationsChanged = (anns) => calls.push(anns);

    const wt = makeWalkthrough(2);
    walkthroughEngine.start(wt);
    walkthroughEngine.stop();
    // 1 for start + 1 for stop
    expect(calls).toHaveLength(2);
  });

  describe('targetHwnd binding', () => {
    it('stores targetHwnd when provided and getTargetHwnd returns it', () => {
      const wt = { ...makeWalkthrough(2), targetHwnd: 12345 };
      walkthroughEngine.start(wt);
      expect(walkthroughEngine.getTargetHwnd()).toBe(12345);
    });

    it('getTargetHwnd returns null when no targetHwnd provided', () => {
      const wt = makeWalkthrough(2);
      walkthroughEngine.start(wt);
      expect(walkthroughEngine.getTargetHwnd()).toBeNull();
    });

    it('stop clears targetHwnd', () => {
      const wt = { ...makeWalkthrough(2), targetHwnd: 12345 };
      walkthroughEngine.start(wt);
      walkthroughEngine.stop();
      expect(walkthroughEngine.getTargetHwnd()).toBeNull();
    });

    it('WalkthroughSchema.parse succeeds with targetHwnd present', () => {
      const result = WalkthroughSchema.safeParse({
        id: 'x',
        title: 'X',
        steps: [{ stepId: 's1', title: 'S', instruction: 'Do', annotations: [] }],
        targetHwnd: 99999,
      });
      expect(result.success).toBe(true);
    });

    it('WalkthroughSchema.parse succeeds without targetHwnd (backward compat)', () => {
      const result = WalkthroughSchema.safeParse({
        id: 'x',
        title: 'X',
        steps: [{ stepId: 's1', title: 'S', instruction: 'Do', annotations: [] }],
      });
      expect(result.success).toBe(true);
    });

    it('WalkthroughSchema.parse rejects targetHwnd of 0', () => {
      const result = WalkthroughSchema.safeParse({
        id: 'x',
        title: 'X',
        steps: [{ stepId: 's1', title: 'S', instruction: 'Do', annotations: [] }],
        targetHwnd: 0,
      });
      expect(result.success).toBe(false);
    });

    it('WalkthroughSchema.parse rejects targetHwnd of -1', () => {
      const result = WalkthroughSchema.safeParse({
        id: 'x',
        title: 'X',
        steps: [{ stepId: 's1', title: 'S', instruction: 'Do', annotations: [] }],
        targetHwnd: -1,
      });
      expect(result.success).toBe(false);
    });

    it('WalkthroughSchema.parse rejects targetHwnd of 1.5', () => {
      const result = WalkthroughSchema.safeParse({
        id: 'x',
        title: 'X',
        steps: [{ stepId: 's1', title: 'S', instruction: 'Do', annotations: [] }],
        targetHwnd: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });
});
