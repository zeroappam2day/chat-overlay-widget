# Chat Overlay Widget

## What This Is

Tauri v1.8 desktop app wrapping Claude Code's CLI in a GUI with visual window capture capabilities. node-pty (ConPTY) bridges GUI input to a real shell, xterm.js renders terminal output, WebSocket connects browser UI to Node.js sidecar. Includes a window picker with thumbnail previews, one-click HWND-based capture (reliable even when window titles change), and LLM-actionable coordinate metadata for Claude spatial reasoning. Single user, Windows 11 only.

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
- HWND+PID threading through enumeration, protocol, and WebSocket — v1.4 (Phase 21)
- Root-window filter (GetParent==IntPtr.Zero) for child handle exclusion — v1.4 (Phase 21)
- Direct HWND capture via PrintWindow (no title re-enumeration) — v1.4 (Phase 22)
- Stale HWND detection via GetWindowThreadProcessId + PID cross-check — v1.4 (Phase 22)
- Blank-bitmap detection for elevated window capture — v1.4 (Phase 22)
- Title+processName fallback for stale HWNDs — v1.4 (Phase 22)
- Cursor-paginated terminal buffer with ANSI/OSC stripping, exposed via HTTP — v1.5 (Phase 23)
- Best-effort secret scrubbing with provider trust tiers (local unscrubbed, cloud scrubbed) — v1.5 (Phase 24)
- Screenshot self-capture with secret-region blurring before cloud transmission — v1.5 (Phase 25)
- Hook receiver normalizing Claude Code/Windsurf/Cursor events into shared AgentEvent schema — v1.6 (Phase 26)
- MCP server (stdio) wrapping HTTP APIs for autonomous LLM tool access — v1.6 (Phase 27)
- Adapter layer for LLM-specific integrations with sidebar event panel — v1.6 (Phase 28)
- PM Chat multi-turn conversation with terminal context injection — v1.8 (Phase 36)
- LLM settings UI: model dropdown, system prompt, temperature — persisted — v1.8 (Phase 35)
- Playwright CDP test foundation for WebView2 + component tests — v1.8 (Phase 38)
- Keyboard shortcut help overlay for discoverability — v1.8 (Phase 37)
- Orphaned v1.7 code cleanup and dead code removal — v1.8 (Phase 34)
- Guided walkthrough engine with overlay lifecycle and target binding — v1.9 (Phase 39)
- Focus-aware overlay: auto-hide on focus loss, auto-show on focus return, affiliated window detection — v1.9 (Phase 40)

### Active

(none — all current milestone requirements validated)

## Current Milestone: v1.9 Guided Desktop Walkthrough (shipped 2026-04-11)

**Goal:** Interactive walkthrough system that guides users through desktop apps with step-by-step annotations and a focus-aware overlay that hides when the user switches away from the target app.

**Delivered:**
- Walkthrough engine with step sequencing, annotation lifecycle, and target window binding (Phase 39)
- Focus-aware overlay: persistent PowerShell Win32 bridge, FocusTracker with 250ms polling, affiliated-set logic (owner chain + PID), 150ms hide debounce, stale hwnd detection (Phase 40)
- Frontend overlay-focus protocol wiring, dispatcher routing, overlayStore toggle (Phase 40)

## Previous Milestone: v1.8 Ship & Harden (shipped 2026-04-10)

**Goal:** Finish the half-built PM Chat assistant, establish frontend test infrastructure, and add keyboard shortcut discoverability — shipping what's 80% done while hardening what's already shipped.

**Delivered:**
- PM Chat sidebar with multi-turn conversation and terminal context injection
- LLM settings UI with model dropdown, system prompt, temperature — all persisted
- Playwright CDP test foundation for WebView2 + component tests for high-churn files
- Keyboard shortcut help overlay (Ctrl+/)
- Orphaned v1.7 code cleaned up organically

## Previous Milestone: v1.7 PM Voice Chat (abandoned 2026-04-09)

**Goal:** PM assistant with local Ollama LLM summarization + Windows SAPI5 TTS.

**Outcome:** Abandoned. Phase 31 sidecar backend completed (pmChat.ts streaming proxy, health check, abort). Frontend partially wired (PMChatTab, pmChatStore exist). Phases 30, 32, 33 never started. TTS had zero implementation. PM Chat completion carried forward to v1.8; TTS moved to backlog.

## Previous Milestone: v1.6 Agent Hooks & MCP Integration (shipped 2026-04-07)

**Goal:** The app can observe its own terminal output and capture its own window — with secret scrubbing, trust tiers, and HTTP APIs.

