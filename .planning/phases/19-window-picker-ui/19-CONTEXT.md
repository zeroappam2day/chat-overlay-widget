# Phase 19: Window Picker UI - Context

**Gathered:** 2026-03-30 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

User can open a popover showing a live thumbnail grid of open windows, navigate it with keyboard or mouse, search/filter by title or process name, and manually refresh the list. Selecting a window (Phase 20) and metadata injection are out of scope — this phase delivers the picker UI only.

</domain>

<decisions>
## Implementation Decisions

### Picker Trigger & Placement
- **D-01:** Picker button goes in TerminalHeader.tsx toolbar, in the right-side button group alongside split/close/sidebar buttons — per-pane action, not app-level
- **D-02:** Picker is an absolutely-positioned popover panel (not modal, not sidebar) rendered inside TerminalPane, following the SearchOverlay positioning precedent (`absolute z-10`)
- **D-03:** Picker state (open/closed, thumbnail data, search filter) is per-pane local useState — not in paneStore (which is layout-only)
- **D-04:** Picker sends `list-windows-with-thumbnails` via the pane's existing sendMessage and handles `window-thumbnails` response through handleServerMessage, same pattern as save-image/save-image-result

### Thumbnail Grid Layout
- **D-05:** Cards are ~260px wide by ~220px tall — 240x180 native thumbnail + padding + title row below
- **D-06:** CSS grid with `auto-fill, minmax(260px, 1fr)` — yields 3 columns at 1200px default window, 2 columns at 800px minimum
- **D-07:** Each card shows: thumbnail image, window title (truncated with ellipsis), process name as secondary muted label
- **D-08:** Windows where thumbnail failed (error field present) still appear as placeholder cards showing title, process name, and error reason in a gray placeholder area — never hidden

### Keyboard Navigation
- **D-09:** Arrow key navigation uses a tracked `selectedIndex` state with 2D grid math (left/right ±1, up/down ±columns)
- **D-10:** Auto-focus search input on picker mount via useEffect + inputRef. Escape closes picker and restores focus to ChatInputBar (`.chat-input-textarea` selector)
- **D-11:** No global keyboard shortcut to open picker — button-only trigger, matching sidebar toggle pattern
- **D-12:** Picker container uses `e.stopPropagation()` on onKeyDown + pickerOpen gate in TerminalPane's document-level keydown handler to prevent arrow keys leaking to xterm.js as escape sequences

### Search/Filter Behavior
- **D-13:** Synchronous filter on every keystroke, no debounce — array of 5-30 items is trivially fast. Success criteria mandates "in real time"
- **D-14:** Case-insensitive substring match on title OR processName — a window matches if either field contains the search string
- **D-15:** Search input fixed at top of popover, above scrollable thumbnail grid
- **D-16:** Empty filter state shows centered "No matching windows" text in the grid area

### Refresh
- **D-17:** A refresh button inside the picker header (next to search) re-sends `list-windows-with-thumbnails` and replaces the grid data without closing the picker

### Claude's Discretion
- Popover anchoring details (below button vs centered in pane)
- Exact card border-radius, shadow, hover styling
- Transition/animation on popover open/close
- Selected card highlight ring color and style
- Whether arrow keys wrap at grid edges or stop

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Protocol types (source of truth)
- `sidecar/src/protocol.ts` — WindowThumbnail interface, ClientMessage union (list-windows-with-thumbnails), ServerMessage union (window-thumbnails)
- `src/protocol.ts` — Frontend copy, manually synced (D-12 comment)

### Backend handlers (read-only reference)
- `sidecar/src/windowThumbnailBatch.ts` — Batch thumbnail generation, 240x180 hardcoded, error cases (MINIMIZED, ZERO_BOUNDS)
- `sidecar/src/server.ts` — WS handler for list-windows-with-thumbnails already wired

### Frontend patterns (follow these)
- `src/components/SearchOverlay.tsx` — Popover positioning pattern, auto-focus on mount, Escape handling
- `src/components/TerminalHeader.tsx` — Toolbar button pattern, SVG icon sizing, button styling classes
- `src/components/TerminalPane.tsx` — Per-pane state management, handleServerMessage switch, isActiveRef keyboard gating, document-level keydown handler
- `src/hooks/useWebSocket.ts` — sendMessage/onMessage pattern for WS communication

### Requirements
- `.planning/REQUIREMENTS.md` — PICK-01, PICK-02, PICK-03, THUMB-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useWebSocket` hook: sendMessage for `list-windows-with-thumbnails`, onMessage handler for `window-thumbnails` response
- `WindowThumbnail` interface: already exported from `src/protocol.ts` with title, processName, thumbnail?, error?
- TerminalHeader button pattern: 14x14 SVG icons, `text-gray-400 hover:text-gray-200 px-1` styling
- SearchOverlay: `absolute top-0 right-0 z-10` positioning, auto-focus, Escape close pattern

### Established Patterns
- Dark theme: `bg-[#2d2d2d]`, `border-[#404040]`, `text-gray-300` primary, `text-gray-500` secondary
- Per-pane local state: useState for UI toggles (searchOpen, sidebarOpen, pendingImagePath)
- Keyboard gating: isActiveRef + document-level keydown with active pane check
- WS request/response: send typed ClientMessage, handle typed ServerMessage in switch statement
- No external UI libraries — all components are hand-rolled Tailwind

### Integration Points
- TerminalHeader: add picker button to right-side button group, new `onTogglePicker` prop
- TerminalPane: add `pickerOpen` state, wire handleServerMessage for `window-thumbnails`, add pickerOpen gate to document keydown handler
- New component: `WindowPicker.tsx` in src/components/

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard thumbnail grid picker following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — analysis stayed within phase scope.

</deferred>

---

*Phase: 19-window-picker-ui*
*Context gathered: 2026-03-30*
