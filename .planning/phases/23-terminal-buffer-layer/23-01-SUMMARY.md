---
phase: 23-terminal-buffer-layer
plan: 01
subsystem: sidecar
tags: [ring-buffer, ansi-stripping, pty-session, terminal-buffer]
dependency_graph:
  requires: []
  provides: [TerminalBuffer class, second onData PTY listener]
  affects: [sidecar/src/ptySession.ts, Phase 23 Plan 02 HTTP endpoints, Phase 27 MCP tools]
tech_stack:
  added: [strip-ansi@7.2.0]
  patterns: [Two-Listener PTY Tap, CR-Fold + Strip Pipeline, Cursor-Based Pagination]
key_files:
  created:
    - sidecar/src/terminalBuffer.ts
    - sidecar/src/terminalBuffer.test.ts
  modified:
    - sidecar/package.json
    - sidecar/src/ptySession.ts
decisions:
  - Dynamic import for strip-ansi ESM-in-CJS: used async getStripAnsi() with sync fallback regex
  - initStripAnsi() export added for pre-loading at sidecar startup
  - bufferDisposable disposed before dataDisposable in PTYSession.destroy()
metrics:
  duration: ~8 minutes
  completed: 2026-03-31
  tasks_completed: 2
  files_modified: 4
---

# Phase 23 Plan 01: TerminalBuffer Core Summary

TerminalBuffer 64KB ring buffer with CR-fold + strip-ansi pipeline wired into PTYSession via a second onData listener; cursor-paginated reads ready for Phase 23 HTTP endpoints.

## What Was Built

**Task 1: TerminalBuffer class and unit tests**

- `sidecar/src/terminalBuffer.ts`: `crFold()` function and `TerminalBuffer` class with `append()`, `getLines(n, since)`, `reset()`.
- The two-step pipeline: CR-fold collapses spinner/progress-bar overwritten frames, then strip-ansi removes remaining escape codes.
- 64KB byte budget enforced via evict-oldest-first ring strategy using `Buffer.byteLength(str, 'utf8')` for accurate byte tracking.
- Partial-line accumulator handles PTY chunks that don't end with `\n`.
- Cursor-paginated reads: `getLines(n, since)` returns `{ lines, cursor }` where cursor is the monotone total-lines-written counter.
- 15 unit tests covering all behaviors: CR-fold, ANSI strip, OSC-8 hyperlinks, ring eviction, since-pagination, partial accumulation, reset, empty-line exclusion.

**Task 2: PTYSession wiring**

- `sidecar/src/ptySession.ts`: Added `public readonly terminalBuffer: TerminalBuffer` field and `private bufferDisposable: pty.IDisposable` field.
- Second `onData` listener registered after the existing WebSocket+recorder listener — no changes to the primary data path.
- `bufferDisposable.dispose()` called in `destroy()` before `dataDisposable.dispose()`.
- `initStripAnsi()` async export for pre-loading the ESM module at sidecar startup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] strip-ansi ESM import fails TypeScript CJS type check**

- **Found during:** Task 2 (TypeScript verification `npx tsc --noEmit`)
- **Issue:** `import stripAnsi from 'strip-ansi'` triggers `TS1479: The current file is a CommonJS module... cannot be imported with require`. Despite `"module": "Node16"` in tsconfig, the sidecar `.ts` files are treated as CJS because `sidecar/package.json` lacks `"type": "module"`. The PLAN.md assumed Node16 = ESM, but Node16 module resolution uses file extension and package type to determine CJS vs ESM — `.ts` without `type: module` defaults to CJS.
- **Fix:** Replaced static import with dynamic import pattern: `async function getStripAnsi()` that loads strip-ansi once and caches it as `_stripAnsi`. `stripAnsiSync()` internal function uses the cached reference, falling back to a regex for the pre-init window. Added `export async function initStripAnsi()` for startup pre-loading.
- **Files modified:** `sidecar/src/terminalBuffer.ts`, `sidecar/src/terminalBuffer.test.ts`
- **Commit:** `951d66d`

## Known Stubs

None — all TerminalBuffer behaviors are fully implemented and tested. `initStripAnsi()` must be called at sidecar startup before the first PTY session to ensure the real strip-ansi library is loaded (not the fallback regex). This is a wiring task for Plan 02 or the server entry point.

## Test Results

```
Test Files  8 passed (8)
     Tests  102 passed (102)
```

- 15 new tests in `sidecar/src/terminalBuffer.test.ts` — all green
- 87 pre-existing tests — no regressions
- `npx tsc --noEmit -p sidecar/tsconfig.json` — exits 0, no errors

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `87adf11` | feat(23-01): implement TerminalBuffer with ANSI strip and ring buffer |
| 2 | `951d66d` | feat(23-01): wire TerminalBuffer into PTYSession second onData listener |

## Self-Check: PASSED

Files exist:
- `sidecar/src/terminalBuffer.ts` — FOUND
- `sidecar/src/terminalBuffer.test.ts` — FOUND
- `sidecar/src/ptySession.ts` — FOUND (modified)

Commits exist:
- `87adf11` — FOUND
- `951d66d` — FOUND
