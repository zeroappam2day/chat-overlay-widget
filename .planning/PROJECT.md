# Chat Overlay Widget

## What This Is

Tauri v1.8 desktop app wrapping Claude Code's CLI in a GUI. node-pty (ConPTY) bridges GUI input to a real shell, xterm.js renders terminal output, WebSocket connects browser UI to Node.js sidecar. Single user, Windows 11 only.

## Core Value

The CLI must think GUI input is real keyboard input — the PTY bridge is the heart. If everything else fails, the ability to send commands to Claude Code and see output must work flawlessly.

## Requirements

See `.planning/REQUIREMENTS.md` for full requirement database with status and traceability.

## Current Milestone: v1.3 Window Picker & LLM-Actionable Capture

**Goal:** Add a visual window picker UI with thumbnail previews, one-click capture, and LLM-actionable coordinate metadata so Claude can reason about spatial positions.

**Target features:**
- Window Picker UI — popover/panel showing open Windows apps with thumbnail previews
- Thumbnail Previews — mini-captures of each visible window as image cards
- One-Click Capture — select window → capture screenshot → inject path + metadata into ChatInputBar
- LLM-Actionable Coordinate Metadata — bounds, DPI scale, capture dimensions in computer_use-compatible format

### Out of Scope

Docker; WSL; mobile/tablet; cloud/remote; multi-user/auth; OAuth/external services

## Context

platform: Windows 11 local only | arch: Browser UI → WebSocket → Node.js (node-pty) → Shell
Tauri v1.8: Rust desktop shell, Node.js as sidecar (no native Node in webview)
node-pty: ConPTY on Windows, powers VS Code terminal | xterm.js: ANSI terminal emulator
shadow typing: `ptyProcess.write(input)` — CLI cannot distinguish from real keyboard
v1.1 shipped: shell path quoting + input bar resize. HTTP API approach (phases 7-9) dropped in favor of direct UI + Claude skill.
v1.2 shipped: split fix, capture infrastructure, window enumeration, window capture, CLI wrapper, Claude skill
v1.3 direction: visual window picker UI with thumbnails, one-click capture, LLM-actionable coordinate metadata
Phase 16 complete: shared WS protocol types for thumbnails and enriched capture landed in both sidecar and frontend
Phase 20 complete: full metadata injection pipeline — picker selection triggers capture, formats coordinate block, injects into ChatInputBar

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
*Last updated: 2026-03-31 — Phase 20 (Metadata Injection & Integration) complete*
