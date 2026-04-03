---
phase: quick
plan: 260403-mgs
subsystem: zoom
tags: [zoom, feature-flag, keyboard-shortcuts, accessibility]
dependency_graph:
  requires: []
  provides: [ctrlWheelZoom feature flag, document-level zoom scaling, zoom persistence]
  affects: [PaneContainer, useShortcuts, usePersistence, featureFlagStore, FeatureFlagPanel]
tech_stack:
  added: [src/lib/wheelZoom.ts, src/hooks/useZoom.ts, src/styles/zoom.css]
  patterns: [custom-event-dispatch, useRef-for-mutable-state, localStorage-persistence]
key_files:
  created:
    - src/lib/wheelZoom.ts
    - src/hooks/useZoom.ts
    - src/styles/zoom.css
  modified:
    - src/store/featureFlagStore.ts
    - src/components/FeatureFlagPanel.tsx
    - src/components/PaneContainer.tsx
    - src/hooks/useShortcuts.ts
    - src/hooks/usePersistence.ts
decisions:
  - "useRef<ZoomState> holds mutable zoom state to avoid re-renders on every wheel tick"
  - "Custom events zoom-reset/zoom-in/zoom-out bridge useShortcuts to useZoom (same pattern as keyboard-request-diff, toggle-prompt-history)"
  - "processZoomWheel returns null for no-op cases (no Ctrl, steps=0) to avoid redundant DOM updates"
  - "Flag OFF resets zoom to 100% and removes localStorage key to clean up state"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_changed: 8
---

# Phase quick Plan 260403-mgs: Ctrl+Wheel Zoom Summary

**One-liner:** Ctrl+Wheel zoom (70-150% in 5% steps) via root font-size scaling with xterm.js isolation, feature flag, keyboard shortcuts, and localStorage persistence.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create zoom utility, hook, and CSS | e8105aa | src/lib/wheelZoom.ts, src/hooks/useZoom.ts, src/styles/zoom.css |
| 2 | Integrate zoom into feature flags, PaneContainer, useShortcuts, persistence | 7329f9a | 5 files modified |

## What Was Built

### New Files

**src/lib/wheelZoom.ts** — Pure TypeScript utility with no React dependency. Exports `ZoomState`, `createZoomState`, and `processZoomWheel`. Handles deltaMode conversion (pixel/line/page), remainder accumulation for smooth zoom feel, and clamping to 70-150% range.

**src/hooks/useZoom.ts** — React hook called once in PaneContainer. Attaches `wheel` event listener with `{ passive: false }` to call `e.preventDefault()` and suppress browser native zoom. Responds to custom events `zoom-reset`, `zoom-in`, `zoom-out` dispatched by useShortcuts. Persists scale to `chat-overlay-zoom-scale` in localStorage. Resets to 100% and clears storage when `ctrlWheelZoom` flag is turned off.

**src/styles/zoom.css** — Isolates xterm.js terminal and `.zoom-exempt` elements from root font-size scaling via `font-size: initial !important`.

### Integration Edits

- **featureFlagStore.ts:** `ctrlWheelZoom: boolean` added to interface and defaults (`true`), included in localStorage serialization
- **FeatureFlagPanel.tsx:** `ctrlWheelZoom: 'Ctrl+Wheel Zoom'` label added to FLAG_LABELS
- **PaneContainer.tsx:** `useZoom()` called after `usePersistence()`, `zoom.css` imported
- **useShortcuts.ts:** Three new shortcuts — Ctrl+0 (zoom-reset), Ctrl+= (zoom-in), Ctrl+- (zoom-out) — gated behind `ctrlWheelZoom` flag check
- **usePersistence.ts:** `ctrlWheelZoom: flags.ctrlWheelZoom` added to `gatherState` featureFlags object

## Decisions Made

1. **useRef for mutable zoom state:** Avoids re-renders on every wheel tick. The hook manages DOM side effects directly without React state.
2. **Custom events bridge:** `zoom-reset/zoom-in/zoom-out` custom events let useShortcuts dispatch to useZoom without coupling — same pattern as `keyboard-request-diff` and `toggle-prompt-history` already in useShortcuts.
3. **processZoomWheel null returns:** Returns null when Ctrl not held or steps=0, preventing redundant `style.fontSize` DOM mutations.
4. **Flag OFF resets completely:** Removes wheel listener, resets font-size to 100%, and clears localStorage key — clean state with no residue.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — zoom is fully wired end-to-end.

## Self-Check: PASSED

- [x] src/lib/wheelZoom.ts exists and exports ZoomState/createZoomState/processZoomWheel
- [x] src/hooks/useZoom.ts exists and exports useZoom
- [x] src/styles/zoom.css exists with xterm isolation rules
- [x] Commits e8105aa and 7329f9a exist
- [x] TypeScript compiles with zero errors (npx tsc --noEmit)
