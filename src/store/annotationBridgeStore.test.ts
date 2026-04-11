import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(() => Promise.resolve()),
}));

// Mock overlayStore
const showOverlay = vi.fn(() => Promise.resolve());
const hideOverlay = vi.fn(() => Promise.resolve());
vi.mock('./overlayStore', () => ({
  useOverlayStore: {
    getState: () => ({ showOverlay, hideOverlay }),
  },
}));

// Mock featureFlagStore - default: guidedWalkthrough enabled
let guidedWalkthrough = true;
vi.mock('./featureFlagStore', () => ({
  useFeatureFlagStore: {
    getState: () => ({ guidedWalkthrough }),
  },
}));

import { useAnnotationBridgeStore } from './annotationBridgeStore';
import { emit } from '@tauri-apps/api/event';

beforeEach(() => {
  vi.clearAllMocks();
  guidedWalkthrough = true;
});

describe('annotationBridgeStore - setWalkthroughStep', () => {
  const sampleStep = {
    stepId: 's1',
    title: 'Test Step',
    instruction: 'Do something',
    currentStep: 1,
    totalSteps: 3,
  };

  it('calls showOverlay when step is non-null', async () => {
    useAnnotationBridgeStore.getState().setWalkthroughStep(sampleStep);
    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 10));
    expect(showOverlay).toHaveBeenCalledOnce();
    expect(hideOverlay).not.toHaveBeenCalled();
  });

  it('calls hideOverlay when step is null', async () => {
    useAnnotationBridgeStore.getState().setWalkthroughStep(null);
    await new Promise((r) => setTimeout(r, 10));
    expect(hideOverlay).toHaveBeenCalledOnce();
    expect(showOverlay).not.toHaveBeenCalled();
  });

  it('does NOT call showOverlay or hideOverlay when guidedWalkthrough is false', async () => {
    guidedWalkthrough = false;
    useAnnotationBridgeStore.getState().setWalkthroughStep(sampleStep);
    useAnnotationBridgeStore.getState().setWalkthroughStep(null);
    await new Promise((r) => setTimeout(r, 10));
    expect(showOverlay).not.toHaveBeenCalled();
    expect(hideOverlay).not.toHaveBeenCalled();
  });

  it('still emits update-walkthrough-step event for non-null step', async () => {
    useAnnotationBridgeStore.getState().setWalkthroughStep(sampleStep);
    await new Promise((r) => setTimeout(r, 10));
    expect(emit).toHaveBeenCalledWith('update-walkthrough-step', sampleStep);
  });
});
