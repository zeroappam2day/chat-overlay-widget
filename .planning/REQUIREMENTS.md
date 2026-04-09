# Requirements: Chat Overlay Widget

**Defined:** 2026-04-09
**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart

## v1.8 Requirements

Requirements for v1.8 Ship & Harden milestone. Each maps to roadmap phases.

### PM Chat Completion

- [x] **CHAT-01**: User can send a message and receive a streaming response from local Ollama LLM (shipped v1.7 Phase 31)
- [ ] **CHAT-02**: Each message automatically includes the last N lines of terminal output as context for the LLM
- [ ] **CHAT-03**: User can ask follow-up questions with conversation history maintained (capped at 20 turns)
- [x] **CHAT-04**: App checks Ollama availability on sidebar open and shows clear status if Ollama is not running (shipped v1.7 Phase 31)
- [x] **SET-01**: User can select from available Ollama models via dropdown populated from /api/tags
- [x] **SET-02**: User can edit the PM system prompt in a textarea, persisted to localStorage
- [x] **SET-03**: User can adjust LLM temperature via slider (default 0.0), persisted to localStorage
- [x] **SET-04**: User can configure custom Ollama endpoint URL, persisted to localStorage

### Test Infrastructure

- [ ] **TEST-01**: Playwright CDP connects to running Tauri app's WebView2 via --remote-debugging-port and can navigate the UI programmatically
- [ ] **TEST-02**: Component tests exist for the 3 highest-churn frontend files (TerminalPane, ChatInputBar, PaneContainer) using Vitest + Testing Library
- [ ] **TEST-03**: At least one E2E smoke test validates the core flow: app launches → terminal connects → command sends → output renders

### Discoverability

- [ ] **DISC-01**: User can press a keyboard shortcut (Ctrl+/) to see all available keyboard shortcuts in a help overlay
- [ ] **DISC-02**: The shortcut overlay groups shortcuts by category (navigation, features, editing) and shows current key bindings

### Cleanup

- [ ] **CLEAN-01**: All orphaned v1.7 code is either completed (wired end-to-end) or removed — no half-imported modules remain at runtime
- [ ] **CLEAN-02**: Dead code identified by repowise get_dead_code() is removed or explicitly justified with comments

## v1.7 Requirements (Partially Shipped, Carried Forward)

### Shipped (v1.7 Phase 31)

- [x] **CHAT-01**: Streaming Ollama chat via sidecar pmChat.ts
- [x] **CHAT-04**: Ollama health check with graceful error states

### Carried to v1.8

- CHAT-02, CHAT-03, SET-01–04 (see v1.8 requirements above)

### Moved to Backlog

- TTS-01 through TTS-04 (zero implementation, deferred twice)

## v1.6 Requirements (Shipped)

### Agent Visibility

- [x] **AGNT-01**: `POST /hook-event` endpoint on sidecar receives hook payloads
- [x] **AGNT-02**: Normalized `AgentEvent` schema consumed by all downstream components
- [x] **AGNT-03**: Collapsible sidebar panel shows structured agent activity
- [ ] **AGNT-04**: Auto-configuration injects hook config + MCP registration on startup (deferred)

### LLM Integration

- [x] **LLM-01**: MCP server (stdio transport) exposes terminal, history, screenshot tools
- [x] **LLM-02**: Adapter layer with ClaudeCode/Windsurf/Cursor/Fallback adapters

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### TTS Voice Engine (moved to backlog from v1.7)

- **TTS-01**: LLM responses spoken aloud via Windows SAPI5 through persistent PowerShell subprocess
- **TTS-02**: Stop button halts current utterance immediately
- **TTS-03**: Voice selection (Hazel/Zira) and speech rate settings
- **TTS-04**: Auto-speak toggle
- **Trigger condition:** Only revisit when PM Chat is stable and user requests voice output

### Auto-Configuration (deferred from v1.6)

- **AGNT-04**: Auto-configuration for hook + MCP registration on startup

### Accessibility

- **A11Y-01**: ARIA roles and labels on all custom interactive components
- **A11Y-02**: Screen reader support for key user flows

### Other Deferred

- **SSE-01**: SSE transport bridge for MCP server
- **CDP-01**: Chrome DevTools Protocol integration (dev builds only)
- **XTERM-01**: xterm.js SerializeAddon integration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Midscene.js AI testing layer | Beta quality (v1.7.3), no Tauri-specific evidence; defer until Playwright CDP proves out |
| Full E2E test suite | Premature for single-user app; smoke test + component tests sufficient |
| Mode system journey definition | Product decision, not code task; needs separate product discovery |
| First-run onboarding/tutorial | Requires product definition of default experience; defer until feature flags stabilize |
| Virtual xterm.js panes per agent | Stress test: raw JSONL is unreadable, panes accumulate |
| Full-buffer dump (no pagination) | 64KB = 16K-20K tokens per call |
| Secret scrubber as security guarantee | Regex bypass vectors; explicit warning instead |
| LLM output in shell commands | RCE risk — all LLM text piped via stdin, never interpolated |
| Persistent chat history across restarts | v1 scope: in-memory only; flag for v2 |
| Multi-LLM provider support | v1 scope: Ollama only; extensible later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 34 | Pending |
| CLEAN-02 | Phase 34 | Pending |
| SET-01 | Phase 35 | Complete |
| SET-02 | Phase 35 | Complete |
| SET-03 | Phase 35 | Complete |
| SET-04 | Phase 35 | Complete |
| CHAT-02 | Phase 36 | Pending |
| CHAT-03 | Phase 36 | Pending |
| DISC-01 | Phase 37 | Pending |
| DISC-02 | Phase 37 | Pending |
| TEST-01 | Phase 38 | Pending |
| TEST-02 | Phase 38 | Pending |
| TEST-03 | Phase 38 | Pending |

**Coverage:**
- v1.8 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*v1.6 requirements archived inline (shipped phases 26-28)*
*v1.7 requirements: CHAT-01/CHAT-04 shipped, CHAT-02/03/SET-01-04 carried to v1.8, TTS-01-04 moved to backlog*
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 — v1.8 roadmap created, all 13 requirements mapped to phases 34-38*
