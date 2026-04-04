import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElementTracker } from './elementTracker.js';
import type { UiElement } from './uiAutomation.js';
import type { Annotation } from './annotationStore.js';

function makeElement(overrides: Partial<UiElement> = {}): UiElement {
  return {
    name: 'TestElement',
    role: 'Button',
    boundingRect: { x: 100, y: 200, w: 80, h: 30 },
    automationId: 'btn1',
    isEnabled: true,
    isOffscreen: false,
    children: [],
    ...overrides,
  };
}

describe('ElementTracker', () => {
  let annotations: Map<string, Annotation>;
  let staleMap: Map<string, boolean>;
  let mockGetUiElements: ReturnType<typeof vi.fn>;
  let tracker: ElementTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    annotations = new Map();
    staleMap = new Map();
    mockGetUiElements = vi.fn().mockReturnValue([makeElement()]);

    tracker = new ElementTracker({
      pollIntervalMs: 500,
      getAnnotations: () => [...annotations.values()],
      updateAnnotation: (id, rect) => {
        const ann = annotations.get(id);
        if (ann) {
          ann.x = rect.x;
          ann.y = rect.y;
          if (rect.w > 0) ann.width = rect.w;
          if (rect.h > 0) ann.height = rect.h;
        }
      },
      markStale: (id, stale) => {
        staleMap.set(id, stale);
      },
      getUiElements: mockGetUiElements,
    });
  });

  afterEach(() => {
    tracker.stop();
    vi.useRealTimers();
  });

  it('should not start polling when no bindings exist', () => {
    tracker.start();
    vi.advanceTimersByTime(1000);
    expect(mockGetUiElements).not.toHaveBeenCalled();
  });

  it('should start polling when a binding is added', () => {
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    expect(mockGetUiElements).toHaveBeenCalledWith(12345, { maxDepth: 3, roleFilter: undefined });
  });

  it('should update annotation position from element bounding rect', () => {
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0, width: 10, height: 10 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    const ann = annotations.get('ann1')!;
    expect(ann.x).toBe(100);
    expect(ann.y).toBe(200);
    expect(ann.width).toBe(80);
    expect(ann.height).toBe(30);
  });

  it('should apply offsets to position', () => {
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
      offsetX: 10,
      offsetY: 20,
    });
    vi.advanceTimersByTime(500);
    const ann = annotations.get('ann1')!;
    expect(ann.x).toBe(110);
    expect(ann.y).toBe(220);
  });

  it('should mark annotation stale when element not found', () => {
    mockGetUiElements.mockReturnValue([makeElement({ automationId: 'otherBtn' })]);
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    expect(staleMap.get('ann1')).toBe(true);
  });

  it('should clear stale when element reappears', () => {
    mockGetUiElements.mockReturnValueOnce([makeElement({ automationId: 'otherBtn' })]);
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    expect(staleMap.get('ann1')).toBe(true);

    mockGetUiElements.mockReturnValueOnce([makeElement({ automationId: 'btn1' })]);
    vi.advanceTimersByTime(500);
    expect(staleMap.get('ann1')).toBe(false);
  });

  it('should stop polling when all bindings are removed', () => {
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    expect(mockGetUiElements).toHaveBeenCalledTimes(1);

    tracker.unbindAnnotation('ann1');
    vi.advanceTimersByTime(1000);
    // Should not have been called again after unbind
    expect(mockGetUiElements).toHaveBeenCalledTimes(1);
  });

  it('should match by nameRole strategy', () => {
    mockGetUiElements.mockReturnValue([makeElement({ name: 'Save', role: 'Button', automationId: '' })]);
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'nameRole',
      name: 'Save',
      role: 'Button',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    expect(staleMap.get('ann1')).toBe(false);
    expect(annotations.get('ann1')!.x).toBe(100);
  });

  it('should search children for matching elements', () => {
    const parent = makeElement({
      automationId: 'container',
      role: 'Pane',
      children: [makeElement({ automationId: 'btn1', boundingRect: { x: 300, y: 400, w: 50, h: 25 } })],
    });
    mockGetUiElements.mockReturnValue([parent]);
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    expect(annotations.get('ann1')!.x).toBe(300);
    expect(annotations.get('ann1')!.y).toBe(400);
  });

  it('should mark stale when hwnd is missing', () => {
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      // no hwnd
    });
    vi.advanceTimersByTime(500);
    expect(staleMap.get('ann1')).toBe(true);
  });

  it('should fire onPositionsUpdated callback', () => {
    const callback = vi.fn();
    tracker.onPositionsUpdated = callback;
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'ann1' })]));
  });

  it('should handle getUiElements throwing', () => {
    mockGetUiElements.mockImplementation(() => { throw new Error('PowerShell failed'); });
    annotations.set('ann1', { id: 'ann1', type: 'box', x: 0, y: 0 });
    tracker.bindAnnotation('ann1', {
      strategy: 'automationId',
      automationId: 'btn1',
      hwnd: 12345,
    });
    // Should not throw
    vi.advanceTimersByTime(500);
    expect(staleMap.get('ann1')).toBe(true);
  });
});
