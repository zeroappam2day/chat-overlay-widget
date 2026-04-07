# Requirements: Chat Overlay Widget

**Defined:** 2026-04-07
**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart

## v1.7 Requirements

Requirements for PM Voice Chat milestone.

### LLM Chat

- [x] **CHAT-01**: User can send a message and receive a streaming response from local Ollama LLM
- [ ] **CHAT-02**: Each message automatically includes the last N lines of terminal output as context for the LLM
- [ ] **CHAT-03**: User can ask follow-up questions with conversation history maintained (capped at 20 turns)
- [x] **CHAT-04**: App checks Ollama availability on sidebar open and shows clear status if Ollama is not running

### TTS Voice

- [ ] **TTS-01**: LLM responses are spoken aloud via Windows SAPI5 through a persistent PowerShell process
- [ ] **TTS-02**: User can stop/cancel speech mid-utterance via a button
- [ ] **TTS-03**: User can select voice (Hazel/Zira) and adjust speech rate in settings
- [ ] **TTS-04**: User can toggle auto-speak on/off (when on, every response is spoken automatically)

### Settings

- [ ] **SET-01**: User can select from available Ollama models via dropdown populated from /api/tags
- [ ] **SET-02**: User can edit the PM system prompt in a textarea, persisted to localStorage
- [ ] **SET-03**: User can adjust LLM temperature via slider (default 0.0), persisted to localStorage
- [ ] **SET-04**: User can configure custom Ollama endpoint URL, persisted to localStorage

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

### Deferred

- **SSE-01**: SSE transport bridge for MCP server
- **CDP-01**: Chrome DevTools Protocol integration (dev builds only)
- **XTERM-01**: xterm.js SerializeAddon integration
- **AGNT-04**: Auto-configuration for hook + MCP registration (from v1.6)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Virtual xterm.js panes per agent | Stress test: raw JSONL is unreadable, panes accumulate |
| Full-buffer dump (no pagination) | 64KB = 16K-20K tokens per call |
| Secret scrubber as security guarantee | Regex bypass vectors; explicit warning instead |
| Cloud TTS (edge-tts) | Currently returning 403; pyttsx3/SAPI5 unreliable cross-platform |
| Python TTS dependency | Eliminated — PowerShell SAPI5 used instead (no Python required) |
| LLM output in shell commands | RCE risk — all LLM text piped via stdin, never interpolated |
| Persistent chat history across restarts | v1 scope: in-memory only; flag for v2 |
| Multi-LLM provider support | v1 scope: Ollama only; extensible later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHAT-01 | Phase 31 | Complete |
| CHAT-02 | Phase 32 | Pending |
| CHAT-03 | Phase 32 | Pending |
| CHAT-04 | Phase 31 | Complete |
| TTS-01 | Phase 33 | Pending |
| TTS-02 | Phase 33 | Pending |
| TTS-03 | Phase 33 | Pending |
| TTS-04 | Phase 33 | Pending |
| SET-01 | Phase 30 | Pending |
| SET-02 | Phase 30 | Pending |
| SET-03 | Phase 30 | Pending |
| SET-04 | Phase 30 | Pending |

**Coverage:**
- v1.7 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*v1.6 requirements archived inline (shipped phases 26-28)*
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after v1.7 roadmap creation (phases 30-33)*
