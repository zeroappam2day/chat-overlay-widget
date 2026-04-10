# Phase 38: Test Infrastructure - Context

**Gathered:** 2026-04-10 (stress-test mode — 4 parallel research agents, 6 decision angles per option)
**Status:** Ready for planning

<domain>
## Phase Boundary

Playwright E2E connection to the running app, Vitest component tests for the 3 highest-churn frontend files (TerminalPane, ChatInputBar, PaneContainer), and one E2E smoke test validating the core PTY flow. No full test suite, no AI testing layer, no cross-platform testing.

</domain>

<decisions>
## Implementation Decisions

### CDP Connection Strategy (TEST-01)
- **D-01:** Real WebView2 CDP connection is the primary approach — web research confirms this is a proven pattern, not a risky spike. Set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` environment variable before launching the Tauri app. This is a standard WebView2 feature (Microsoft docs) that works through wry (Tauri's WebView2 wrapper). No Rust code changes needed.
- **D-02:** Playwright connects via `chromium.connectOverCDP('http://localhost:9222')`. The Haprog/playwright-cdp GitHub repo provides a complete working example specifically for Tauri 2 + WebView2. Tauri v1 uses the same wry WebView2 backend, so the env var approach applies.
- **D-03:** For parallel test isolation, set `WEBVIEW2_USER_DATA_FOLDER` to a temp directory per test run (Playwright docs recommendation). Not critical for single-test smoke test but good practice.
- **D-04:** Fallback: if CDP connection fails for any Tauri v1-specific reason, fall back to the proven mock-Tauri + Vite dev server approach (`uat-phase35.spec.ts` pattern). The WebSocket path is identical in both approaches (`ws://127.0.0.1:{port}`). The sidecar doesn't know whether its client is WebView2 or Chromium.
- **D-04b:** The E2E test launch sequence: (1) set env vars, (2) start sidecar, (3) launch `npx tauri dev`, (4) wait for app window, (5) `connectOverCDP('http://localhost:9222')`, (6) run tests. Modify `tauri-dev.sh` or create a test-specific launcher script.

### Component Test Strategy (TEST-02)
- **D-05:** ChatInputBar — full component test. Pure controlled component (110 lines, 0 stores, simple props). Test: render with default props, Enter sends, Shift+Enter doesn't send, image paste handler fires, pending injection appends to textarea, disabled state.
- **D-06:** PaneContainer — component test with mocked hooks. Mock `useShortcuts`, `usePaneDimming`, `usePersistence`, `useZoom` as no-ops. Mock `usePaneStore` via `setState()`. Mock `appWindow.onFileDropEvent` to return unlisten fn. Mock `ResizeObserver`. Verify: renders AppHeader + AgentSidebar + terminal pane wrappers, Ctrl+/ toggles ShortcutHelpOverlay.
- **D-07:** TerminalPane — extract-and-test strategy, NOT full render test. The component has 9 Zustand stores, 3 custom hooks, 11 useEffects, and xterm.js which cannot render in jsdom (canvas stub). A full mount test would be mostly mock scaffolding with hollow rendering verification.
- **D-08:** TerminalPane extraction targets: (1) Extract `handleServerMessage` dispatch logic (the 16-case switch at lines 102-220) into a testable pure function — this is the highest-complexity, highest-value code. (2) Extract shell name resolution (line 112-113) as a pure function. (3) Write a shallow mount test that verifies the component doesn't throw on render with minimal mocks (catches import breaks on a 97th-percentile churn file).
- **D-09:** Follow the established mocking patterns from existing tests: `store.setState()` for Zustand (PMChatTab pattern), `vi.fn()` for callbacks (WindowPicker pattern), `globalThis.fetch = vi.fn()` for HTTP (PMChatSettings pattern).

### E2E Smoke Test Strategy (TEST-03)
- **D-10:** Protocol-level verification, NOT canvas OCR. Intercept WebSocket messages via `page.evaluate()` hook. Flow: send `spawn` → wait for `pty-ready` → send `input` with `echo hello\r` → accumulate `output` messages into buffer → assert buffer contains "hello". This tests the core PTY bridge directly and deterministically.
- **D-11:** Primary E2E approach: use CDP connection to real Tauri WebView2 (per D-01/D-02). Fallback: build on `uat-phase35.spec.ts` pattern (mock Tauri APIs via `addInitScript`, connect to Vite dev server on localhost:1420).
- **D-12:** Handle ConPTY output chunking by accumulating all `output` type WebSocket messages into a string buffer over a 5-second window, then asserting the buffer contains the expected output. ConPTY splits output non-deterministically and echoes input — the accumulation pattern handles both.
- **D-13:** Prerequisites: running Vite dev server + running sidecar (same as uat-phase35). No Ollama dependency for the smoke test.

### Flakiness Mitigation
- **D-14:** Set `retries: 1` in `playwright.config.ts` (currently 0). Use `waitForFunction()` with 5-second timeouts at each checkpoint: WebSocket connected, pty-ready received, output buffer accumulated.
- **D-15:** Keep the 30-second overall timeout (current config). Add explicit waits at PTY spawn (ConPTY + PowerShell init takes 200-800ms) and output accumulation (2-3 seconds for echo round-trip).
- **D-16:** The smoke test is not a CI gate (single-user project, no CI pipeline). It runs via `npx playwright test` on developer's machine. Retry handles timing variance; real failures will fail twice consistently.

