---
phase: 10-split-pane-preservation
plan: 01
subsystem: frontend
tags: [react, xterm, pane-layout, zustand, flat-render, css-visibility]
dependency_graph:
  requires: []
  provides: [flat-render-pane-container, pane-store-selectors, pane-store-tests]
  affects: [PaneContainer, paneStore, TerminalPane stability]
tech_stack:
  added: []
  patterns:
    - CSS visibility flat-render (TerminalPane as stable flat siblings, absolutely positioned)
    - usePanelRects hook (ResizeObserver tracks Panel placeholder rects relative to container)
    - onLayoutChanged with size-change guard (>0.5% threshold prevents initial-mount overwrite)
    - Counter-based ID suffix to prevent Date.now() collision on rapid splits
key_files:
  created:
    - src/store/paneStore.test.ts
  modified:
    - src/store/paneStore.ts
    - src/components/PaneContainer.tsx
decisions:
  - react-resizable-panels v4 uses onLayoutChanged(Layout map {[id]:number}) not onLayout(number[]) — adapted to Panel id= prop + map-to-array conversion
  - Counter suffix on pane/split IDs (Date.now() alone collides in rapid test execution)
  - onLayoutChanged chosen over onLayoutChange (called after stable, not during drag)
metrics:
  duration: ~5 minutes
  completed: 2026-03-30T04:23:29Z
  tasks_completed: 2
  files_modified: 3
---

# Phase 10 Plan 01: Flat-Render PaneContainer with paneStore Tests Summary

CSS visibility flat-render refactor of PaneContainer preventing xterm.js Terminal destruction on split, with onLayoutChanged panel size persistence and 7 paneStore unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Export getAllPaneIds + splitInTree, add unit tests | 992dc80 | src/store/paneStore.ts, src/store/paneStore.test.ts |
| 2 | Refactor PaneContainer to flat-render pattern | ec1c806 | src/components/PaneContainer.tsx |

## What Was Built

**Task 1:** Exported `getAllPaneIds` and `splitInTree` from `paneStore.ts` for testability. Created `paneStore.test.ts` with 7 vitest tests covering: splitInTree identity preservation, unique child ID creation, activePaneId non-change on split, 4-pane cap enforcement, setSizes round-trip, getAllPaneIds nested tree traversal, closePane SplitNode collapse.

**Task 2:** Refactored `PaneContainer.tsx` from recursive `renderLayout` (which wrapped TerminalPane inside changing Panel/Group ancestors, causing xterm.js Terminal destruction on split) to a two-layer architecture:
- **Layout layer:** `renderLayoutPanels` renders Group/Panel/Separator with empty placeholder divs only — no TerminalPane
- **Terminal layer:** `allPaneIds.map()` renders all TerminalPanes as flat siblings in a stable React tree position, absolutely positioned to match their Panel's bounding rect via `usePanelRects` ResizeObserver hook
- **onLayoutChanged** on every Group writes panel sizes to paneStore.setSizes with a >0.5% size-change guard preventing initial-mount overwrites

## Decisions Made

1. **react-resizable-panels v4 Layout API:** v4 uses `onLayoutChanged(layout: {[panelId]: number})` not the old `onLayout(number[])`. Added `id=` prop on each Panel matching the pane ID; `onLayoutChanged` converts the map back to ordered array using `splitNode.children.map(c => layoutMap[c.id])`.

2. **onLayoutChanged over onLayoutChange:** `onLayoutChanged` fires after the layout change is complete (not during drag), making it safer for persistence.

3. **Counter-based ID generation:** `Date.now()` alone for pane/split IDs causes collisions when splits execute in rapid succession (same millisecond). Added a module-level counter `_idCounter` appended to IDs — revealed by failing test, fixed as Rule 1 bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Date.now()-only ID generation causing pane ID collisions**
- **Found during:** Task 1 test execution (4-pane cap test failed with count=5)
- **Issue:** `splitInTree` used `pane-${Date.now()}` which collides when two splits execute in the same millisecond — test infrastructure runs synchronously so multiple splits share the same timestamp
- **Fix:** Added `_idCounter` module-level counter; IDs are now `pane-${Date.now()}-${++_idCounter}` ensuring uniqueness regardless of timing
- **Files modified:** src/store/paneStore.ts
- **Commit:** 992dc80

**2. [Rule 1 - Adaptation] react-resizable-panels v4 uses onLayoutChanged not onLayout**
- **Found during:** Task 2 TypeScript compilation (`tsc --noEmit`)
- **Issue:** Plan specified `onLayout` prop (v3 API) but v4.7.6 exports `onLayoutChange`/`onLayoutChanged` with a `Layout = {[id]: number}` map type, not `number[]`
- **Fix:** Used `onLayoutChanged` with Panel `id=` props matching pane IDs; convert Layout map to ordered array via `childIds.map(id => layoutMap[id] ?? 50)`
- **Files modified:** src/components/PaneContainer.tsx
- **Commit:** ec1c806

## Verification Results

- `npx vitest run`: 16 tests passed (7 paneStore + 9 pre-existing)
- `npx tsc --noEmit`: exits 0 (no type errors)
- `getAllPaneIds` imported in PaneContainer.tsx: yes (2 occurrences)
- `onLayoutChanged` on Group components: yes (2 occurrences)
- `Math.abs` size-change guard: yes (1 occurrence)
- `allPaneIds.map` flat render: yes (1 occurrence)
- Old `renderLayout` function: removed (replaced by `renderLayoutPanels`)
- TerminalPane.tsx: unchanged
- useTerminal.ts: unchanged

## Known Stubs

None — flat-render wiring is complete. TerminalPane receives real rects from usePanelRects.

## Self-Check

Files created/modified:
- src/store/paneStore.ts — FOUND
- src/store/paneStore.test.ts — FOUND
- src/components/PaneContainer.tsx — FOUND

Commits:
- 992dc80 — feat(10-01): export getAllPaneIds and splitInTree, add paneStore unit tests
- ec1c806 — feat(10-01): refactor PaneContainer to CSS visibility flat-render pattern
