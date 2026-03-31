# Roadmap: Chat Overlay Widget

## Milestones

- ✅ **v1.0 Core Application** — Phases 1-5 (shipped 2026-03-28)
- ✅ **v1.1 Screenshot Automation & Input Polish** — Phases 6-9 (shipped 2026-03-30)
- ✅ **v1.2 Live App Awareness & Capture** — Phases 10-15 (shipped 2026-03-30)
- ✅ **v1.3 Window Picker & LLM-Actionable Capture** — Phases 16-20 (shipped 2026-03-31)
- ✅ **v1.4 Stable Window Targeting** — Phases 21-22 (shipped 2026-03-31)
- 🚧 **v1.5 Self-Observation & Agent Visibility** — Phases 23-29 (in progress)

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

### 🚧 v1.5 Self-Observation & Agent Visibility (In Progress)

**Milestone Goal:** Let any MCP-capable LLM running in the app autonomously read the terminal, observe agent activity, and capture screenshots — with a layered adapter architecture that degrades gracefully for non-MCP LLMs.

- [x] **Phase 23: Terminal Buffer Layer** - Ring buffer, ANSI stripping, HTTP endpoint, SQLite history query (completed 2026-03-31)
- [ ] **Phase 24: Secret Scrubber & Trust Tiers** - Best-effort secret scrubbing and provider trust tier config
- [ ] **Phase 25: Screenshot Self-Capture** - App self-capture, secret-region blurring, provider-gated delivery
- [ ] **Phase 26: Hook Receiver & Event Schema** - Hook endpoint, normalized AgentEvent schema
- [ ] **Phase 27: MCP Server** - stdio MCP server wrapping terminal, history, and screenshot tools
- [ ] **Phase 28: Adapter Layer & Sidebar** - Hook adapters for Claude Code/Windsurf/Cursor, sidebar event panel
- [ ] **Phase 29: Auto-Configuration** - Zero-setup hook config and MCP registration injection on startup

## Phase Details

### Phase 23: Terminal Buffer Layer
**Goal**: Any caller can query the app's terminal output as clean, paginated plain text
**Depends on**: Phase 22
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04
**Success Criteria** (what must be TRUE):
  1. `GET /terminal-state?lines=50` returns the last 50 lines of terminal output as plain text with no ANSI codes
  2. `GET /terminal-state?since=<cursor>` returns only output that appeared after the caller's last read position
  3. A tool reading historical output via `query_session_history` can retrieve PTY output from before the current buffer window
  4. ANSI/OSC escape codes are stripped at write time — the stored buffer contains only readable text
**Plans**: 2 plans
Plans:
- [x] 23-01-PLAN.md -- TerminalBuffer core (ring buffer, ANSI strip, PTYSession wiring)
- [x] 23-02-PLAN.md -- HTTP endpoints (/terminal-state, /session-history) + live verify

### Phase 24: Secret Scrubber & Trust Tiers
**Goal**: Sensitive values in terminal output are identified and redacted before leaving the local machine
**Depends on**: Phase 23
**Requirements**: LLM-04, LLM-03
**Success Criteria** (what must be TRUE):
  1. API keys, tokens, and connection strings matching known patterns are replaced with `[REDACTED]` in terminal content before it is returned to any LLM caller
  2. A visible warning in the app communicates that scrubbing is best-effort, not a security guarantee
  3. Local model callers receive unscrubbed terminal content; cloud provider callers receive scrubbed content based on the configured trust tier
**Plans**: 2 plans
Plans:
- [x] 24-01-PLAN.md — Secret scrubber module (scrub, detectSecrets, ~18 regex patterns)
- [ ] 24-02-PLAN.md — HTTP route integration (?scrub param, X-Scrub-Warning header, warning field)

### Phase 25: Screenshot Self-Capture
**Goal**: The app can capture and deliver its own window as a PNG, with secrets blurred for cloud transmission
**Depends on**: Phase 24
**Requirements**: SCRN-01, SCRN-02, SCRN-03
**Success Criteria** (what must be TRUE):
  1. `GET /screenshot` returns a PNG of the current Tauri app window, captured via PrintWindow
  2. Pixel rows corresponding to lines that contain secret patterns are blacked out in the PNG before it is returned to a cloud LLM caller
  3. A local model caller requesting a screenshot receives the raw unblurred PNG; a cloud caller receives the blurred version
**Plans**: TBD
**UI hint**: yes

### Phase 26: Hook Receiver & Event Schema
**Goal**: The sidecar can receive and normalize lifecycle events from any supported AI coding agent
**Depends on**: Phase 22
**Requirements**: AGNT-01, AGNT-02
**Success Criteria** (what must be TRUE):
  1. `POST /hook-event` on the sidecar accepts hook payloads (SubagentStart, SubagentStop, PreToolUse, PostToolUse) and responds within 500ms
  2. Every received hook payload is normalized to a shared `AgentEvent` object with consistent `tool`, `type`, `timestamp`, `sessionId`, and `payload` fields regardless of the originating tool
  3. Events from Claude Code hooks delivered via curl reach the sidecar and are logged with their normalized schema
**Plans**: TBD

### Phase 27: MCP Server
**Goal**: Any MCP-capable LLM can autonomously read terminal output, query session history, and capture screenshots via standard MCP tools
**Depends on**: Phase 23, Phase 24, Phase 25
**Requirements**: LLM-01
**Success Criteria** (what must be TRUE):
  1. An MCP client (e.g., Claude Code with `.mcp.json` configured) can call `read_terminal_output` and receive the current terminal buffer
  2. An MCP client can call `query_session_history` and receive historical PTY output from the SQLite store
  3. An MCP client can call `capture_screenshot` and receive a PNG of the app window (blurred if the caller is a cloud provider)
  4. The MCP server starts via stdio transport and registers cleanly with no manual setup beyond the `.mcp.json` file
**Plans**: TBD

### Phase 28: Adapter Layer & Sidebar
**Goal**: Hook events from Claude Code, Windsurf, and Cursor are normalized through typed adapters, and structured agent activity is visible in the app UI
**Depends on**: Phase 26
**Requirements**: LLM-02, AGNT-03
**Success Criteria** (what must be TRUE):
  1. Hook events from Claude Code, Windsurf, and Cursor each pass through a dedicated adapter that maps tool-specific fields to the shared `AgentEvent` schema
  2. Unrecognized hook formats are handled by a FallbackAdapter that preserves the raw payload without crashing
  3. The app sidebar shows a list of recent agent events with tool name, file path (where applicable), and a status indicator (running/complete/error)
  4. The sidebar can be collapsed and expanded without losing the accumulated event history for the current session
**Plans**: TBD
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
| 23. Terminal Buffer Layer | v1.5 | 2/2 | Complete    | 2026-03-31 |
| 24. Secret Scrubber & Trust Tiers | v1.5 | 1/2 | In Progress|  |
| 25. Screenshot Self-Capture | v1.5 | 0/TBD | Not started | - |
| 26. Hook Receiver & Event Schema | v1.5 | 0/TBD | Not started | - |
| 27. MCP Server | v1.5 | 0/TBD | Not started | - |
| 28. Adapter Layer & Sidebar | v1.5 | 0/TBD | Not started | - |
| 29. Auto-Configuration | v1.5 | 0/TBD | Not started | - |

---
*Full phase details archived in `.planning/milestones/`*