### Claude's Discretion
- WebSocket message interception hook implementation (page.evaluate injection pattern)
- Exact mock depth for PaneContainer's ResizeObserver and react-resizable-panels
- Whether to extract TerminalPane's handleServerMessage into a separate file or keep it co-located with a `@visibleForTesting` export
- Test file naming and organization within `src/components/__tests__/`
- npm script naming for running component tests vs E2E tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Test infrastructure
- `vitest.config.ts` — Vitest config with jsdom/node env matching, test-setup.ts
- `playwright.config.ts` — Playwright config, e2e test dir, chromium project
- `src/test-setup.ts` — Jest-DOM matcher import

### Existing test patterns (MUST READ for mocking consistency)
- `src/components/__tests__/PMChatTab.test.tsx` — Zustand setState() pattern, cleanup
- `src/components/__tests__/WindowPicker.test.tsx` — vi.fn() callbacks, userEvent, data-testid
- `src/components/__tests__/PMChatSettings.test.tsx` — vi.mock() for stores, globalThis.fetch mock
- `src/components/__tests__/AgentSidebar.test.tsx` — Portal content assertion, complex store state

### Existing E2E pattern (MUST READ for smoke test)
- `e2e/uat-phase35.spec.ts` — Mock Tauri IPC, sidecar discovery file, Vite dev server connection

### Target components
- `src/components/TerminalPane.tsx` — 552 lines, 9 stores, 16-case message dispatcher (lines 102-220)
- `src/components/ChatInputBar.tsx` — 110 lines, pure controlled component
- `src/components/PaneContainer.tsx` — 243 lines, layout tree, ResizeObserver, custom hooks
- `src/hooks/useTerminal.ts` — xterm.js Terminal instantiation, canvas renderer, FitAddon, SearchAddon
- `src/hooks/useWebSocket.ts` — WebSocket connection with Tauri IPC port discovery

### Protocol definition
- `src/protocol.ts` — ClientMessage/ServerMessage types, WebSocket message contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mockTauriAndConnect()` in `e2e/uat-phase35.spec.ts` (lines 30-63) — complete Tauri IPC mock function, reuse directly for smoke test
- `getSidecarPort()` in `e2e/uat-phase35.spec.ts` (lines 19-27) — reads discovery file, reuse for smoke test
- Zustand `setState()` pattern — established across 4 existing test files, no vi.mock() needed for most stores
- `vi.fn()` callback pattern — established in WindowPicker test for props
- `@testing-library/user-event` — already installed and used in WindowPicker test

### Established Patterns
- **jsdom environment**: Frontend tests use jsdom (vitest.config.ts line 8). xterm.js Terminal cannot instantiate in jsdom (needs canvas + requestAnimationFrame + nonzero container dimensions).
- **Store mocking**: Direct `store.setState()` preferred over `vi.mock()` — simpler, less brittle. Only use vi.mock() when you need to mock store action functions (PMChatSettings pattern).
- **Cleanup**: `afterEach(() => { cleanup(); vi.restoreAllMocks(); })` — consistent across all tests.
- **Console capture**: `page.on('console', ...)` used in E2E for debugging WebSocket state (uat-phase35 line 78).

### Integration Points
- E2E tests connect to: Vite dev server (localhost:1420) + sidecar (port from discovery file)
- Component tests run isolated in jsdom — no sidecar, no WebSocket, no Tauri runtime
- WebSocket protocol is the boundary: component tests mock at the hook level, E2E tests use real WebSocket

</code_context>

<specifics>
## Specific Ideas

- TerminalPane's `handleServerMessage` (lines 102-220) is a 16-case switch that dispatches to 9 different stores. Extracting this as `dispatchServerMessage(msg, callbacks)` makes it testable as a pure function with 16 test cases — highest ROI test in the phase.
- Shell name resolution (TerminalPane line 112-113) maps full exe paths to short names from the shell list. Extract as `resolveShellName(fullPath, shells)` — trivially testable, has caught bugs before.
- The E2E smoke test should inject a WebSocket message interceptor via `page.addInitScript()` that captures `pty-ready` and `output` messages into `window.__testState` — then `page.waitForFunction(() => window.__testState.outputBuffer.includes('hello'))`.
- ConPTY echoes both input AND output — the `output` buffer will contain `echo hello\r\n` (the typed command) AND `hello\r\n` (the result). Assert on the output substring, not exact match.

</specifics>

<deferred>
## Deferred Ideas

- Real WebView2 CDP connection — RESOLVED: web research confirmed this is a proven pattern via `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` env var + `connectOverCDP()`. Promoted to primary approach (D-01/D-02).
- `@xterm/addon-serialize` for terminal buffer text extraction — listed in REQUIREMENTS.md as XTERM-01 (deferred). Would enable DOM-level terminal content assertions in future tests.
- CI pipeline integration — single-user project has no CI. Tests are developer-run only.
- Visual regression testing — screenshot comparison for UI components. Needs baseline infrastructure not in scope.

</deferred>

---

*Phase: 38-test-infrastructure*
*Context gathered: 2026-04-10*
