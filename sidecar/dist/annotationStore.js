"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.annotationState = exports.AnnotationPayloadSchema = exports.AnnotationSchema = void 0;
const zod_1 = require("zod");
/**
 * Zod schema for a single annotation.
 * Supports: box, arrow, text, highlight.
 */
exports.AnnotationSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(200),
    type: zod_1.z.enum(['box', 'arrow', 'text', 'highlight']),
    x: zod_1.z.number().int().min(0).max(10000),
    y: zod_1.z.number().int().min(0).max(10000),
    width: zod_1.z.number().int().min(0).max(10000).optional(),
    height: zod_1.z.number().int().min(0).max(10000).optional(),
    label: zod_1.z.string().max(500).optional(),
    color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    /** Seconds until this annotation auto-expires. 0 = never. */
    ttl: zod_1.z.number().int().min(0).max(3600).optional(),
    /** Grouping key — clear-group removes all annotations sharing this group. */
    group: zod_1.z.string().max(100).optional(),
});
/**
 * Batch annotation payload from an agent.
 * - "set": replace ALL annotations with the provided list.
 * - "merge": upsert annotations by id (add new, update existing).
 * - "clear": remove annotations matching the provided ids.
 * - "clear-group": remove all annotations with the given group.
 * - "clear-all": remove every annotation.
 */
exports.AnnotationPayloadSchema = zod_1.z.discriminatedUnion('action', [
    zod_1.z.object({
        action: zod_1.z.literal('set'),
        annotations: zod_1.z.array(exports.AnnotationSchema).max(200),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('merge'),
        annotations: zod_1.z.array(exports.AnnotationSchema).max(200),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('clear'),
        ids: zod_1.z.array(zod_1.z.string().min(1).max(200)).max(200),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('clear-group'),
        group: zod_1.z.string().min(1).max(100),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('clear-all'),
    }),
]);
/**
 * In-memory annotation state. Max 200 annotations.
 * Thread-safe for single-threaded Node.js event loop.
 */
class AnnotationState {
    constructor() {
        this.annotations = new Map();
        this.timers = new Map();
    }
    apply(payload) {
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
    getAll() {
        return [...this.annotations.values()].map(({ expiresAt, ...rest }) => {
            const ann = rest;
            // Include elementBinding and stale if present
            const full = rest;
            if (full.elementBinding)
                ann.elementBinding = full.elementBinding;
            if (full.stale !== undefined)
                ann.stale = full.stale;
            return ann;
        });
    }
    upsert(ann) {
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
    remove(id) {
        this.annotations.delete(id);
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }
    }
    clearAllInternal() {
        for (const timer of this.timers.values())
            clearTimeout(timer);
        this.annotations.clear();
        this.timers.clear();
    }
    /** EAC-1: Update annotation position (called by ElementTracker) */
    updatePosition(id, rect) {
        const entry = this.annotations.get(id);
        if (!entry)
            return;
        entry.x = rect.x;
        entry.y = rect.y;
        if (rect.w > 0)
            entry.width = rect.w;
        if (rect.h > 0)
            entry.height = rect.h;
    }
    /** EAC-1: Mark an annotation as stale or not */
    setStale(id, stale) {
        const entry = this.annotations.get(id);
        if (!entry)
            return;
        entry.stale = stale;
    }
    /** EAC-1: Set element binding on an annotation */
    setElementBinding(id, binding) {
        const entry = this.annotations.get(id);
        if (!entry)
            return;
        entry.elementBinding = binding;
    }
}
exports.annotationState = new AnnotationState();
