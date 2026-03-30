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

- [x] **INBAR-01**: Chat input bar default height is ~144px (3x current 48px)
- [x] **INBAR-02**: User can drag-resize the chat input bar height via a drag handle
- [x] **INBAR-03**: xterm.js terminal re-fits correctly when input bar height changes (debounce + offsetHeight guard)

### Capture Infrastructure (superseded by v1.2 CAPI)

~~CAPI-01–04, WCAP-01–04, BCAP-01–03, CLIP-01–03~~ — Replaced by v1.2 approach (direct UI + Claude skill instead of HTTP-only API). See v1.2 requirements below.

## v1.2 Requirements

Requirements for Live App Awareness & Capture milestone.

### Split Pane Preservation

- [x] **SPLIT-01**: User can split a pane without losing the live PTY session in the original pane
- [x] **SPLIT-02**: Terminal content (scrollback, ANSI output) preserved after split
- [x] **SPLIT-03**: xterm.js correctly refits to new panel dimensions after split completes

### Window Enumeration

- [x] **ENUM-01**: User can retrieve a list of visible taskbar applications with title and process name
- [x] **ENUM-02**: System windows, tooltips, and background services are filtered from the list
- [x] **ENUM-03**: Window list results are cached (5s TTL) to avoid redundant PowerShell spawns
- [x] **ENUM-04**: Sidecar exposes GET /list-windows HTTP endpoint returning JSON array

### Window Capture

- [x] **WCAP-01**: User can capture a window screenshot by title (exact or substring match)
- [x] **WCAP-02**: Capture is DPI-aware on 125%+ scaled displays (DwmGetWindowAttribute bounds)
- [x] **WCAP-03**: Minimized windows return ERROR:MINIMIZED (caller restores before capturing); occluded windows captured via PrintWindow PW_RENDERFULLCONTENT
- [x] **WCAP-04**: Captured PNG saved to temp dir with UUID filename, absolute path returned
- [x] **WCAP-05**: Capture failure returns error response (never crashes sidecar)

### Capture Infrastructure

- [x] **CAPI-01**: Sidecar exposes HTTP REST API alongside existing WebSocket server (shared port)
- [x] **CAPI-02**: Port discovery file written to %APPDATA%\chat-overlay-widget\ with port + auth token
- [x] **CAPI-03**: HTTP API requires Bearer token authentication on all endpoints
- [x] **CAPI-04**: Port discovery file atomically deleted on sidecar shutdown

### CLI Wrapper

- [x] **CLIP-01**: overlay-capture script discovers sidecar port + token from discovery file
- [x] **CLIP-02**: overlay-capture supports list and window --title commands
- [x] **CLIP-03**: Prints captured filepath to stdout for CLI consumption

### Claude Skill

- [x] **SKIL-01**: .claude/skills/capture-app/SKILL.md registers /capture-app slash command
- [x] **SKIL-02**: Skill dynamically injects current window list via overlay-capture list
- [x] **SKIL-03**: Skill captures selected window and returns file path for Claude to reference

## v1.3 Requirements

Requirements for Window Picker & LLM-Actionable Capture milestone.

### Thumbnails

- [ ] **THUMB-01**: User can request batch thumbnails of all visible windows via a single async operation
- [ ] **THUMB-02**: Each thumbnail is a mini-capture (240x180) returned as base64 with window title and process name
- [ ] **THUMB-03**: Thumbnails are briefly cached to avoid re-capturing on picker reopen
- [ ] **THUMB-04**: User can filter windows by title or process name in the picker

### Picker

- [ ] **PICK-01**: User can open a window picker popover/panel from the UI showing thumbnail grid
- [ ] **PICK-02**: User can navigate the thumbnail grid with arrow keys and select with Enter
- [ ] **PICK-03**: User can manually refresh the window list without closing the picker

### Capture

- [ ] **CAPT-01**: Capture result includes window bounds (x, y, w, h), capture dimensions, and DPI scale
- [ ] **CAPT-02**: Structured metadata block is formatted alongside the image path in ChatInputBar
- [ ] **CAPT-03**: Metadata follows Claude computer_use coordinate conventions for LLM spatial reasoning

