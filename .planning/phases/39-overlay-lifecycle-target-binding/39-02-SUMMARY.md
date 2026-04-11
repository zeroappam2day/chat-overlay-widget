---
phase: 39-overlay-lifecycle-target-binding
plan: 02
subsystem: sidecar
tags: [walkthrough, hwnd, schema, mcp]
dependency_graph:
  requires: []
  provides: [targetHwnd-schema, targetHwnd-getter, mcp-targetHwnd]
  affects: [walkthroughEngine, mcp-server]
tech_stack:
  added: []
  patterns: [zod-optional-field, tdd-red-green]
key_files:
  created: []
  modified:
    - sidecar/src/walkthroughEngine.ts
    - sidecar/src/walkthroughEngine.test.ts
    - sidecar/src/mcp-server.ts
decisions:
  - targetHwnd stored on ActiveWalkthrough (not just Walkthrough) for clear lifecycle ownership
metrics:
  duration: 4m30s
  completed: "2026-04-11T09:17:00Z"
  tasks: 2
  files: 3
---

# Phase 39 Plan 02: Target Window Binding (targetHwnd) Summary

Optional targetHwnd field added to WalkthroughSchema and MCP tool, enabling walkthrough-to-window binding for Phase 40+ focus tracking and verification.

## What Was Done

### Task 1: Add targetHwnd to WalkthroughSchema, ActiveWalkthrough, and engine with tests (TDD)

**RED phase:** Added 6 failing tests in `describe('targetHwnd binding')` block covering storage, retrieval, clearing, and schema validation (positive int, no value, 0, -1, 1.5).

**GREEN phase:**
- `WalkthroughSchema`: Added `targetHwnd: z.number().int().positive().optional()`
- `ActiveWalkthrough` interface: Added `targetHwnd?: number`
- `start()` method: Stores `targetHwnd: walkthrough.targetHwnd` in active state
- `getTargetHwnd()` method: Returns `this.active?.targetHwnd ?? null`
- All 21 tests pass

**Commits:** `e36e195` (RED), `3211864` (GREEN)

### Task 2: Update MCP tool schema and handler to pass targetHwnd

- Added `targetHwnd` field to `start_guided_walkthrough` inline Zod schema with description
- Updated handler destructuring to include `targetHwnd`
- Updated `JSON.stringify` call to include `targetHwnd` in POST body
- Build passes, full test suite (484 tests) passes

**Commit:** `f20ddc9`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx vitest run sidecar/src/walkthroughEngine.test.ts` -- 21/21 pass
- `npx vitest run` -- 484/484 pass
- `npm run build` -- exits 0

## Self-Check: PASSED

- [x] sidecar/src/walkthroughEngine.ts modified with targetHwnd in schema, interface, start(), getTargetHwnd()
- [x] sidecar/src/walkthroughEngine.test.ts modified with targetHwnd binding describe block
- [x] sidecar/src/mcp-server.ts modified with targetHwnd in tool schema and handler
- [x] Commits e36e195, 3211864, f20ddc9 exist
