---
phase: 31-ollama-chat-backend-sidebar-tab
plan: 02
subsystem: frontend
tags: [zustand, react, chat-ui, streaming, websocket, ollama, sidebar, tabs, vitest]

# Dependency graph
requires:
  - phase: 31-01
    provides: pm-chat WS message types, pmChat sidecar module, server.ts switch cases

provides:
  - usePmChatStore Zustand store with messages, streaming, health, wsSend
  - PMChatTab React component with streaming chat UI, health error state, cancel button
  - AgentSidebar tab switcher (Agent / PM Chat) with icon strip + tab label header
  - WS dispatch in TerminalPane for pm-chat-token/done/error/health
  - WS lifecycle wiring: setWsSend on connect, clear+setStreaming(false) on disconnect

affects: [phase-32-follow-up-chat, phase-33-tts, phase-30-llm-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "wsSend stored in Zustand: decouples PMChatTab from TerminalPane WS ref without prop drilling"
    - "setActiveTab sets collapsed:false: tab icon click expands the sidebar in one action"
    - "scrollIntoView JSDOM guard: typeof check before calling for test compatibility"

key-files:
  created:
    - src/store/pmChatStore.ts
    - src/store/pmChatStore.test.ts
    - src/components/PMChatTab.tsx
    - src/components/__tests__/PMChatTab.test.tsx
  modified:
    - src/store/agentEventStore.ts
    - src/components/AgentSidebar.tsx
    - src/components/TerminalPane.tsx

key-decisions:
  - "wsSend in pmChatStore not prop-drilled: PMChatTab is portal-rendered deep in AgentSidebar; storing sender in Zustand avoids prop chain through AgentSidebar"
  - "setActiveTab also sets collapsed:false: clicking a tab icon from the strip expands the panel immediately — single action matches user expectation"
  - "model hardcoded to qwen3:0.6b in PMChatTab: Phase 30 LLM settings will replace; avoids blocking Phase 31 on settings UI"

# Metrics
duration: ~5min
completed: 2026-04-07
---

# Phase 31 Plan 02: PM Chat Sidebar Tab Summary

**Zustand pmChatStore, PMChatTab streaming chat UI, and AgentSidebar tab switcher — PM Chat tab accessible from the sidebar with streaming Ollama responses, health error state, and cancel support**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-07T16:48:30Z
- **Completed:** 2026-04-07T16:53:53Z
- **Tasks:** 2 auto + 1 human-verify checkpoint
- **Files modified:** 7

## Accomplishments

- Created `usePmChatStore` Zustand store with 9 passing unit tests (TDD: RED then GREEN)
- Built `PMChatTab` component: health check on mount, streaming cursor, error state with `ollama serve` instructions + Retry button, Stop button to cancel in-flight requests
- Refactored `AgentSidebar` with Agent/PM Chat tab icons in collapsed strip and tab labels in expanded header; `setActiveTab` expands the sidebar automatically
- Wired all 4 pm-chat server message types (`pm-chat-token`, `pm-chat-done`, `pm-chat-error`, `pm-chat-health`) into TerminalPane's WS switch
- WS lifecycle: `setWsSend` on connect, clear + `setStreaming(false)` on disconnect to prevent orphaned loading states

## Task Commits

1. **Task 1: pmChatStore + unit tests + TerminalPane WS dispatch** - `59a3225` (feat)
2. **Task 2: PMChatTab component + AgentSidebar tab switcher** - `54bdca0` (feat)

## Files Created/Modified

- `src/store/pmChatStore.ts` — Zustand store: messages, streaming, health, healthError, wsSend
- `src/store/pmChatStore.test.ts` — 9 unit tests for all store actions
- `src/components/PMChatTab.tsx` — Chat UI: health check on mount, message list with streaming cursor, input + send/stop button, health error state
- `src/components/__tests__/PMChatTab.test.tsx` — 4 component render tests (loading, error, ok, messages)
- `src/store/agentEventStore.ts` — Added `activeTab: 'agent' | 'pm-chat'` and `setActiveTab`
- `src/components/AgentSidebar.tsx` — Tab icons in collapsed strip, tab labels in expanded header, conditional PMChatTab render
- `src/components/TerminalPane.tsx` — Added pm-chat WS dispatch cases + WS lifecycle wiring for setWsSend

## Decisions Made

- wsSend stored in Zustand store rather than prop-drilled: PMChatTab is portal-rendered inside AgentSidebar; Zustand avoids threading the sendMessage prop through the sidebar structure
- `setActiveTab` also sets `collapsed: false`: clicking a tab icon expands the panel in one click — matches user expectation
- Model hardcoded to `qwen3:0.6b` in PMChatTab: Phase 30 LLM settings will replace this; avoids blocking Phase 31 on the settings UI

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] scrollIntoView guard for JSDOM test compatibility**
- **Found during:** Task 2 — PMChatTab.test.tsx runs
- **Issue:** JSDOM does not implement `scrollIntoView`, causing `TypeError: messagesEndRef.current?.scrollIntoView is not a function` in 2 tests
- **Fix:** Added `typeof messagesEndRef.current.scrollIntoView === 'function'` guard before calling
- **Files modified:** `src/components/PMChatTab.tsx`
- **Commit:** included in `54bdca0`

**2. [Rule 2 - Missing critical] Added `// @vitest-environment jsdom` directive to PMChatTab tests**
- **Found during:** Task 2 — tests ran in node environment by default
- **Issue:** `document is not defined` — component render tests require jsdom environment
- **Fix:** Added `// @vitest-environment jsdom` pragma (matching existing AgentSidebar.test.tsx pattern)
- **Files modified:** `src/components/__tests__/PMChatTab.test.tsx`
- **Commit:** included in `54bdca0`

## Task 3: Human Verification Checkpoint

Task 3 is a `checkpoint:human-verify` — no code changes. Awaiting user verification of the PM Chat tab end-to-end.

---
*Phase: 31-ollama-chat-backend-sidebar-tab*
*Status: Awaiting checkpoint verification (Task 3)*
*Completed tasks: 2 of 3*
