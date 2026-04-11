# Phase 40: Focus-Aware Overlay - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 40-focus-aware-overlay
**Areas discussed:** Focus detection method, Overlay transition behavior, Edge cases & safety

---

## Focus Detection Method

### Round 1: Initial Research (3 parallel agents)

5 options analyzed with evidence:

| Option | Description | Selected |
|--------|-------------|----------|
| A: Fresh PowerShell spawn | Existing `getActiveWindowHwnd()` via `execFile` per call | |
| B: Persistent PowerShell | Keep one powershell.exe alive, pipe commands to stdin | |
| C: SetWinEventHook | Event-driven via C# helper or PowerShell Add-Type | |
| D: Rust native | windows-rs crate in Tauri backend | |
| E: koffi (Node.js FFI) | Direct user32.dll calls from sidecar via koffi | |

Initial recommendation: Option E (koffi)

### Round 2: Adversarial Stress-Test (6 perspectives)

The stress-test challenged koffi from build/bundling, reliability, security angles, and made the strongest cases for Options B, C, and A (YAGNI).

Key findings:
- Option A eliminated: 4 PS spawns/sec = ~80% CPU on one core. Disqualifying.
- Option D eliminated: Rust backend deliberately minimal, wrong surface area.
- Option C premature: correct long-term architecture but Phase 41/42 should determine need.
- Option B strongest competitor: zero new deps, ~5ms per call (warm), serves all Win32 calls. But stdout interleaving risk with shared persistent PS process.
- Option E confirmed: 0.05ms per call, N-API stable, same bundling pattern as node-pty/better-sqlite3, ~15 lines of code.

**User's choice:** Option E (koffi) — "go with your recommendation that is future proof, robust, scalable and easy to maintain"

---

## Overlay Transition Behavior

### Round 1: Initial Research

7 scenarios analyzed (target app, unrelated app, chat widget, overlay interactive, Alt+Tab, child dialogs, system UI). Initial recommendation: affiliated set + CSS fade (150ms) + 300ms hide / 100ms show debounce.

### Round 2: Adversarial Stress-Test (6 perspectives)

Key changes from stress-test:
- CSS fade KILLED: cross-window coordination complexity not justified for sparse transparent overlay
- 300ms hide debounce REDUCED to 150ms: 300ms felt "sticky" (overlay lingers 700ms total)
- 100ms show debounce ELIMINATED: overlay should appear on next poll, zero delay
- Minimized-target check ADDED: `IsIconic(targetHwnd)` — original analysis missed this
- PID matching REFINED: hybrid hwnd-tree + PID, exclude ApplicationFrameHost.exe

| Scenario | Action | Delay |
|----------|--------|-------|
| Click target app | SHOW (instant) | 0ms (next poll) |
| Click unrelated app | HIDE (instant) | 150ms debounce |
| Click chat widget | STAY VISIBLE | n/a |
| Click overlay interactive | STAY VISIBLE | n/a |
| Alt+Tab rapid cycle | Debounced | 150ms |
| Target child dialog | STAY VISIBLE | n/a (ownership/PID match) |
| System UI | HIDE (instant) | 150ms debounce |
| Target minimized | HIDE (instant) | No debounce |

**User's choice:** Agreed with all revised recommendations.

---

## Edge Cases & Safety

### Round 1: Initial Research

6 categories analyzed. Initial must-handle: stale hwnd, lifecycle, race conditions, multi-monitor positioning.

### Round 2: Adversarial Stress-Test (6 perspectives)

Key changes:
- Multi-monitor positioning DOWNGRADED: user confirmed primary monitor only, not an issue
- Generation counter REMOVED: traced actual code paths, race produces invisible result (empty transparent window)
- Walkthrough pause() REJECTED: simplify to hide overlay + emit target-lost, don't touch engine state
- Overlay self-hwnd concern RESOLVED: WS_EX_TRANSPARENT means GetForegroundWindow returns target, not overlay. But WalkthroughPanel pointerEvents:'auto' is a real edge case — overlay hwnd must be in affiliated set.
- Elevated windows: NOT deferred — works out of the box, no mitigation needed
- Sleep/wake: deferred per user (computer doesn't use these)
- App restart with new hwnd: deferred per user

**User's choices:**
- Multi-monitor: "not an issue. we will only use the primary monitor only"
- Elevated windows: "i dont see why to defer" — confirmed works out of the box
- Sleep/wake: "computer doesn use any of these, so yes defer"
- App restart: "defer"

---

## Claude's Discretion

- koffi API usage patterns (sync vs async, type definitions)
- Whether to also export getWindowThreadProcessId and isIconic from win32.ts
- FocusTracker internal class structure and event emission pattern
- Whether to migrate existing windowFocusManager.ts to koffi in this phase

## Deferred Ideas

- Multi-monitor overlay repositioning — not needed (primary monitor only)
- App restart with new hwnd — future phase
- Migration of windowFocusManager.ts / spatial_engine.ts to koffi — follow-up
- SetWinEventHook — evaluate during Phase 41/42 research
