"use strict";
/**
 * EAC-1: Element-Bound Annotations
 * Periodically re-queries UI Automation for bound elements and updates annotation positions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElementTracker = void 0;
class ElementTracker {
    constructor(opts) {
        this.bindings = new Map();
        this.timer = null;
        this.pollIntervalMs = opts.pollIntervalMs ?? 500;
        this.getAnnotations = opts.getAnnotations;
        this.updateAnnotation = opts.updateAnnotation;
        this.markStale = opts.markStale;
        this.getUiElementsFn = opts.getUiElements;
    }
    start() {
        if (this.timer)
            return;
        if (this.bindings.size === 0)
            return;
        this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    bindAnnotation(annotationId, binding) {
        this.bindings.set(annotationId, binding);
        if (this.bindings.size === 1 && !this.timer) {
            this.start();
        }
    }
    unbindAnnotation(annotationId) {
        this.bindings.delete(annotationId);
        if (this.bindings.size === 0) {
            this.stop();
        }
    }
    getBindings() {
        return this.bindings;
    }
    poll() {
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
                }
                else {
                    this.markStale(annotationId, true);
                    changed = true;
                }
            }
            catch {
                this.markStale(annotationId, true);
                changed = true;
            }
        }
        if (changed && this.onPositionsUpdated) {
            this.onPositionsUpdated(this.getAnnotations());
        }
    }
    findElement(elements, binding) {
        for (const el of elements) {
            if (this.matches(el, binding))
                return el;
            if (el.children && el.children.length > 0) {
                const child = this.findElement(el.children, binding);
                if (child)
                    return child;
            }
        }
        return null;
    }
    matches(el, binding) {
        switch (binding.strategy) {
            case 'automationId':
                return !!binding.automationId && el.automationId === binding.automationId;
            case 'nameRole':
                return ((binding.name ? el.name === binding.name : true) &&
                    (binding.role ? el.role === binding.role : true) &&
                    (!!binding.name || !!binding.role));
            case 'coordinates':
                // Coordinates strategy: element found at same hwnd is enough
                return el.boundingRect.w > 0 && el.boundingRect.h > 0;
            default:
                return false;
        }
    }
}
exports.ElementTracker = ElementTracker;
