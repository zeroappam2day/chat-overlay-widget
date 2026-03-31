---
phase: 19-window-picker-ui
plan: 02
subsystem: frontend/components
tags: [react, window-picker, websocket, keyboard-gate, ternary-state]

requires:
  - phase: 19-01
    provides: WindowPicker component with full grid/search/keyboard/refresh behavior
  - phase: 16
    provides: WindowThumbnail type and list-windows-with-thumbnails/window-thumbnails protocol messages

provides:
  - TerminalHeader toolbar button (4-square grid icon) that calls onTogglePicker
  - TerminalPane pickerOpen/pickerWindows state with WS send/receive wired
  - Keyboard gate: pickerOpenRef blocks document keydown from reaching xterm.js while picker is open
  - Conditional WindowPicker render inside the live terminal area

affects: [Plan 20 (one-click capture from picker)]

tech-stack:
  added: []
  patterns:
    - "pickerOpenRef pattern: sync ref with useEffect to avoid stale closure in document keydown handler without adding pickerOpen to dependency array"
    - "Keyboard gate co-located with other document keydown guards in the single consolidated useEffect"

key-files:
  created: []
  modified:
    - src/components/TerminalHeader.tsx
    - src/components/TerminalPane.tsx

key-decisions:
  - "onTogglePicker placed BEFORE split buttons in toolbar — frequent action deserves left-of-destructor placement"
  - "pickerOpenRef pattern used (not adding pickerOpen to keyboard useEffect deps) — consistent with isActiveRef approach from Phase 04"

patterns-established:
  - "pickerOpenRef: stable ref bridging pickerOpen state into document event handler without stale closure"

requirements-completed: [PICK-01, PICK-02, PICK-03, THUMB-04]

duration: 5min
completed: 2026-03-31
---

# Phase 19 Plan 02: WindowPicker Integration Summary

**TerminalHeader picker button and TerminalPane WS+keyboard wiring: picker opens via 4-square icon, fetches thumbnails over WS, gates arrow keys from xterm.js**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-31T05:10:00Z
- **Completed:** 2026-03-31T05:15:00Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 2

## Accomplishments

- Added `onTogglePicker` prop and grid icon button to `TerminalHeader` toolbar
- Added `pickerOpen`/`pickerWindows` state, `pickerOpenRef`, and `handleOpenPicker` callback to `TerminalPane`
- Wired `window-thumbnails` WS response to `setPickerWindows` in `handleServerMessage` switch
- Added keyboard gate in document keydown handler: `if (pickerOpenRef.current) return;`
- Rendered `<WindowPicker>` conditionally inside the live terminal area alongside `SearchOverlay`
- All 66 vitest tests pass (no regressions)

## Task Commits

1. **Task 1: Wire TerminalHeader picker button and TerminalPane integration** - `a488456` (feat)
2. **Task 2: Visual verification of window picker** - approved by user

## Files Created/Modified

- `src/components/TerminalHeader.tsx` - Added `onTogglePicker: () => void` to props interface and 4-square grid SVG button before split buttons
- `src/components/TerminalPane.tsx` - Added picker state, ref, WS handler, keyboard gate, and WindowPicker conditional render

## Decisions Made

- `onTogglePicker` placed before split buttons — picker is a primary action, not a secondary utility
- `pickerOpenRef` pattern used (not adding `pickerOpen` to keyboard `useEffect` deps array) — consistent with `isActiveRef` from Phase 04, avoids unintended listener re-registration

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all integration points wired. `onSelect` prop on WindowPicker is passed as undefined (intentional per Plan 01 spec; Phase 20 will wire one-click capture).

## User Setup Required

None.

## Next Phase Readiness

- Task 2 visual checkpoint approved by user
- Phase 19 is complete
- Phase 20 can proceed: one-click capture from picker via `onSelect` → `capture-window-with-metadata` WS message

---
*Phase: 19-window-picker-ui*
*Completed: 2026-03-31*