### Integration

- [x] **INTG-01**: New WebSocket message types (list-windows-with-thumbnails, capture-window-with-metadata) added to protocol
- [ ] **INTG-02**: Existing HTTP endpoints (/list-windows, /capture/window, /health) continue working for CLI wrapper
- [ ] **INTG-03**: Captured path + metadata injected into active pane's ChatInputBar on window selection

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
| Browser CDP capture | Dropped from v1.1 — window capture covers the use case without CDP complexity |
| DWM live thumbnails | WebView2 compositor constraint — cannot compose DWM thumbnails in HTML DOM. Using PrintWindow mini-captures instead (v1.3) |
| Hover-to-highlight window detection | Overlay app steals focus; title-based selection is deterministic |
| Screenshot annotation/markup | Separate product category; use OS tools |
| Auto-capture on every prompt | Side effects without user intent; Claude decides when to use skill |
| Automation execution (nut.js/SendInput) | Future milestone — v1.3 metadata format is forward-compatible |
| Computer Use API bridge | Separate Claude API agent loop — future milestone |
| Video/screen recording | Different product category |
| Multi-monitor window grouping | Complexity vs. value — defer |
| Window manipulation (minimize/resize/move) | Out of scope for capture tool |

## Traceability

v1 (35 reqs): INFRA-01–05 → Phase 1; PTY-01–07 → Phase 2; TERM-01–05, INPUT-01–03, HIST-01/02/04 → Phase 3; SCRN-01–04, HIST-03, PSMUX-01–04, WIN-01–03 → Phase 4. All complete.

v1.1 (5 reqs): PATH-01/02 → Phase 6 (complete); INBAR-01–03 → Phase 6 (complete). Original v1.1 CAPI/WCAP/BCAP/CLIP superseded by v1.2.

v1.2 (20 reqs):

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPLIT-01 | Phase 10 | Complete |
| SPLIT-02 | Phase 10 | Complete |
| SPLIT-03 | Phase 10 | Complete |
| CAPI-01 | Phase 11 | Complete |
| CAPI-02 | Phase 11 | Complete |
| CAPI-03 | Phase 11 | Complete |
| CAPI-04 | Phase 11 | Complete |
| ENUM-01 | Phase 12 | Complete |
| ENUM-02 | Phase 12 | Complete |
| ENUM-03 | Phase 12 | Complete |
| ENUM-04 | Phase 12 | Complete |
| WCAP-01 | Phase 13 | Complete |
| WCAP-02 | Phase 13 | Complete |
| WCAP-03 | Phase 13 | Complete |
| WCAP-04 | Phase 13 | Complete |
| WCAP-05 | Phase 13 | Complete |
| CLIP-01 | Phase 14 | Complete |
| CLIP-02 | Phase 14 | Complete |
| CLIP-03 | Phase 14 | Complete |
| SKIL-01 | Phase 15 | Complete |
| SKIL-02 | Phase 15 | Complete |
| SKIL-03 | Phase 15 | Complete |

Coverage: 20/20 v1.2 requirements mapped. No orphans.

v1.3 (13 reqs):

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTG-01 | Phase 16 | Complete |
| THUMB-01 | Phase 17 | Pending |
| THUMB-02 | Phase 17 | Pending |
| THUMB-03 | Phase 17 | Pending |
| CAPT-01 | Phase 18 | Pending |
| INTG-02 | Phase 18 | Pending |
| PICK-01 | Phase 19 | Pending |
| PICK-02 | Phase 19 | Pending |
| PICK-03 | Phase 19 | Pending |
| THUMB-04 | Phase 19 | Pending |
| CAPT-02 | Phase 20 | Pending |
| CAPT-03 | Phase 20 | Pending |
| INTG-03 | Phase 20 | Pending |

Coverage: 13/13 v1.3 requirements mapped. No orphans.

---
*Defined: 2026-03-27 | Updated: 2026-03-30 — v1.3 roadmap created (Phases 16-20)*
