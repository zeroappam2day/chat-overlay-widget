---
phase: 40-focus-aware-overlay
reviewed: 2026-04-11T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - sidecar/src/focusTracker.ts
  - sidecar/src/focusTracker.test.ts
  - sidecar/src/server.ts
  - sidecar/src/walkthroughEngine.ts
  - sidecar/src/win32Bridge.ts
  - sidecar/src/win32Bridge.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 40: Code Review Report

**Reviewed:** 2026-04-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 40 focus-aware overlay implementation: `win32Bridge.ts` (persistent PowerShell P/Invoke bridge), `focusTracker.ts` (polling-based focus detection), integration in `server.ts`, and supporting `walkthroughEngine.ts` changes. The Win32 bridge architecture is well-designed with request correlation, timeouts, and auto-restart. The focus tracker has clean state machine logic with proper dedup and debounce. One critical race condition in `win32Bridge.ts` and several warnings around data mutation and missing feature flag gating.

## Critical Issues

### CR-01: Race condition -- null dereference after destroy() in sendRequest

**File:** `sidecar/src/win32Bridge.ts:243`
**Issue:** `sendRequest` awaits `this.init()` at line 223-227, then accesses `this.proc!.stdin!.write()` at line 243 with non-null assertions. If `destroy()` is called between `init()` resolution and the write (e.g., during sidecar shutdown while a focus poll is in-flight), `this.proc` is set to `null` at line 255, causing a crash. The `!` assertion bypasses TypeScript's null safety.
**Fix:**
```typescript
// Line 243: replace non-null assertion with a guard
if (!this.proc?.stdin) {
  reject(new Error('win32Bridge: process not available'));
  return;
}
this.proc.stdin.write(msg, 'utf8');
```

## Warnings

### WR-01: appendSteps mutates array before validating max constraint

**File:** `sidecar/src/walkthroughEngine.ts:137-138`
**Issue:** `appendSteps` pushes validated steps into the array at line 137, then checks the 50-step limit at line 138. If the limit is exceeded, the throw leaves the steps array in a corrupted state (over 50 steps). Same pattern at line 163 in `updateRemainingSteps`.
**Fix:**
```typescript
appendSteps(steps: WalkthroughStep[]): { totalSteps: number; currentStep: number } {
  if (!this.active) throw new Error('No active walkthrough');
  const validated = steps.map(s => WalkthroughStepSchema.parse(s));
  if (this.active.walkthrough.steps.length + validated.length > 50) {
    throw new Error('Max 50 steps');
  }
  this.active.walkthrough.steps.push(...validated);
  return { totalSteps: this.active.walkthrough.steps.length, currentStep: this.active.currentIndex + 1 };
}
```

### WR-02: Focus tracker starts without feature flag gate

**File:** `sidecar/src/server.ts:195-204`
**Issue:** The focus tracker is instantiated and started inside `/walkthrough/start` without any feature flag check. Every other capability in the sidecar (window capture, clipboard, accessibility, etc.) is gated behind a `sidecarFlags.*` check. If focus tracking should be an opt-in capability, it needs a flag gate. Without one, importing `win32Bridge.ts` spawns a PowerShell process on every sidecar startup regardless of whether focus tracking is used.
**Fix:** Add a feature flag (e.g., `focusAwareOverlay`) to `sidecarFlags` and gate the focus tracker start:
```typescript
if (targetHwnd !== null && sidecarFlags.focusAwareOverlay) {
  // ... start focus tracker
}
```

### WR-03: Private field access via `as any` cast -- fragile coupling

**File:** `sidecar/src/server.ts:836-837`
**Issue:** `(walkthroughEngine as any).active?.walkthrough.steps[...]` bypasses TypeScript's access control to read private internals. If `walkthroughEngine`'s internal structure changes (field renamed, index semantics change), this code silently breaks at runtime with no compiler warning.
**Fix:** Add a public accessor method to `WalkthroughEngine`:
```typescript
// In walkthroughEngine.ts
getCurrentStep(): WalkthroughStep | null {
  if (!this.active) return null;
  return this.active.walkthrough.steps[this.active.currentIndex] ?? null;
}
```
Then in server.ts: `const currentStep = walkthroughEngine.getCurrentStep();`

## Info

### IN-01: Module-level PowerShell spawn on import

**File:** `sidecar/src/win32Bridge.ts:285-287`
**Issue:** `win32Bridge.init()` is called at module scope, meaning importing `win32Bridge.ts` (even transitively via `focusTracker.ts`) spawns a PowerShell process. This happens on every sidecar startup even if focus tracking is never used. For a local single-user app this is acceptable overhead, but worth noting for future optimization.
**Fix:** Consider lazy initialization -- only call `init()` on first `sendRequest` (which already handles this case), and remove the module-level `init()` call.

### IN-02: PowerShell error message sanitization is incomplete

**File:** `sidecar/src/win32Bridge.ts:94`
**Issue:** Error messages only strip double quotes (`-replace '"', ''`) but don't escape backslashes or other JSON-special characters. A Windows error message containing a backslash path (e.g., `C:\Users\...`) could produce malformed JSON output from the PowerShell bridge.
**Fix:** Use `ConvertTo-Json` for the error message:
```powershell
$errJson = $errMsg | ConvertTo-Json -Compress
Write-Output ('{"id":' + $id + ',"error":' + $errJson + '}')
```

---

_Reviewed: 2026-04-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
