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
- 🚧 **v1.8 Ship & Harden** — Phases 34-38 (active)

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

- [x] **Phase 26: Hook Receiver & Event Schema** - Hook endpoint, normalized AgentEvent schema (completed 2026-04-01)
- [x] **Phase 27: MCP Server** - stdio MCP server wrapping terminal, history, and screenshot tools (completed 2026-04-01)
- [x] **Phase 28: Adapter Layer & Sidebar** - Hook adapters for Claude Code/Windsurf/Cursor, sidebar event panel (completed 2026-04-01)
- [ ] **Phase 29: Auto-Configuration** - Zero-setup hook config and MCP registration injection on startup

</details>

<details>
<summary>❌ v1.7 PM Voice Chat (Phases 30-33) — ABANDONED 2026-04-09</summary>

- [ ] **Phase 30: LLM Settings Store** - Never started
- [~] **Phase 31: Ollama Chat Backend & Sidebar Tab** - Sidecar backend shipped (31-01); frontend (31-02) never executed
- [ ] **Phase 32: Conversational Context** - Never started
- [ ] **Phase 33: TTS Voice Engine** - Never started (moved to backlog)

</details>

### 🚧 v1.8 Ship & Harden (Active)

- [ ] **Phase 34: Orphan & Dead Code Cleanup** - Wire or remove all half-imported v1.7 modules; remove repowise-confirmed dead code
- [ ] **Phase 35: PM Chat Settings UI** - Model dropdown, system prompt, temperature, endpoint — all persisted to localStorage
- [ ] **Phase 36: PM Chat Conversational Context** - Terminal context injection per message, 20-turn history cap, multi-turn flow
- [ ] **Phase 37: Keyboard Shortcut Discoverability** - Ctrl+/ shortcut help overlay grouped by category
- [ ] **Phase 38: Test Infrastructure** - Playwright CDP connection to WebView2, component tests for high-churn files, E2E smoke test

## Phase Details

> v1.0–v1.5 phase details archived to `.planning/milestones/`

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
  1. On first launch after v1.6, the app writes hook configuration into `~/.claude/settings.json` (or equivalent) pointing to `POST /hook-event` without requiring any manual edit
  2. The MCP server entry is injected into the user's MCP config on startup so Claude Code discovers the tools automatically
  3. If the config files already contain the correct entries, startup does not duplicate or corrupt them
**Plans**: TBD

## v1.7 Phase Details

### Phase 30: LLM Settings Store
**Goal**: User-configurable LLM settings are persisted to localStorage and available to all v1.7 components before any LLM or TTS calls are made
**Depends on**: Phase 28 (sidebar infrastructure)
**Requirements**: SET-01, SET-02, SET-03, SET-04
**Success Criteria** (what must be TRUE):
  1. User can open the settings panel and select an Ollama model from a dropdown that is populated live from the Ollama /api/tags endpoint
  2. User can edit the PM system prompt in a textarea and the text survives an app restart
  3. User can move the temperature slider (0.0–1.0, default 0.0) and the value survives an app restart
  4. User can enter a custom Ollama endpoint URL and the value survives an app restart
  5. All four settings load from localStorage on startup so no value resets unexpectedly between sessions
**Plans**: TBD (never started — v1.7 abandoned)
**UI hint**: yes

### Phase 31: Ollama Chat Backend & Sidebar Tab
**Goal**: User can send a message to the local Ollama LLM from a PM Chat sidebar tab and watch the response stream in real time, with clear feedback if Ollama is not running
**Depends on**: Phase 30
**Requirements**: CHAT-01, CHAT-04
**Success Criteria** (what must be TRUE):
  1. Sending a message from the PM Chat tab triggers a streaming POST to the sidecar's /pm-chat route, and response tokens appear in the UI as they arrive from Ollama /api/chat
  2. Opening the PM Chat sidebar tab triggers an Ollama health check; if Ollama is not running the tab shows a clear error state with instructions rather than a blank or broken UI
  3. The PM Chat tab coexists with the AgentSidebar tab as a separate selectable tab in the sidebar
  4. Streaming completes cleanly — no orphaned loading states if the connection is closed mid-stream
