# Roadmap: Chat Overlay Widget

## Milestones

- ✅ **v1.0 Core Application** — Phases 1-5 (shipped 2026-03-28)
- ✅ **v1.1 Screenshot Automation & Input Polish** — Phases 6-9 (shipped 2026-03-30)
- ✅ **v1.2 Live App Awareness & Capture** — Phases 10-15 (shipped 2026-03-30)
- ✅ **v1.3 Window Picker & LLM-Actionable Capture** — Phases 16-20 (shipped 2026-03-31)
- ✅ **v1.4 Stable Window Targeting** — Phases 21-22 (shipped 2026-03-31)
- ✅ **v1.5 Self-Observation & Agent Visibility** — Phases 23-25 (shipped 2026-04-01)
- ✅ **v1.6 Agent Hooks & MCP Integration** — Phases 26-29 (shipped 2026-04-07)
- ❌ **v1.7 PM Voice Chat** — Phases 30-33 (abandoned 2026-04-09; Phase 31 sidecar backend shipped)
- ✅ **v1.8 Ship & Harden** — Phases 34-38 (shipped 2026-04-10)
- 🔄 **v1.9 Guided Desktop Walkthrough** — Phases 39-42 (in progress)

## Phases

<details>
<summary>✅ v1.0 Core Application (Phases 1-5) — SHIPPED 2026-03-28</summary>

- [x] Phase 1: Scaffolding (2/2 plans) — completed 2026-03-28
- [x] Phase 2: PTY Bridge (2/2 plans) — completed 2026-03-28
- [x] Phase 3: Chat Overlay MVP (2/2 plans) — completed 2026-03-28
- [x] Phase 4: Differentiating Features (4/4 plans) — completed 2026-03-28
- [x] Phase 5: Production Hardening (1/1 plan) — completed 2026-03-28

</details>

<details>
<summary>✅ v1.1 Screenshot Automation & Input Polish (Phases 6-9) — SHIPPED 2026-03-30</summary>

- [x] Phase 6: Shell Path Formatting & Input Bar (2/2 plans) — completed 2026-03-30
- [x] Phase 7: Capture HTTP Server — superseded by v1.2
- [x] Phase 8: Window Screenshot Capture — superseded by v1.2
- [x] Phase 9: Browser CDP Capture & CLI Wrapper — superseded by v1.2

</details>

<details>
<summary>✅ v1.2 Live App Awareness & Capture (Phases 10-15) — SHIPPED 2026-03-30</summary>

- [x] Phase 10: Split Pane Preservation (2/2 plans) — completed 2026-03-30
- [x] Phase 11: Capture Infrastructure (2/2 plans) — completed 2026-03-30
- [x] Phase 12: Window Enumeration (1/1 plan) — completed 2026-03-30
- [x] Phase 13: Window Capture (2/2 plans) — completed 2026-03-30
- [x] Phase 14: CLI Wrapper (1/1 plan) — completed 2026-03-30
- [x] Phase 15: Claude Skill (1/1 plan) — completed 2026-03-30

</details>

<details>
<summary>✅ v1.3 Window Picker & LLM-Actionable Capture (Phases 16-20) — SHIPPED 2026-03-31</summary>

- [x] Phase 16: Protocol Extension (1/1 plan) — completed 2026-03-30
- [x] Phase 17: Batch Thumbnail Backend (1/1 plan) — completed 2026-03-30
- [x] Phase 18: Enriched Capture Backend (1/1 plan) — completed 2026-03-30
- [x] Phase 19: Window Picker UI (2/2 plans) — completed 2026-03-31
- [x] Phase 20: Metadata Injection & Integration (2/2 plans) — completed 2026-03-31

</details>

<details>
<summary>✅ v1.4 Stable Window Targeting (Phases 21-22) — SHIPPED 2026-03-31</summary>

- [x] Phase 21: Protocol Extension (2/2 plans) — completed 2026-03-31
- [x] Phase 22: HWND-Based Capture (2/2 plans) — completed 2026-03-31

</details>

<details>
<summary>✅ v1.5 Self-Observation & Agent Visibility (Phases 23-25) — SHIPPED 2026-04-01</summary>

- [x] Phase 23: Terminal Buffer Layer (2/2 plans) — completed 2026-03-31
- [x] Phase 24: Secret Scrubber & Trust Tiers (3/3 plans) — completed 2026-03-31
- [x] Phase 25: Screenshot Self-Capture (2/2 plans) — completed 2026-03-31

</details>

<details>
<summary>✅ v1.6 Agent Hooks & MCP Integration (Phases 26-29) — SHIPPED 2026-04-07</summary>

- [x] Phase 26: Hook Receiver & Event Schema (2/2 plans) — completed 2026-04-01
- [x] Phase 27: MCP Server (1/1 plan) — completed 2026-04-01
- [x] Phase 28: Adapter Layer & Sidebar (2/2 plans) — completed 2026-04-01
- [ ] Phase 29: Auto-Configuration — deferred

</details>

<details>
<summary>❌ v1.7 PM Voice Chat (Phases 30-33) — ABANDONED 2026-04-09</summary>

- [ ] Phase 30: LLM Settings Store — never started
- [~] Phase 31: Ollama Chat Backend & Sidebar Tab (1/2 plans) — sidecar only
- [ ] Phase 32: Conversational Context — never started
- [ ] Phase 33: TTS Voice Engine — moved to backlog

</details>

