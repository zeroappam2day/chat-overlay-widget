# Requirements: Chat Overlay Widget

**Defined:** 2026-03-31
**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart

## v1.5 Requirements

Requirements for Self-Observation & Agent Visibility milestone. Each maps to roadmap phases.

### Terminal Observation

- [ ] **TERM-01**: Sidecar maintains a 64KB rolling ring buffer of PTY output via a second `onData` listener
- [ ] **TERM-02**: Ring buffer strips ANSI/OSC escape codes at write time using `strip-ansi` or Node.js built-in
- [ ] **TERM-03**: `GET /terminal-state?lines=N&since=cursor` returns only new content since caller's last read position
- [ ] **TERM-04**: `query_session_history` queries SQLite `session_chunks` read-only for historical output before current buffer

### Screenshot

- [ ] **SCRN-01**: `GET /screenshot` captures the app's own Tauri window via PrintWindow and returns PNG
- [ ] **SCRN-02**: Secret-region blurring detects secret patterns in buffer text and blacks out matching pixel rows in the PNG
- [ ] **SCRN-03**: Provider-gated screenshot: cloud LLMs receive blurred PNG, local models receive raw PNG

### Agent Visibility

- [ ] **AGNT-01**: `POST /hook-event` endpoint on sidecar receives hook payloads (SubagentStart/Stop/PreToolUse/PostToolUse)
- [ ] **AGNT-02**: Normalized `AgentEvent` schema (tool, type, timestamp, sessionId, payload) consumed by all downstream components
- [ ] **AGNT-03**: Collapsible sidebar panel in React UI shows structured agent activity (tool name, file path, status indicator)
- [ ] **AGNT-04**: Auto-configuration injects hook config + MCP registration into settings.json on app startup

### LLM Integration

- [ ] **LLM-01**: MCP server (stdio transport) exposes `read_terminal_output`, `query_session_history`, `capture_screenshot` tools
- [ ] **LLM-02**: Adapter layer with ClaudeCodeAdapter, WindsurfAdapter, CursorAdapter, FallbackAdapter normalizing hook events
- [x] **LLM-03**: Provider trust tier config: local models receive unscrubbed content, cloud providers receive scrubbed content
- [x] **LLM-04**: Best-effort secret scrubber (regex for API keys, tokens, connection strings) with explicit "not a security boundary" warning

## Future Requirements

### Deferred

- **SSE-01**: SSE transport bridge for MCP server (needed for remote LLMs like GPT-4, Gemini to call tools autonomously)
- **CDP-01**: Chrome DevTools Protocol integration for webview state inspection (dev builds only)
- **XTERM-01**: xterm.js SerializeAddon integration for exact viewport snapshot (high complexity, browser-to-server bridge)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Virtual xterm.js panes per agent | Stress test: raw JSONL is unreadable, panes accumulate, category error (terminal for log data) |
| Full-buffer dump (no pagination) | 64KB = 16K-20K tokens per call; catastrophic for small-context models |
| Secret scrubber as security guarantee | Regex bypass vectors (ANSI-split, base64, line-wrap); false guarantee is worse than explicit warning |
| CDP in production builds | Localhost attack surface; dev-only if ever needed |
| Process tree monitoring for agent detection | Claude Code agents are in-process context windows, not subprocesses |
| Transcript JSONL tail-watching as core component | Moved to adapter layer; only relevant for Claude Code + Windsurf |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TERM-01 | Phase 23 | Pending |
| TERM-02 | Phase 23 | Pending |
| TERM-03 | Phase 23 | Pending |
| TERM-04 | Phase 23 | Pending |
| LLM-04 | Phase 24 | Complete |
| LLM-03 | Phase 24 | Complete |
| SCRN-01 | Phase 25 | Pending |
| SCRN-02 | Phase 25 | Pending |
| SCRN-03 | Phase 25 | Pending |
| AGNT-01 | Phase 26 | Pending |
| AGNT-02 | Phase 26 | Pending |
| LLM-01 | Phase 27 | Pending |
| LLM-02 | Phase 28 | Pending |
| AGNT-03 | Phase 28 | Pending |
| AGNT-04 | Phase 29 | Pending |

**Coverage:**
- v1.5 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 — traceability mapped to phases 23-29*
