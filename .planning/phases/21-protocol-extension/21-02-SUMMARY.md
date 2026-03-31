---
phase: 21-protocol-extension
plan: "02"
subsystem: protocol
tags: [websocket, protocol, hwnd, pid, typescript]
dependency_graph:
  requires: [21-01]
  provides: [PROT-04, PROT-05]
  affects: [sidecar/src/protocol.ts, src/protocol.ts, sidecar/src/server.ts, src/components/TerminalPane.tsx]
tech_stack:
  added: []
  patterns: [mirror-protocol, hwnd-passthrough]
key_files:
  modified:
    - sidecar/src/protocol.ts
    - src/protocol.ts
    - sidecar/src/server.ts
    - src/components/TerminalPane.tsx
    - src/components/__tests__/WindowPicker.test.tsx
decisions:
  - "hwnd and pid are required (not optional) fields on WindowThumbnail — all callers must supply them"
  - "PROT-05 preserved: captureWindowWithMetadata(msg.title) unchanged — HWND-based capture deferred to Phase 22"
  - "server.ts forwards msg.hwnd and msg.pid passthrough — no server-side lookup needed"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_modified: 5
---

# Phase 21 Plan 02: WebSocket Protocol Extension — hwnd+pid Threading Summary

hwnd and pid threaded through WebSocket protocol types, server handler, TerminalPane capture call, and test fixtures — end-to-end protocol extension complete with zero TypeScript errors and all 77 tests passing.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update protocol types in sidecar and frontend protocol.ts | 1a7015e | sidecar/src/protocol.ts, src/protocol.ts |
| 2 | Update server.ts handler and TerminalPane.tsx capture call | 3305db6 | sidecar/src/server.ts, src/components/TerminalPane.tsx, src/components/__tests__/WindowPicker.test.tsx |

## What Was Built

### Task 1 — Protocol Types (both protocol.ts files)

Three changes applied identically to `sidecar/src/protocol.ts` and `src/protocol.ts`:

1. `ClientMessage` capture-window-with-metadata variant: added `hwnd: number; pid: number;` before `title`
2. `WindowThumbnail` interface: added `hwnd: number` and `pid: number` fields (sidecar already had these from 21-01 deviation fix; frontend mirror was missing them)
3. `ServerMessage` capture-result-with-metadata variant: added `hwnd: number; pid: number;` after `title`

Files are now in sync (diff shows only the 2-line header comment in `src/protocol.ts`).

### Task 2 — Server Handler and TerminalPane

`sidecar/src/server.ts`: Added `hwnd: msg.hwnd` and `pid: msg.pid` to the `sendMsg` call in the capture-window-with-metadata handler. The `captureWindowWithMetadata(msg.title)` call is unchanged — title-based capture preserved (PROT-05).

`src/components/TerminalPane.tsx`: `handleWindowSelect` expanded from a single-line `sendMessage` to a multi-property object including `hwnd: window.hwnd` and `pid: window.pid`.

`src/components/__tests__/WindowPicker.test.tsx`: Mock `WindowThumbnail` fixtures updated to include `hwnd` and `pid` required fields (see Deviations).

## Verification

- `npx tsc --noEmit` in sidecar: exit 0 (zero errors)
- `npx tsc --noEmit` in root: exit 0 (zero errors)
- `npx vitest run`: 77 tests pass (7 test files)
- `grep -c "hwnd: number" sidecar/src/protocol.ts`: 3
- `grep -c "hwnd: number" src/protocol.ts`: 3
- `msg.hwnd` present in server.ts handler
- `hwnd: window.hwnd` present in TerminalPane handleWindowSelect
- `captureWindowWithMetadata(msg.title)` still present in server.ts (PROT-05 preserved)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing required fields] Updated WindowPicker test fixtures with hwnd+pid**
- **Found during:** Task 2 TypeScript compiler run
- **Issue:** `WindowPicker.test.tsx` mock `WindowThumbnail[]` array was missing the newly required `hwnd` and `pid` fields. This caused 4 TypeScript errors (`TS2739: missing properties hwnd, pid`).
- **Fix:** Added representative integer values for `hwnd` and `pid` to each of the 4 mock objects in `mockWindows`.
- **Files modified:** `src/components/__tests__/WindowPicker.test.tsx`
- **Commit:** 3305db6

## Known Stubs

None — all protocol fields are wired end-to-end. hwnd and pid flow from C# enumeration (21-01) through WindowThumbnail, WebSocket ClientMessage, server.ts handler, and WebSocket ServerMessage response.

## Self-Check: PASSED

All files exist. Both commits (1a7015e, 3305db6) confirmed in git history.
