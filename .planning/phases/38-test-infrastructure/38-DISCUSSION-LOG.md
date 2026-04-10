# Phase 38: Test Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 38-test-infrastructure
**Mode:** stress-test (4 parallel research agents, multi-angle evidence-based analysis)
**Areas discussed:** CDP connection strategy, Component test scope, E2E smoke test flow, Flakiness tolerance

---

## Research Agents Deployed

4 parallel exploration agents analyzed the codebase before discussion:

1. **CDP/WebView2/Tauri researcher** — Investigated all Playwright, CDP, WebView2, and Tauri test infrastructure. Found zero CDP infrastructure exists. Documented the full gap.
2. **Component analyzer** — Deep-read all 3 target components + 4 existing test files. Cataloged every dependency, mock requirement, and testability challenge.
3. **E2E flow analyzer** — Traced the full PTY chain: app startup → sidecar → WebSocket → xterm.js. Analyzed existing E2E test pattern and output verification options.
4. **Risk analyzer** — Skeptical assessment of all failure modes with severity ratings. Identified blocking, significant, and minor risks.

---

## CDP Connection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Real WebView2 CDP | Modify main.rs + playwright.config for --remote-debugging-port | |
| Mock-Tauri + Vite (primary) | Reuse proven uat-phase35 pattern with fallback | |
| Spike CDP, fallback to Mock-Tauri | 2h time-boxed spike, mock-Tauri as safety net | :heavy_check_mark: |

**User's choice:** Spike CDP with fallback (recommended default)
**Notes:** Evidence showed zero CDP infrastructure exists today. Mock-Tauri covers ~95% of code paths (WebSocket is identical). STATE.md explicitly flags CDP as unproven. The spike validates the requirement-as-written; the fallback ensures the phase delivers value regardless.

---

## TerminalPane Test Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full component test | Mount with 9 stores mocked, verify DOM output | |
| Extract + unit test dispatch | Extract handleServerMessage as pure function, 16 test cases | :heavy_check_mark: |
| Skip, cover via E2E only | No component test, rely on smoke test | |

**User's choice:** Extract and test (recommended default)
**Notes:** Component analysis revealed 9 Zustand stores, 3 custom hooks, 11 useEffects. xterm.js cannot render in jsdom (canvas stub). Full mount test would be mostly scaffolding with hollow verification. Extracting the 16-case message dispatcher tests the highest-complexity logic as pure functions. Shallow mount test catches import breaks.

---

## E2E Output Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Protocol-level (WebSocket intercept) | Accumulate output messages, assert contains "hello" | :heavy_check_mark: |
| Screenshot + OCR | Tesseract.js text extraction from canvas | |
| DOM accessibility query | xterm.js aria textarea content | |

**User's choice:** Protocol-level verification (recommended default)
**Notes:** Tests the core PTY bridge directly and deterministically. Zero new dependencies. OCR adds 10MB dependency + fuzzy matching for marginal value (REQUIREMENTS.md already rejected Midscene.js AI testing). Accessibility textarea is disabled by default in xterm.js config and would require production code change.

---

## Flakiness Tolerance

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate (must pass) | Block shipping on test failure | |
| Advisory (runs, doesn't block) | Informational only | |
| Retry + generous timeouts | retries: 1, waitForFunction 5s checkpoints | :heavy_check_mark: |

**User's choice:** Retry with generous timeouts (recommended default)
**Notes:** ConPTY + PowerShell startup is 200-800ms, varies by system load. Single-user project has no CI pipeline. retries: 1 handles timing variance; real failures fail twice consistently. Existing E2E test already uses waitForTimeout(2000) patterns.

---

## Claude's Discretion

- WebSocket message interception hook implementation
- Exact mock depth for PaneContainer's ResizeObserver
- TerminalPane extraction: separate file vs co-located export
- Test file organization and npm script naming

## Deferred Ideas

- Real WebView2 CDP connection (if spike succeeds, can be follow-up)
- @xterm/addon-serialize for terminal buffer text extraction
- CI pipeline integration
- Visual regression testing
