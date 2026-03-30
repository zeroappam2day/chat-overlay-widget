---
phase: 12-window-enumeration
plan: 01
subsystem: api
tags: [powershell, win32, add-type, spawnSync, vitest, cache, enumwindows]

# Dependency graph
requires:
  - phase: 11-capture-infrastructure
    provides: HTTP server with Bearer auth and handleHttpRequest route dispatch
provides:
  - GET /list-windows HTTP endpoint returning filtered JSON array of visible windows
  - sidecar/src/windowEnumerator.ts — PowerShell Add-Type C# with 4-filter chain and 5s TTL cache
  - Unit tests for cache TTL logic in sidecar/src/windowEnumerator.test.ts
affects: [13-window-capture, 14-cli-wrapper, 15-claude-skill]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - spawnSync with args array for multi-line PS inline C# scripts (avoids shell quoting issues vs execSync)
    - Module-scope TTL cache with { data, ts } record — no mutex needed in Node.js single-threaded loop
    - Export resetCache() for test isolation — allows vi.resetAllMocks() + cache reset in beforeEach

key-files:
  created:
    - sidecar/src/windowEnumerator.ts
    - sidecar/src/windowEnumerator.test.ts
  modified:
    - sidecar/src/server.ts
    - vitest.config.ts

key-decisions:
  - "spawnSync with args array (not execSync with string) for PS inline C# — avoids shell quoting escapes in multi-line heredoc"
  - "GetWindowLongPtr (64-bit aware) not GetWindowLong — required on 64-bit Windows 11"
  - "WS_EX_TOOLWINDOW constant declared as long (0x80L) in C# to match GetWindowLongPtr return type"
  - "@() array wrapper in PS around ConvertTo-Json call — prevents bare object when only 1 window matches"

patterns-established:
  - "Pattern: embed PS Add-Type C# as TypeScript template literal, run via spawnSync, parse stdout as JSON"
  - "Pattern: resetCache() exported alongside main function for vitest test isolation"

requirements-completed: [ENUM-01, ENUM-02, ENUM-03, ENUM-04]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 12 Plan 01: Window Enumeration Summary

**PowerShell Add-Type inline C# with EnumWindows 4-filter chain (IsWindowVisible, title, DWMWA_CLOAKED, WS_EX_TOOLWINDOW) and 5s module-scope TTL cache exposed via GET /list-windows behind Bearer auth**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T07:53:19Z
- **Completed:** 2026-03-30T07:55:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `windowEnumerator.ts` with complete 4-filter Win32 P/Invoke chain via PS Add-Type inline C#
- 5s TTL module-scope cache prevents redundant PowerShell spawns on repeated calls
- 6 vitest unit tests cover cache hit, cache expiry, return type, empty output, PS error, and resetCache
- Wired `GET /list-windows` into `server.ts` behind existing Bearer auth with 500 error handling
- Updated `vitest.config.ts` to include `sidecar/src/**/*.test.ts` so sidecar tests run alongside frontend tests

## Task Commits

Each task was committed atomically:

1. **Task 1: windowEnumerator.ts + tests + vitest config** - `677a381` (feat, TDD green)
2. **Task 2: GET /list-windows route in server.ts** - `37f89a5` (feat)

**Plan metadata:** (docs commit below)

_Note: TDD task — test file written first (RED confirmed), then implementation (GREEN confirmed), no refactor needed._

## Files Created/Modified
- `sidecar/src/windowEnumerator.ts` - WindowInfo interface, listWindows(), resetCache(), PS_SCRIPT with Add-Type C# and 4-filter chain
- `sidecar/src/windowEnumerator.test.ts` - 6 vitest tests for cache TTL behavior using vi.mock('node:child_process')
- `sidecar/src/server.ts` - Added import + GET /list-windows route with try/catch 500 fallback
- `vitest.config.ts` - Expanded include to add sidecar/src/**/*.test.ts

## Decisions Made
- Used `spawnSync` with args array instead of `execSync` string — avoids shell quoting issues with the multi-line Add-Type heredoc
- `GetWindowLongPtr` (not `GetWindowLong`) — 64-bit pointer-sized result required on Windows 11 x64
- Declared `WS_EX_TOOLWINDOW = 0x80L` as `long` in C# to match `GetWindowLongPtr` return type conversion
- `@([WinEnum]::GetVisibleWindows()) | ConvertTo-Json` — `@()` array wrapper is critical when only 1 window is visible (PS would return a bare object without it)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The PS_SCRIPT contains the full C# implementation. No placeholders or hardcoded empty values. Manual verification (step 3-6 in plan verification) requires the app to be running to test the live PS execution against real windows.

## Next Phase Readiness
- `GET /list-windows` fully implemented and tested at the unit level
- Phase 13 (window capture) can import `listWindows()` directly from `windowEnumerator.ts`
- Manual verification (curl against running sidecar) is listed in plan as step 3-6 but does not block automated tests — all unit tests pass
- Phase 14 CLI wrapper and Phase 15 Claude skill can consume the endpoint via the discovery file token

---
*Phase: 12-window-enumeration*
*Completed: 2026-03-30*

## Self-Check: PASSED

Files verified:
- `sidecar/src/windowEnumerator.ts` — FOUND
- `sidecar/src/windowEnumerator.test.ts` — FOUND
- `sidecar/src/server.ts` (modified) — FOUND
- `vitest.config.ts` (modified) — FOUND

Commits verified:
- `677a381` — FOUND (feat: windowEnumerator with 4-filter chain, 5s TTL cache, and unit tests)
- `37f89a5` — FOUND (feat: wire GET /list-windows route into server.ts behind Bearer auth)
