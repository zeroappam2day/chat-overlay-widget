---
phase: 40-focus-aware-overlay
plan: 01
subsystem: sidecar
tags: [powershell, win32, pinvoke, focus-tracking, websocket, polling, debounce]

requires:
  - phase: 39-overlay-lifecycle-target-binding
    provides: WalkthroughSchema.targetHwnd, walkthroughEngine.getTargetHwnd()

provides:
  - Win32Bridge: persistent PowerShell child process for Win32 API calls
  - FocusTracker: 250ms polling, affiliated-set logic, debounced hide, stale detection
  - server.ts lifecycle wiring: start/stop/advance/deactivate hooks for focus tracking
  - broadcastFocusEvent(): WebSocket overlay-focus events (show/hide/target-lost)

affects: [40-02-plan, overlay-frontend, focus-aware-overlay]

tech-stack:
  added: []
  patterns:
    - "Persistent PowerShell bridge pattern: spawn once, Add-Type once, JSON line protocol with request ID"
    - "setTimeout chain polling (not setInterval) to prevent post-sleep burst"
    - "Affiliated set: owner chain (5 levels) + PID match + ApplicationFrameHost exclusion"
    - "Debounced hide with immediate cancel on show"

key-files:
  created:
    - sidecar/src/win32Bridge.ts
    - sidecar/src/win32Bridge.test.ts
    - sidecar/src/focusTracker.ts
    - sidecar/src/focusTracker.test.ts
  modified:
    - sidecar/src/server.ts
    - sidecar/src/walkthroughEngine.ts

key-decisions:
  - "PowerShell stdin/stdout JSON line protocol with request ID correlation for concurrent request safety"
  - "setTimeout chain (not setInterval) prevents timer burst after system wake/sleep (D-02)"
  - "ApplicationFrameHost.exe excluded from PID affiliation to avoid false positives on UWP app hosts"
  - "3000ms timeout with auto-reject + auto-restart on crash implements T-40-02 DoS mitigation"
  - "walkthroughEngine.ts restored from phase 39 (worktree divergence: getTargetHwnd was missing)"

patterns-established:
  - "Win32Bridge singleton: init() called at module load, all callers use re-exported convenience functions"
  - "FocusTracker: lastEmitted state dedup prevents duplicate show/hide callbacks"

requirements-completed: [FOCUS-01, FOCUS-02, FOCUS-03]

duration: 75min
completed: 2026-04-11
---

# Phase 40 Plan 01: Focus-Aware Overlay Sidecar Backend Summary

**Persistent PowerShell Win32 bridge + 250ms FocusTracker with affiliated-set logic, debounce, and WebSocket focus events wired into walkthrough lifecycle**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-04-11T19:00:00Z
- **Completed:** 2026-04-11T20:05:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Win32Bridge spawns one PowerShell process at sidecar startup, compiles Add-Type C# once, routes concurrent requests by ID with 3s timeout and auto-restart on crash
- FocusTracker polls at 250ms via setTimeout chains, resolves affiliated windows (owner chain up to 5 levels + PID match excluding ApplicationFrameHost.exe), debounces hide at 150ms, detects stale HWNDs and minimized targets
- server.ts wired: focusTracker starts on walkthrough/start (only when targetHwnd present), stops on walkthrough/stop, advance/done, and modeManager deactivation
- 22 unit tests across both modules (10 Win32Bridge + 12 FocusTracker), all passing

## Task Commits

1. **Task 1: win32Bridge.ts + unit tests** - `657e8fb` (feat)
2. **Task 2: focusTracker.ts + server.ts wiring + unit tests** - `6ef99e2` (feat)

## Files Created/Modified
- `sidecar/src/win32Bridge.ts` - Persistent PowerShell bridge; exports Win32Bridge class, win32Bridge singleton, and convenience functions (getForegroundWindow, getWindowThreadProcessId, isWindow, isIconic, getOwnerWindow, getProcessName)
- `sidecar/src/win32Bridge.test.ts` - 10 unit tests: spawn mock, init/READY, all commands, timeout, crash, destroy, concurrent request ID correlation
- `sidecar/src/focusTracker.ts` - FocusTracker class; 250ms setTimeout chain, affiliated set (owner chain + PID), 150ms debounce, stale/minimized detection, self-hwnd set
- `sidecar/src/focusTracker.test.ts` - 12 unit tests: all polling behaviors, affiliated set cases, dedup, target-lost
- `sidecar/src/server.ts` - Added FocusTracker import, module-level focusTracker var, broadcastFocusEvent(), start/stop wiring at 4 lifecycle points
- `sidecar/src/walkthroughEngine.ts` - Restored getTargetHwnd() and targetHwnd field from phase 39 (worktree divergence fix, Rule 3)

## Decisions Made
- PowerShell stdin/stdout JSON line protocol chosen over named pipes for simplicity and compatibility with existing PS bridge patterns in the codebase
- setTimeout chain (not setInterval) for poll loop prevents post-sleep timer burst per D-02
- ApplicationFrameHost.exe excluded from PID affiliation — UWP app host holds windows for multiple apps and would cause false positives
- `as any` cast on broadcastFocusEvent message since protocol.ts overlay-focus type added in Plan 02

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored walkthroughEngine.ts from phase 39**
- **Found during:** Task 2 (focusTracker wiring into server.ts)
- **Issue:** Worktree was created from an older commit; walkthroughEngine.ts was missing getTargetHwnd() and targetHwnd field added in phase 39. The plan interface spec referenced these.
- **Fix:** Copied walkthroughEngine.ts from main repo (which had phase 39 changes at HEAD d6f4966)
- **Files modified:** sidecar/src/walkthroughEngine.ts
- **Verification:** grep confirmed targetHwnd and getTargetHwnd present; tests pass
- **Committed in:** 6ef99e2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking worktree divergence)
**Impact on plan:** Required fix — without getTargetHwnd(), focus tracking could not start. No scope creep.

## Issues Encountered
- Worktree created from stale base: `git reset --soft` moved branch pointer but not working tree files. Several sidecar source files were at an older version (before phase 39). Resolved by copying affected files from main repo.
- PowerShell Add-Type block embedded in TypeScript template literal: backtick-quotes in PS (`"id"`) conflicted with esbuild parser. Fixed by switching to PS single-quote string concatenation (`'{"id":' + $id + ...`).

## Known Stubs
None — all exports are fully implemented. The `as any` cast in broadcastFocusEvent is intentional (protocol.ts updated in Plan 02).

## Threat Flags
None — all threat mitigations from T-40-01 through T-40-05 are implemented:
- T-40-02 (DoS via hang): 3s timeout, auto-restart, pending reject on crash
- T-40-05 (polling runaway): setTimeout chain + isTracking boolean guard

## Next Phase Readiness
- Plan 02 (frontend) can consume overlay-focus WebSocket events (type: 'overlay-focus', event: 'show'|'hide'|'target-lost')
- win32Bridge singleton is available for import by any sidecar module needing Win32 API access
- FocusTracker can be extended with addSelfHwnd() when frontend reports its own hwnd (Plan 02)

## Self-Check: PASSED
- sidecar/src/win32Bridge.ts: FOUND
- sidecar/src/win32Bridge.test.ts: FOUND
- sidecar/src/focusTracker.ts: FOUND
- sidecar/src/focusTracker.test.ts: FOUND
- sidecar/src/server.ts: FOUND (modified)
- Commit 657e8fb: FOUND
- Commit 6ef99e2: FOUND

---
*Phase: 40-focus-aware-overlay*
*Completed: 2026-04-11*
