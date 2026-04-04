/**
 * EAC-1: Element-Bound Annotations
 * Periodically re-queries UI Automation for bound elements and updates annotation positions.
 */
import type { Annotation } from './annotationStore.js';
import type { UiElement } from './uiAutomation.js';
export interface ElementBinding {
    strategy: 'automationId' | 'nameRole' | 'coordinates';
    automationId?: string;
    name?: string;
    role?: string;
    hwnd?: number;
    offsetX?: number;
    offsetY?: number;
}
export interface BoundAnnotation {
    annotationId: string;
    binding: ElementBinding;
}
export declare class ElementTracker {
    private pollIntervalMs;
    private bindings;
    private timer;
    private getAnnotations;
    private updateAnnotation;
    private markStale;
    private getUiElementsFn;
    onPositionsUpdated: ((annotations: Annotation[]) => void) | undefined;
    constructor(opts: {
        pollIntervalMs?: number;
        getAnnotations: () => Annotation[];
        updateAnnotation: (id: string, rect: {
            x: number;
            y: number;
            w: number;
            h: number;
        }) => void;
        markStale: (id: string, stale: boolean) => void;
        getUiElements: (hwnd: number, opts?: {
            maxDepth?: number;
            roleFilter?: string[];
        }) => UiElement[];
    });
    start(): void;
    stop(): void;
    bindAnnotation(annotationId: string, binding: ElementBinding): void;
    unbindAnnotation(annotationId: string): void;
    getBindings(): Map<string, ElementBinding>;
    private poll;
    private findElement;
    private matches;
}
