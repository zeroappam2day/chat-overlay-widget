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
- [x] **PTY-06**: Sidecar process cleanup on app close (no orphan node.exe processes)
- [x] **PTY-07**: Shell selector UI to choose between available shells

### Terminal Rendering

- [x] **TERM-01**: xterm.js rendering with full ANSI escape code support
- [x] **TERM-02**: Scrollback buffer of 10000+ lines
- [x] **TERM-03**: Copy text from terminal output to clipboard
- [x] **TERM-04**: Paste text from clipboard into terminal
- [x] **TERM-05**: Search within terminal output

### Input & Shadow Typing

- [x] **INPUT-01**: GUI input box for typing commands
- [x] **INPUT-02**: Shadow typing — input sent to PTY as real keystrokes, CLI cannot distinguish
- [x] **INPUT-03**: Enter key sends command, preserves input box focus

### Chat History

- [x] **HIST-01**: Chat history persisted within current session (in-memory + display)
- [x] **HIST-02**: Chat history persisted across app sessions (SQLite on disk)
- [x] **HIST-03**: Per-pane chat history in multi-pane mode (separate history per split pane)
- [x] **HIST-04**: User can browse and scroll through past conversations

### Screenshots

- [x] **SCRN-01**: User can drag and drop image onto the app to send to CLI
- [x] **SCRN-02**: User can paste image from clipboard to send to CLI
- [x] **SCRN-03**: Images saved to temp folder, file path passed to CLI as input
- [x] **SCRN-04**: Temp screenshot files automatically deleted on session close

### Multi-Pane (psmux)

- [x] **PSMUX-01**: User can create multiple terminal panes in split layout
- [x] **PSMUX-02**: Each pane runs an independent PTY session (own shell process)
- [x] **PSMUX-03**: User can close individual panes (PTY session cleaned up)
- [x] **PSMUX-04**: User can resize panes by dragging dividers

### Window Management

- [x] **WIN-01**: Always-on-top toggle (pin window above all others)
- [x] **WIN-02**: Adaptive layout responsive to screen size and window shape
- [x] **WIN-03**: xterm.js terminal auto-fits to available pane size on resize

## v1.1 Requirements

Requirements for Screenshot Automation & Input Polish milestone.

### Path Insertion

- [x] **PATH-01**: Screenshot file paths are quoted per active shell (PS single-quote, cmd double-quote, bash forward-slash + single-quote)
- [x] **PATH-02**: Temp screenshot filenames use UUID-only format (no special characters that need escaping)

### Input Bar

- [ ] **INBAR-01**: Chat input bar default height is ~144px (3x current 48px)
- [ ] **INBAR-02**: User can drag-resize the chat input bar height via a drag handle
- [ ] **INBAR-03**: xterm.js terminal re-fits correctly when input bar height changes (debounce + offsetHeight guard)

### Capture Infrastructure

- [ ] **CAPI-01**: Sidecar exposes HTTP REST API alongside existing WebSocket server
- [ ] **CAPI-02**: Port discovery file written to %TEMP%/chat-overlay-api with port + auth token
- [ ] **CAPI-03**: HTTP API requires Bearer token authentication on all endpoints
- [ ] **CAPI-04**: Port discovery file is atomically deleted on sidecar shutdown

### Window Capture

- [ ] **WCAP-01**: HTTP endpoint captures a window screenshot by title
- [ ] **WCAP-02**: HTTP endpoint lists available windows with titles and process names
- [ ] **WCAP-03**: Window capture is DPI-aware on 125%+ scaled displays
- [ ] **WCAP-04**: Captured image saved to temp dir, absolute filepath returned in response

### Browser Capture

- [ ] **BCAP-01**: HTTP endpoint captures full-page browser screenshot via CDP (puppeteer-core)
- [ ] **BCAP-02**: Automatically falls back to window capture when CDP unavailable
- [ ] **BCAP-03**: Connects to Chrome or Edge debug port (default 9222, configurable)

### CLI Wrapper

- [ ] **CLIP-01**: overlay-capture script discovers sidecar port + token from discovery file
- [ ] **CLIP-02**: overlay-capture supports window, browser, list, and help commands
- [ ] **CLIP-03**: Prints captured filepath to stdout for AI CLI tool consumption

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
| PTY-06 | Phase 2 | Complete |
| PTY-07 | Phase 2 | Complete |
| TERM-01 | Phase 3 | Complete |
| TERM-02 | Phase 3 | Complete |
| TERM-03 | Phase 3 | Complete |
| TERM-04 | Phase 3 | Complete |
| TERM-05 | Phase 3 | Complete |
| INPUT-01 | Phase 3 | Complete |
| INPUT-02 | Phase 3 | Complete |
| INPUT-03 | Phase 3 | Complete |
| HIST-01 | Phase 3 | Complete |
| HIST-02 | Phase 3 | Complete |
| HIST-04 | Phase 3 | Complete |
| SCRN-01 | Phase 4 | Complete |
| SCRN-02 | Phase 4 | Complete |
| SCRN-03 | Phase 4 | Complete |
| SCRN-04 | Phase 4 | Complete |
| HIST-03 | Phase 4 | Complete |
| PSMUX-01 | Phase 4 | Complete |
| PSMUX-02 | Phase 4 | Complete |
| PSMUX-03 | Phase 4 | Complete |
| PSMUX-04 | Phase 4 | Complete |
| WIN-01 | Phase 4 | Complete |
| WIN-02 | Phase 4 | Complete |
| WIN-03 | Phase 4 | Complete |
| PATH-01 | Phase 6 | Complete |
| PATH-02 | Phase 6 | Complete |
| INBAR-01 | Phase 6 | Pending |
| INBAR-02 | Phase 6 | Pending |
| INBAR-03 | Phase 6 | Pending |
| CAPI-01 | Phase 7 | Pending |
| CAPI-02 | Phase 7 | Pending |
| CAPI-03 | Phase 7 | Pending |
| CAPI-04 | Phase 7 | Pending |
| WCAP-01 | Phase 8 | Pending |
| WCAP-02 | Phase 8 | Pending |
| WCAP-03 | Phase 8 | Pending |
| WCAP-04 | Phase 8 | Pending |
| BCAP-01 | Phase 9 | Pending |
| BCAP-02 | Phase 9 | Pending |
| BCAP-03 | Phase 9 | Pending |
| CLIP-01 | Phase 9 | Pending |
| CLIP-02 | Phase 9 | Pending |
| CLIP-03 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 35 total — mapped to phases 1-5, all complete
- v1.1 requirements: 19 total — mapped to phases 6-9, all pending
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-28 — v1.1 traceability added (Phases 6-9, 19 requirements)*
