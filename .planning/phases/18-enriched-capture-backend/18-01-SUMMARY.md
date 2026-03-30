---
phase: 18-enriched-capture-backend
plan: 01
subsystem: sidecar
tags: [capture, metadata, dpi, websocket, powershell]
dependency_graph:
  requires: [phase-16-protocol-extension, phase-13-window-capture]
  provides: [captureWindowWithMetadata, WS-capture-window-with-metadata]
  affects: [phase-20-metadata-injection]
tech_stack:
  added: []
  patterns: [GetWindowRect-for-DPI-ratio, JSON-stdout-with-diagnostic-skip, TDD-red-green]
key_files:
  created: []
  modified:
    - sidecar/src/windowCapture.ts
    - sidecar/src/windowCapture.test.ts
    - sidecar/src/server.ts
decisions:
  - "buildCaptureScriptWithMetadata exports for testability — consistent with Phase 13 buildCaptureScript pattern"
  - "DPI scale derived from physW/logW ratio (DwmGetWindowAttribute vs GetWindowRect) — not hardcoded"
  - "stdout JSON parsing skips to first '{' to handle Add-Type diagnostic lines before JSON"
  - "captureWindow in HTTP handler unchanged — INTG-02 compliance: POST /capture/window stays { path } only"
metrics:
  duration_seconds: 148
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 18 Plan 01: Enriched Capture Backend Summary

Extends window capture with pixel-accurate bounds and DPI scale via `captureWindowWithMetadata()` and WS `capture-window-with-metadata` handler, using GetWindowRect/DwmGetWindowAttribute ratio for runtime DPI derivation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add captureWindowWithMetadata function and tests | f7ccc0c | sidecar/src/windowCapture.ts, sidecar/src/windowCapture.test.ts |
| 2 | Wire capture-window-with-metadata WS handler | b4ccf04 | sidecar/src/server.ts |

## What Was Built

**Task 1 — captureWindowWithMetadata (TDD)**

Added to `sidecar/src/windowCapture.ts` (additions only, no existing code modified):
- `CaptureMetadata` interface: `{ path, bounds: {x,y,w,h}, captureSize: {w,h}, dpiScale }`
- `CaptureWithMetadataResult` discriminated union
- `buildCaptureScriptWithMetadata(titleQuery, outputPath)`: PowerShell C# inline script with `GetWindowRect` P/Invoke, DPI ratio computation, and JSON output via `string.Format`
- `captureWindowWithMetadata(titleQuery)`: same spawn pattern as `captureWindow`, parses JSON stdout (skips Add-Type diagnostic lines by seeking first `{`)

8 new tests added (Tests 12-19): happy path, NO_MATCH, MINIMIZED, script assertions (DPI awareness, GetWindowRect, JSON fields), diagnostic-line skip, regression guard.

**Task 2 — server.ts WS handler**

- Updated import: `import { captureWindow, captureWindowWithMetadata } from './windowCapture.js'`
- Added `case 'capture-window-with-metadata'` block after `list-windows-with-thumbnails`
- Sends `capture-result-with-metadata` with `{ path, title, bounds, captureSize, dpiScale }` on success
- Falls back to `{ type: 'error' }` on failure
- HTTP handlers `POST /capture/window` and `GET /list-windows` untouched

## Verification Results

- `npx vitest run sidecar/src/windowCapture.test.ts` — 19/19 tests pass (11 existing + 8 new)
- `npx vitest run` — 49/49 tests pass across all 5 test files (no regressions)
- `npx tsc --noEmit -p sidecar/tsconfig.json` — zero type errors
- `grep` confirms `captureWindow(title)` in HTTP handler (INTG-02 preserved)
- `grep` confirms `captureWindowWithMetadata(msg.title)` in WS handler (CAPT-01 fulfilled)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `captureWindowWithMetadata` is fully wired end-to-end. DPI scale is derived at runtime from the physW/logW ratio.

## Self-Check: PASSED

Files exist:
- sidecar/src/windowCapture.ts — FOUND
- sidecar/src/windowCapture.test.ts — FOUND
- sidecar/src/server.ts — FOUND

Commits exist:
- f7ccc0c — FOUND (feat(18-01): add captureWindowWithMetadata function and tests)
- b4ccf04 — FOUND (feat(18-01): wire capture-window-with-metadata WS handler in server.ts)
