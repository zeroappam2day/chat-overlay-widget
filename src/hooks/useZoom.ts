/**
 * React hook that attaches a Ctrl+Wheel zoom listener to the document.
 * Reads ctrlWheelZoom flag — if OFF, no listener attached and zoom resets.
 *
 * Applies zoom by setting root font-size on document.documentElement.
 * Persists scale to localStorage under 'chat-overlay-zoom-scale'.
 *
 * Usage: call useZoom() once in PaneContainer.
 *
 * Zoom applies to:
 *   - All UI text (via root font-size scaling)
 *   - Panel headers, buttons, labels
 *
 * Zoom does NOT apply to:
 *   - xterm.js Terminal (has its own font size management via FitAddon)
 *     Isolation provided by zoom.css: .xterm { font-size: initial !important; }
 *   - Elements with class .zoom-exempt
 *
 * Keyboard events 'zoom-reset', 'zoom-in', 'zoom-out' dispatched by
 * useShortcuts.ts are handled here for Ctrl+0/=/- support.
 */

import { useEffect, useRef } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { createZoomState, processZoomWheel, type ZoomState } from '../lib/wheelZoom';

const STORAGE_KEY = 'chat-overlay-zoom-scale';
const STEP_SIZE = 0.05;
const MIN_SCALE = 0.7;
const MAX_SCALE = 1.5;

function applyScale(scale: number): void {
  document.documentElement.style.fontSize = `${scale * 100}%`;
}

function persistScale(scale: number): void {
  localStorage.setItem(STORAGE_KEY, String(scale));
}

function loadPersistedScale(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed) && parsed >= MIN_SCALE && parsed <= MAX_SCALE) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return 1.0;
}

export function useZoom(): void {
  const enabled = useFeatureFlagStore((s) => s.ctrlWheelZoom);
  const stateRef = useRef<ZoomState>(createZoomState(loadPersistedScale()));

  // Apply persisted scale on mount
  useEffect(() => {
    applyScale(stateRef.current.scale);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Reset zoom when flag is turned off
      stateRef.current = createZoomState(1.0);
      applyScale(1.0);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Restore persisted scale when flag is turned on
    const persisted = loadPersistedScale();
    stateRef.current = createZoomState(persisted);
    applyScale(persisted);

    function handleWheel(e: WheelEvent): void {
      const result = processZoomWheel(e, stateRef.current);
      if (result === null) return;
      e.preventDefault();
      stateRef.current = result;
      applyScale(result.scale);
      persistScale(result.scale);
    }

    function handleZoomReset(): void {
      if (!useFeatureFlagStore.getState().ctrlWheelZoom) return;
      stateRef.current = createZoomState(1.0);
      applyScale(1.0);
      persistScale(1.0);
    }

    function handleZoomIn(): void {
      if (!useFeatureFlagStore.getState().ctrlWheelZoom) return;
      const newScale = Math.min(MAX_SCALE, parseFloat((stateRef.current.scale + STEP_SIZE).toFixed(10)));
      stateRef.current = { scale: newScale, remainder: 0 };
      applyScale(newScale);
      persistScale(newScale);
    }

    function handleZoomOut(): void {
      if (!useFeatureFlagStore.getState().ctrlWheelZoom) return;
      const newScale = Math.max(MIN_SCALE, parseFloat((stateRef.current.scale - STEP_SIZE).toFixed(10)));
      stateRef.current = { scale: newScale, remainder: 0 };
      applyScale(newScale);
      persistScale(newScale);
    }

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('zoom-reset', handleZoomReset);
    document.addEventListener('zoom-in', handleZoomIn);
    document.addEventListener('zoom-out', handleZoomOut);

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('zoom-reset', handleZoomReset);
      document.removeEventListener('zoom-in', handleZoomIn);
      document.removeEventListener('zoom-out', handleZoomOut);
    };
  }, [enabled]);
}
