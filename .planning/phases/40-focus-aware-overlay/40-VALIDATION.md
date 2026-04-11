---
phase: 40
slug: focus-aware-overlay
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-11
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | sidecar/vitest.config.ts (sidecar), vitest.config.ts (frontend) |
| **Quick run command** | `npx vitest run sidecar/src/win32Bridge.test.ts sidecar/src/focusTracker.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run sidecar/src/win32Bridge.test.ts sidecar/src/focusTracker.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | FOCUS-01, FOCUS-02, FOCUS-03 | — | N/A | unit | `npx vitest run sidecar/src/win32Bridge.test.ts` | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | FOCUS-01, FOCUS-02, FOCUS-03 | — | N/A | unit | `npx vitest run sidecar/src/focusTracker.test.ts` | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 2 | FOCUS-01, FOCUS-02 | — | N/A | unit | `npx vitest run src/components/terminalMessageDispatcher.test.ts` | ❌ W0 | ⬜ pending |
| 40-02-02 | 02 | 2 | FOCUS-01, FOCUS-02, FOCUS-03 | — | N/A | manual | Human UAT (Alt+Tab test) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `sidecar/src/win32Bridge.test.ts` — TDD stubs for persistent PowerShell bridge (10 behaviors)
- [ ] `sidecar/src/focusTracker.test.ts` — TDD stubs for focus polling, affiliated set, debounce (12 behaviors)
- [ ] `src/components/terminalMessageDispatcher.test.ts` — extend existing test file with overlay-focus dispatch (6 behaviors)

*Existing vitest infrastructure covers all phase requirements. No new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Focus away hides overlay | FOCUS-01 | Requires real window focus changes on Windows | 1. Start walkthrough targeting Notepad. 2. Click Spotify/another app. 3. Verify overlay disappears within ~400ms. |
| Focus back shows overlay | FOCUS-02 | Requires real window focus changes on Windows | 1. After hide, click Notepad. 2. Verify overlay reappears within ~250ms. |
| Detection latency <500ms | FOCUS-03 | Requires wall-clock timing measurement | 1. Use stopwatch or visual inspection during Alt+Tab. 2. Overlay state change must be imperceptible (<500ms). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
