---
phase: 21-protocol-extension
plan: 01
subsystem: sidecar
tags: [hwnd, pid, window-enumeration, c-sharp, typescript, protocol]
dependency_graph:
  requires: []
  provides: [hwnd-in-WindowInfo, pid-in-WindowInfo, hwnd-in-WindowThumbnail, GetParent-filter]
  affects: [windowEnumerator.ts, windowThumbnailBatch.ts, protocol.ts]
tech_stack:
  added: []
  patterns: [ToInt64-for-hwnd-serialization, long-cast-for-pid, GetParent-root-window-filter]
key_files:
  created: []
  modified:
    - sidecar/src/windowEnumerator.ts
    - sidecar/src/windowThumbnailBatch.ts
    - sidecar/src/windowEnumerator.test.ts
    - sidecar/src/windowThumbnailBatch.test.ts
    - sidecar/src/protocol.ts
decisions:
  - PS_SCRIPT exported from windowEnumerator.ts to enable structural assertions in tests (Tests 9/10)
  - require() replaced with await import() in Tests 7/8 — vitest ESM environment requires dynamic import not CommonJS require
metrics:
  duration: 170s
  completed: 2026-03-31
  tasks: 2
  files: 5
---

# Phase 21 Plan 01: HWND and PID threading through C# enumeration scripts Summary

HWND serialized via `hWnd.ToInt64()` and PID via `(long)pid` added to both C# enumeration delegates, with GetParent root-window filter added as Filter 5, WindowInfo and WindowThumbnail TypeScript types extended, and 4 new PROT-01/02/03 tests added.

## What Was Built

- `windowEnumerator.ts`: Added `GetParent` P/Invoke to WinEnum class, Filter 5 (`GetParent(hWnd) != IntPtr.Zero`), `hwnd = hWnd.ToInt64()` and `pid = (long)pid` in the `windows.Add` call, updated `WindowInfo` interface with `hwnd: number` and `pid: number`, exported `PS_SCRIPT` constant
- `windowThumbnailBatch.ts`: Added `GetParent` P/Invoke to BatchThumb class, Filter 5 in EnumWindowsProc callback, `hwnd = hWnd.ToInt64()` and `pid = (long)pid` in all four `results.Add` paths (minimized, zero-bounds, success, exception)
- `protocol.ts`: Extended `WindowThumbnail` interface with `hwnd: number` and `pid: number` fields
- `windowEnumerator.test.ts`: Updated all `makeOkResult` mocks to include hwnd/pid, added Tests 7–10 covering PROT-01, PROT-02, PROT-03
- `windowThumbnailBatch.test.ts`: Updated FAKE_WINDOW_JSON with hwnd/pid fields, added hwnd/pid assertions to Test 2, added GetParent/ToInt64/long-pid assertions to Test 8

## Acceptance Criteria Met

- windowEnumerator.ts contains `hWnd.ToInt64()`: YES
- windowEnumerator.ts contains `(long)pid`: YES
- windowEnumerator.ts contains `GetParent(hWnd) != IntPtr.Zero`: YES
- windowEnumerator.ts contains `hwnd: number;` in WindowInfo: YES
- windowEnumerator.ts contains `pid: number;` in WindowInfo: YES
- windowThumbnailBatch.ts contains `hWnd.ToInt64()`: YES (4 occurrences)
- windowThumbnailBatch.ts contains `(long)pid`: YES
- windowThumbnailBatch.ts contains `GetParent(hWnd) != IntPtr.Zero`: YES
- No `ToInt32()` in either file: YES
- All 77 tests pass: YES

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed require() incompatibility in Tests 7 and 8**
- **Found during:** Task 2 test run
- **Issue:** Plan template used `require('./windowEnumerator.js')` for Tests 7/8 — fails in vitest ESM environment with `MODULE_NOT_FOUND`
- **Fix:** Replaced `require()` with `await import()` pattern consistent with all other tests in the file; made tests `async`
- **Files modified:** sidecar/src/windowEnumerator.test.ts
- **Commit:** 208c382

**2. [Rule 2 - Missing critical functionality] Extended WindowThumbnail type in protocol.ts**
- **Found during:** Task 2
- **Issue:** `windowThumbnailBatch.test.ts` Test 2 references `chromeEntry!.hwnd` and `chromeEntry!.pid` which are not in the `WindowThumbnail` TypeScript type — would cause TypeScript type errors
- **Fix:** Added `hwnd: number` and `pid: number` to `WindowThumbnail` interface in `protocol.ts`
- **Files modified:** sidecar/src/protocol.ts
- **Commit:** 208c382

## Known Stubs

None — all hwnd/pid fields are wired through from C# script output to TypeScript interfaces.

## Self-Check: PASSED
