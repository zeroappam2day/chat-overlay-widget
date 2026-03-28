---
phase: 06-shell-path-formatting-input-bar
plan: 01
subsystem: ui
tags: [vitest, typescript, shell-quoting, powershell, cmd, bash, screenshot]

# Dependency graph
requires:
  - phase: 04-differentiating-features
    provides: Screenshot save-image flow (ptySession.saveImage, pendingImagePath state, ChatInputBar pendingImagePath injection)
provides:
  - quotePathForShell pure utility (src/utils/shellQuote.ts) for all 3 shells + null guard
  - ChatInputBar currentShell prop wiring for shell-aware path injection
  - UUID-only temp filenames (no sessionId prefix) eliminating shell escaping edge cases
  - Vitest test infrastructure for src/ unit tests
affects: [06-02-input-bar-resize, future phases using screenshot path injection]

# Tech tracking
tech-stack:
  added: [vitest@4.1.2]
  patterns: [TDD for pure utility functions, quotePathForShell called at injection time not send time]

key-files:
  created:
    - src/utils/shellQuote.ts
    - src/utils/shellQuote.test.ts
    - vitest.config.ts
  modified:
    - src/components/ChatInputBar.tsx
    - src/components/TerminalPane.tsx
    - sidecar/src/ptySession.ts

key-decisions:
  - "quotePathForShell applied at pendingImagePath injection time (useEffect), not at send time — per D-04"
  - "UUID-only filenames (no sessionId prefix) for temp screenshots — PATH-02 compliance; no shell escaping edge cases from numeric IDs"
  - "vitest.config.ts targets src/**/*.test.ts only — keeps sidecar tests separate"
  - "currentShell ?? null passed to quotePathForShell — handles both undefined (new optional prop) and null (no shell spawned)"

patterns-established:
  - "quotePathForShell pattern: inject quoted path at display time, send raw value to PTY as user typed"
  - "Shell-aware injection: currentShell flows from TerminalPane state down to ChatInputBar prop"

requirements-completed: [PATH-01, PATH-02]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 06 Plan 01: Shell Path Quoting Summary

**Shell-aware screenshot path quoting via quotePathForShell utility (PowerShell/cmd/bash/null), wired into ChatInputBar via currentShell prop, with UUID-only temp filenames**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-28T12:00:00Z
- **Completed:** 2026-03-28T12:08:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `quotePathForShell` pure utility covering PowerShell (single-quote + '' escape), cmd.exe (double-quote), Git Bash (forward-slash + /c/ drive + POSIX '' escape), and null/undefined guard
- 9 vitest unit tests cover all 3 shells, null, undefined, and embedded-single-quote edge cases — all passing
- ChatInputBar now applies shell-aware quoting at injection time via new `currentShell` optional prop
- TerminalPane passes its `currentShell` state down to ChatInputBar
- Sidecar temp filenames changed to UUID-only format (removed sessionId prefix) per PATH-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Create quotePathForShell utility with vitest tests** - `75e1b65` (feat)
2. **Task 2: Integrate path quoting into ChatInputBar and fix UUID filename** - `8fb4f38` (feat)

## Files Created/Modified

- `src/utils/shellQuote.ts` — quotePathForShell pure function, all shell quoting rules
- `src/utils/shellQuote.test.ts` — 9 unit tests via vitest
- `vitest.config.ts` — vitest configuration targeting src/**/*.test.ts
- `src/components/ChatInputBar.tsx` — added currentShell prop, import, quoting in pendingImagePath effect
- `src/components/TerminalPane.tsx` — pass currentShell={currentShell} to ChatInputBar
- `sidecar/src/ptySession.ts` — UUID-only filename (removed `${this.sessionId}-` prefix)

## Decisions Made

- quotePathForShell is called in the pendingImagePath useEffect (injection time), not in handleKeyDown (send time). This ensures the user sees the properly quoted path and can edit it before sending (per D-04).
- UUID-only filenames for temp screenshots: removes sessionId numeric prefix that could contain characters needing escaping in some contexts.
- `currentShell ?? null` at the call site ensures compatibility regardless of whether the prop is undefined (not passed) or null (no shell spawned yet).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all wiring is functional end-to-end.

## Next Phase Readiness

- quotePathForShell utility and vitest infrastructure ready for any Phase 06 follow-on tests
- Phase 06-02 (resizable chat input bar) can proceed — no blocking items from this plan
- The `currentShell` prop is optional with `?` so existing code paths without a known shell gracefully fall back to raw path (no quoting)

---
*Phase: 06-shell-path-formatting-input-bar*
*Completed: 2026-03-28*
