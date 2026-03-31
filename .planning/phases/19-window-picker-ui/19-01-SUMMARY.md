---
phase: 19-window-picker-ui
plan: 01
subsystem: frontend/components
tags: [react, testing, window-picker, jsdom, tdd]
dependency_graph:
  requires: [src/protocol.ts (WindowThumbnail type)]
  provides: [src/components/WindowPicker.tsx]
  affects: [Plan 02 (TerminalPane integration)]
tech_stack:
  added:
    - "@testing-library/react"
    - "@testing-library/user-event"
    - "@testing-library/jest-dom"
    - "jsdom@24"
  patterns:
    - "TDD: RED-GREEN cycle with vitest + @testing-library/react"
    - "environmentMatchGlobs for mixed jsdom/node test environments"
    - "@vitest-environment jsdom docblock for per-file environment override"
    - "afterEach(cleanup) to prevent DOM leakage between tests"
key_files:
  created:
    - src/components/WindowPicker.tsx
    - src/components/__tests__/WindowPicker.test.tsx
    - src/test-setup.ts
  modified:
    - vitest.config.ts
    - package.json
    - package-lock.json
decisions:
  - "jsdom downgraded to v24 (not v27) for Node 20.17.0 compatibility — v27 requires Node 20.19.0+"
  - "Use @vitest-environment jsdom docblock in test file (not global environment) to avoid breaking sidecar CJS tests"
  - "afterEach(cleanup) added explicitly — vitest 4 does not auto-cleanup between tests in jsdom mode"
metrics:
  duration: "6m 20s"
  completed: "2026-03-31"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 19 Plan 01: WindowPicker Component Summary

WindowPicker React component with full TDD coverage: thumbnail grid, case-insensitive search filter, arrow-key navigation with stopPropagation, and Refresh/close actions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install test deps and update vitest config | ba8ea46 | package.json, vitest.config.ts, package-lock.json |
| 2 (RED) | Write failing WindowPicker tests | 19e8ad2 | WindowPicker.test.tsx, test-setup.ts, vitest.config.ts |
| 2 (GREEN) | Implement WindowPicker component | 52bcb00 | WindowPicker.tsx, WindowPicker.test.tsx, package.json |

## Verification Results

- `npx vitest run` — 66 tests, 6 files, all pass (49 existing + 17 new)
- Test count: 17 test cases in WindowPicker.test.tsx (>12 minimum)
- `grep 'WindowThumbnail' WindowPicker.tsx` — confirmed import from protocol

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom v27 ESM/CJS incompatibility on Node 20.17.0**
- **Found during:** Task 1 verification
- **Issue:** jsdom v27 requires Node 20.19.0+ (uses @csstools/css-calc as pure ESM). Node 20.17.0 cannot require it, causing ERR_REQUIRE_ESM crash in vitest pool.
- **Fix:** Downgraded jsdom to v24 which uses CJS-compatible dependencies
- **Files modified:** package.json, package-lock.json
- **Commit:** 52bcb00

**2. [Rule 1 - Bug] Global jsdom environment broke sidecar CJS tests**
- **Found during:** Task 1 verification (first attempt)
- **Issue:** Setting `environment: 'jsdom'` globally applied jsdom to sidecar/src/** tests which use node:child_process CJS modules — crashing them
- **Fix:** Used `environmentMatchGlobs` to scope jsdom to src/**, node to sidecar/src/**; also added `@vitest-environment jsdom` docblock to test file as final override
- **Files modified:** vitest.config.ts
- **Commit:** ba8ea46

**3. [Rule 1 - Bug] @testing-library/jest-dom ERR_REQUIRE_ESM in setup file**
- **Found during:** Task 1 verification
- **Issue:** `import '@testing-library/jest-dom'` in setup file calls `expect` before vitest injects it, causing "expect is not defined"
- **Fix:** Used `@testing-library/jest-dom/vitest` entry point which uses vitest's `expect` via `afterEach` registration
- **Files modified:** src/test-setup.ts
- **Commit:** 19e8ad2

**4. [Rule 1 - Bug] DOM leakage between tests — "Found multiple elements"**
- **Found during:** Task 2 GREEN phase
- **Issue:** vitest 4 does not auto-call `cleanup()` between tests in jsdom mode. Renders from test N leaked into test N+1.
- **Fix:** Added `afterEach(() => { cleanup(); })` to test file
- **Files modified:** src/components/__tests__/WindowPicker.test.tsx
- **Commit:** 52bcb00

## Known Stubs

None — all component logic is wired. `onSelect` prop is a no-op pending Phase 20 integration (intentional per plan spec).

## Component API

```typescript
interface WindowPickerProps {
  windows: WindowThumbnail[];
  onClose: () => void;
  onRefresh: () => void;
  onSelect?: (window: WindowThumbnail) => void; // Phase 20 hook
}
```

Key behaviors:
- Root div: `absolute inset-0 z-10`, `tabIndex={-1}`, `onKeyDown={handleKeyDown}`
- All keyDown events call `stopPropagation()`
- Arrow keys navigate grid (COLS=3); Escape → `onClose()` + focuses `.chat-input-textarea`
- Search: `useMemo` case-insensitive substring on title OR processName
- selectedIndex resets to 0 on search change
- Empty filter state shows "No matching windows"
- Error windows show error text in placeholder div (not hidden)
- Thumbnail windows show `<img src="data:image/png;base64,..."/>`

## Self-Check: PASSED

- src/components/WindowPicker.tsx — FOUND
- src/components/__tests__/WindowPicker.test.tsx — FOUND
- src/test-setup.ts — FOUND
- Commit ba8ea46 (Task 1) — FOUND
- Commit 19e8ad2 (Task 2 RED) — FOUND
- Commit 52bcb00 (Task 2 GREEN) — FOUND
