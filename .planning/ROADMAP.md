# Roadmap: Chat Overlay Widget

## Milestones

- ✅ **v1.0 Core Application** — Phases 1-5 (shipped 2026-03-28)
- ✅ **v1.1 Screenshot Automation & Input Polish** — Phases 6-9 (shipped 2026-03-30)
- ✅ **v1.2 Live App Awareness & Capture** — Phases 10-15 (shipped 2026-03-30)
- ✅ **v1.3 Window Picker & LLM-Actionable Capture** — Phases 16-20 (shipped 2026-03-31)
- ✅ **v1.4 Stable Window Targeting** — Phases 21-22 (shipped 2026-03-31)
- ✅ **v1.5 Self-Observation & Agent Visibility** — Phases 23-25 (shipped 2026-04-01)
- 🚧 **v1.6 Agent Hooks & MCP Integration** — Phases 26-29 (planned)

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

### 🚧 v1.6 Agent Hooks & MCP Integration (Planned)

**Milestone Goal:** Let any MCP-capable LLM running in the app autonomously read the terminal, observe agent activity, and capture screenshots — with a layered adapter architecture that degrades gracefully for non-MCP LLMs.

- [x] **Phase 26: Hook Receiver & Event Schema** - Hook endpoint, normalized AgentEvent schema (completed 2026-04-01)
- [x] **Phase 27: MCP Server** - stdio MCP server wrapping terminal, history, and screenshot tools (completed 2026-04-01)
- [x] **Phase 28: Adapter Layer & Sidebar** - Hook adapters for Claude Code/Windsurf/Cursor, sidebar event panel (completed 2026-04-01)
- [ ] **Phase 29: Auto-Configuration** - Zero-setup hook config and MCP registration injection on startup

## Phase Details

> v1.5 phase details archived to `.planning/milestones/v1.5-ROADMAP.md`

## v1.6 Phase Details

### Phase 26: Hook Receiver & Event Schema
**Goal**: The sidecar can receive and normalize lifecycle events from any supported AI coding agent
**Depends on**: Phase 25
**Requirements**: AGNT-01, AGNT-02
**Success Criteria** (what must be TRUE):
  1. `POST /hook-event` on the sidecar accepts hook payloads (SubagentStart, SubagentStop, PreToolUse, PostToolUse) and responds within 500ms
  2. Every received hook payload is normalized to a shared `AgentEvent` object with consistent `tool`, `type`, `timestamp`, `sessionId`, and `payload` fields regardless of the originating tool
  3. Events from Claude Code hooks delivered via curl reach the sidecar and are logged with their normalized schema
**Plans:** 2/2 plans complete
Plans:
- [x] 26-01-PLAN.md — AgentEvent schema module (TDD) + protocol extension
- [x] 26-02-PLAN.md — Server route integration, hook scripts, E2E validation

### Phase 27: MCP Server
**Goal**: Any MCP-capable LLM can autonomously read terminal output, query session history, and capture screenshots via standard MCP tools
**Depends on**: Phase 23, Phase 24, Phase 25
**Requirements**: LLM-01
**Success Criteria** (what must be TRUE):
  1. An MCP client (e.g., Claude Code with `.mcp.json` configured) can call `read_terminal_output` and receive the current terminal buffer
  2. An MCP client can call `query_session_history` and receive historical PTY output from the SQLite store
  3. An MCP client can call `capture_screenshot` and receive a PNG of the app window (blurred if the caller is a cloud provider)
  4. The MCP server starts via stdio transport and registers cleanly with no manual setup beyond the `.mcp.json` file
**Plans:** 1/1 plans complete
Plans:
- [x] 27-01-PLAN.md — MCP stdio server with 3 tool handlers (read_terminal_output, query_session_history, capture_screenshot)

### Phase 28: Adapter Layer & Sidebar
**Goal**: Hook events from Claude Code, Windsurf, and Cursor are normalized through typed adapters, and structured agent activity is visible in the app UI
**Depends on**: Phase 26
**Requirements**: LLM-02, AGNT-03
**Success Criteria** (what must be TRUE):
  1. Hook events from Claude Code, Windsurf, and Cursor each pass through a dedicated adapter that maps tool-specific fields to the shared `AgentEvent` schema
  2. Unrecognized hook formats are handled by a FallbackAdapter that preserves the raw payload without crashing
  3. The app sidebar shows a list of recent agent events with tool name, file path (where applicable), and a status indicator (running/complete/error)
  4. The sidebar can be collapsed and expanded without losing the accumulated event history for the current session
**Plans:** 2/2 plans complete
Plans:
- [x] 28-01-PLAN.md — Adapter layer: IAdapter interface, ClaudeCode/Windsurf/Cursor/Fallback adapters, selectAdapter factory, server.ts integration
- [x] 28-02-PLAN.md — Sidebar UI: Zustand agent event store, AgentSidebar component, PaneContainer/TerminalPane wiring
**UI hint**: yes

### Phase 29: Auto-Configuration
**Goal**: Opening the app is all that is required — hook registration and MCP server access are configured automatically
**Depends on**: Phase 27, Phase 28
**Requirements**: AGNT-04
**Success Criteria** (what must be TRUE):
  1. On first launch after v1.5, the app writes hook configuration into `~/.claude/settings.json` (or equivalent) pointing to `POST /hook-event` without requiring any manual edit
  2. The MCP server entry is injected into the user's MCP config on startup so Claude Code discovers the tools automatically
  3. If the config files already contain the correct entries, startup does not duplicate or corrupt them
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 11/11 | Complete | 2026-03-28 |
| 6 | v1.1 | 2/2 | Complete | 2026-03-30 |
| 7-9 | v1.1 | — | Superseded by v1.2 | — |
| 10-15 | v1.2 | 9/9 | Complete | 2026-03-30 |
| 16-20 | v1.3 | 7/7 | Complete | 2026-03-31 |
| 21-22 | v1.4 | 4/4 | Complete | 2026-03-31 |
| 23-25 | v1.5 | 7/7 | Complete | 2026-04-01 |
| 26. Hook Receiver & Event Schema | v1.6 | 2/2 | Complete    | 2026-04-01 |
| 27. MCP Server | v1.6 | 1/1 | Complete    | 2026-04-01 |
| 28. Adapter Layer & Sidebar | v1.6 | 2/2 | Complete   | 2026-04-01 |
| 29. Auto-Configuration | v1.6 | 0/TBD | Not started | - |

---
*Full phase details archived in `.planning/milestones/`*
