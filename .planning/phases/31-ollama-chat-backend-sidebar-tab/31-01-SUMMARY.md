---
phase: 31-ollama-chat-backend-sidebar-tab
plan: 01
subsystem: api
tags: [ollama, websocket, ndjson, streaming, http, vitest, typescript, protocol]

# Dependency graph
requires:
  - phase: 28-adapter-layer-sidebar
    provides: broadcast helper pattern (broadcastX), WS switch-case pattern, sendMsg helper

provides:
  - Ollama streaming chat proxy (streamOllamaChat) with NDJSON lineBuffer chunk boundary handling
  - Ollama health check (checkOllamaHealth) with 2-second timeout and ECONNREFUSED handling
  - AbortController-based request cancellation (cancelOllamaChat)
  - pm-chat, pm-chat-cancel, pm-chat-health-check ClientMessage types in both protocol.ts copies
  - pm-chat-token, pm-chat-done, pm-chat-error, pm-chat-health ServerMessage types in both protocol.ts copies
  - WS switch cases for all 3 pm-chat message types in server.ts
  - 8 unit tests for NDJSON parsing, health check, and abort

affects: [31-02-sidebar-tab, phase-32-follow-up-chat, phase-33-tts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pmChat module: separate module for Ollama proxy, imported into server.ts (same pattern as askCodeHandler.js)"
    - "AbortController map keyed by requestId for per-request cancellation"
    - "lineBuffer accumulation for NDJSON chunk boundaries across Node.js data events"
    - "broadcast helper trio (token/done/error) — same pattern as broadcastAgentEvent"

key-files:
  created:
    - sidecar/src/pmChat.ts
    - sidecar/src/pmChat.test.ts
  modified:
    - sidecar/src/protocol.ts
    - src/protocol.ts
    - sidecar/src/server.ts

key-decisions:
  - "WS messages over HTTP POST for pm-chat: frontend lacks sidecar auth token; WS is already authenticated"
  - "Separate pmChat.ts module (not inline in server.ts): keeps server.ts focused on routing, pmChat owns Ollama logic"
  - "Only emit token when message.content is non-empty string: correctly ignores Qwen3 extended-thinking tokens"

patterns-established:
  - "pm-chat WS pattern: requestId-keyed AbortController map + onToken/onDone/onError callbacks"
  - "NDJSON lineBuffer: lineBuffer += chunk; lines = split('\n'); lineBuffer = lines.pop(); parse each complete line"

requirements-completed: [CHAT-01, CHAT-04]

# Metrics
duration: 8min
completed: 2026-04-07
---

# Phase 31 Plan 01: Ollama Chat Backend — Protocol Types + pmChat Module + WS Wiring Summary

**Ollama streaming chat proxy via WebSocket with NDJSON lineBuffer parsing, AbortController cancellation, and health check — all wired into server.ts switch with 8 passing unit tests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-07T16:45:24Z
- **Completed:** 2026-04-07T16:47:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `sidecar/src/pmChat.ts` with `streamOllamaChat`, `cancelOllamaChat`, `checkOllamaHealth` — zero new npm dependencies
- Extended both `protocol.ts` copies with 7 new pm-chat message types (ClientMessage: 3, ServerMessage: 4), keeping D-12 sync intact
- Wired all 3 WS switch cases into `server.ts` with broadcast helpers; pre-existing test failures (AgentSidebar, WindowPicker) confirmed pre-existing — no regressions

## Task Commits

1. **Task 1: Protocol types + pmChat module with NDJSON streaming and health check** - `21adbd0` (feat)
2. **Task 2: Wire pmChat into server.ts WS switch** - `6539510` (feat)

**Plan metadata:** (docs commit below)

_Note: Task 1 used TDD — RED (failing tests) then GREEN (implementation) in single commit per plan spec_

## Files Created/Modified

- `sidecar/src/pmChat.ts` — Ollama streaming proxy, health check, AbortController cancellation map
- `sidecar/src/pmChat.test.ts` — 8 unit tests: single line, done:true, multi-line chunk, split chunk, thinking ignored, health ok, health ECONNREFUSED, cancel abort
- `sidecar/src/protocol.ts` — +3 ClientMessage variants, +4 ServerMessage variants
- `src/protocol.ts` — mirrored pm-chat types (D-12 sync)
- `sidecar/src/server.ts` — import pmChat, 3 broadcast helpers, 3 WS switch cases

## Decisions Made

- WS messages over HTTP POST for pm-chat: frontend lacks sidecar auth token; WS already authenticated
- Separate pmChat.ts module rather than inline in server.ts: keeps routing concerns separated
- Only emit token when `message.content` is non-empty string: correctly ignores Qwen3 extended-thinking tokens (`message.thinking`)

## Deviations from Plan

None — plan executed exactly as written. TDD sequence (RED then GREEN) followed correctly.

## Issues Encountered

Pre-existing test failures in `AgentSidebar.test.tsx` (5 failing) and `WindowPicker.test.tsx` (6 failing) were present before our changes. Verified with `git stash` — same 11 failures existed in prior commit. These are out of scope.

## User Setup Required

None — no external service configuration required. Ollama must be running locally for health check to return `ok: true`, but the health check gracefully returns `ok: false` when Ollama is not running (CHAT-04 requirement).

## Next Phase Readiness

- Plan 02 (sidebar tab UI) can now consume the `pm-chat` WS message types and `pm-chat-token`/`pm-chat-done`/`pm-chat-health` responses
- The `streamOllamaChat` function accepts `endpoint` override — Phase 30 LLM settings will populate this from the settings store
- Pre-existing test failures in AgentSidebar/WindowPicker should be investigated before Phase 31-02 modifies AgentSidebar

---
*Phase: 31-ollama-chat-backend-sidebar-tab*
*Completed: 2026-04-07*
