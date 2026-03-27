---
phase: 03-chat-overlay-mvp
plan: 01
subsystem: ui
tags: [xterm, terminal, react, typescript, search, clipboard]

requires:
  - phase: 02-pty-bridge
    provides: useTerminal hook, useWebSocket hook, TerminalPane component with xterm.js and PTY bridge

provides:
  - TerminalHeader component extracted from TerminalPane with connection status, shell selector, sidebar toggle
  - SearchOverlay component with @xterm/addon-search incremental search, match navigation, highlight decorations
  - useTerminal extended with 10000-line scrollback, Ctrl+Shift+C copy, Ctrl+Shift+V paste, right-click paste
  - TerminalPane decomposed into layout shell ready for ChatInputBar (Plan 03) and HistorySidebar (Plan 04)

affects: [03-02-chat-input-bar, 03-04-history-sidebar, future multi-pane plans]

tech-stack:
  added:
    - "@xterm/addon-search@0.16.0 — in-terminal search with match highlighting and decorations"
  patterns:
    - "SearchAddon loaded in useTerminal hook, ref exposed to allow SearchOverlay to call findNext/findPrevious/clearDecorations"
    - "Ctrl+F intercepted at document level (not terminal level) to prevent WebView2 native find-in-page"
    - "Custom key event handler (attachCustomKeyEventHandler) for clipboard operations after term.open()"
    - "Layout decomposition: useTerminal = low-level terminal; TerminalHeader = status bar; SearchOverlay = floating search; TerminalPane = layout shell"

key-files:
  created:
    - src/components/TerminalHeader.tsx
    - src/components/SearchOverlay.tsx
  modified:
    - src/hooks/useTerminal.ts
    - src/components/TerminalPane.tsx
    - package.json

key-decisions:
  - "SearchAddon ref exposed from useTerminal hook (not passed as prop to useTerminal) so SearchOverlay can call methods imperatively"
  - "Ctrl+F intercepted on document to prevent WebView2 native dialog from opening before xterm captures the event"
  - "SearchOverlay uses incremental: true on input change for live match tracking, plain findNext on Enter"
  - "clearDecorations() called on Escape/close to remove search highlights — required (highlights persist otherwise)"
  - "sidebarOpen state added to TerminalPane now even though sidebar component comes in Plan 04 — avoids future refactor"

patterns-established:
  - "Pattern 1: Addon refs exposed from useTerminal — allows parent components to call addon methods without prop drilling Terminal instance"
  - "Pattern 2: Document-level keyboard intercept in useEffect for system-level shortcuts (Ctrl+F) that must override webview defaults"
  - "Pattern 3: right-click contextmenu paste registered in terminal useEffect with proper cleanup in return fn"

requirements-completed: [TERM-01, TERM-02, TERM-03, TERM-04, TERM-05]

duration: 3min
completed: 2026-03-27
---

# Phase 03 Plan 01: Terminal Component Decomposition + Interaction Features Summary

**TerminalPane split into TerminalHeader + SearchOverlay + layout shell; useTerminal extended with 10000-line scrollback, Ctrl+Shift+C/V clipboard, right-click paste, and @xterm/addon-search with match decorations**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-27T13:13:58Z
- **Completed:** 2026-03-27T13:16:05Z
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments

- Installed @xterm/addon-search@0.16.0 and wired SearchAddon into useTerminal with searchAddonRef in return type
- Extended useTerminal with 10000-line scrollback, Ctrl+Shift+C copy, Ctrl+Shift+V paste, right-click contextmenu paste
- Extracted TerminalHeader with connection dot, shell name, shell selector dropdown, and sidebar hamburger toggle
- Created SearchOverlay with incremental search, Enter/Shift+Enter navigation, Escape to close and clear decorations
- Refactored TerminalPane into a layout shell with Ctrl+F document intercept, searchOpen/sidebarOpen state

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @xterm/addon-search and extend useTerminal** - `6293edc` (feat)
2. **Task 2: Extract TerminalHeader, create SearchOverlay, decompose TerminalPane** - `a283fdd` (feat)

## Files Created/Modified

- `src/hooks/useTerminal.ts` - Extended with SearchAddon, scrollback 10000, clipboard handlers, contextmenu paste
- `src/components/TerminalHeader.tsx` - New: header bar with connection status, shell selector, sidebar toggle button
- `src/components/SearchOverlay.tsx` - New: floating search bar with findNext/findPrevious/clearDecorations
- `src/components/TerminalPane.tsx` - Decomposed into layout shell, imports TerminalHeader + SearchOverlay
- `package.json` + `package-lock.json` - Added @xterm/addon-search@0.16.0

## Decisions Made

- SearchAddon ref exposed from useTerminal hook so SearchOverlay calls methods imperatively (not via event bus)
- Ctrl+F intercepted at document level to block WebView2 native find-in-page dialog
- clearDecorations() called on Escape/close — required, highlights persist until explicitly cleared
- sidebarOpen state added now (sidebar in Plan 04) to avoid future refactor in TerminalPane

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled clean on first attempt for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TerminalPane layout shell ready for ChatInputBar at the bottom (`{/* ChatInputBar will go here — Plan 03 */}` placeholder)
- sidebarOpen state already in TerminalPane, ready for HistorySidebar (Plan 04)
- searchAddonRef pattern established — can be reused for future multi-pane search

---
*Phase: 03-chat-overlay-mvp*
*Completed: 2026-03-27*
