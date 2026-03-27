---
phase: 03-chat-overlay-mvp
plan: 02
subsystem: database
tags: [better-sqlite3, sqlite, session-persistence, pty, node-pty, typescript]

requires:
  - phase: 02-pty-bridge
    provides: PTYSession class, onData/onExit callbacks, WebSocket server startup

provides:
  - SQLite database schema (sessions + session_chunks tables) with WAL mode
  - Batched PTY output recorder (500ms / 64KB flush) via SessionRecorder class
  - Orphan session detection on sidecar startup
  - Session metadata persistence (shell, cwd, start/end timestamps)

affects: [03-04-history-sidebar, future-plan-03-history-replay]

tech-stack:
  added: [better-sqlite3@12.8.0, @types/better-sqlite3]
  patterns:
    - Module-level singleton db pattern with openDb()/getDb() guards
    - Batched write pattern via buffer accumulation with dual-threshold flush (time + size)
    - Orphan detection: mark all sessions with ended_at IS NULL on startup

key-files:
  created:
    - sidecar/src/historyStore.ts
    - sidecar/src/sessionRecorder.ts
  modified:
    - sidecar/src/ptySession.ts
    - sidecar/src/server.ts
    - sidecar/package.json

key-decisions:
  - "Use end() in PTYSession.destroy() not destroy() — ensures ended_at is written on normal app close; destroy() intentionally omits ended_at for crash-only orphan marking"
  - "DB path: %LOCALAPPDATA%/chat-overlay-widget/sessions.db — standard Windows app data location"
  - "WAL mode + synchronous=NORMAL for SQLite — durability trade-off acceptable for local session data"

patterns-established:
  - "Pattern: SessionRecorder batches output via Buffer.concat at 500ms or 64KB threshold, not per onData event"
  - "Pattern: openDb() is idempotent (CREATE TABLE IF NOT EXISTS), safe to call multiple times"
  - "Pattern: markOrphans() runs before any new sessions are created — marks only sessions from previous runs"

requirements-completed: [HIST-01, HIST-02]

duration: 15min
completed: 2026-03-27
---

# Phase 03 Plan 02: SQLite Session Persistence Summary

**better-sqlite3 session recorder with batched BLOB writes (500ms/64KB), WAL-mode SQLite at %LOCALAPPDATA%, and orphan detection on sidecar startup**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-27T13:20:00Z
- **Completed:** 2026-03-27T13:35:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `historyStore.ts`: WAL-mode SQLite with sessions + session_chunks schema, index, openDb/getDb/markOrphans/listSessions/getSessionChunks exports
- Created `sessionRecorder.ts`: batched writer that accumulates PTY output in memory and flushes every 500ms or when buffer exceeds 64KB
- Extended `PTYSession` with SessionRecorder integration — append on data, end() on exit and destroy
- Extended `server.ts` to initialize SQLite and mark orphans before accepting connections

## Task Commits

1. **Task 1: Install better-sqlite3 and create historyStore + sessionRecorder** - `4e0ef41` (feat)
2. **Task 2: Integrate SessionRecorder into PTYSession and initialize SQLite in server** - `e85e661` (feat)

## Files Created/Modified

- `sidecar/src/historyStore.ts` — SQLite schema creation, WAL mode setup, CRUD helpers for sessions and chunks
- `sidecar/src/sessionRecorder.ts` — Batched PTY output writer: Buffer accumulation, dual-threshold flush (500ms / 64KB), session lifecycle
- `sidecar/src/ptySession.ts` — Added SessionRecorder field, append on onData, end() on onExit and destroy(), sessionId getter
- `sidecar/src/server.ts` — Added openDb()/markOrphans() on startup, session ID log after spawn
- `sidecar/package.json` — Added better-sqlite3@12.8.0 dependency and @types/better-sqlite3 devDependency

## Decisions Made

- Used `recorder.end()` (not `recorder.destroy()`) in `PTYSession.destroy()` so that normal app close/shell-switch properly writes `ended_at`. Only hard crashes (no cleanup) produce orphans that `markOrphans()` catches on restart.
- `%LOCALAPPDATA%/chat-overlay-widget/sessions.db` chosen as the database path — standard Windows per-user app data location.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. SQLite database is auto-created at `%LOCALAPPDATA%\chat-overlay-widget\sessions.db` on first sidecar start.

## Next Phase Readiness

- SQLite data layer is complete: sessions table populated on PTY spawn, chunks stored as BLOBs during session, ended_at written on clean close
- Plan 03 (terminal features) and Plan 04 (history sidebar) can query `listSessions()` and `getSessionChunks()` directly
- Sidecar TypeScript compiles and caxa bundle rebuilt successfully

---
*Phase: 03-chat-overlay-mvp*
*Completed: 2026-03-27*
