---
phase: 04-differentiating-features
plan: 02
subsystem: sidecar
tags: [screenshot, temp-files, node-pty, cleanup, startup-sweep, typescript]

# Dependency graph
requires:
  - phase: 04-differentiating-features plan 01
    provides: save-image/save-image-result protocol types in sidecar/src/protocol.ts

provides:
  - PTYSession.saveImage(base64, ext) method writing to os.tmpdir()/chat-overlay-screenshots/
  - Per-session temp file tracking via private tempFiles array
  - cleanupTempFiles() called in PTYSession.destroy() for SCRN-04
  - sweepScreenshotTempFiles() orphan cleanup called at sidecar startup
  - save-image case in server.ts switch block returning save-image-result with file path
  - SCREENSHOT_DIR exported constant for cross-module use

affects: [04-03-screenshot-frontend, 04-04-frontend-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-session temp file tracking in private array, fire-and-forget unlink in cleanup"
    - "Startup orphan sweep: readdir + Promise.all unlink, silent on ENOENT"
    - "save-image case: async .then/.catch on saveImage promise, returns path or error"

key-files:
  created: []
  modified:
    - sidecar/src/ptySession.ts
    - sidecar/src/server.ts

key-decisions:
  - "saveImage is async — awaits mkdir and writeFile; cleanupTempFiles uses fire-and-forget unlink (non-blocking)"
  - "SCREENSHOT_DIR exported from ptySession.ts so server.ts can use same path for startup sweep"
  - "sweepScreenshotTempFiles() called at module level before wss startup — cleans orphans from previous crashes before accepting new connections"
  - "No cleanup-images message — PTYSession.destroy() called on WebSocket close handles SCRN-04; destroy-on-close is the single cleanup path"

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 04 Plan 02: Screenshot Temp File Management Summary

**Sidecar backend support for screenshot persistence: saveImage method with per-session tracking, destroy-on-close cleanup, and startup orphan sweep**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-28T05:00:00Z
- **Completed:** 2026-03-28T05:05:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended `sidecar/src/ptySession.ts` with `SCREENSHOT_DIR` exported constant, `private tempFiles: string[]` field, async `saveImage(base64, ext)` method, private `cleanupTempFiles()` method, and `cleanupTempFiles()` call at the start of `destroy()`
- Extended `sidecar/src/server.ts` with `sweepScreenshotTempFiles()` async function called at startup after `markOrphans()`, and a `case 'save-image':` handler that calls `session.saveImage()` and returns `save-image-result` with the file path
- TypeScript compiles cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add saveImage method and temp file cleanup to PTYSession** - `e167ff5` (feat)
2. **Task 2: Add save-image routing and startup orphan sweep to server.ts** - `ddfca05` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `sidecar/src/ptySession.ts` — Added SCREENSHOT_DIR export, tempFiles tracking, saveImage async method, cleanupTempFiles private method, destroy() now calls cleanupTempFiles() first
- `sidecar/src/server.ts` — Added node:fs/node:path imports, SCREENSHOT_DIR import from ptySession.js, sweepScreenshotTempFiles() function, startup sweep call, case 'save-image' in switch block

## Decisions Made

- `saveImage` is async (awaits mkdir + writeFile). `cleanupTempFiles` uses fire-and-forget `fs.unlink` callback — non-blocking for destroy path.
- `SCREENSHOT_DIR` exported from `ptySession.ts` so `server.ts` can reference same path for orphan sweep without hardcoding the string in two places.
- `sweepScreenshotTempFiles()` called at module initialization (before `wss.on('connection')`), right after `markOrphans()`. Orphans swept before first connection is accepted.
- No `cleanup-images` message. `PTYSession.destroy()` is the single cleanup path for SCRN-04. Called by WebSocket close handler, kill handler, and process exit handler already.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- TypeScript compilation check used main repo's node_modules (worktree lacks installed packages) — temporary copy approach confirmed both files compile cleanly together. No errors found.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 04-03 (screenshot frontend) can send `{ type: 'save-image', base64: ..., ext: ... }` and receive `{ type: 'save-image-result', path: ... }` from sidecar
- 04-04 frontend integration can rely on file path returned in save-image-result to pass to Claude CLI
- Cleanup happens automatically on session close — no explicit cleanup message needed in frontend

## Known Stubs

None — saveImage writes real files, sweepScreenshotTempFiles deletes real files, no placeholder data.

---
*Phase: 04-differentiating-features*
*Completed: 2026-03-28*
