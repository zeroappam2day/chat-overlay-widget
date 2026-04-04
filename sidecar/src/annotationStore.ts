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

export type Annotation = z.infer<typeof AnnotationSchema>;

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
    return [...this.annotations.values()].map(({ expiresAt, ...rest }) => rest);
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

  /** Callback invoked when a TTL expires. Set by server.ts to broadcast updates. */
  _onExpire: (() => void) | undefined;
}

export const annotationState = new AnnotationState();
