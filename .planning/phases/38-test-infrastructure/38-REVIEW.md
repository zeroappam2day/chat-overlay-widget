---
phase: 38-test-infrastructure
reviewed: 2026-04-10T12:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - e2e/smoke-pty-flow.spec.ts
  - playwright.config.ts
  - src/components/__tests__/ChatInputBar.test.tsx
  - src/components/__tests__/PaneContainer.test.tsx
  - src/components/__tests__/TerminalPane.test.tsx
  - src/components/terminalMessageDispatcher.test.ts
  - src/components/terminalMessageDispatcher.ts
  - src/components/TerminalPane.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 38: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed test infrastructure files (unit tests, E2E smoke test, Playwright config) and the two production source files they cover (terminalMessageDispatcher.ts and TerminalPane.tsx). The dispatcher extraction is clean with good test coverage. The E2E smoke test is well-structured with protocol-level WebSocket interception. Three warnings relate to a stale closure bug in TerminalPane, a silently swallowed error in the E2E test, and unused token in the E2E discovery. Three info items cover minor code quality observations.

## Warnings

### WR-01: Stale closure over `searchOpen` in Escape key handler

**File:** `src/components/TerminalPane.tsx:244`
**Issue:** The `useEffect` at line 213 depends on `[searchOpen]` (line 290), meaning the `handler` closure captures the current `searchOpen` value. However, because the entire effect re-runs on each `searchOpen` change, all six event listeners are torn down and re-attached every time search toggles. This is unnecessary churn. More critically, the Escape handler on line 244 reads `searchOpen` from closure -- if other state changes occur between effect runs, `searchOpen` could be stale for the brief window before React re-runs the effect. The `isActive` state already uses a ref pattern (line 86) to avoid exactly this problem.
**Fix:** Use a `searchOpenRef` pattern consistent with the existing `isActiveRef` and `pickerOpenRef` patterns, and remove `searchOpen` from the dependency array (use `[]`):
```typescript
const searchOpenRef = useRef(false);
useEffect(() => { searchOpenRef.current = searchOpen; }, [searchOpen]);

// Then in the handler:
if (e.code === 'Escape' && !searchOpenRef.current) {
```

### WR-02: Empty catch block silently swallows WebSocket parse errors in E2E test

**File:** `e2e/smoke-pty-flow.spec.ts:123`
**Issue:** The `catch {}` block on line 123 silently swallows all JSON parse errors from WebSocket messages. If the sidecar sends malformed JSON or binary frames, the test will miss those messages entirely with no diagnostic output. This can mask real bugs during E2E runs -- a broken protocol message would simply be invisible.
**Fix:** Log parse failures so they appear in Playwright trace output:
```typescript
} catch (err) {
  console.warn('[test-interceptor] Failed to parse WS message:', err);
}
```

### WR-03: Discovery token read but never used -- potential missing auth header

**File:** `e2e/smoke-pty-flow.spec.ts:19-27`
**Issue:** `getSidecarPort()` returns `{ port, token }` but only `port` is destructured and used (line 61). The `token` field is parsed from the discovery file but discarded. If the sidecar requires token-based authentication for WebSocket connections, the E2E test may work only because auth is not enforced in dev mode -- it would silently fail when auth is enabled.
**Fix:** Either pass the token to the WebSocket connection setup, or document why it is intentionally unused:
```typescript
// If token auth is not needed for E2E:
const { port } = getSidecarPort(); // drop unused token
// If token auth IS needed, pass it to the test context
```

## Info

### IN-01: console.log statements in production code

**File:** `src/components/TerminalPane.tsx:197-203`
**Issue:** Debug `console.log` calls for auto-spawn diagnostics are present in production code (lines 197 and 203). These will output to the browser console in release builds.
**Fix:** Consider removing or gating behind a `__DEV__` check, or use a structured logger.

### IN-02: `as any` type assertions in E2E test WebSocket mock

**File:** `e2e/smoke-pty-flow.spec.ts:32,127`
**Issue:** Multiple `as any` casts are used for the Tauri IPC mock and WebSocket constructor override. While acceptable in test code, the `Object.assign((window as any).WebSocket, OrigWebSocket)` on line 128 copies static properties but does not preserve the prototype chain, meaning `instanceof WebSocket` checks in application code would fail against the mock constructor.
**Fix:** If no application code uses `instanceof WebSocket`, this is benign. If it does, set the prototype:
```typescript
(window as any).WebSocket.prototype = OrigWebSocket.prototype;
```

### IN-03: TerminalPane.test.tsx has heavy mock surface for a single smoke test

**File:** `src/components/__tests__/TerminalPane.test.tsx:1-209`
**Issue:** The test file contains 30+ `vi.mock()` declarations to support a single "renders without throwing" smoke test. This is a maintenance burden -- any new import added to TerminalPane.tsx requires updating this mock list or the test breaks. The file is functional, but the mock-to-test ratio is unusually high.
**Fix:** No immediate action needed. As more tests are added to this file, the mock overhead amortizes. Consider co-locating mock factories in a shared `__tests__/setup.ts` if the pattern repeats.

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