<details>
<summary>✅ v1.8 Ship & Harden (Phases 34-38) — SHIPPED 2026-04-10</summary>

- [x] Phase 34: Orphan & Dead Code Cleanup (0/0 plans — organic) — completed 2026-04-10
- [x] Phase 35: PM Chat Settings UI (2/2 plans) — completed 2026-04-09
- [x] Phase 36: PM Chat Conversational Context (2/2 plans) — completed 2026-04-10
- [x] Phase 37: Keyboard Shortcut Discoverability (1/1 plan) — completed 2026-04-10
- [x] Phase 38: Test Infrastructure (3/3 plans) — completed 2026-04-10

</details>

### v1.9 Guided Desktop Walkthrough

- [ ] **Phase 39: Overlay Lifecycle & Target Binding** — Walkthrough auto-manages overlay visibility and binds to a target hwnd
- [ ] **Phase 40: Focus-Aware Overlay** — Overlay hides/shows based on target app focus state
- [ ] **Phase 41: External Window Verification** — Pixel-sample, screenshot-diff, and visual polling target external windows with DPI-correct coordinates and safety timeout
- [ ] **Phase 42: UI Automation State Reading** — Query element state, TogglePattern, ValuePattern, SelectionItemPattern and poll for changes on external app elements

## Phase Details

> All shipped phase details archived to `.planning/milestones/`

### Phase 39: Overlay Lifecycle & Target Binding
**Goal**: Walkthrough lifecycle reliably auto-manages overlay visibility and the walkthrough is bound to a specific external window at start
**Depends on**: Phase 38 (previous milestone complete)
**Requirements**: OVRL-01, OVRL-02, OVRL-03
**Success Criteria** (what must be TRUE):
  1. Starting a walkthrough causes the overlay to appear without the user manually toggling it
  2. Completing or cancelling a walkthrough causes the overlay to disappear without the user manually toggling it
  3. A walkthrough start call accepts a target hwnd and the system stores that association for subsequent phases to use
**Plans**: TBD
**UI hint**: yes

### Phase 40: Focus-Aware Overlay
**Goal**: Overlay visibility tracks whether the user is focused on the walkthrough's target window, hiding when they switch away and reappearing when they return
**Depends on**: Phase 39
**Requirements**: FOCUS-01, FOCUS-02, FOCUS-03
**Success Criteria** (what must be TRUE):
  1. Switching focus away from the target app (e.g., clicking another window) causes the overlay to hide automatically
  2. Switching focus back to the target app causes the overlay to reappear automatically
  3. Focus transitions are detected within 500ms of the actual window switch
**Plans**: TBD
**UI hint**: yes

### Phase 41: External Window Verification
**Goal**: Pixel-sample and screenshot-diff verification target an external window by hwnd with DPI-correct coordinates, visual change polling drives auto-advance, and a timeout prevents indefinite hangs
**Depends on**: Phase 39
**Requirements**: VRFY-01, VRFY-02, VRFY-03, VRFY-04, SAFE-01
**Success Criteria** (what must be TRUE):
  1. Pixel-sample verification reads pixels from an external window (by hwnd) rather than the overlay's own window
  2. Logical pixel coordinates passed to verification are correctly scaled to physical device pixels so samples land on the intended screen location across DPI scales
  3. Screenshot-diff comparison captures a baseline, then a runtime screenshot, and returns a meaningful diff result (not a stub)
  4. Visual change polling starts automatically after a walkthrough step and advances when the target window's appearance changes, backing off from 500ms up to 2s between checks
  5. Walkthrough verification stops and reports a timeout error after maxWaitMs rather than running indefinitely
**Plans**: TBD

### Phase 42: UI Automation State Reading
**Goal**: Users can query UI Automation element state on external app elements and poll for state changes, enabling walkthroughs that react to checkbox state, text field values, list selections, and enabled/offscreen status
**Depends on**: Phase 39
**Requirements**: UIA-01, UIA-02, UIA-03, UIA-04, UIA-05
**Success Criteria** (what must be TRUE):
  1. A walkthrough step can query whether an external app element is enabled or offscreen
  2. A walkthrough step can read the on/off/indeterminate toggle state of a checkbox in an external app
  3. A walkthrough step can read the current text value and read-only status of a text field in an external app
  4. A walkthrough step can read whether a list item is selected in an external app
  5. A walkthrough step can wait for an element's state to change within a configured timeout and interval, returning success when the condition is met or a timeout error when it is not
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 11/11 | Complete | 2026-03-28 |
| 6-9 | v1.1 | 2/2 | Complete | 2026-03-30 |
| 10-15 | v1.2 | 9/9 | Complete | 2026-03-30 |
| 16-20 | v1.3 | 7/7 | Complete | 2026-03-31 |
| 21-22 | v1.4 | 4/4 | Complete | 2026-03-31 |
| 23-25 | v1.5 | 7/7 | Complete | 2026-04-01 |
| 26-28 | v1.6 | 5/5 | Complete | 2026-04-01 |
| 29 | v1.6 | 0/TBD | Deferred | - |
| 30-33 | v1.7 | 1/2 | Abandoned | - |
| 34-38 | v1.8 | 8/8 | Complete | 2026-04-10 |
| 39 | v1.9 | 0/TBD | Not started | - |
| 40 | v1.9 | 0/TBD | Not started | - |
| 41 | v1.9 | 0/TBD | Not started | - |
| 42 | v1.9 | 0/TBD | Not started | - |

---
*Full phase details archived in `.planning/milestones/`*
