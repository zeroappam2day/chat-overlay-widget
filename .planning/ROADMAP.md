# Roadmap: Chat Overlay Widget

## Milestones

- **v1.0 Core Application** — Phases 1-5 (shipped 2026-03-28)
- **v1.1 Screenshot Automation & Input Polish** — Phases 6-9 (shipped 2026-03-30)
- **v1.2 Live App Awareness & Capture** — Phases 10-15 (shipped 2026-03-30)
- **v1.3 Window Picker & LLM-Actionable Capture** — Phases 16-20 (shipped 2026-03-31)
- **v1.4 Stable Window Targeting** — Phases 21-22 (in progress)

## Phases

<details>
<summary>v1.0 Core Application (Phases 1-5) — SHIPPED 2026-03-28</summary>

- [x] Phase 1: Scaffolding (2/2 plans) — completed 2026-03-28
- [x] Phase 2: PTY Bridge (2/2 plans) — completed 2026-03-28
- [x] Phase 3: Chat Overlay MVP (2/2 plans) — completed 2026-03-28
- [x] Phase 4: Differentiating Features (4/4 plans) — completed 2026-03-28
- [x] Phase 5: Production Hardening (1/1 plan) — completed 2026-03-28

</details>

<details>
<summary>v1.1 Screenshot Automation & Input Polish (Phases 6-9) — SHIPPED 2026-03-30</summary>

- [x] Phase 6: Shell Path Formatting & Input Bar (2/2 plans) — completed 2026-03-30
- [x] Phase 7: Capture HTTP Server — superseded by v1.2
- [x] Phase 8: Window Screenshot Capture — superseded by v1.2
- [x] Phase 9: Browser CDP Capture & CLI Wrapper — superseded by v1.2

</details>

<details>
<summary>v1.2 Live App Awareness & Capture (Phases 10-15) — SHIPPED 2026-03-30</summary>

- [x] Phase 10: Split Pane Preservation (2/2 plans) — completed 2026-03-30
- [x] Phase 11: Capture Infrastructure (2/2 plans) — completed 2026-03-30
- [x] Phase 12: Window Enumeration (1/1 plan) — completed 2026-03-30
- [x] Phase 13: Window Capture (2/2 plans) — completed 2026-03-30
- [x] Phase 14: CLI Wrapper (1/1 plan) — completed 2026-03-30
- [x] Phase 15: Claude Skill (1/1 plan) — completed 2026-03-30

</details>

<details>
<summary>v1.3 Window Picker & LLM-Actionable Capture (Phases 16-20) — SHIPPED 2026-03-31</summary>

- [x] Phase 16: Protocol Extension (1/1 plan) — completed 2026-03-30
- [x] Phase 17: Batch Thumbnail Backend (1/1 plan) — completed 2026-03-30
- [x] Phase 18: Enriched Capture Backend (1/1 plan) — completed 2026-03-30
- [x] Phase 19: Window Picker UI (2/2 plans) — completed 2026-03-31
- [x] Phase 20: Metadata Injection & Integration (2/2 plans) — completed 2026-03-31

</details>

### v1.4 Stable Window Targeting (In Progress)

**Milestone Goal:** Replace fragile title-based window matching with HWND-based capture so the correct window is always captured regardless of title changes.

- [x] **Phase 21: Protocol Extension** - Thread HWND and PID through enumeration, types, and WebSocket protocol (completed 2026-03-31)
- [ ] **Phase 22: HWND-Based Capture** - Route capture through PrintWindow(hwnd) with stale detection and blank-bitmap fallback

## Phase Details

### Phase 21: Protocol Extension
**Goal**: HWND and PID are present at every layer — enumeration scripts emit them, Node.js types carry them, WebSocket messages include them, and TerminalPane sends them with every capture request
**Depends on**: Phase 20
**Requirements**: PROT-01, PROT-02, PROT-03, PROT-04, PROT-05
**Success Criteria** (what must be TRUE):
  1. Window picker thumbnails include a numeric `hwnd` and `pid` field visible in WebSocket message inspection
  2. Capture request sent from TerminalPane includes `hwnd` and `pid` alongside the window title
  3. Enumeration filters out child render handles — only root windows (GetParent==IntPtr.Zero) appear in the picker
  4. The overlay-capture CLI and HTTP API still capture by title without requiring an HWND argument
  5. TypeScript compiler reports zero errors after both protocol.ts files are updated
**Plans:** 2/2 plans complete
Plans:
- [x] 21-01-PLAN.md — C# scripts + Node.js types: emit HWND/PID, add GetParent filter
- [x] 21-02-PLAN.md — Protocol types + server handler + TerminalPane: thread HWND/PID through WebSocket

### Phase 22: HWND-Based Capture
**Goal**: Capture routes through PrintWindow(hwnd) directly — no title re-enumeration — with explicit validation that the HWND is still alive, the PID matches, and the resulting bitmap is non-blank
**Depends on**: Phase 21
**Requirements**: HWND-01, HWND-02, HWND-03, HWND-04
**Success Criteria** (what must be TRUE):
  1. Capturing a window whose title changed since picker selection produces the correct screenshot (not a wrong-window or stale result)
  2. Capturing a window that was closed after picker selection returns a visible error message (STALE_HWND) rather than a silent failure or wrong-window capture
  3. Capturing an elevated window (e.g., Task Manager) returns a blank-capture warning instead of silently saving a black image
  4. Fallback to title+processName match fires when HWND is stale, with a warning logged to the sidecar console
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 11/11 | Complete | 2026-03-28 |
| 6 | v1.1 | 2/2 | Complete | 2026-03-30 |
| 7-9 | v1.1 | — | Superseded by v1.2 | — |
| 10-15 | v1.2 | 9/9 | Complete | 2026-03-30 |
| 16-20 | v1.3 | 7/7 | Complete | 2026-03-31 |
| 21. Protocol Extension | v1.4 | 2/2 | Complete   | 2026-03-31 |
| 22. HWND-Based Capture | v1.4 | 0/? | Not started | - |

---
*Full phase details archived in `.planning/milestones/v1.3-ROADMAP.md`*
