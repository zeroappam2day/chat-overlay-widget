# Milestones

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
