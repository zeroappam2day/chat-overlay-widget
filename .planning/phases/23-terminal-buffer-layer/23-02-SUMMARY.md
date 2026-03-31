---
phase: 23-terminal-buffer-layer
plan: 02
subsystem: api
tags: [terminal-buffer, http-api, strip-ansi, cursor-pagination, session-history]

# Dependency graph
requires:
  - phase: 23-01
    provides: TerminalBuffer class with getLines(n, since), crFold, initStripAnsi wired into PTYSession

provides:
  - GET /terminal-state HTTP endpoint returning cursor-paginated clean terminal output
  - GET /session-history HTTP endpoint returning ANSI-stripped CR-folded SQLite session data
  - stripAnsiSync exported from terminalBuffer.ts for shared use

affects:
  - phase-27 (MCP tools that call /terminal-state and /session-history)
  - phase-24 (secret scrubber that processes terminal output)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - cursor-pagination via getLines(n, since) — reads only new lines since last cursor position
    - at-query-time cleaning — crFold + stripAnsiSync applied to raw SQLite chunks on /session-history request
    - ESM-only package workaround — stripAnsiSync exported as sync wrapper over dynamic-imported strip-ansi

key-files:
  created:
    - sidecar/src/server.test.ts
  modified:
    - sidecar/src/server.ts
    - sidecar/src/terminalBuffer.ts

key-decisions:
  - "Export stripAnsiSync from terminalBuffer.ts instead of duplicating dynamic import pattern in server.ts"
  - "session-history applies cleaning at query time (not write time) — raw chunks preserved in SQLite for replay"
  - "lines cap at 500 on both routes — prevents oversized JSON responses to MCP tools"

patterns-established:
  - "Pattern: server routes that use query params call new URL(req.url!, 'http://localhost') before dispatch"
  - "Pattern: session-history total field = all lines in history; lines field = last N slice"

requirements-completed:
  - TERM-03
  - TERM-04

# Metrics
duration: 7min
completed: 2026-03-31
---

# Phase 23 Plan 02: HTTP Endpoints for Terminal Buffer Summary

**Two HTTP endpoints wired to the ring buffer: GET /terminal-state returns cursor-paginated clean text from the live PTY buffer; GET /session-history returns ANSI-stripped CR-folded historical output from SQLite chunks**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-31T16:17:00Z
- **Completed:** 2026-03-31T16:22:00Z
- **Tasks:** 1 of 2 complete (Task 2 awaiting human verification)
- **Files modified:** 3

## Accomplishments

- Added GET /terminal-state route with cursor pagination, lines capped at 500, no-session 404
- Added GET /session-history route with CR-fold + stripAnsi applied to raw SQLite chunks, missing sessionId 400
- Exported stripAnsiSync from terminalBuffer.ts so server.ts shares the same ANSI stripping path
- Created 15-test suite covering both route data pipelines (TerminalBuffer shape, since= pagination, cleaning pipeline, edge cases)
- All routes require Bearer auth (pre-existing auth check in handleHttpRequest catches unauthorized requests first)

## Task Commits

1. **Task 1: Add GET /terminal-state and GET /session-history HTTP routes** - `225b33f` (feat)
2. **Task 2: Verify live terminal buffer and HTTP endpoints** - pending human verification

**Plan metadata:** pending (written at checkpoint)

## Files Created/Modified

- `sidecar/src/server.ts` — Added two new routes and terminalBuffer imports; initStripAnsi() called at startup
- `sidecar/src/terminalBuffer.ts` — Exported stripAnsiSync (previously internal function)
- `sidecar/src/server.test.ts` — 15 unit tests for /terminal-state and /session-history data pipelines

## Decisions Made

- Export `stripAnsiSync` from terminalBuffer.ts rather than duplicating the ESM dynamic-import workaround in server.ts — single source of truth for ANSI stripping
- Session history applies crFold + stripAnsiSync at query time, not write time — raw PTY chunks stay in SQLite intact for replay and other uses
- Lines parameter capped at 500 on both routes — consistent ceiling prevents oversized MCP tool responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exported stripAnsiSync instead of direct strip-ansi import**

- **Found during:** Task 1 (HTTP route implementation)
- **Issue:** Plan's action block specified `import stripAnsi from 'strip-ansi'` in server.ts, but strip-ansi 7.x is ESM-only and the sidecar compiles to CJS (module: Node16). A direct import would fail at runtime with ERR_REQUIRE_ESM.
- **Fix:** Changed `stripAnsiSync` from `function` to `export function` in terminalBuffer.ts. Imported `{ stripAnsiSync, initStripAnsi }` in server.ts instead. Also added `initStripAnsi()` call at sidecar startup to pre-warm the ESM module.
- **Files modified:** sidecar/src/terminalBuffer.ts, sidecar/src/server.ts
- **Verification:** TypeScript passes clean (`npx tsc --noEmit` exits 0). Tests pass (15/15).
- **Committed in:** 225b33f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical: ESM compatibility)
**Impact on plan:** Necessary correctness fix. The direct import would have caused a runtime crash. No scope creep — same functionality, safer import path.

## Issues Encountered

- Worktree sidecar had no node_modules — tsc and vitest could not run directly in worktree. Workaround: temporarily copied worktree files to main repo (which has sidecar/node_modules), ran validation, then restored. Plan verification commands worked correctly when run this way.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- GET /terminal-state and GET /session-history are ready for MCP tool consumption (Phase 27)
- Both routes enforce Bearer auth using the existing authToken from discovery.json
- Human verification of live curl behavior needed before marking plan complete (Task 2 checkpoint)

---
*Phase: 23-terminal-buffer-layer*
*Completed: 2026-03-31 (Task 1); Task 2 pending human verify*
