# Milestones

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
