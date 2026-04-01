---
phase: 28-adapter-layer-sidebar
plan: 02
subsystem: ui
tags: [react, zustand, websocket, sidebar, agent-events, tailwind, vitest, testing-library]

# Dependency graph
requires:
  - phase: 26-hook-receiver-event-schema
    provides: AgentEvent schema and agent-event WebSocket message type in protocol.ts
  - phase: 28-01
    provides: adapter layer context (parallel plan, same phase)
provides:
  - Zustand store (useAgentEventStore) accumulating AgentEvent[] with collapse toggle
  - AgentSidebar component: collapsible w-72 sidebar with status dots, tool badge, file path, timestamp
  - PaneContainer wiring: sidebar inserted as flex-row peer to terminal layout container
  - TerminalPane wiring: agent-event WebSocket messages pushed to Zustand store
  - 8 component tests covering empty state, event rendering, status indicators, collapse/expand, file path
affects: [29-auto-config, verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useAgentEventStore.getState().pushEvent() in non-React callback context (Zustand outside hook)"
    - "Sidebar as flex-row peer to layout container (not inside layout container) to avoid terminal resize flash"
    - "AgentEvent store uses reversed render order (newest-first) via [...events].reverse()"

key-files:
  created:
    - src/store/agentEventStore.ts
    - src/components/AgentSidebar.tsx
    - src/components/__tests__/AgentSidebar.test.tsx
  modified:
    - src/components/PaneContainer.tsx
    - src/components/TerminalPane.tsx

key-decisions:
  - "Sidebar inserted as peer to layoutContainerRef div in flex-row wrapper — prevents terminal resize flash (Pitfall 3 from RESEARCH.md)"
  - "agent-event WebSocket case wired in TerminalPane.tsx (existing WS handler location) rather than adding new WS connection in PaneContainer"
  - "useAgentEventStore.getState() used in TerminalPane callback — correct Zustand pattern for non-React contexts, avoids re-render subscription"

patterns-established:
  - "Pattern: Zustand getState() for store writes from WebSocket callbacks"
  - "Pattern: Sidebar collapse renders thin w-8 strip with expand button, not zero-width or unmounted"

requirements-completed: [AGNT-03]

# Metrics
duration: 15min
completed: 2026-04-01
---

# Phase 28 Plan 02: Agent Activity Sidebar Summary

**Collapsible React sidebar rendering live AgentEvent feed from WebSocket, backed by Zustand store, with yellow/green/red/gray status dots, tool badge, file path, and timestamp per event**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-01T12:05:00Z
- **Completed:** 2026-04-01T12:15:00Z
- **Tasks:** 3/3 complete (2 automated + 1 visual verification approved)
- **Files modified:** 5

## Accomplishments

- Zustand store `useAgentEventStore` accumulates `AgentEvent[]` across WebSocket messages with `pushEvent` / `toggleCollapsed` actions
- `AgentSidebar` component renders events newest-first with status dot (yellow=running, green=complete, red=error, gray=undefined), tool badge, tool name, optional file path, and timestamp
- `PaneContainer` layout restructured from flex-col to include flex-row wrapper: AgentSidebar is a peer to the layout container (not inside it), preventing terminal ResizeObserver flash on collapse/expand
- `TerminalPane` handles `agent-event` WebSocket messages via `useAgentEventStore.getState().pushEvent()` in the existing `handleServerMessage` callback
- 8 component tests (all passing): empty state, event rendering, status dot colors, collapse/expand toggle, file path display

## Task Commits

1. **Task 1: Create Zustand store, AgentSidebar component, and wire into PaneContainer** - `df12fc3` (feat)
2. **Task 2: Create AgentSidebar component tests** - `afc77d9` (test)
3. **Task 3: Visual verification of sidebar** - approved (events visible, collapse/expand works, no terminal flash)

## Files Created/Modified

- `src/store/agentEventStore.ts` - Zustand store: events[], collapsed bool, pushEvent, toggleCollapsed
- `src/components/AgentSidebar.tsx` - Collapsible sidebar rendering agent event list with status indicators
- `src/components/PaneContainer.tsx` - Added flex-row wrapper and `<AgentSidebar />` as peer to layout container
- `src/components/TerminalPane.tsx` - Added `case 'agent-event':` to WebSocket handler, imports useAgentEventStore
- `src/components/__tests__/AgentSidebar.test.tsx` - 8 component tests via Vitest + React Testing Library

## Decisions Made

- Sidebar inserted as peer to `layoutContainerRef` div — prevents terminal resize flash (RESEARCH.md Pitfall 3)
- `useAgentEventStore.getState()` in TerminalPane callback — Zustand recommended pattern for non-React contexts
- `agent-event` case wired in `TerminalPane.tsx` (existing WS handler) rather than adding new WS listener in PaneContainer

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript check passed clean, all 8 tests passed on first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- AGNT-03 is complete: visual verification approved by user
- Phase 29 (auto-config) can proceed: sidebar and store are wired; auto-config only needs to inject hook config and MCP registration on startup
- Known: sidebar history is session-local from WebSocket connection time — no ring buffer backfill (deferred to Phase 29 evaluation per RESEARCH.md open question 1)

---
*Phase: 28-adapter-layer-sidebar*
*Completed: 2026-04-01*
