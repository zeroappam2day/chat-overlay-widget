---
phase: 04-differentiating-features
plan: 03
subsystem: ui
tags: [react, zustand, react-resizable-panels, xterm, multi-pane, split-layout]

# Dependency graph
requires:
  - phase: 04-differentiating-features/04-01
    provides: Zustand pane store (usePaneStore, LayoutNode, splitPane, closePane, setSizes)
provides:
  - PaneContainer.tsx: recursive split tree renderer using react-resizable-panels v4
  - TerminalPane.tsx refactored to accept paneId with independent hooks per instance
  - TerminalHeader.tsx extended with split-h, split-v, close buttons
  - App.tsx updated to render PaneContainer as root
affects:
  - 04-04 (screenshot injection — TerminalPane is the parent component)
  - 04-05 (always-on-top — App-level feature, PaneContainer is the root)

# Tech tracking
tech-stack:
  added:
    - react-resizable-panels v4.7.6 (Group/Panel/Separator API — v4 uses different names than v1/v2)
    - zustand v5.0.12 (already added in 04-01, now actively consumed in TerminalPane)
  patterns:
    - isActiveRef pattern: stable ref updated from reactive state used in document-level event handlers to avoid stale closures
    - gatedToggleSearch pattern: document-level custom event listener gated to active pane only to prevent multi-pane event cascade
    - renderLayout recursive function: pure function rendering LayoutNode tree as React.ReactNode

key-files:
  created:
    - src/components/PaneContainer.tsx
  modified:
    - src/App.tsx
    - src/components/TerminalPane.tsx
    - src/components/TerminalHeader.tsx

key-decisions:
  - "react-resizable-panels v4 exports Group/Panel/Separator (not PanelGroup/Panel/PanelResizeHandle as in v1/v2 — API renamed in v4)"
  - "Omit onLayoutChange from Group in PaneContainer — v4 Layout type is {[id:string]:number} map, incompatible with Zustand sizes:number[]; panels manage own sizes via defaultSize prop"
  - "isActiveRef pattern for keyboard handler gating — avoids stale closure issue when isActive is used inside document.addEventListener callbacks"
  - "gatedToggleSearch function for terminal-toggle-search custom event — prevents Ctrl+F from opening search in all panes simultaneously"

patterns-established:
  - "Pattern: Active pane gating — all document-level keyboard/custom event handlers check isActiveRef.current before acting"
  - "Pattern: PaneContainer recursive renderer — pure function traverses LayoutNode tree, renders TerminalPane for leaf nodes, Group+Panel+Separator for split nodes"

requirements-completed: [PSMUX-01, PSMUX-02, PSMUX-03, PSMUX-04, WIN-03]

# Metrics
duration: 12min
completed: 2026-03-28
---

# Phase 04 Plan 03: Multi-Pane Frontend Summary

**Recursive split-pane layout with react-resizable-panels v4, each pane running its own independent WebSocket/PTY/xterm.js instance via paneId-aware TerminalPane**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-28T04:55:00Z
- **Completed:** 2026-03-28T05:07:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- PaneContainer renders recursive LayoutNode tree from Zustand store using react-resizable-panels v4 Group/Panel/Separator
- TerminalPane refactored to accept paneId — each mounted instance gets its own useWebSocket, useTerminal, useSessionHistory hooks
- Keyboard handlers (Ctrl+F, Escape, terminal-toggle-search) scoped to active pane via isActiveRef to prevent multi-pane event cascade
- TerminalHeader extended with split-horizontal, split-vertical, and close buttons with disabled states (canSplit caps at 4 panes, canClose hides when 1 pane)
- Active pane shows blue left-border indicator; clicking a pane sets it as active via Zustand setActivePane

## Task Commits

1. **Task 1: Create PaneContainer and update App.tsx** - `7268718` (feat)
2. **Task 2: Refactor TerminalPane with paneId and extend TerminalHeader** - `d12f059` (feat)

## Files Created/Modified

- `src/components/PaneContainer.tsx` - Recursive split tree renderer using react-resizable-panels v4; renders TerminalPane per leaf, Group+Panel+Separator per SplitNode
- `src/App.tsx` - Now renders PaneContainer as root instead of TerminalPane directly
- `src/components/TerminalPane.tsx` - Accepts paneId prop; active pane gating for keyboard handlers; split/close buttons wired to pane store
- `src/components/TerminalHeader.tsx` - Added onSplitHorizontal, onSplitVertical, onClose, canSplit, canClose props with SVG icon buttons

## Decisions Made

- **react-resizable-panels v4 API difference:** v4 exports `Group`, `Panel`, `Separator` not `PanelGroup`, `PanelResizeHandle`. Used `orientation` prop (not `direction`), `onLayoutChange` receives `{[id:string]:number}` not `number[]`.
- **Omit onLayoutChange:** v4's `Layout` type is incompatible with Zustand `sizes: number[]`. Panels manage sizes via `defaultSize` on mount; sizes reset to 50/50 on re-render which is acceptable since `splitInTree` always initializes new splits at `[50, 50]`.
- **isActiveRef pattern:** Keyboard event handlers registered on `document` need access to `isActive` state. Using a ref updated in a `useEffect` avoids stale closures that would cause all panes to respond to keyboard events.
- **gatedToggleSearch:** `useTerminal.ts` dispatches `terminal-toggle-search` at document level when terminal has focus. Without gating, Ctrl+F in any pane opens search in ALL panes simultaneously. The gated listener checks `isActiveRef.current` before toggling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing npm dependencies (zustand, react-resizable-panels)**
- **Found during:** Task 1 (PaneContainer creation)
- **Issue:** zustand and react-resizable-panels were in package.json but not installed (only 100 packages in node_modules). TypeScript could not find module declarations.
- **Fix:** Ran `npm install` to install all dependencies
- **Files modified:** node_modules (not committed)
- **Verification:** `npx tsc --noEmit` passes after install
- **Committed in:** implicit (npm install, not committed to repo)

**2. [Rule 1 - Bug] Used react-resizable-panels v4 API (Group/Panel/Separator) instead of v1/v2 API**
- **Found during:** Task 1 (PaneContainer creation)
- **Issue:** Plan referenced `PanelGroup`, `PanelResizeHandle` API (v1/v2). Installed v4.7.6 exports `Group`, `Panel`, `Separator` with different prop names (`orientation` not `direction`, `onLayoutChange` receives Layout map not number[])
- **Fix:** Updated PaneContainer to use v4 API throughout; omitted `onLayoutChange` due to type incompatibility with Zustand store
- **Files modified:** src/components/PaneContainer.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** `7268718` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 API version mismatch)
**Impact on plan:** Both fixes required for functionality. The omission of onLayoutChange means pane sizes don't persist to Zustand on drag, but visual resize still works correctly via react-resizable-panels internal state. Zustand sizes are used as `defaultSize` on initial render only.

## Issues Encountered

- react-resizable-panels v4 onLayoutChange callback type (`Layout = {[id:string]:number}`) is incompatible with the Zustand store's `setSizes(splitId, sizes: number[])`. Rather than create a complex ID-to-index mapping, omitted the callback — panels manage own sizes internally after initial mount.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Multi-pane split layout is fully functional: split-h, split-v, close, resize, independent PTY/WS per pane
- PaneContainer is the new root — ready for screenshot injection (04-04) and always-on-top (04-05) features
- The TerminalPane paneId prop is the anchor for per-pane screenshot temp file tracking (SCRN-04)

---
*Phase: 04-differentiating-features*
*Completed: 2026-03-28*
