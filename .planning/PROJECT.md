# Chat Overlay Widget

## What This Is

Tauri v1.8 desktop app wrapping Claude Code's CLI in a GUI with visual window capture capabilities. node-pty (ConPTY) bridges GUI input to a real shell, xterm.js renders terminal output, WebSocket connects browser UI to Node.js sidecar. Includes a window picker with thumbnail previews, one-click capture, and LLM-actionable coordinate metadata for Claude spatial reasoning. Single user, Windows 11 only.

## Core Value

The CLI must think GUI input is real keyboard input — the PTY bridge is the heart. If everything else fails, the ability to send commands to Claude Code and see output must work flawlessly.

## Requirements

### Validated

- PTY bridge with ConPTY, shell selector, resize chain — v1.0
- xterm.js terminal with ANSI support, scrollback, copy/paste, search — v1.0
- Chat input overlay with shadow typing — v1.0
- Session history persistence (SQLite) — v1.0
- Screenshot drag-drop and clipboard paste — v1.0
- Multi-pane split layout with independent PTY sessions — v1.0
- Always-on-top, adaptive layout, auto-fit terminal — v1.0
- WebSocket heartbeat/reconnect, process cleanup, crash recovery — v1.0
- Shell-aware path quoting for screenshot paths — v1.1
- Resizable chat input bar — v1.1
- Split pane preservation (PTY survives split) — v1.2
- Capture infrastructure (HTTP API, bearer auth, port discovery) — v1.2
- Window enumeration with filter chain and cache — v1.2
- DPI-aware window capture via PrintWindow — v1.2
- CLI wrapper (overlay-capture) for programmatic capture — v1.2
- Claude /capture-app skill with dynamic window list — v1.2
- Batch thumbnail engine (240x180 base64 PNGs, 5s cache) — v1.3
- Window Picker UI (thumbnail grid, keyboard nav, search filter) — v1.3
- Enriched capture with bounds/DPI/dimensions metadata — v1.3
- Metadata injection into ChatInputBar in computer_use format — v1.3

### Active

## Current Milestone: v1.4 Stable Window Targeting

**Goal:** Replace fragile title-based window matching with HWND-based capture so the correct window is always captured regardless of title changes.

**Target features:**
- HWND threaded through enumeration → protocol → picker → capture
- Capture by HWND instead of title substring match
- Fallback/validation when HWND becomes stale (window closed)
- Process name as secondary disambiguator

### Out of Scope

Docker; WSL; mobile/tablet; cloud/remote; multi-user/auth; OAuth/external services; Tauri v2 migration; browser CDP capture; DWM live thumbnails (WebView2 compositor constraint); hover-to-highlight (overlay steals focus); screenshot annotation; auto-capture on every prompt; automation execution (nut.js/SendInput) — future milestone; Computer Use API bridge — future milestone; video/screen recording; multi-monitor window grouping; window manipulation (minimize/resize/move)

## Context

platform: Windows 11 local only | arch: Browser UI → WebSocket → Node.js (node-pty) → Shell
Tauri v1.8: Rust desktop shell, Node.js as sidecar (no native Node in webview)
node-pty: ConPTY on Windows, powers VS Code terminal | xterm.js: ANSI terminal emulator
shadow typing: `ptyProcess.write(input)` — CLI cannot distinguish from real keyboard
v1.0 shipped: scaffolding, PTY bridge, chat overlay MVP, differentiating features, production hardening (Phases 1-5)
v1.1 shipped: shell path quoting + input bar resize (Phase 6). HTTP API approach (phases 7-9) superseded by v1.2.
v1.2 shipped: split fix, capture infrastructure, window enumeration, window capture, CLI wrapper, Claude skill (Phases 10-15)
v1.3 shipped: protocol extension, batch thumbnails, enriched capture, window picker UI, metadata injection (Phases 16-20)
Codebase: ~38 files changed in v1.3, +4,816 lines. TypeScript frontend (React/Vite) + TypeScript sidecar (node-pty/ws).

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
| CSS visibility for split pane preservation | Render all panes flat, toggle visibility; no portal reparenting | Validated (Phase 10) |
| PrintWindow PW_RENDERFULLCONTENT for capture | Required for GPU-composited windows (Chrome, VS Code); BitBlt returns black | Validated (Phase 13) |
| Single async PS spawn for batch thumbnails | One PowerShell process captures all windows — avoids per-window spawn overhead | Validated (Phase 17) |
| computer_use coordinate format for metadata | Forward-compatible with Claude automation; # comment lines readable without JSON parsing | Validated (Phase 20) |

## Evolution

Updates at phase transitions: invalidate/validate requirements, log decisions, check core value accuracy.
Updates at milestones: full review, core value check, out-of-scope audit.

---
*Last updated: 2026-03-31 after v1.4 milestone start*
