---
phase: 03-chat-overlay-mvp
plan: 04
subsystem: ui
tags: [xterm, react, websocket, sqlite, history, replay, pty]

# Dependency graph
requires:
  - phase: 03-02
    provides: SQLite session recording via historyStore.ts (listSessions, getSessionChunks)
  - phase: 03-01
    provides: TerminalPane decomposition with TerminalHeader, SearchOverlay, ChatInputBar layout
provides:
  - Extended WebSocket protocol with 6 history message types (history-list, history-replay, history-sessions, history-chunk, history-end, session-start)
  - HistorySidebar component listing past sessions with timestamp, shell, and duration
  - HistoryViewer component with read-only xterm.js replay and visual indicator header
  - useSessionHistory hook managing sidebar state, session list, and replay lifecycle
  - Full history flow wired into TerminalPane: sidebar toggle, session list from SQLite, chunk streaming, read-only replay
affects: [04-multi-pane, any phase adding WebSocket protocol messages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS hidden class (not conditional rendering) for xterm.js container during replay — preserves Terminal DOM binding"
    - "handleHistoryMessageRef pattern — stable ref to hook callback avoids adding it to useCallback deps"
    - "useRef for chunk accumulation with counter state for re-render trigger — avoids O(n) re-renders on each chunk"

key-files:
  created:
    - src/hooks/useSessionHistory.ts
    - src/components/HistorySidebar.tsx
    - src/components/HistoryViewer.tsx
  modified:
    - sidecar/src/protocol.ts
    - src/protocol.ts
    - sidecar/src/server.ts
    - src/components/TerminalPane.tsx

key-decisions:
  - "CSS hidden class (not unmount) for live terminal during replay — xterm.js Terminal.open() binds to a DOM element; unmounting severs that reference, causing a blank terminal on return"
  - "handleHistoryMessageRef (ref pattern) to bridge useSessionHistory callback into handleServerMessage useCallback without adding it to the dependency array — avoids re-creating the message handler on every render"
  - "sendMessage typed narrowly in useSessionHistory to only { history-list } | { history-replay } — prevents accidental misuse of the hook's sendMessage path"

patterns-established:
  - "Pattern: use CSS hidden on terminal container during overlay modes (replay, future pane modes) — never unmount xterm.js container"
  - "Pattern: delegate unknown server message types to a ref-stabilized handler in handleServerMessage default case — extensible without modifying the switch"

requirements-completed: [HIST-04]

# Metrics
duration: 25min
completed: 2026-03-27
---

# Phase 03 Plan 04: History Sidebar and Replay Summary

**Collapsible history sidebar + read-only xterm.js session replay wired end-to-end: SQLite sessions surfaced in UI, full ANSI replay from stored chunks, live terminal preserved via CSS hiding during replay**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-27T14:30:00Z
- **Completed:** 2026-03-27T14:55:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Extended sidecar and frontend protocol with 6 new message types (history-list, history-replay, history-sessions, history-chunk, history-end, session-start) — both files kept in sync
- Server-side history handlers query SQLite via listSessions() and getSessionChunks(), streaming chunks to frontend
- HistorySidebar lists sessions with timestamp, shell name, duration, and orphan badge; HistoryViewer renders read-only xterm.js instance with blue visual indicator header and incremental chunk writing
- useSessionHistory hook encapsulates all history state (sessions list, replay session ID, chunk accumulation, replay-complete flag) with stable callbacks via useCallback
- TerminalPane wired: sidebar toggle fetches sessions, clicking session starts replay, CSS hidden preserves live terminal DOM binding, ChatInputBar disabled during replay
- Sidecar TypeScript compiled and caxa binary rebuilt with new protocol handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend protocol types and add server-side history message handlers** - `ce8a38e` (feat)
2. **Task 2: Create HistorySidebar, HistoryViewer, and useSessionHistory hook** - `f9e5657` (feat)
3. **Task 3: Wire history components into TerminalPane** - `b24d939` (feat)

## Files Created/Modified

- `sidecar/src/protocol.ts` - Added 2 client message types, 4 server message types, SessionMeta interface
- `src/protocol.ts` - Frontend copy kept in sync with sidecar protocol
- `sidecar/src/server.ts` - Added history-list and history-replay case handlers, session-start on spawn
- `src/hooks/useSessionHistory.ts` - Hook managing sessions list, replay state, chunk accumulation, handleHistoryMessage dispatch
- `src/components/HistorySidebar.tsx` - Collapsible session list with timestamp/shell/duration formatting
- `src/components/HistoryViewer.tsx` - Read-only xterm.js Terminal with FitAddon, incremental chunk writing, visual indicator header
- `src/components/TerminalPane.tsx` - Wired HistorySidebar + HistoryViewer, CSS hidden for live terminal during replay, ChatInputBar disabled during replay

## Decisions Made

- **CSS hidden over conditional rendering for live terminal during replay.** xterm.js binds its Terminal instance to a specific DOM element via `term.open(container)`. If that element is unmounted, the Terminal loses its DOM reference. On remount, a new element is created but the Terminal instance still points to the old (destroyed) one — resulting in a blank terminal. Using CSS `hidden` keeps the container in the DOM at all times. The existing ResizeObserver + FitAddon (150ms debounce) automatically refits when the container becomes visible again.

- **handleHistoryMessageRef pattern.** `handleHistoryMessage` from useSessionHistory is a stable useCallback (no deps). Adding it to handleServerMessage's useCallback dependency array would be harmless but coupling. Using a ref (`handleHistoryMessageRef.current = handleHistoryMessage`) keeps handleServerMessage's dependency surface minimal and avoids any future issues if the callback's stability changes.

- **Narrow sendMessage type in useSessionHistory.** The hook's sendMessage parameter is typed as `(msg: { type: 'history-list' } | { type: 'history-replay'; sessionId: number }) => void` rather than accepting any ClientMessage. This prevents accidentally routing non-history messages through the hook.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled cleanly after all three tasks. Sidecar build and bundle completed without errors.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — all history flow is wired to real SQLite data via listSessions() and getSessionChunks(). No placeholder or mock data paths.

## Next Phase Readiness

- Phase 03 is now complete (all 4 plans done): scaffolding (01), SQLite session recording (02), ChatInputBar + search (03), history sidebar + replay (04)
- Phase 04 multi-pane work can reuse the CSS hidden pattern for pane overlay modes and the useSessionHistory hook pattern for per-pane state management
- The WebSocket protocol is extensible via the default case in handleServerMessage — new message types delegate automatically

---
*Phase: 03-chat-overlay-mvp*
*Completed: 2026-03-27*