**Delivered:**
- Universal HTTP APIs (/terminal-state, /session-history, /screenshot) with cursor pagination and ANSI stripping
- 18-pattern best-effort secret scrubber with provider trust tiers (local unscrubbed, cloud scrubbed)
- Self-capture via PrintWindow with secret-region blurring (sharp SVG compositing)
- 140 sidecar tests, 9/9 requirements verified

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
v1.4 shipped: HWND+PID protocol threading, direct HWND capture, stale detection, blank-bitmap warning, fallback (Phases 21-22)
Codebase: ~190+ files. TypeScript frontend (React/Vite) + TypeScript sidecar (node-pty/ws). 40 phases shipped across 9 milestones.
v1.5 shipped: Terminal buffer, secret scrubbing, self-screenshot — HTTP APIs for any caller. 3 phases, 7 plans, 140 sidecar tests, 9/9 requirements verified. Phases 23-25.
v1.6 shipped: Hook receiver, MCP server, adapter layer, sidebar — Phases 26-28 (Phase 29 auto-config deferred).
v1.7 abandoned: PM Voice Chat scope was too broad. Phase 31 sidecar backend shipped (pmChat.ts). Frontend partially wired. TTS never started. Carried PM Chat forward to v1.8; TTS moved to backlog.
v1.8 shipped: PM Chat multi-turn + settings UI, Playwright CDP tests, keyboard shortcut overlay, orphan cleanup — Phases 34-38.
v1.9 shipped: Guided Desktop Walkthrough — walkthrough engine (Phase 39), focus-aware overlay with Win32 bridge + FocusTracker (Phase 40). 40 phases shipped across 9 milestones.

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
| HWND as decimal number (ToInt64) | JS number safe (upper 32 bits always zero), simpler than hex, no BigInt needed | Validated (Phase 21) |
| GetWindowThreadProcessId over IsWindow | IsWindow has TOCTOU race; GWTP returns 0 if invalid AND enables PID cross-check | Validated (Phase 22) |
| Grid sampling for blank-bitmap detection | Full pixel scan too slow at 4K; 100-point grid with luminance < 5/255 threshold | Validated (Phase 22) |
| Single-window gate for processName fallback | Chrome/VS Code have many same-process windows; fallback only safe for unique processes | Validated (Phase 22) |

| Best-effort secret scrubbing (not security boundary) | Regex bypass vectors (ANSI-split, base64, line-wrap); explicit user warning instead of false guarantee | Validated (Phase 24) |
| Provider trust tiers (local unscrubbed, cloud scrubbed) | Multi-LLM data leakage: same content to all providers defeats purpose of local models for sensitive work | Validated (Phase 24) |
| Cursor-paginated terminal reads over full buffer dump | 64KB raw dump = 16K-20K tokens; catastrophic for small-context models (Haiku, local Llama) | Validated (Phase 23) |
| Sidebar over virtual terminal panes for agent visibility | Stress test: raw JSONL in xterm.js is unreadable; panes accumulate; category error (terminal for log data) | — Pending (v1.6) |
| Layered architecture (HTTP → MCP → Adapters) | LLM portability: HTTP is universal, MCP is broadly adopted, adapters handle fragmented hooks | Validated (Phase 26-28) |
| PowerShell SAPI5 over Python pyttsx3 for TTS | Eliminates Python dependency; persistent process avoids per-utterance cold start | Deferred to backlog (v1.7 abandoned, zero implementation) |
| Ollama chat over cloud LLM for PM summaries | Local-only, no API keys, privacy-preserving, user already runs Ollama | Validated (v1.7 Phase 31 backend) |
| LLM output piped via stdin (never shell-interpolated) | Adversarial review found RCE via shell injection if LLM text embedded in command strings | Validated (v1.7 Phase 31 backend) |
| Playwright CDP over tauri-driver for E2E testing | WebView2 supports --remote-debugging-port; Playwright v1.59.1 confirmed compatible; tauri-driver is minimally maintained | — Pending (v1.8) |
| Defer Midscene.js AI layer | Beta quality (v1.7.3), no Tauri-specific usage evidence; Playwright CDP sufficient for smoke tests | — Pending (v1.8) |
| Cut TTS to backlog after 4-direction stress test | Zero implementation, deferred twice, high risk (persistent PS subprocess); 4 agents × 6 perspectives unanimously agreed | — Decided (v1.8) |
| Persistent PowerShell for Win32 focus detection | Reuse Add-Type C# pattern from windowFocusManager; single process avoids per-call spawn overhead; JSON stdin/stdout protocol with request ID correlation | Validated (Phase 40) |
| setTimeout chains over setInterval for focus polling | Prevents post-wake burst of stale callbacks; each poll schedules the next only after completion | Validated (Phase 40) |
| Affiliated window set (owner chain + PID match) | Child dialogs and same-process windows should not trigger overlay hide; owner chain walk (5 levels) + PID fallback with ApplicationFrameHost exclusion | Validated (Phase 40) |

## Evolution

Updates at phase transitions: invalidate/validate requirements, log decisions, check core value accuracy.
Updates at milestones: full review, core value check, out-of-scope audit.

---
*Last updated: 2026-04-09 after v1.8 milestone start (v1.7 abandoned)*
