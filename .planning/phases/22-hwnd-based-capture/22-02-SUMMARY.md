---
phase: 22-hwnd-based-capture
plan: 02
subsystem: capture
tags: [hwnd, capture, websocket, server, routing]

# Dependency graph
requires:
  - phase: 22-hwnd-based-capture
    plan: 01
    provides: captureWindowByHwnd(hwnd, pid, titleLabel) in windowCapture.ts
provides:
  - WebSocket capture-window-with-metadata handler routes through captureWindowByHwnd
  - HWND-based capture fully wired end-to-end from picker selection to screenshot
affects: [future capture plans, window-picker integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HWND routing pattern: WebSocket handler dispatches to captureWindowByHwnd(hwnd, pid, title) using fields from ClientMessage"

key-files:
  created: []
  modified:
    - sidecar/src/server.ts

key-decisions:
  - "captureWindowWithMetadata import retained — needed for fallback path inside captureWindowByHwnd"
  - "HTTP POST /capture/window left unchanged using captureWindow(title) — PROT-05 preserved"
  - "Error message prefix changed to 'capture failed:' for consistency"

patterns-established:
  - "HWND-first capture: server handler passes hwnd, pid, title from ClientMessage directly to capture function"

requirements-completed: [HWND-01]

# Metrics
duration: 10min
completed: 2026-03-31
---

# Phase 22 Plan 02: Server Handler HWND Routing Summary

**WebSocket capture-window-with-metadata handler now routes through captureWindowByHwnd(hwnd, pid, title) — title-based re-enumeration replaced with direct HWND targeting**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-31T11:05:00Z
- **Completed:** 2026-03-31T11:15:00Z
- **Tasks:** 2 of 2
- **Files modified:** 1

## Accomplishments
- Updated import in server.ts to add `captureWindowByHwnd` from windowCapture.ts
- Replaced `captureWindowWithMetadata(msg.title)` with `captureWindowByHwnd(msg.hwnd, msg.pid, msg.title)` in handler
- Log line updated to show hwnd and pid for observability
- HTTP POST /capture/window unchanged — captureWindow(title) path unaffected (PROT-05)
- All 87 tests pass, TypeScript compiles clean
- Human E2E verification passed: HWND and PID visible in WebSocket messages, capture succeeds with HWND routing, no console errors

## Task Commits

1. **Task 1: Route capture handler to captureWindowByHwnd** - `2801bcf` (feat)
2. **Task 2: Verify HWND-based capture end-to-end** - APPROVED (checkpoint:human-verify)

## Files Created/Modified
- `sidecar/src/server.ts` - Import updated, capture-window-with-metadata handler routes through captureWindowByHwnd

## Decisions Made
- Retained `captureWindowWithMetadata` in import — it is still referenced internally by the fallback path in captureWindowByHwnd (HWND-04)
- HTTP /capture/window path unchanged — the title-based API remains for CLI and external callers
- Error message prefix simplified to `capture failed:` (was `capture-window-with-metadata failed:`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- HWND-based capture is fully wired and human-verified end-to-end
- v1.4 Stable Window Targeting milestone: Phase 22 complete (both plans)
- Ready for milestone closure or next milestone planning

## Self-Check: PASSED

---
*Phase: 22-hwnd-based-capture*
*Completed: 2026-03-31*
