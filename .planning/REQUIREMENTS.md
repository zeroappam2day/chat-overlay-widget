# Requirements: Chat Overlay Widget

**Defined:** 2026-03-31
**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart

## v1.6 Requirements

Requirements for Agent Hooks & MCP Integration milestone (Phases 26-29).

### Agent Visibility

- [ ] **AGNT-01**: `POST /hook-event` endpoint on sidecar receives hook payloads (SubagentStart/Stop/PreToolUse/PostToolUse)
- [x] **AGNT-02**: Normalized `AgentEvent` schema (tool, type, timestamp, sessionId, payload) consumed by all downstream components
- [ ] **AGNT-03**: Collapsible sidebar panel in React UI shows structured agent activity (tool name, file path, status indicator)
- [ ] **AGNT-04**: Auto-configuration injects hook config + MCP registration into settings.json on app startup

### LLM Integration

- [ ] **LLM-01**: MCP server (stdio transport) exposes `read_terminal_output`, `query_session_history`, `capture_screenshot` tools
- [ ] **LLM-02**: Adapter layer with ClaudeCodeAdapter, WindsurfAdapter, CursorAdapter, FallbackAdapter normalizing hook events

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

| Requirement | Phase | Milestone | Status |
|-------------|-------|-----------|--------|
| AGNT-01 | Phase 26 | v1.6 | Pending |
| AGNT-02 | Phase 26 | v1.6 | Pending |
| LLM-01 | Phase 27 | v1.6 | Pending |
| LLM-02 | Phase 28 | v1.6 | Pending |
| AGNT-03 | Phase 28 | v1.6 | Pending |
| AGNT-04 | Phase 29 | v1.6 | Pending |

**Coverage:**
- v1.6 requirements: 6 total, 0 complete
- Unmapped: 0

---
*v1.5 requirements archived to .planning/milestones/v1.5-REQUIREMENTS.md*
*Last updated: 2026-04-01 — v1.5 completed, v1.6 requirements retained*