**Plans:** 1/2 plans executed
Plans:
- [x] 31-01-PLAN.md — Sidecar streaming proxy: protocol types, pmChat module (NDJSON streaming + health check + abort), server.ts WS wiring
- [ ] 31-02-PLAN.md — Frontend: pmChatStore Zustand store, PMChatTab component, AgentSidebar tab switcher, TerminalPane WS dispatch
**UI hint**: yes

### Phase 32: Conversational Context
**Goal**: Every message the user sends automatically includes recent terminal output as context, and the LLM remembers the last 20 turns of conversation so follow-up questions work naturally
**Depends on**: Phase 31
**Requirements**: CHAT-02, CHAT-03
**Success Criteria** (what must be TRUE):
  1. Each outgoing message to Ollama includes the last N lines of terminal output (from TerminalBuffer) injected into the context without the user doing anything manually
  2. After receiving a response, the user can type a follow-up message and Ollama answers with awareness of the preceding exchange
  3. Conversation history is capped at 20 turns — the oldest turn is dropped when the cap is reached, and new messages continue to work normally
  4. Sending a message while a previous response is still streaming is blocked or queued — no duplicate in-flight requests
**Plans**: TBD (never started — v1.7 abandoned)
**UI hint**: yes

### Phase 33: TTS Voice Engine
**Goal**: LLM responses are spoken aloud via Windows SAPI5 through a persistent PowerShell subprocess, with user controls for voice selection, speech rate, auto-speak toggle, and mid-utterance stop
**Depends on**: Phase 31
**Requirements**: TTS-01, TTS-02, TTS-03, TTS-04
**Success Criteria** (what must be TRUE):
  1. When a response arrives and auto-speak is on, the text is spoken aloud through the Windows voice (Hazel or Zira) via the persistent PowerShell SAPI5 process — no new process is spawned per utterance
  2. User can click a Stop button during speech and the current utterance stops immediately without affecting subsequent messages
  3. User can select voice (Hazel/Zira) and adjust speech rate in settings and the next utterance reflects the change
  4. User can toggle auto-speak off; with auto-speak off, responses are not spoken unless the user explicitly triggers speech
  5. LLM response text is sent to the PowerShell process via stdin pipe only — it is never interpolated into a shell command string
**Plans**: TBD (never started — moved to backlog)
**UI hint**: yes

## v1.8 Phase Details

### Phase 34: Orphan & Dead Code Cleanup
**Goal**: The codebase has no half-imported modules at runtime and no confirmed-dead code — every file either works end-to-end or is removed
**Depends on**: Nothing (prerequisite for all v1.8 phases)
**Requirements**: CLEAN-01, CLEAN-02
**Success Criteria** (what must be TRUE):
  1. The app starts without console errors caused by missing imports or unresolved module references from v1.7 partial work
  2. PMChatTab.tsx and pmChatStore.ts are either wired into the sidebar (rendering without errors) or removed — no half-import state remains
  3. Every file flagged by `repowise get_dead_code()` is either deleted or has an inline comment explaining why it is retained
**Plans**: TBD

### Phase 35: PM Chat Settings UI
**Goal**: User can configure all LLM settings from a dedicated settings panel in the PM Chat sidebar, and every setting persists across app restarts
**Depends on**: Phase 34
**Requirements**: SET-01, SET-02, SET-03, SET-04
**Success Criteria** (what must be TRUE):
  1. User can open the PM Chat settings panel and select from a model dropdown populated live from Ollama /api/tags — selecting a model takes effect on the next message
  2. User can edit the PM system prompt in a textarea and the edited text is present after restarting the app
  3. User can drag the temperature slider (0.0–1.0, default 0.0) and the value is present after restarting the app
  4. User can enter a custom Ollama endpoint URL and the value is present after restarting the app
