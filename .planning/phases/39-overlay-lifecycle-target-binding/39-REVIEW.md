---
phase: 39-overlay-lifecycle-target-binding
reviewed: 2026-04-11T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - sidecar/src/mcp-server.ts
  - sidecar/src/walkthroughEngine.test.ts
  - sidecar/src/walkthroughEngine.ts
  - src/store/annotationBridgeStore.test.ts
  - src/store/annotationBridgeStore.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 39: Code Review Report

**Reviewed:** 2026-04-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This phase adds `targetHwnd` binding to the walkthrough engine (schema, storage, getter) and wires overlay show/hide lifecycle into the annotation bridge store. The walkthrough engine changes are clean and well-tested. The annotation bridge store has a logic issue where the overlay auto-show/hide bypasses the `annotationOverlay` feature flag gate, and the MCP server has a regex injection surface. Test coverage for the new features is solid.

## Critical Issues

### CR-01: User-supplied regex in advanceWhen pattern compiled without safety

**File:** `sidecar/src/walkthroughEngine.ts:114`
**Issue:** `getCurrentAdvancePattern()` compiles a user-supplied string directly via `new RegExp(step.advanceWhen.pattern)`. While the catch block prevents crashes, a malicious or careless pattern like `(a+)+$` causes catastrophic backtracking (ReDoS). The pattern originates from the MCP `start_guided_walkthrough` tool input (line 386 of mcp-server.ts), which is externally controlled. Since this regex is evaluated against terminal output (potentially large), a ReDoS pattern could hang the sidecar event loop.
**Fix:** Use a safe regex library (e.g., `re2` or `safe-regex`) or enforce a complexity/length limit. Alternatively, wrap execution in a timeout:
```typescript
import RE2 from 're2';

getCurrentAdvancePattern(): RegExp | null {
  if (!this.active) return null;
  const step = this.active.walkthrough.steps[this.active.currentIndex];
  if (!step.advanceWhen || step.advanceWhen.type !== 'terminal-match') return null;
  try {
    return new RE2(step.advanceWhen.pattern);
  } catch {
    return null;
  }
}
```

## Warnings

### WR-01: Overlay show/hide not gated behind annotationOverlay feature flag

**File:** `src/store/annotationBridgeStore.ts:39-47`
**Issue:** The new overlay lifecycle logic (`showOverlay`/`hideOverlay`) is gated only behind `guidedWalkthrough`, but the `setAnnotations` method on line 27 gates behind `annotationOverlay`. The overlay window itself is an annotation surface -- showing it when `annotationOverlay` is disabled creates an inconsistency where the overlay window appears but annotations are blocked. If both flags exist independently, the show/hide should check both, or at minimum check `annotationOverlay` since the overlay renders annotations.
**Fix:** Add `annotationOverlay` check alongside `guidedWalkthrough`:
```typescript
setWalkthroughStep: (step) => {
  const flags = useFeatureFlagStore.getState();
  if (!flags.guidedWalkthrough) return;
  emit('update-walkthrough-step', step).catch(/* ... */);
  if (!flags.annotationOverlay) return; // don't toggle overlay if annotations are off
  if (step !== null) {
    useOverlayStore.getState().showOverlay().catch(/* ... */);
  } else {
    useOverlayStore.getState().hideOverlay().catch(/* ... */);
  }
},
```

### WR-02: Redundant targetHwnd field in ActiveWalkthrough interface

**File:** `sidecar/src/walkthroughEngine.ts:50`
**Issue:** The `ActiveWalkthrough` interface has a separate `targetHwnd?: number` field, but this value already exists in `walkthrough.targetHwnd` (since `Walkthrough` now includes it via the schema). On `start()` line 60, the value is copied: `targetHwnd: walkthrough.targetHwnd`. The `getTargetHwnd()` method reads from `this.active.targetHwnd` rather than `this.active.walkthrough.targetHwnd`. This creates two sources of truth -- if the walkthrough object is mutated (e.g., via a future `rebind` operation), the cached copy will be stale.
**Fix:** Remove the redundant field and read directly from the walkthrough:
```typescript
interface ActiveWalkthrough {
  walkthrough: Walkthrough;
  currentIndex: number;
  // Remove targetHwnd -- read from walkthrough.targetHwnd
}

getTargetHwnd(): number | null {
  return this.active?.walkthrough.targetHwnd ?? null;
}
```

## Info

### IN-01: Duplicate tool number comment (Tool 9 appears twice)

**File:** `sidecar/src/mcp-server.ts:521,551`
**Issue:** Both `write_terminal` (line 521) and `web_fetch` (line 551) are labeled as "Tool 9" in comments. The `web_fetch` tool should be Tool 10.
**Fix:** Renumber `web_fetch` comment to `Tool 10` and subsequent tools accordingly.

### IN-02: Test file missing coverage for annotationOverlay flag interaction

**File:** `src/store/annotationBridgeStore.test.ts`
**Issue:** Tests cover `guidedWalkthrough` flag gating but do not mock or test the `annotationOverlay` flag. The `setAnnotations` path is not tested at all. While this is a new test file focused on the walkthrough step lifecycle, the missing coverage for `setAnnotations` means the existing code path has no regression protection.
**Fix:** Add test cases for `setAnnotations` with `annotationOverlay` enabled/disabled, and (if WR-01 is addressed) test the interaction between both flags in `setWalkthroughStep`.

---

_Reviewed: 2026-04-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
