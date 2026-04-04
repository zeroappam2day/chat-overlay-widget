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

export class ElementTracker {
  private pollIntervalMs: number;
  private bindings = new Map<string, ElementBinding>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private getAnnotations: () => Annotation[];
  private updateAnnotation: (id: string, rect: { x: number; y: number; w: number; h: number }) => void;
  private markStale: (id: string, stale: boolean) => void;
  private getUiElementsFn: (hwnd: number, opts?: { maxDepth?: number; roleFilter?: string[] }) => UiElement[];

  onPositionsUpdated: ((annotations: Annotation[]) => void) | undefined;

  constructor(opts: {
    pollIntervalMs?: number;
    getAnnotations: () => Annotation[];
    updateAnnotation: (id: string, rect: { x: number; y: number; w: number; h: number }) => void;
    markStale: (id: string, stale: boolean) => void;
    getUiElements: (hwnd: number, opts?: { maxDepth?: number; roleFilter?: string[] }) => UiElement[];
  }) {
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    this.getAnnotations = opts.getAnnotations;
    this.updateAnnotation = opts.updateAnnotation;
    this.markStale = opts.markStale;
    this.getUiElementsFn = opts.getUiElements;
  }

  start(): void {
    if (this.timer) return;
    if (this.bindings.size === 0) return;
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  bindAnnotation(annotationId: string, binding: ElementBinding): void {
    this.bindings.set(annotationId, binding);
    if (this.bindings.size === 1 && !this.timer) {
      this.start();
    }
  }

  unbindAnnotation(annotationId: string): void {
    this.bindings.delete(annotationId);
    if (this.bindings.size === 0) {
      this.stop();
    }
  }

  getBindings(): Map<string, ElementBinding> {
    return this.bindings;
  }

  private poll(): void {
    if (this.bindings.size === 0) {
      this.stop();
      return;
    }

    let changed = false;

    for (const [annotationId, binding] of this.bindings) {
      if (!binding.hwnd) {
        this.markStale(annotationId, true);
        changed = true;
        continue;
      }

      try {
        const roleFilter = binding.strategy === 'nameRole' && binding.role ? [binding.role] : undefined;
        const elements = this.getUiElementsFn(binding.hwnd, { maxDepth: 3, roleFilter });
        const match = this.findElement(elements, binding);

        if (match) {
          const rect = match.boundingRect;
          const x = rect.x + (binding.offsetX ?? 0);
          const y = rect.y + (binding.offsetY ?? 0);
          this.updateAnnotation(annotationId, { x, y, w: rect.w, h: rect.h });
          this.markStale(annotationId, false);
          changed = true;
        } else {
          this.markStale(annotationId, true);
          changed = true;
        }
      } catch {
        this.markStale(annotationId, true);
        changed = true;
      }
    }

    if (changed && this.onPositionsUpdated) {
      this.onPositionsUpdated(this.getAnnotations());
    }
  }

  private findElement(elements: UiElement[], binding: ElementBinding): UiElement | null {
    for (const el of elements) {
      if (this.matches(el, binding)) return el;
      if (el.children && el.children.length > 0) {
        const child = this.findElement(el.children, binding);
        if (child) return child;
      }
    }
    return null;
  }

  private matches(el: UiElement, binding: ElementBinding): boolean {
    switch (binding.strategy) {
      case 'automationId':
        return !!binding.automationId && el.automationId === binding.automationId;
      case 'nameRole':
        return (
          (binding.name ? el.name === binding.name : true) &&
          (binding.role ? el.role === binding.role : true) &&
          (!!binding.name || !!binding.role)
        );
      case 'coordinates':
        // Coordinates strategy: element found at same hwnd is enough
        return el.boundingRect.w > 0 && el.boundingRect.h > 0;
      default:
        return false;
    }
  }
}
