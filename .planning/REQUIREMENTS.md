# Requirements: Chat Overlay Widget

**Defined:** 2026-03-27
**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart

## v1 Requirements

### Infrastructure

- [x] **INFRA-01**: Tauri 1.7.2 desktop shell with native window controls (minimize, maximize, close)
- [x] **INFRA-02**: Node.js sidecar process running node-pty (separate from Tauri webview)
- [x] **INFRA-03**: WebSocket bridge between Tauri webview and Node.js sidecar on localhost
- [x] **INFRA-04**: `dangerousUseHttpScheme` configured for production ws:// compatibility
- [x] **INFRA-05**: Sidecar bundled via caxa with node-pty native .node binary

### PTY Bridge

- [x] **PTY-01**: node-pty ConPTY spawning PowerShell as default shell
- [x] **PTY-02**: node-pty ConPTY spawning cmd.exe as alternative shell
- [x] **PTY-03**: node-pty ConPTY spawning Git Bash as alternative shell (if installed)
- [x] **PTY-04**: Full keystroke → PTY → shell → output roundtrip verified
- [x] **PTY-05**: PTY resize chain — xterm.js onResize → WebSocket → ptyProcess.resize(cols, rows)
- [ ] **PTY-06**: Sidecar process cleanup on app close (no orphan node.exe processes)
- [ ] **PTY-07**: Shell selector UI to choose between available shells

### Terminal Rendering

- [x] **TERM-01**: xterm.js rendering with full ANSI escape code support
- [x] **TERM-02**: Scrollback buffer of 10000+ lines
- [x] **TERM-03**: Copy text from terminal output to clipboard
- [x] **TERM-04**: Paste text from clipboard into terminal
- [x] **TERM-05**: Search within terminal output

### Input & Shadow Typing

- [ ] **INPUT-01**: GUI input box for typing commands
- [ ] **INPUT-02**: Shadow typing — input sent to PTY as real keystrokes, CLI cannot distinguish
- [ ] **INPUT-03**: Enter key sends command, preserves input box focus

### Chat History

- [x] **HIST-01**: Chat history persisted within current session (in-memory + display)
- [x] **HIST-02**: Chat history persisted across app sessions (SQLite on disk)
- [ ] **HIST-03**: Per-pane chat history in multi-pane mode (separate history per split pane)
- [ ] **HIST-04**: User can browse and scroll through past conversations

### Screenshots

- [ ] **SCRN-01**: User can drag and drop image onto the app to send to CLI
- [ ] **SCRN-02**: User can paste image from clipboard to send to CLI
- [ ] **SCRN-03**: Images saved to temp folder, file path passed to CLI as input
- [ ] **SCRN-04**: Temp screenshot files automatically deleted on session close

### Multi-Pane (psmux)

- [ ] **PSMUX-01**: User can create multiple terminal panes in split layout
- [ ] **PSMUX-02**: Each pane runs an independent PTY session (own shell process)
- [ ] **PSMUX-03**: User can close individual panes (PTY session cleaned up)
- [ ] **PSMUX-04**: User can resize panes by dragging dividers

### Window Management

- [ ] **WIN-01**: Always-on-top toggle (pin window above all others)
- [ ] **WIN-02**: Adaptive layout responsive to screen size and window shape
- [ ] **WIN-03**: xterm.js terminal auto-fits to available pane size on resize

## v2 Requirements

### Input Enhancements

- **INPUT-V2-01**: Syntax-aware input with autocomplete
- **INPUT-V2-02**: Command history recall (up/down arrow in input box)

### Session Management

- **SESS-V2-01**: Session restore on app restart (pane layout + CWD, not live PTY state)
- **SESS-V2-02**: Named sessions for organizing different workspaces

### Terminal Enhancements

- **TERM-V2-01**: Command block grouping (Warp Blocks-style input/output demarcation)
- **TERM-V2-02**: Hotkey to focus input overlay from anywhere

## Out of Scope

| Feature | Reason |
|---------|--------|
| Docker integration | Local Windows only, not needed |
| WSL support | Windows native only per constraint |
| Cloud sync / remote deployment | Single user, local machine only |
| Multi-user / authentication | Personal tool, no auth needed |
| OAuth / external service integrations | Local CLI wrapper only |
| Plugin system | Scope trap — single-purpose tool |
| SSH terminal management | Not a general terminal app |
| Mobile / tablet support | Desktop only |
| Tauri v2 migration | v1.7.2 is stable and sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| PTY-01 | Phase 2 | Complete |
| PTY-02 | Phase 2 | Complete |
| PTY-03 | Phase 2 | Complete |
| PTY-04 | Phase 2 | Complete |
| PTY-05 | Phase 2 | Complete |
| PTY-06 | Phase 2 | Pending |
| PTY-07 | Phase 2 | Pending |
| TERM-01 | Phase 3 | Complete |
| TERM-02 | Phase 3 | Complete |
| TERM-03 | Phase 3 | Complete |
| TERM-04 | Phase 3 | Complete |
| TERM-05 | Phase 3 | Complete |
| INPUT-01 | Phase 3 | Pending |
| INPUT-02 | Phase 3 | Pending |
| INPUT-03 | Phase 3 | Pending |
| HIST-01 | Phase 3 | Complete |
| HIST-02 | Phase 3 | Complete |
| HIST-04 | Phase 3 | Pending |
| SCRN-01 | Phase 4 | Pending |
| SCRN-02 | Phase 4 | Pending |
| SCRN-03 | Phase 4 | Pending |
| SCRN-04 | Phase 4 | Pending |
| HIST-03 | Phase 4 | Pending |
| PSMUX-01 | Phase 4 | Pending |
| PSMUX-02 | Phase 4 | Pending |
| PSMUX-03 | Phase 4 | Pending |
| PSMUX-04 | Phase 4 | Pending |
| WIN-01 | Phase 4 | Pending |
| WIN-02 | Phase 4 | Pending |
| WIN-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 — Phase 1 complete, all INFRA requirements verified*
