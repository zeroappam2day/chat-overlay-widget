# Chat Overlay Widget

## What This Is

Tauri v1.8 desktop app wrapping Claude Code's CLI in a GUI. node-pty (ConPTY) bridges GUI input to a real shell, xterm.js renders terminal output, WebSocket connects browser UI to Node.js sidecar. Single user, Windows 11 only.

## Core Value

The CLI must think GUI input is real keyboard input — the PTY bridge is the heart. If everything else fails, the ability to send commands to Claude Code and see output must work flawlessly.

## Requirements

See `.planning/REQUIREMENTS.md` for full requirement database with status and traceability.

## Current Milestone: v1.2 Live App Awareness & Capture

**Goal:** Fix session-killing split bug, let the app see and screenshot live Windows applications, and give Claude a skill to do the same automatically.

**Target features:**
- Split pane preservation (bug fix: React unmount destroys PTY session on split)
- Taskbar app identification (visible windows with titles via Win32 EnumWindows)
- Screenshot capture of selected live application (path injected into terminal)
- Claude Code skill for automated app identification + capture (agent-initiated)

### Out of Scope

Docker; WSL; mobile/tablet; cloud/remote; multi-user/auth; OAuth/external services

## Context

platform: Windows 11 local only | arch: Browser UI → WebSocket → Node.js (node-pty) → Shell
Tauri v1.8: Rust desktop shell, Node.js as sidecar (no native Node in webview)
node-pty: ConPTY on Windows, powers VS Code terminal | xterm.js: ANSI terminal emulator
shadow typing: `ptyProcess.write(input)` — CLI cannot distinguish from real keyboard
v1.1 shipped: shell path quoting + input bar resize. HTTP API approach (phases 7-9) dropped in favor of direct UI + Claude skill.
v1.2 direction: app becomes aware of live Windows applications — enumerate, capture, and expose via Claude Code skill

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Tauri v1.8 over Electron | Lighter, Rust-based, user preference | Validated (Phase 1) |
| node-pty for PTY bridge | Powers VS Code terminal, ConPTY on Windows | Validated (Phase 2) |
| xterm.js for rendering | Standard terminal emulator, handles ANSI codes | Validated (Phase 2) |
| Node.js as Tauri sidecar | node-pty requires Node.js runtime | Validated (Phase 1) |
| Screenshots via temp files | CLI accepts file paths, session cleanup | Validated (Phase 4) |
| Local persistence (better-sqlite3) | Single user, synchronous API, no cloud sync | Validated (Phase 3) |
| @appthreat/caxa for sidecar bundling | Original caxa archived; fork supports native .node | Validated (Phase 1) |
| react-resizable-panels v4 for pane layout | Group/Panel/Separator API, orientation prop | Validated (Phase 4) |

## Evolution

Updates at phase transitions: invalidate/validate requirements, log decisions, check core value accuracy.
Updates at milestones: full review, core value check, out-of-scope audit.

---
*Last updated: 2026-03-30 — v1.2 milestone complete: Phases 10-15 shipped (split fix, capture infrastructure, window enumeration, window capture, CLI wrapper, Claude skill)*
