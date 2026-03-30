---
phase: 11-capture-infrastructure
plan: 01
subsystem: api
tags: [node-http, crypto, bearer-auth, discovery-file, websocket, sidecar]

# Dependency graph
requires:
  - phase: 03-chat-overlay-mvp
    provides: sidecar WebSocket server (server.ts) that this plan refactors
provides:
  - Shared HTTP+WS server on single random port via http.createServer
  - Bearer token authentication middleware on all HTTP endpoints
  - GET /health endpoint returning { ok: true } for authenticated callers
  - Atomic discovery file write at %APPDATA%/chat-overlay-widget/api.port on server start
  - Synchronous discovery file delete on sidecar exit (CAPI-04)
  - discoveryFile.ts module with writeDiscoveryFile / deleteDiscoveryFile exports
affects: [12-window-enumeration, 13-window-capture, 14-overlay-capture-cli, 15-capture-skill]

# Tech tracking
tech-stack:
  added: [node:http (built-in), node:crypto (built-in), node:os (built-in)]
  patterns:
    - Shared HTTP+WS port via WebSocketServer({ server: httpServer })
    - Bearer auth middleware inline in HTTP request handler
    - Atomic file write via writeFileSync(tmp) + renameSync(final)
    - Synchronous cleanup in process.on('exit') using unlinkSync

key-files:
  created:
    - sidecar/src/discoveryFile.ts
  modified:
    - sidecar/src/server.ts

key-decisions:
  - "Shared port for HTTP and WS (not separate ports) — CAPI-01 is authoritative over STATE.md todo"
  - "Discovery file at %APPDATA%/chat-overlay-widget/api.port with JSON { port, token } format"
  - "Bearer auth on all HTTP endpoints — token generated per-process via crypto.randomBytes(32)"
  - "httpServer.on('close') replaces wss.on('close') for heartbeat cleanup — fires more reliably"
  - "writeDiscoveryFile returns path string — caller stores in portFilePath for exit cleanup"
  - "Log token char count only (never value) to avoid token leaking into Tauri CommandEvent::Stdout"

patterns-established:
  - "Pattern: HTTP+WS shared port — always attach WebSocketServer to existing http.Server, not standalone port:0"
  - "Pattern: Bearer auth middleware — check Authorization header before any route logic; 401 on mismatch"
  - "Pattern: Atomic discovery file — writeFileSync to .tmp then renameSync; idempotent on repeat startup"
  - "Pattern: Sync exit cleanup — process.on('exit') is synchronous-only; use unlinkSync not fs.promises.unlink"

requirements-completed: [CAPI-01, CAPI-02, CAPI-03, CAPI-04]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 11 Plan 01: Capture Infrastructure — HTTP+WS Server with Bearer Auth Summary

**Refactored sidecar to shared HTTP+WebSocket server on single port with crypto.randomBytes Bearer token, atomic %APPDATA% discovery file, and /health endpoint — infrastructure for Phases 12-15 capture API.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T05:41:43Z
- **Completed:** 2026-03-30T05:49:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `discoveryFile.ts` module with atomic write (tmp-then-rename) and sync delete for process.on('exit') safety
- Refactored `server.ts` from standalone WebSocketServer({ port: 0 }) to http.createServer + WebSocketServer({ server: httpServer }) — both HTTP and WS on same random port
- Added Bearer token auth middleware: unauthenticated requests get 401 { error: 'Unauthorized' }, authenticated GET /health returns 200 { ok: true }
- Discovery file written atomically at %APPDATA%/chat-overlay-widget/api.port on server listen; deleted synchronously on process exit
- All existing WS message handlers (spawn, input, resize, kill, history-list, history-replay, save-image) preserved unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create discoveryFile.ts module** - `ae7820f` (feat)
2. **Task 2: Refactor server.ts to shared HTTP+WS with auth and discovery** - `cc8295d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `sidecar/src/discoveryFile.ts` - DISCOVERY_FILE_DIR constant, writeDiscoveryFile (atomic), deleteDiscoveryFile (sync)
- `sidecar/src/server.ts` - Shared HTTP+WS server, Bearer auth middleware, /health route, discovery file lifecycle

## Decisions Made

- Shared port (CAPI-01) is authoritative — STATE.md todo "separate random port" was a preliminary note before REQUIREMENTS.md was finalized
- Discovery file path %APPDATA%/chat-overlay-widget/api.port (not %TEMP%) — consistent with v1.2 decision in STATE.md
- writeDiscoveryFile returns the written file path so server.ts can store it in `portFilePath` without discoveryFile.ts needing a shared global
- httpServer.on('close') for heartbeat timer clearance — more reliable than wss.on('close') when underlying server is shut down externally

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled clean on first attempt. All 16 existing vitest tests passed without change.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- HTTP+WS infrastructure complete; Phases 12-15 can build GET /list-windows, POST /capture, and overlay-capture.js on this foundation
- Discovery file format is JSON { port, token } — Phase 14 reads it with JSON.parse
- Bearer token pattern established — future routes just call handleHttpRequest and route within it

## Self-Check: PASSED

- FOUND: sidecar/src/discoveryFile.ts
- FOUND: sidecar/src/server.ts
- FOUND: .planning/phases/11-capture-infrastructure/11-01-SUMMARY.md
- FOUND commit ae7820f (Task 1)
- FOUND commit cc8295d (Task 2)
- TSC: no errors
- Vitest: 16/16 tests pass

---
*Phase: 11-capture-infrastructure*
*Completed: 2026-03-30*
