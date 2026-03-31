---
phase: 20-metadata-injection-integration
plan: 01
subsystem: ui
tags: [vitest, typescript, xterm, formatting, tdd]

# Dependency graph
requires:
  - phase: 06-shell-path-quoting
    provides: quotePathForShell utility used by formatCaptureBlock

provides:
  - formatCaptureBlock utility: converts capture metadata to 6-line text block for Claude spatial reasoning
  - CaptureBlockInput interface: typed input contract for the formatter

affects:
  - 20-02 (capture injection into ChatInputBar will import formatCaptureBlock)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD with vitest — RED/GREEN/REFACTOR cycle for pure utility functions
    - Thin formatter pattern: delegates path quoting to existing quotePathForShell, handles only metadata layout

key-files:
  created:
    - src/utils/formatCaptureBlock.ts
    - src/utils/formatCaptureBlock.test.ts
  modified: []

key-decisions:
  - "formatCaptureBlock delegates shell-quoting entirely to quotePathForShell — no duplication of quoting logic"
  - "dpiScale formatted with toFixed(4) for consistent 4-decimal precision matching computer_use coordinate convention"
  - "Block uses # comment lines readable by Claude without JSON parsing — plain text, no structured format"

patterns-established:
  - "Pure utility TDD: write failing tests first, then minimal implementation, no refactor needed for simple formatters"

requirements-completed:
  - CAPT-02
  - CAPT-03

# Metrics
duration: 1min
completed: 2026-03-31
---

# Phase 20 Plan 01: formatCaptureBlock Utility Summary

**TDD-built `formatCaptureBlock()` utility that converts capture metadata to a 6-line shell-quoted + coordinate-annotated text block for Claude spatial reasoning (CAPT-02, CAPT-03)**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-31T07:14:51Z
- **Completed:** 2026-03-31T07:15:52Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `CaptureBlockInput` interface matching `capture-result-with-metadata` protocol type
- Implemented `formatCaptureBlock` producing 6-line block: shell-quoted path + 5 comment lines
- All 7 TDD tests pass: PS/cmd/bash/null shells, dpiScale toFixed(4), title passthrough, line count

## Task Commits

1. **Task 1: TDD formatCaptureBlock utility** - `c953614` (feat)

## Files Created/Modified

- `src/utils/formatCaptureBlock.ts` - Exports CaptureBlockInput interface and formatCaptureBlock function
- `src/utils/formatCaptureBlock.test.ts` - 7 unit tests covering all shell types and output format

## Decisions Made

- `formatCaptureBlock` delegates to existing `quotePathForShell` — no duplication of path-quoting logic
- `dpiScale.toFixed(4)` for consistent 4-decimal precision per computer_use convention
- Block uses plain `# comment` lines so Claude can read without JSON parsing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `formatCaptureBlock` is ready for import in Plan 02, which wires capture results into ChatInputBar
- No blockers

---
*Phase: 20-metadata-injection-integration*
*Completed: 2026-03-31*
