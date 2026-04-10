# Milestones

## v1.8 Ship & Harden (Shipped: 2026-04-10)

**Phases completed:** 4 phases, 8 plans, 14 tasks

**Timeline:** 2 days (2026-04-09 → 2026-04-10)
**Files changed:** 44 | **Lines:** +4,081 / -455

**Delivered:** Finished the half-built PM Chat assistant with multi-turn conversation, terminal context injection, and full LLM settings UI. Added keyboard shortcut discoverability and established Playwright CDP + Vitest test infrastructure.

**Key accomplishments:**

- PM Chat Settings UI — Zustand store with localStorage persistence, gear-toggled collapsible panel (model dropdown, temperature slider, system prompt, endpoint)
- Conversational context — multi-turn Ollama chat with 20-turn FIFO cap, automatic terminal context injection per message, streaming guard
- Endpoint threading — custom Ollama endpoint threaded through protocol, sidecar, and UI; PMChatTab reads all 4 settings with no hardcoded values
- Keyboard shortcut overlay — Ctrl+/ toggles categorized shortcut help with Escape/click-outside dismiss
- Test infrastructure — Playwright CDP connection to WebView2, Vitest component tests for ChatInputBar/PaneContainer/TerminalPane, E2E PTY smoke test
- Dead code cleanup — orphaned v1.7 modules wired end-to-end organically during phases 35-36

**Requirements:** 13/13 v1.8 requirements complete (SET-01–04, CHAT-02–03, DISC-01–02, TEST-01–03, CLEAN-01–02)

---

## v1.5 Self-Observation & Agent Visibility (Shipped: 2026-04-01)

**Phases:** 23-25 (3 phases, 7 plans)
**Timeline:** 1 day (2026-03-31)
**Commits:** 14 | **Files changed:** 16 | **Lines:** +1,797 / -230
**Git range:** `87adf11..909797e` (+ Phase 25 uncommitted files)

**Delivered:** The app can observe its own terminal output and capture its own window as a PNG — with secret scrubbing, provider trust tiers, and HTTP APIs for any caller.

**Key accomplishments:**

- 64KB rolling ring buffer with ANSI/OSC stripping — TerminalBuffer class wired into PTYSession via second onData listener
- Cursor-paginated HTTP APIs: GET /terminal-state and GET /session-history with SQLite historical output
- Best-effort secret scrubber with 18 regex patterns (API keys, tokens, connection strings) — scrub() and detectSecrets()
- Provider trust tiers via ?scrub param: default scrubbed responses include X-Scrub-Warning header; ?scrub=false bypasses for local models
- Self-screenshot capture via PrintWindow with secret-region blurring using sharp SVG compositing
- GET /screenshot route with ?blur param (default=true), error mapping, and X-Blur-Warning header

**Requirements:** 9/9 v1.5 requirements complete (TERM-01–04, LLM-03–04, SCRN-01–03)

---

## v1.4 Stable Window Targeting (Shipped: 2026-03-31)

**Phases:** 21-22 (2 phases, 4 plans, 8 tasks)
**Timeline:** 1 day (2026-03-31)
**Commits:** 14 | **Files changed:** 38 | **Lines:** +2,495 / -51
**Git range:** `cdd9fc5..c7f2846`

**Key accomplishments:**

- HWND+PID threading through C# enumeration, TypeScript types, WebSocket protocol, and TerminalPane — window identity preserved end-to-end
- Root-window filter (GetParent==IntPtr.Zero) excludes Chrome child render handles from picker
- Direct HWND capture via PrintWindow — no title re-enumeration, eliminates title-change race condition
- Stale HWND detection via GetWindowThreadProcessId + PID cross-check with structured ERROR:STALE_HWND
- Blank-bitmap grid sampling detects elevated window captures (black images) with ERROR:BLANK_CAPTURE warning
- Title+processName fallback for stale HWNDs gated on single-window processes

**Requirements:** 9/9 v1.4 requirements complete (PROT-01–05, HWND-01–04)

---

## v1.3 Window Picker & LLM-Actionable Capture (Shipped: 2026-03-31)

**Phases:** 16-20 (5 phases, 7 plans, 8 tasks)
**Timeline:** 2 days (2026-03-30 → 2026-03-31)
**Commits:** 31 | **Files changed:** 38 | **Lines:** +4,816 / -87
**Git range:** `50908a7..f33c762`

**Key accomplishments:**

- Shared WebSocket protocol types for batch thumbnails and enriched capture across sidecar and frontend
- Batch thumbnail engine — single async PowerShell spawn capturing all visible windows as 240x180 base64 PNGs with 5s cache
- Enriched capture with metadata — window bounds, DPI scale, and capture dimensions in computer_use-compatible format
- Window Picker UI — thumbnail grid popover with keyboard navigation, search filter, and manual refresh
- Metadata injection pipeline — picker selection triggers capture, formats coordinate block, injects into ChatInputBar for Claude spatial reasoning

**Requirements:** 13/13 v1.3 requirements complete (THUMB-01–04, PICK-01–03, CAPT-01–03, INTG-01–03)

---