**Plans**: 2 plans
Plans:
- [x] 35-01-PLAN.md — pmChatSettingsStore (localStorage persistence) + PMChatSettings collapsible panel
- [ ] 35-02-PLAN.md — Protocol endpoint? threading, sidecar server wiring, PMChatTab integration
**UI hint**: yes

### Phase 36: PM Chat Conversational Context
**Goal**: PM Chat is a fully functional multi-turn assistant — every message includes live terminal context, and the LLM remembers the conversation up to 20 turns
**Depends on**: Phase 35
**Requirements**: CHAT-02, CHAT-03
**Success Criteria** (what must be TRUE):
  1. Each message sent to the PM Chat includes the last N lines of terminal output injected automatically — the user sees terminal-aware responses without pasting context manually
  2. After receiving a response, the user can type a follow-up question and the LLM answers with awareness of the prior exchange
  3. Conversation history caps at 20 turns — the oldest turn drops and new messages continue to work without errors
  4. Sending a message while a response is still streaming is blocked — only one request is in flight at a time
**Plans**: TBD
**UI hint**: yes

### Phase 37: Keyboard Shortcut Discoverability
**Goal**: User can see all keyboard shortcuts in the app at any time by pressing a single key combination
**Depends on**: Phase 34
**Requirements**: DISC-01, DISC-02
**Success Criteria** (what must be TRUE):
  1. Pressing Ctrl+/ while the app is focused opens a shortcut help overlay without navigating away or losing the current terminal state
  2. The overlay lists all shortcuts grouped into categories (navigation, features, editing) with the current key binding displayed for each
  3. Pressing Ctrl+/, Escape, or clicking outside the overlay closes it cleanly
**Plans**: TBD
**UI hint**: yes

### Phase 38: Test Infrastructure
**Goal**: The project has a working Playwright CDP connection to the running app's WebView2, component tests for the three highest-churn files, and one E2E smoke test that validates the core PTY flow
**Depends on**: Phase 36, Phase 37
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Running `npx playwright test` against a running Tauri app connects via CDP to WebView2 and can programmatically interact with the UI — confirmed by a test that reads a visible DOM element
  2. Vitest component tests exist for TerminalPane, ChatInputBar, and PaneContainer — each file has at least one passing test covering its primary render path
  3. An E2E smoke test completes the core flow end-to-end: app launches, terminal connects, a command is sent, and output renders in the xterm.js pane — test passes on the local machine
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
| 26. Hook Receiver & Event Schema | v1.6 | 2/2 | Complete | 2026-04-01 |
| 27. MCP Server | v1.6 | 1/1 | Complete | 2026-04-01 |
| 28. Adapter Layer & Sidebar | v1.6 | 2/2 | Complete | 2026-04-01 |
| 29. Auto-Configuration | v1.6 | 0/TBD | Not started | - |
| 30. LLM Settings Store | v1.7 | 0/TBD | Abandoned | - |
| 31. Ollama Chat Backend & Sidebar Tab | v1.7 | 1/2 | Partial (sidecar only) | - |
| 32. Conversational Context | v1.7 | 0/TBD | Abandoned | - |
| 33. TTS Voice Engine | v1.7 | 0/TBD | Moved to backlog | - |
| 34. Orphan & Dead Code Cleanup | v1.8 | 0/TBD | Not started | - |
| 35. PM Chat Settings UI | v1.8 | 1/2 | In Progress|  |
| 36. PM Chat Conversational Context | v1.8 | 0/TBD | Not started | - |
| 37. Keyboard Shortcut Discoverability | v1.8 | 0/TBD | Not started | - |
| 38. Test Infrastructure | v1.8 | 0/TBD | Not started | - |

---
*Full phase details archived in `.planning/milestones/`*
