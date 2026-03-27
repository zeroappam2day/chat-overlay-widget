# Roadmap: Chat Overlay Widget

## Overview

Five phases, strictly dependency-ordered. The PTY bridge is the root dependency — nothing is testable until node-pty compiles and the sidecar communicates with the webview. Phase 1 establishes the compilation and architecture boundary. Phase 2 proves the PTY roundtrip end-to-end. Phase 3 completes the MVP with the chat overlay UI and session history. Phase 4 layers the differentiating features: screenshots, multi-pane, persistent history, and window controls. Phase 5 hardens the packaged build and clears the production pitfalls that only surface in a built .exe.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scaffolding** - Tauri + Node.js sidecar compiling cleanly with node-pty, WebSocket bridge established
- [ ] **Phase 2: PTY Bridge** - Single-pane PTY session: keystroke → shell → xterm.js roundtrip verified end-to-end
- [ ] **Phase 3: Chat Overlay MVP** - Chat input overlay, terminal rendering features, and session-scoped history complete the usable app
- [ ] **Phase 4: Differentiating Features** - Screenshots, multi-pane, persistent history, and always-on-top make the app distinctively useful
- [ ] **Phase 5: Production Hardening** - Packaged .exe validated, WebSocket reconnect, process cleanup, and UX polish verified

## Phase Details

### Phase 1: Scaffolding
**Goal**: The project compiles on Windows 11 with the correct sidecar architecture in place — node-pty builds successfully, caxa bundles the sidecar, and the webview connects to the sidecar over WebSocket
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. `tauri dev` launches the app window with native controls (minimize, maximize, close) on Windows 11
  2. The Node.js sidecar starts automatically and a WebSocket connection is established on localhost — confirmed in browser DevTools or sidecar logs
  3. node-pty compiles cleanly with VS Build Tools (no native addon errors in sidecar startup)
  4. caxa bundles the sidecar including the node-pty .node binary — `tauri build` produces a working .exe with the sidecar embedded
  5. A test message sent from the webview WebSocket client reaches the sidecar and produces a logged response
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Tauri v1 project, sidecar directory, node-pty compilation, tauri.conf.json config
- [x] 01-02-PLAN.md — Wire WebSocket bridge: Rust sidecar spawn, port relay, webview client with retry
- [x] 01-03-PLAN.md — caxa bundling spike: bundle sidecar .exe with native node-pty binary

**UI hint**: yes

### Phase 2: PTY Bridge
**Goal**: A single terminal pane connects end-to-end — keystrokes typed in the app reach PowerShell as real input, shell output renders correctly in xterm.js, and the PTY process is cleaned up when the app closes
**Depends on**: Phase 1
**Requirements**: PTY-01, PTY-02, PTY-03, PTY-04, PTY-05, PTY-06, PTY-07
**Success Criteria** (what must be TRUE):
  1. User types a command in the terminal; PowerShell executes it and output appears in xterm.js with correct ANSI colors and formatting
  2. User can switch shells via the shell selector UI — cmd.exe and Git Bash (if installed) spawn and accept input
  3. Resizing the app window causes the terminal columns and rows to update — `tput cols` / `$host.ui.rawui.WindowSize` reflects the new dimensions
  4. After closing the app, no orphaned node.exe processes remain in Windows Task Manager
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Typed protocol, PTYSession class, sidecar PTY message routing
- [x] 02-02-PLAN.md — xterm.js frontend, useTerminal hook, TerminalPane wiring
- [x] 02-03-PLAN.md — Shell selector UI, Rust sidecar cleanup, end-to-end verification

### Phase 3: Chat Overlay MVP
**Goal**: The app is fully usable for its stated purpose — a chat input overlay sits above the terminal, session history is visible and scrollable, and all terminal interaction features (copy, paste, search, scrollback) work
**Depends on**: Phase 2
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05, INPUT-01, INPUT-02, INPUT-03, HIST-01, HIST-02, HIST-04
**Success Criteria** (what must be TRUE):
  1. User types in the chat input box, presses Enter, and the command appears in the terminal as if typed — Claude Code cannot detect it was not real keyboard input
  2. User can scroll back 10,000+ lines of terminal output without losing content
  3. User can copy text from the terminal and paste text into the terminal using standard clipboard operations
  4. User can search terminal output and see matches highlighted
  5. Past conversations from previous app sessions appear when the app restarts — history is persisted to SQLite
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Decompose TerminalPane, add scrollback + clipboard + search (TERM-01 through TERM-05)
- [x] 03-02-PLAN.md — SQLite session persistence in sidecar with batched writes (HIST-01, HIST-02)
- [x] 03-03-PLAN.md — Chat input overlay with shadow typing and focus management (INPUT-01 through INPUT-03)
- [ ] 03-04-PLAN.md — History sidebar and read-only session replay viewer (HIST-04)

**UI hint**: yes

### Phase 4: Differentiating Features
**Goal**: The features that make this tool distinctly better than a plain terminal are working — screenshot injection, multi-pane PTY sessions with per-pane history, always-on-top window, and adaptive layout
**Depends on**: Phase 3
**Requirements**: SCRN-01, SCRN-02, SCRN-03, SCRN-04, HIST-03, PSMUX-01, PSMUX-02, PSMUX-03, PSMUX-04, WIN-01, WIN-02, WIN-03
**Success Criteria** (what must be TRUE):
  1. User drags an image onto the app or pastes from clipboard; the file path is injected into the terminal input and sent to the CLI — temp file is removed when the session closes
  2. User can open multiple terminal panes in a split layout; each pane runs an independent shell and maintains its own chat history
  3. User can close a pane and no orphaned shell processes or event listener warnings occur
  4. User can toggle always-on-top and the window stays above other applications until toggled off
  5. Resizing the app window causes each terminal pane to resize proportionally and xterm.js fits to the available space
**Plans**: TBD
**UI hint**: yes

### Phase 5: Production Hardening
**Goal**: The packaged .exe is production-quality — the WebSocket connection survives idle periods, the app handles edge cases gracefully, and all pitfalls from the research phase are verified against the built binary
**Depends on**: Phase 4
**Requirements**: (cross-cutting verification — no new requirements; validates INFRA-03, INFRA-04, PTY-06 in packaged context)
**Success Criteria** (what must be TRUE):
  1. The packaged .exe connects and maintains the WebSocket connection after several minutes idle — ping/pong heartbeat prevents disconnection
  2. The terminal shows a loading indicator before the PTY connects; no blank/frozen state confuses the user on startup
  3. Temp screenshot files left from a crash are cleaned up on next app startup
  4. PowerShell outputs non-ASCII characters (emoji, international chars) correctly in the terminal without garbled encoding
  5. Running `tauri build` and launching the output .exe passes the full PITFALLS.md verification checklist without regressions
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffolding | 3/3 | Complete | 2026-03-27 |
| 2. PTY Bridge | 1/3 | In Progress|  |
| 3. Chat Overlay MVP | 3/4 | In Progress|  |
| 4. Differentiating Features | 0/TBD | Not started | - |
| 5. Production Hardening | 0/TBD | Not started | - |
