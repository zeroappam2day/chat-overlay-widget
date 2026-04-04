import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { annotationState, AnnotationPayloadSchema, AnnotationSchema } from './annotationStore.js';

// Reset state between tests by clearing all annotations
beforeEach(() => {
  vi.useFakeTimers();
  annotationState.apply({ action: 'clear-all' });
  annotationState._onExpire = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AnnotationSchema validation', () => {
  it('rejects missing id', () => {
    expect(() => AnnotationSchema.parse({ type: 'box', x: 0, y: 0 })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => AnnotationSchema.parse({ id: 'a', type: 'circle', x: 0, y: 0 })).toThrow();
  });

  it('rejects x out of range', () => {
    expect(() => AnnotationSchema.parse({ id: 'a', type: 'box', x: -1, y: 0 })).toThrow();
    expect(() => AnnotationSchema.parse({ id: 'a', type: 'box', x: 10001, y: 0 })).toThrow();
  });

  it('rejects invalid color format', () => {
    expect(() => AnnotationSchema.parse({ id: 'a', type: 'box', x: 0, y: 0, color: 'red' })).toThrow();
    expect(() => AnnotationSchema.parse({ id: 'a', type: 'box', x: 0, y: 0, color: '#fff' })).toThrow();
  });

  it('accepts valid color', () => {
    const result = AnnotationSchema.parse({ id: 'a', type: 'box', x: 0, y: 0, color: '#ff3e00' });
    expect(result.color).toBe('#ff3e00');
  });

  it('accepts valid annotation with all fields', () => {
    const result = AnnotationSchema.parse({
      id: 'test1',
      type: 'highlight',
      x: 100,
      y: 200,
      width: 300,
      height: 50,
      label: 'Hello',
      color: '#00ff00',
      ttl: 60,
      group: 'group1',
    });
    expect(result.id).toBe('test1');
    expect(result.type).toBe('highlight');
  });
});

describe('AnnotationPayloadSchema validation', () => {
  it('rejects invalid action', () => {
    expect(() => AnnotationPayloadSchema.parse({ action: 'delete' })).toThrow();
  });

  it('accepts valid set payload', () => {
    const result = AnnotationPayloadSchema.parse({
      action: 'set',
      annotations: [{ id: 'a', type: 'box', x: 0, y: 0 }],
    });
    expect(result.action).toBe('set');
  });

  it('accepts clear-all with no extra fields', () => {
    const result = AnnotationPayloadSchema.parse({ action: 'clear-all' });
    expect(result.action).toBe('clear-all');
  });
});

describe('annotationState — set action', () => {
  it('replaces all annotations', () => {
    annotationState.apply({
      action: 'set',
      annotations: [
        { id: 'a', type: 'box', x: 0, y: 0 },
        { id: 'b', type: 'text', x: 10, y: 10 },
      ],
    });
    expect(annotationState.getAll()).toHaveLength(2);

    const result = annotationState.apply({
      action: 'set',
      annotations: [{ id: 'c', type: 'arrow', x: 5, y: 5 }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
  });
});

describe('annotationState — merge action', () => {
  it('upserts by id without duplicating', () => {
    annotationState.apply({
      action: 'set',
      annotations: [{ id: 'a', type: 'box', x: 0, y: 0, label: 'old' }],
    });

    const result = annotationState.apply({
      action: 'merge',
      annotations: [
        { id: 'a', type: 'box', x: 0, y: 0, label: 'new' },
        { id: 'b', type: 'text', x: 10, y: 10 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result.find(a => a.id === 'a')?.label).toBe('new');
    expect(result.find(a => a.id === 'b')).toBeDefined();
  });
});

describe('annotationState — clear action', () => {
  it('removes specified ids', () => {
    annotationState.apply({
      action: 'set',
      annotations: [
        { id: 'a', type: 'box', x: 0, y: 0 },
        { id: 'b', type: 'box', x: 0, y: 0 },
        { id: 'c', type: 'box', x: 0, y: 0 },
      ],
    });

    const result = annotationState.apply({ action: 'clear', ids: ['a', 'c'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });
});

describe('annotationState — clear-group action', () => {
  it('removes all annotations with matching group', () => {
    annotationState.apply({
      action: 'set',
      annotations: [
        { id: 'a', type: 'box', x: 0, y: 0, group: 'g1' },
        { id: 'b', type: 'box', x: 0, y: 0, group: 'g1' },
        { id: 'c', type: 'box', x: 0, y: 0, group: 'g2' },
        { id: 'd', type: 'box', x: 0, y: 0 },
      ],
    });

    const result = annotationState.apply({ action: 'clear-group', group: 'g1' });
    expect(result).toHaveLength(2);
    expect(result.map(a => a.id).sort()).toEqual(['c', 'd']);
  });
});

describe('annotationState — clear-all action', () => {
  it('removes every annotation', () => {
    annotationState.apply({
      action: 'set',
      annotations: [
        { id: 'a', type: 'box', x: 0, y: 0 },
        { id: 'b', type: 'box', x: 0, y: 0 },
      ],
    });

    const result = annotationState.apply({ action: 'clear-all' });
    expect(result).toHaveLength(0);
  });
});

describe('annotationState — TTL expiry', () => {
  it('removes annotation after TTL expires', () => {
    const onExpire = vi.fn();
    annotationState._onExpire = onExpire;

    annotationState.apply({
      action: 'set',
      annotations: [{ id: 'temp', type: 'box', x: 0, y: 0, ttl: 1 }],
    });
    expect(annotationState.getAll()).toHaveLength(1);

    vi.advanceTimersByTime(1000);

    expect(annotationState.getAll()).toHaveLength(0);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('clears timer when annotation is removed before TTL', () => {
    annotationState.apply({
      action: 'set',
      annotations: [{ id: 'temp', type: 'box', x: 0, y: 0, ttl: 10 }],
    });

    annotationState.apply({ action: 'clear', ids: ['temp'] });
    expect(annotationState.getAll()).toHaveLength(0);

    // Advancing time should not cause issues
    vi.advanceTimersByTime(10000);
    expect(annotationState.getAll()).toHaveLength(0);
  });
});

describe('annotationState — max 200 annotations', () => {
  it('rejects payload with more than 200 annotations', () => {
    const annotations = Array.from({ length: 201 }, (_, i) => ({
      id: `ann-${i}`,
      type: 'box' as const,
      x: 0,
      y: 0,
    }));

    expect(() =>
      AnnotationPayloadSchema.parse({ action: 'set', annotations })
    ).toThrow();
  });

  it('accepts exactly 200 annotations', () => {
    const annotations = Array.from({ length: 200 }, (_, i) => ({
      id: `ann-${i}`,
      type: 'box' as const,
      x: 0,
      y: 0,
    }));

    const result = AnnotationPayloadSchema.parse({ action: 'set', annotations });
    expect(result.action).toBe('set');
  });
});
