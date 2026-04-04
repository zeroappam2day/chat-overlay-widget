import { useRef, useEffect } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  '[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(isOpen: boolean): React.RefObject<HTMLDivElement> {
  const containerRef = useRef<HTMLDivElement>(null!);
  const previousFocusRef = useRef<Element | null>(null);
  const enabled = useFeatureFlagStore((s) => s.focusTrap);

  useEffect(() => {
    if (!isOpen || !enabled) return;

    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables = container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, enabled]);

  return containerRef;
}
