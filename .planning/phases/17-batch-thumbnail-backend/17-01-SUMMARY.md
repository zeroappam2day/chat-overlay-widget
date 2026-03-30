---
phase: 17-batch-thumbnail-backend
plan: 01
subsystem: api
tags: [node-pty, powershell, gdi+, websocket, system.drawing, async-spawn, thumbnails]

# Dependency graph
requires:
  - phase: 16-protocol-extension
    provides: WindowThumbnail interface and list-windows-with-thumbnails/window-thumbnails WS protocol types
  - phase: 12-window-enumeration
    provides: EnumWindows 4-filter chain, GetWindowLongPtr (64-bit) pattern
  - phase: 13-window-capture
    provides: PrintWindow PW_RENDERFULLCONTENT, SetProcessDpiAwarenessContext, System.Drawing patterns
provides:
  - windowThumbnailBatch.ts module with async spawn wrapper, batch PS C# script, 5s cache
  - listWindowsWithThumbnails() async function returning WindowThumbnail[]
  - server.ts case handler for list-windows-with-thumbnails WS message
  - 8 unit tests covering THUMB-01, THUMB-02, THUMB-03
affects: [19-window-picker-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async spawn wrapper: spawn + Promise with proc.stdout.setEncoding('utf8') on stream, not spawn options"
    - "Batch PS C# script pattern: single process for all windows vs per-window spawns"
    - "Per-window try/catch in C# batch loop: partial failures return error field, not crash"

key-files:
  created:
    - sidecar/src/windowThumbnailBatch.ts
    - sidecar/src/windowThumbnailBatch.test.ts
  modified:
    - sidecar/src/server.ts

key-decisions:
  - "proc.stdout.setEncoding('utf8') called on stream (not in spawn options) — per Pitfall 3 from research; spawn does not support encoding option the same way spawnSync does"
  - "30s timeout for batch PS spawn — covers 10-15 windows at 50-150ms each plus PS startup"
  - "CACHE_TTL_MS = 5_000 matching windowEnumerator.ts pattern — user can refresh via Phase 19 button"
  - "buildBatchThumbnailScript() exported for testability — same pattern as buildCaptureScript() in windowCapture.ts"

patterns-established:
  - "Async PS spawn pattern: spawn with stream encoding, timeout, chunk collection, close/error handlers"
  - "Mock pattern for spawn in vitest: makeFakeProcess helper with EventEmitter stdout having .setEncoding stub"

requirements-completed:
  - THUMB-01
  - THUMB-02
  - THUMB-03

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 17 Plan 01: Batch Thumbnail Backend Summary

**Single async PowerShell spawn capturing all visible windows as 240x180 base64 PNG thumbnails via GDI+ PrintWindow+scaling, with 5s cache and full WS handler wiring**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-30T16:31:29Z
- **Completed:** 2026-03-30T16:34:00Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- windowThumbnailBatch.ts: async spawn wrapper, batch PS C# BatchThumb class, 5s module-level cache
- 8 unit tests passing: THUMB-01 (single spawn, resolve array, error on non-zero exit, empty output), THUMB-02 (thumbnail base64 starts with iVBOR, error field for minimized, script content assertions), THUMB-03 (cache hit on second call, resetCache forces re-spawn)
- server.ts handler: case 'list-windows-with-thumbnails' routes to listWindowsWithThumbnails() with .then/.catch, returns window-thumbnails response

## Task Commits

Each task was committed atomically:

1. **Task 1: Create windowThumbnailBatch module with TDD** - `cc78841` (feat)
2. **Task 2: Wire list-windows-with-thumbnails handler into server.ts** - `729d2b1` (feat)

_Note: TDD task includes test file (RED) and implementation (GREEN) in a single atomic commit after all tests passed_

## Files Created/Modified

- `sidecar/src/windowThumbnailBatch.ts` - Batch thumbnail module: async runPsAsync wrapper, buildBatchThumbnailScript() with inline C# BatchThumb class, listWindowsWithThumbnails() with 5s cache, resetCache()
- `sidecar/src/windowThumbnailBatch.test.ts` - 8 unit tests mocking node:child_process spawn with EventEmitter fake, covering THUMB-01/02/03
- `sidecar/src/server.ts` - Added import and case 'list-windows-with-thumbnails' WS handler

## Decisions Made

- `proc.stdout.setEncoding('utf8')` called on stream, not in spawn options — spawn ignores encoding in options the same way spawnSync handles it; chunks would arrive as Buffers without this
- 30_000ms timeout for batch PS spawn (10-15 windows at ~150ms + PS startup)
- DwmGetWindowAttributeRect separate P/Invoke overload for RECT output type (DWMWA_EXTENDED_FRAME_BOUNDS) vs int output (DWMWA_CLOAKED) — C# P/Invoke type safety
- setEncoding stub added to fake stdout EventEmitter in test helper — mock must match ChildProcess interface for proc.stdout.setEncoding() call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock: stdout EventEmitter missing setEncoding() method**
- **Found during:** Task 1 (GREEN phase — first test run)
- **Issue:** makeFakeProcess helper created a plain EventEmitter for stdout. Implementation calls proc.stdout.setEncoding('utf8') before attaching data listener. Mock threw "setEncoding is not a function".
- **Fix:** Added `stdoutEmitter.setEncoding = vi.fn()` to the fake process helper in the test file.
- **Files modified:** sidecar/src/windowThumbnailBatch.test.ts
- **Verification:** All 8 tests pass after fix
- **Committed in:** cc78841 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test mock)
**Impact on plan:** Necessary for test correctness — mock must accurately reflect ChildProcess interface. No scope creep.

## Issues Encountered

None beyond the mock setEncoding issue documented above.

## Known Stubs

None — listWindowsWithThumbnails() returns real data from spawn; cache is functional; all exports are wired.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 19 (Window Picker UI) can now import listWindowsWithThumbnails or send list-windows-with-thumbnails WS message and receive window-thumbnails response
- Protocol types (WindowThumbnail, ClientMessage, ServerMessage) already in both sidecar/src/protocol.ts and src/protocol.ts (Phase 16)
- No blockers

## Self-Check

Checking files exist and commits are reachable.

---
*Phase: 17-batch-thumbnail-backend*
*Completed: 2026-03-30*
