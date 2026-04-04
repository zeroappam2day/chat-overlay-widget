import { z } from 'zod';
/**
 * Zod schema for a single annotation.
 * Supports: box, arrow, text, highlight.
 */
export declare const AnnotationSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["box", "arrow", "text", "highlight"]>;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    label: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    /** Seconds until this annotation auto-expires. 0 = never. */
    ttl: z.ZodOptional<z.ZodNumber>;
    /** Grouping key — clear-group removes all annotations sharing this group. */
    group: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "box" | "arrow" | "text" | "highlight";
    id: string;
    x: number;
    y: number;
    width?: number | undefined;
    height?: number | undefined;
    label?: string | undefined;
    color?: string | undefined;
    ttl?: number | undefined;
    group?: string | undefined;
}, {
    type: "box" | "arrow" | "text" | "highlight";
    id: string;
    x: number;
    y: number;
    width?: number | undefined;
    height?: number | undefined;
    label?: string | undefined;
    color?: string | undefined;
    ttl?: number | undefined;
    group?: string | undefined;
}>;
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
export declare const AnnotationPayloadSchema: z.ZodDiscriminatedUnion<"action", [z.ZodObject<{
    action: z.ZodLiteral<"set">;
    annotations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["box", "arrow", "text", "highlight"]>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        label: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        /** Seconds until this annotation auto-expires. 0 = never. */
        ttl: z.ZodOptional<z.ZodNumber>;
        /** Grouping key — clear-group removes all annotations sharing this group. */
        group: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }, {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    action: "set";
    annotations: {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }[];
}, {
    action: "set";
    annotations: {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }[];
}>, z.ZodObject<{
    action: z.ZodLiteral<"merge">;
    annotations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["box", "arrow", "text", "highlight"]>;
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        label: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        /** Seconds until this annotation auto-expires. 0 = never. */
        ttl: z.ZodOptional<z.ZodNumber>;
        /** Grouping key — clear-group removes all annotations sharing this group. */
        group: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }, {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    action: "merge";
    annotations: {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }[];
}, {
    action: "merge";
    annotations: {
        type: "box" | "arrow" | "text" | "highlight";
        id: string;
        x: number;
        y: number;
        width?: number | undefined;
        height?: number | undefined;
        label?: string | undefined;
        color?: string | undefined;
        ttl?: number | undefined;
        group?: string | undefined;
    }[];
}>, z.ZodObject<{
    action: z.ZodLiteral<"clear">;
    ids: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    action: "clear";
    ids: string[];
}, {
    action: "clear";
    ids: string[];
}>, z.ZodObject<{
    action: z.ZodLiteral<"clear-group">;
    group: z.ZodString;
}, "strip", z.ZodTypeAny, {
    group: string;
    action: "clear-group";
}, {
    group: string;
    action: "clear-group";
}>, z.ZodObject<{
    action: z.ZodLiteral<"clear-all">;
}, "strip", z.ZodTypeAny, {
    action: "clear-all";
}, {
    action: "clear-all";
}>]>;
export type AnnotationPayload = z.infer<typeof AnnotationPayloadSchema>;
/**
 * In-memory annotation state. Max 200 annotations.
 * Thread-safe for single-threaded Node.js event loop.
 */
declare class AnnotationState {
    private annotations;
    private timers;
    apply(payload: AnnotationPayload): Annotation[];
    getAll(): Annotation[];
    private upsert;
    private remove;
    private clearAllInternal;
    /** EAC-1: Update annotation position (called by ElementTracker) */
    updatePosition(id: string, rect: {
        x: number;
        y: number;
        w: number;
        h: number;
    }): void;
    /** EAC-1: Mark an annotation as stale or not */
    setStale(id: string, stale: boolean): void;
    /** EAC-1: Set element binding on an annotation */
    setElementBinding(id: string, binding: Annotation['elementBinding']): void;
    /** Callback invoked when a TTL expires. Set by server.ts to broadcast updates. */
    _onExpire: (() => void) | undefined;
}
export declare const annotationState: AnnotationState;
export {};
