# Phase 19: Window Picker UI - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-30
**Phase:** 19-window-picker-ui
**Mode:** assumptions (adversarial stress test)
**Areas analyzed:** Picker trigger & placement, Thumbnail grid layout, Keyboard navigation, Search/filter behavior

---

## Analysis Method

User requested adversarial stress testing before proceeding. Four parallel `gsd-assumptions-analyzer` agents examined the codebase independently, each focused on one gray area. Results were synthesized and presented as a confidence-rated assumption table.

**Result:** 12 Confident, 5 Likely, 0 Unclear assumptions. All areas sufficiently answered by codebase evidence + requirements + success criteria. No external research needed.

---

## Assumptions Presented

### Picker Trigger & Placement

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Button in TerminalHeader toolbar (per-pane) | Confident | Phase 20 routes to active pane's ChatInputBar; AppHeader is drag region |
| Absolutely-positioned popover (not modal/sidebar) | Likely | SearchOverlay precedent; too large for sidebar, too lightweight for modal |
| Per-pane local state, not paneStore | Confident | All overlays use per-pane useState; paneStore is layout-only |
| Existing sendMessage/handleServerMessage WS flow | Confident | Protocol types defined; save-image pattern is exact precedent |

### Thumbnail Grid Layout

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| ~260x220 cards (240x180 native + chrome) | Likely | Backend hardcodes 240x180; native display avoids blur |
| CSS auto-fill grid, 3 cols at 1200px, 2 at 800px | Likely | tauri.conf.json min 800x600, default 1200x800 |
| Title + process name on each card | Confident | WindowThumbnail fields; success criteria confirms both visible |
| Error cards shown with placeholder, not hidden | Confident | Success criteria: "all visible windows"; MINIMIZED is a real window |

### Keyboard Navigation

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| selectedIndex + 2D grid math | Likely | No existing grid nav; standard React pattern |
| Auto-focus search, Escape restores to ChatInputBar | Confident | SearchOverlay pattern; .chat-input-textarea selector |
| Button-only trigger, no global hotkey | Confident | Success criteria says "button"; sidebar is button-only too |
| stopPropagation + pickerOpen gate for terminal isolation | Confident | Arrow keys produce \x1b[A in PTY without isolation |

### Search/Filter Behavior

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Synchronous per-keystroke, no debounce | Confident | "in real time" in success criteria; 5-30 item array |
| Case-insensitive substring on title OR processName | Confident | THUMB-04: "title or process name"; toLowerCase() pattern |
| Search input fixed at top of popover | Likely | Standard picker UX; SearchOverlay is top-positioned |
| "No matching windows" centered text for empty state | Likely | No elaborate empty state pattern; lightweight text is consistent |

## Corrections Made

No corrections — all assumptions confirmed by user.

## Claude's Discretion

- Popover anchoring details
- Card border-radius, shadow, hover styling
- Open/close transitions
- Selected card highlight style
- Arrow key wrap vs stop at edges
