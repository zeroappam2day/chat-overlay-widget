---
phase: 38-test-infrastructure
plan: 03
status: completed
started: 2026-04-10T18:18:30Z
completed: 2026-04-10T18:20:00Z
---

## Summary

Updated Playwright config with CDP project and retries, and created E2E smoke test validating the core PTY flow via protocol-level WebSocket interception.

## Results

### Task 1: Update Playwright config
- Added `retries: 1` for timing variance tolerance
- Added `webview2-cdp` project with CDP connectOptions on port 9222
- Added documentation comment for WebView2 setup prerequisites

### Task 2: E2E smoke test
- TEST-01: CDP connection reads visible DOM element (validates Playwright + app rendering)
- TEST-03: Full PTY flow — WebSocket connects, PTY spawns, command sends via ChatInputBar, output verified via intercepted WebSocket messages
- Uses `addInitScript` WebSocket monkey-patch for deterministic protocol-level verification (D-10)
- 10-second timeouts for ConPTY init (D-15) and output accumulation (D-12)

## Key Files

### Created
- `e2e/smoke-pty-flow.spec.ts` — 2 E2E test cases (TEST-01, TEST-03)

### Modified
- `playwright.config.ts` — retries:1, webview2-cdp project, documentation

## Self-Check: PASSED

- [x] playwright.config.ts contains retries: 1
- [x] playwright.config.ts contains webview2-cdp project with wsEndpoint
- [x] smoke-pty-flow.spec.ts contains `test.describe('Smoke: Core PTY Flow'`
- [x] smoke-pty-flow.spec.ts contains WebSocket interceptor via addInitScript
- [x] smoke-pty-flow.spec.ts contains `__PLAYWRIGHT_SMOKE__` marker
- [x] `npx playwright test --list` shows both smoke tests

## Deviations

- E2E tests require running Vite dev server + sidecar as prerequisites. Cannot be verified in CI without those services. Test listing confirms config and test file parse correctly.
