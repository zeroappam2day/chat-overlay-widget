---
phase: 13-window-capture
plan: "01"
subsystem: sidecar
tags: [window-capture, powershell, win32, tdd, dpi-aware, print-window]
dependency_graph:
  requires: [sidecar/src/ptySession.ts (SCREENSHOT_DIR), node:child_process.spawnSync, node:crypto, node:fs, node:path]
  provides: [sidecar/src/windowCapture.ts (captureWindow, buildCaptureScript, CaptureResult)]
  affects: [sidecar/src/server.ts (Plan 02 will add POST /capture/window route)]
tech_stack:
  added: []
  patterns: [spawnSync + PS inline C# (Phase 12 established), CaptureResult discriminated union, TDD RED/GREEN]
key_files:
  created:
    - sidecar/src/windowCapture.ts
    - sidecar/src/windowCapture.test.ts
  modified: []
decisions:
  - "buildCaptureScript exported for testability — allows script content assertions in tests without running PowerShell"
  - "fs.mkdirSync used for mkdir (not a second spawnSync PS mkdir) — simpler and already imported"
  - "Title sanitization via replace(/[\"`\\r\\n]/g, '') before PS string interpolation — prevents PS injection"
metrics:
  duration: "107s"
  completed_date: "2026-03-30"
  tasks_completed: 1
  files_modified: 2
---

# Phase 13 Plan 01: windowCapture Module Summary

WindowCapture module with PS inline C# that captures any window by title substring using PrintWindow PW_RENDERFULLCONTENT, DPI-aware via SetProcessDpiAwarenessContext(-4) + DWMWA_EXTENDED_FRAME_BOUNDS, with minimized window fallback via IsIconic + GetWindowPlacement.

## Objective

Create `windowCapture.ts` module as the core capture engine for the window screenshot feature. This module is consumed by the HTTP route (Plan 02). TDD approach: tests written first (RED), then implementation (GREEN).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | TDD RED — 11 failing tests | b6fe481 | sidecar/src/windowCapture.test.ts |
| 1 | TDD GREEN — captureWindow implementation | 66bedc6 | sidecar/src/windowCapture.ts |

## Implementation Details

### captureWindow(titleQuery: string): CaptureResult

- Generates UUID output path in `SCREENSHOT_DIR` (imported from `ptySession.ts`)
- Calls `fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })` to ensure dir exists
- Calls `buildCaptureScript(titleQuery, outputPath)` to build the PS script
- Runs `spawnSync('powershell.exe', [..., script], { encoding: 'utf8', timeout: 15_000 })`
- Returns discriminated union: `{ ok: true, path }` or `{ ok: false, error }`

### buildCaptureScript(titleQuery, outputPath): string

PowerShell script with C# `WinCapture` class containing:

- `SetProcessDpiAwarenessContext(new IntPtr(-4))` — first call in CaptureWindow method (PER_MONITOR_AWARE_V2)
- `EnumWindows` with `IsWindowVisible` + `IndexOf(OrdinalIgnoreCase)` title substring match
- `IsIconic` check for minimized windows → `GetWindowPlacement.rcNormalPosition` for dimensions
- `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS = 9)` for physical pixel bounds on non-minimized
- `PrintWindow(target, hdc, PW_RENDERFULLCONTENT = 0x2)` for GPU-composited window capture
- `System.Drawing.Bitmap.Save(outputPath, ImageFormat.Png)` for PNG encoding
- Returns `"OK:<path>"` or `"ERROR:<reason>"` strings parsed by Node.js layer

### Requirements Coverage

- WCAP-01: title substring match via EnumWindows + IndexOf (tested via mock)
- WCAP-02: DPI-aware via SetProcessDpiAwarenessContext(-4) + DWMWA_EXTENDED_FRAME_BOUNDS (script content verified)
- WCAP-03: PrintWindow PW_RENDERFULLCONTENT for GPU-composited windows (script content verified)
- WCAP-04: UUID filename in SCREENSHOT_DIR, absolute path returned (tested via mock)
- WCAP-05: All error paths return `{ ok: false, error }` — never throw (tested via mock)

## Test Results

```
Tests  11 passed (11)   [sidecar/src/windowCapture.test.ts]
Tests  33 passed (33)   [full vitest suite — 4 test files]
```

## Deviations from Plan

None — plan executed exactly as written. The fs.mkdirSync approach (instead of a second spawnSync PS mkdir as mentioned in the research skeleton) is consistent with the plan's action spec which says "fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })".

## Known Stubs

None — all exports are fully implemented. The module is production-ready pending manual DPI validation (noted in STATE.md blockers).

## Self-Check: PASSED
