---
phase: 24-secret-scrubber-trust-tiers
plan: 02
subsystem: api
tags: [security, secrets, scrubbing, http-routes, trust-tiers, typescript]

# Dependency graph
requires:
  - phase: 24-01
    provides: scrub() function and SecretMatch interface from secretScrubber.ts
  - phase: 23-terminal-buffer-layer
    provides: HTTP routes /terminal-state and /session-history in server.ts
provides:
  - /terminal-state?scrub=true|false — read-time secret scrubbing on terminal buffer output
  - /session-history?scrub=true|false — read-time secret scrubbing on historical session output
  - X-Scrub-Warning: best-effort header on all scrubbed responses
  - warning JSON field with best-effort disclaimer on all scrubbed responses
affects:
  - Phase 27 (MCP tools will call these routes with ?scrub=true for cloud tool calls)
  - Phase 25 (reuses detectSecrets() from secretScrubber.ts for screenshot blurring)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-time scrubbing: scrub applied at HTTP handler, ring buffer stores unscrubbed text (D-07)"
    - "Safe-default: ?scrub=true is default; scrub=false is opt-in bypass (D-06)"
    - "Dual response shape: scrubbed adds warning field + X-Scrub-Warning header, unscrubbed omits both"
    - "Test pattern: simulate server behavior inline — no HTTP server required"

key-files:
  created: []
  modified:
    - sidecar/src/server.ts
    - sidecar/src/server.test.ts

key-decisions:
  - "Default is scrub=true — only explicit scrub=false skips redaction (safe default per D-06)"
  - "Scrubbing happens at read-time in the HTTP handler, NOT at write-time in TerminalBuffer (D-07)"
  - "Both routes share the same scrub param pattern for consistent behavior across all callers (D-08)"
  - "Exact warning string: 'Secret scrubbing is best-effort. Do not rely on it as a security boundary.' (D-09)"

requirements-completed: [LLM-03, LLM-04]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 24 Plan 02: Scrub Integration in HTTP Routes Summary

**Both HTTP routes wired with ?scrub param: default scrubbed responses include X-Scrub-Warning header and warning JSON field; scrub=false bypasses redaction entirely**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-31T17:21:22Z
- **Completed:** 2026-03-31T17:24:28Z
- **Tasks:** 2 (wire integration + add tests)
- **Files modified:** 2

## Accomplishments

- `/terminal-state` now reads `?scrub` param — default `scrub=true` maps each buffer line through `scrub()`, adds `X-Scrub-Warning: best-effort` header and `warning` JSON field; `scrub=false` returns raw lines with no warning
- `/session-history` same behavior — applies `scrub()` to the already-cleaned `result` lines (post-crFold + stripAnsiSync) before JSON serialization
- 6 new tests added to `server.test.ts` covering: default redaction, scrub=false bypass, session-history pipeline scrubbing, warning field presence/absence, multi-secret line redaction
- All 118 tests across 6 test files pass; `tsc --noEmit` exits 0

## Task Commits

1. **Task 1: Wire scrub() into /terminal-state and /session-history** - `96a74e8` (feat)
2. **Task 2: Add tests for scrub integration in HTTP routes** - `66d4e35` (test)

## Files Created/Modified

- `sidecar/src/server.ts` — added `import { scrub } from './secretScrubber.js'`; modified both GET routes to read `?scrub` param, apply `scrub()` per-line when `shouldScrub=true`, conditionally add `X-Scrub-Warning` header and `warning` JSON field
- `sidecar/src/server.test.ts` — added `import { scrub } from './secretScrubber.js'`; added `describe('secret scrubbing integration')` block with 6 tests

## Decisions Made

- Safe-default: `url.searchParams.get('scrub') !== 'false'` means only the explicit string `"false"` disables scrubbing; absent param, `"true"`, or any other value all enable scrubbing
- Scrubbing applied after the existing `result`/`snapshot.lines` — does not touch the ring buffer or SQLite store
- Test structure mirrors existing Phase 23 tests: inline data pipeline simulation rather than live HTTP server (no PTY or SQLite required)

## Deviations from Plan

None — plan executed exactly as written. Both routes implement the exact specification from D-06, D-07, D-08, D-09.

## Known Stubs

None — all scrub behavior is fully wired. Both routes produce correct scrubbed/unscrubbed output.

## Issues Encountered

- `cd sidecar && npx vitest run` fails (vitest not in sidecar devDependencies — it lives in root package.json). Run tests from root: `npx vitest run sidecar/src/`. This matches how Phase 23 and 24-01 tests ran.

## User Setup Required

None.

## Next Phase Readiness

- Phase 27 MCP tools can call `/terminal-state?scrub=true` and `/session-history?sessionId=N&scrub=true` to get scrubbed output for cloud LLM calls
- Phase 25 screenshot blurring can reuse `detectSecrets()` from `secretScrubber.ts` (already exported, already tested)

---
*Phase: 24-secret-scrubber-trust-tiers*
*Completed: 2026-03-31*

## Self-Check: PASSED

- FOUND: sidecar/src/server.ts
- FOUND: sidecar/src/server.test.ts
- FOUND: .planning/phases/24-secret-scrubber-trust-tiers/24-02-SUMMARY.md
- FOUND: commit 96a74e8
- FOUND: commit 66d4e35
