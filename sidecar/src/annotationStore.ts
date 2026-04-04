import { z } from 'zod';

/**
 * Zod schema for a single annotation.
 * Supports: box, arrow, text, highlight.
 */
export const AnnotationSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(['box', 'arrow', 'text', 'highlight']),
  x: z.number().int().min(0).max(10000),
  y: z.number().int().min(0).max(10000),
  width: z.number().int().min(0).max(10000).optional(),
  height: z.number().int().min(0).max(10000).optional(),
  label: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Seconds until this annotation auto-expires. 0 = never. */
  ttl: z.number().int().min(0).max(3600).optional(),
  /** Grouping key — clear-group removes all annotations sharing this group. */
  group: z.string().max(100).optional(),
});

/** Raw annotation from Zod parsing */
export type AnnotationBase = z.infer<typeof AnnotationSchema>;

/** Runtime annotation with optional element binding (EAC-1) */
export type Annotation = AnnotationBase & {
  elementBinding?: {
    strategy: 'automationId' | 'nameRole' | 'coordinates';
    automationId?: string;
    name?: string;
    role?: string;
    hwnd?: number;
    offsetX?: number;
    offsetY?: number;
  };
  stale?: boolean;
};

/**
 * Batch annotation payload from an agent.
 * - "set": replace ALL annotations with the provided list.
 * - "merge": upsert annotations by id (add new, update existing).
 * - "clear": remove annotations matching the provided ids.
 * - "clear-group": remove all annotations with the given group.
 * - "clear-all": remove every annotation.
 */
export const AnnotationPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set'),
    annotations: z.array(AnnotationSchema).max(200),
  }),
  z.object({
    action: z.literal('merge'),
    annotations: z.array(AnnotationSchema).max(200),
  }),
  z.object({
    action: z.literal('clear'),
    ids: z.array(z.string().min(1).max(200)).max(200),
  }),
  z.object({
    action: z.literal('clear-group'),
    group: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal('clear-all'),
  }),
]);

export type AnnotationPayload = z.infer<typeof AnnotationPayloadSchema>;

/**
 * In-memory annotation state. Max 200 annotations.
 * Thread-safe for single-threaded Node.js event loop.
 */
class AnnotationState {
  private annotations: Map<string, Annotation & { expiresAt: number | null }> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  apply(payload: AnnotationPayload): Annotation[] {
    switch (payload.action) {
      case 'set': {
        this.clearAllInternal();
        for (const ann of payload.annotations) {
          this.upsert(ann);
        }
        break;
      }
      case 'merge': {
        for (const ann of payload.annotations) {
          this.upsert(ann);
        }
        break;
      }
      case 'clear': {
        for (const id of payload.ids) {
          this.remove(id);
        }
        break;
      }
      case 'clear-group': {
        for (const [id, ann] of this.annotations) {
          if (ann.group === payload.group) {
            this.remove(id);
          }
        }
        break;
      }
      case 'clear-all': {
        this.clearAllInternal();
        break;
      }
    }
    return this.getAll();
  }

  getAll(): Annotation[] {
    return [...this.annotations.values()].map(({ expiresAt, ...rest }) => {
      const ann: Annotation = rest;
      // Include elementBinding and stale if present
      const full = rest as Annotation & { elementBinding?: Annotation['elementBinding']; stale?: boolean };
      if (full.elementBinding) ann.elementBinding = full.elementBinding;
      if (full.stale !== undefined) ann.stale = full.stale;
      return ann;
    });
  }

  private upsert(ann: Annotation): void {
    this.remove(ann.id); // clear old timer if exists
    const ttl = ann.ttl ?? 0;
    const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
    this.annotations.set(ann.id, { ...ann, expiresAt });
    if (ttl > 0) {
      const timer = setTimeout(() => {
        this.annotations.delete(ann.id);
        this.timers.delete(ann.id);
        this._onExpire?.();
      }, ttl * 1000);
      this.timers.set(ann.id, timer);
    }
  }

  private remove(id: string): void {
    this.annotations.delete(id);
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private clearAllInternal(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.annotations.clear();
    this.timers.clear();
  }

  /** EAC-1: Update annotation position (called by ElementTracker) */
  updatePosition(id: string, rect: { x: number; y: number; w: number; h: number }): void {
    const entry = this.annotations.get(id);
    if (!entry) return;
    entry.x = rect.x;
    entry.y = rect.y;
    if (rect.w > 0) entry.width = rect.w;
    if (rect.h > 0) entry.height = rect.h;
  }

  /** EAC-1: Mark an annotation as stale or not */
  setStale(id: string, stale: boolean): void {
    const entry = this.annotations.get(id);
    if (!entry) return;
    (entry as Annotation & { stale?: boolean }).stale = stale;
  }

  /** EAC-1: Set element binding on an annotation */
  setElementBinding(id: string, binding: Annotation['elementBinding']): void {
    const entry = this.annotations.get(id);
    if (!entry) return;
    (entry as Annotation & { elementBinding?: Annotation['elementBinding'] }).elementBinding = binding;
  }

  /** Callback invoked when a TTL expires. Set by server.ts to broadcast updates. */
  _onExpire: (() => void) | undefined;
}

export const annotationState = new AnnotationState();
