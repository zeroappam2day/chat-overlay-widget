---
phase: 13-window-capture
plan: 02
subsystem: api
tags: [http, window-capture, powershell, csharp, p-invoke]

requires:
  - phase: 13-01
    provides: captureWindow() function and CaptureResult type
provides:
  - POST /capture/window HTTP endpoint wired to captureWindow module
  - Manual verification of capture flow (DPI, minimized, error handling)
affects: [14-overlay-capture-cli, 15-claude-skill]

tech-stack:
  added: []
  patterns: [inline-json-body-parsing, typed-capture-response]

key-files:
  created: []
  modified:
    - sidecar/src/server.ts
    - sidecar/src/windowCapture.ts
    - sidecar/src/windowCapture.test.ts

key-decisions:
  - "-ReferencedAssemblies System.Drawing required for Add-Type -TypeDefinition inline C# — PS loads assembly for runtime but C# compiler needs explicit reference"
  - "ERROR:MINIMIZED early return for IsIconic windows — PrintWindow PW_RENDERFULLCONTENT returns black rectangles for minimized windows; restore-capture-minimize rejected (focus steal, race conditions, UX disruption)"
  - "Removed dead code: GetWindowPlacement, WINDOWPLACEMENT, POINT structs no longer needed after MINIMIZED early return"

patterns-established:
  - "Minimized window handling: return actionable error, let caller decide to restore"

requirements-completed: [WCAP-01, WCAP-04, WCAP-05]

duration: 45min
completed: 2026-03-30
---

# Phase 13 Plan 02: Window Capture HTTP Route + Manual Verification Summary

**POST /capture/window endpoint with JSON body parsing, title validation, and captureWindow integration — verified via 6 manual tests including DPI and minimized window behavior**

## Performance

- **Duration:** ~45 min (including debug session for 2 bug fixes)
- **Started:** 2026-03-30T09:08:00Z
- **Completed:** 2026-03-30T11:45:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- POST /capture/window route wired into server.ts with proper HTTP status codes (200/400/404/500)
- Fixed critical bug: Add-Type missing -ReferencedAssemblies System.Drawing (all captures were failing)
- Implemented ERROR:MINIMIZED early return — clear error instead of black rectangles
- All 6 manual verification tests passed (capture, no-match, health, DPI, minimized, missing title)

## Task Commits

1. **Task 1: POST /capture/window route** - `21e3b82` (feat)
2. **Bug fixes (debug session)** - `a4e6721` (fix: System.Drawing reference + MINIMIZED early return)

## Files Created/Modified
- `sidecar/src/server.ts` - POST /capture/window route with JSON body parsing, captureWindow call, typed response
- `sidecar/src/windowCapture.ts` - Added -ReferencedAssemblies System.Drawing, replaced minimized fallback with ERROR:MINIMIZED
- `sidecar/src/windowCapture.test.ts` - Updated test 10 for MINIMIZED behavior assertion

## Decisions Made
- **-ReferencedAssemblies System.Drawing:** PowerShell's Add-Type -AssemblyName loads for PS runtime, but the inline C# compiler needs an explicit -ReferencedAssemblies flag to resolve System.Drawing.Imaging (ImageFormat.Png). Root cause of all captures returning "unexpected PS output: ".
- **ERROR:MINIMIZED over restore-capture-minimize:** Stress-tested from 4 adversarial perspectives (YAGNI, reliability, UX, maintainability). Unanimous verdict: single-user local tool where user can restore the window in <1 second. Automating restoration adds race conditions (Thread.Sleep timing), focus stealing, and 15+ lines of fragile Win32 choreography.

## Deviations from Plan

### Auto-fixed Issues

**1. [Missing Critical] Add-Type -ReferencedAssemblies System.Drawing**
- **Found during:** Manual verification (Task 2)
- **Issue:** All captures returned empty stdout — C# compiler couldn't find System.Drawing.Imaging namespace
- **Fix:** Added `-ReferencedAssemblies System.Drawing` to the Add-Type -TypeDefinition call
- **Files modified:** sidecar/src/windowCapture.ts
- **Verification:** Direct PS test returned OK: with valid 2560x1528 PNG
- **Committed in:** a4e6721

**2. [Design Change] ERROR:MINIMIZED instead of black rectangle capture**
- **Found during:** Manual verification (Task 2) — minimized Chrome capture was all-black pixels
- **Issue:** PrintWindow PW_RENDERFULLCONTENT cannot render minimized windows (GPU surface not composited)
- **Fix:** IsIconic(target) now returns ERROR:MINIMIZED immediately; removed dead code (GetWindowPlacement, WINDOWPLACEMENT, POINT)
- **Files modified:** sidecar/src/windowCapture.ts, sidecar/src/windowCapture.test.ts
- **Verification:** Minimized capture returns HTTP 404 {"error":"MINIMIZED"}; restored capture returns HTTP 200 with valid PNG
- **Committed in:** a4e6721

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 design change)
**Impact on plan:** Both fixes essential for correctness. MINIMIZED behavior is a design improvement over original plan's GetWindowPlacement fallback which produced black rectangles.

## Issues Encountered
- PowerShell `curl` alias (Invoke-WebRequest) incompatible with real curl `-H` syntax — manual verification steps should use Git Bash curl or Invoke-RestMethod
- tauri-dev.sh lock poll has a path mangling bug (C:\mnt\c\...) when launched from Git Bash — workaround: start app directly with `npx tauri dev`

## Manual Verification Results

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Capture Chrome (normal) | HTTP 200 + PNG path | 200 + 2560x1528 PNG | PASS |
| No-match | HTTP 404 + NO_MATCH | 404 + {"error":"NO_MATCH"} | PASS |
| Health after error | HTTP 200 + ok:true | 200 + {"ok":true} | PASS |
| DPI (100% scaling) | Native resolution | 2560x1528 (correct) | PASS |
| Minimized capture | Actionable error | 404 + {"error":"MINIMIZED"} | PASS |
| Missing title | HTTP 400 | 400 + {"error":"title is required"} | PASS |

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Window capture API complete — POST /capture/window returns PNG path or actionable error
- Phase 14 (overlay-capture CLI) can read api.port and call this endpoint
- DPI at 100% verified; MINIMIZED returns clear error for caller to handle

---
*Phase: 13-window-capture*
*Completed: 2026-03-30*
