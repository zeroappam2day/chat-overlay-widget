/**
 * Ctrl+Wheel zoom handler.
 * Adapted from parallel-code/src/lib/wheelZoom.ts
 *
 * Constants:
 *   ZOOM_STEP_PX = 100    — wheel delta pixels per zoom step
 *   MIN_SCALE = 0.7       — minimum zoom (70%)
 *   MAX_SCALE = 1.5       — maximum zoom (150%)
 *   STEP_SIZE = 0.05      — 5% per step
 *
 * Accumulates wheel delta (handling line/page deltaMode conversion).
 * Each 100px of accumulated delta = one zoom step (±5%).
 * Remainder carries forward for smooth feel.
 *
 * Direction: positive deltaY (scroll down) = zoom out, negative = zoom in.
 *
 * Does NOT zoom xterm.js terminals. The root font-size is adjusted via
 * document.documentElement.style.fontSize. The xterm.js Terminal manages
 * its own font size via FitAddon. The zoom.css file resets .xterm font-size.
 */

export interface ZoomState {
  scale: number;
  remainder: number;
}

export function createZoomState(initialScale?: number): ZoomState {
  return { scale: initialScale ?? 1.0, remainder: 0 };
}

/**
 * Process a wheel event and return updated zoom state.
 * Returns null if the event should not be handled (no Ctrl key, etc.).
 */
export function processZoomWheel(
  e: WheelEvent,
  state: ZoomState,
): ZoomState | null {
  if (!e.ctrlKey || e.shiftKey || e.altKey) return null;

  const ZOOM_STEP_PX = 100;
  const MIN_SCALE = 0.7;
  const MAX_SCALE = 1.5;
  const STEP_SIZE = 0.05;

  // Convert deltaMode: 0=pixel, 1=line (40px), 2=page (800px)
  const multiplier = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
  const deltaPx = e.deltaY * multiplier;

  const accumulated = state.remainder + deltaPx;
  const steps = Math.trunc(accumulated / ZOOM_STEP_PX);

  if (steps === 0) {
    return { scale: state.scale, remainder: accumulated };
  }

  const remainder = accumulated - steps * ZOOM_STEP_PX;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale - steps * STEP_SIZE));

  return { scale: newScale, remainder };
}
