---
phase: 11-capture-infrastructure
plan: 02
subsystem: api
tags: [verification, manual-test, curl, discovery-file, auth]

# Dependency graph
requires:
  - phase: 11-capture-infrastructure
    plan: 01
    provides: HTTP+WS server with auth and discovery file
---

# Plan 11-02 Summary: Manual Verification Checkpoint

## What was verified

Runtime verification of CAPI-01 through CAPI-04 via manual testing.

## Results

| Requirement | Test | Result |
|-------------|------|--------|
| CAPI-01 | HTTP and WS on same port (curl + terminal pane) | PASS |
| CAPI-02 | Discovery file at %APPDATA%\chat-overlay-widget\api.port with port + token JSON | PASS |
| CAPI-03 | curl without auth → 401; curl with Bearer token → 200 {"ok":true} | PASS |
| CAPI-04 | Discovery file deleted on app close (X button) | PASS |

## Issues found and fixed during verification

1. **Sidecar not recompiled**: Initial test failed because caxa-bundled exe contained old code. Fixed by running `tsc` + `npm run bundle` in sidecar/.

2. **Discovery file not written**: Detailed logging added to `discoveryFile.ts` to trace APPDATA resolution, directory creation, atomic write, and rename steps.

3. **Discovery file not cleaned on shutdown**: Root cause — Tauri kills sidecar via `taskkill /T /F` (TerminateProcess), which never triggers Node.js `process.on('exit')` handlers. Fixed by:
   - Adding discovery file deletion to Tauri's Rust `RunEvent::Exit` handler in `main.rs` (runs before force-kill)
   - Adding `cleanStaleDiscoveryFile()` to sidecar startup (catches stale files from crashes)
   - Adding discovery file cleanup to `kill-all.sh` (for stop.bat usage)

## Files modified (beyond plan 01)

- `src-tauri/src/main.rs` — Added discovery file deletion in RunEvent::Exit before taskkill
- `sidecar/src/discoveryFile.ts` — Added `cleanStaleDiscoveryFile()` export + detailed logging
- `sidecar/src/server.ts` — Added startup stale file cleanup + try/catch around discovery write
- `scripts/kill-all.sh` — Added discovery file cleanup before process termination
