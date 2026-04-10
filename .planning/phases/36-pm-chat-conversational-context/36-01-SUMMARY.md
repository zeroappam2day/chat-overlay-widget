---
phase: 36-pm-chat-conversational-context
plan: "01"
subsystem: pm-chat
tags: [protocol, store, fifo-cap, history, conversation-context]
dependency_graph:
  requires: [35-02]
  provides: [pm-chat-history-protocol, fifo-cap, terminalLines-setting]
  affects: [sidecar/src/server.ts]
tech_stack:
  added: []
  patterns: [zustand-getState-live-read, fifo-cap-slice]
key_files:
  created:
    - src/store/pmChatStore.test.ts (FIFO cap tests — appended to existing file)
  modified:
    - sidecar/src/protocol.ts
    - src/protocol.ts
    - src/store/pmChatStore.ts
    - src/store/pmChatSettingsStore.ts
    - src/components/PMChatTab.tsx
    - src/store/pmChatSettingsStore.test.ts
decisions:
  - "FIFO cap applied only in addUserMessage (not appendToken) — sidecar tokens accumulate beyond 40 until next user turn"
  - "history built after addUserMessage call using slice(0,-1) so current user message is excluded from history"
  - "streaming guard uses getState().streaming instead of stale render closure to eliminate race condition"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-10"
  tasks_completed: 2
  files_modified: 6
---

# Phase 36 Plan 01: PM Chat Conversational Context — Protocol & Store Summary

**One-liner:** Protocol history field + 40-message FIFO cap + terminalLines setting + PMChatTab multi-turn wiring with live streaming guard.

## What Was Built

### Task 1: Protocol history field + pmChatSettingsStore terminalLines + pmChatStore FIFO cap

**Protocol changes (both files synchronized):**

Both `sidecar/src/protocol.ts` (line 26) and `src/protocol.ts` (line 58) now include two new optional fields on the pm-chat ClientMessage union member:
- `history?: Array<{role: 'user'|'assistant'; content: string}>` — conversation history for multi-turn context
- `terminalLines?: number` — number of terminal lines to inject as context in sidecar (Plan 02 feature)

**pmChatSettingsStore (terminalLines):**

`PMChatSettingsState` interface gains `terminalLines: number`. `DEFAULT_SETTINGS` sets it to `30`. `setSetting`'s `localStorage.setItem` JSON block now persists `terminalLines: next.terminalLines` alongside the existing 4 fields.

**pmChatStore (FIFO cap):**

`addUserMessage` now enforces a 40-message cap (`MAX_MESSAGES = 40`). When a new message would push the array above 40, it slices the oldest messages from the front: `next.slice(next.length - MAX_MESSAGES)`. This is a FIFO eviction strategy.

**Tests (TDD — RED then GREEN):**

5 new FIFO cap tests added to `src/store/pmChatStore.test.ts` covering:
- 39 messages + 1 → total 40, no eviction
- 40 messages + 1 → total stays 40, oldest evicted
- 42 messages + 1 → capped to 40
- Eviction removes from front regardless of role
- `appendToken` still works after cap is applied (appends assistant message beyond 40)

**Commit:** `3b6d449`

### Task 2: PMChatTab history wiring + streaming guard fix

**Streaming guard fix (D-12):**

Changed `handleSend` guard from stale render closure `streaming` to `usePmChatStore.getState().streaming`. The render-subscribed `streaming` variable remains for UI state (disabled input, cursor animation) — only the guard in `handleSend` uses the live read. This eliminates a race condition where rapid double-send could slip through.

**History wiring (D-01):**

After `addUserMessage` (which appends to the array), history is built from `messages.slice(0, -1)` — all messages except the latest user message just added. This is sent in the WS message as the `history` field. The `terminalLines` value is also forwarded from `pmChatSettingsStore`.

**Test fix:**

`pmChatSettingsStore.test.ts` test "setSetting writes only serializable fields to localStorage" was updated to include `terminalLines` in the expected key set (Rule 1 auto-fix — test was asserting on old schema).

**Commit:** `429c8db`

## Verification

- `npx vitest run src/store/pmChatStore.test.ts` — 14 tests pass (9 existing + 5 new FIFO)
- `npx vitest run` — 440 tests pass (30 test files)
- Both protocol files synchronized with `history?` and `terminalLines?` fields on pm-chat type
- PMChatTab acceptance criteria verified via grep

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pmChatSettingsStore.test.ts key assertion stale after terminalLines added**
- **Found during:** Task 2 full vitest run
- **Issue:** Test "setSetting writes only 4 serializable fields to localStorage" expected keys `['endpoint', 'model', 'systemPrompt', 'temperature']` — missing `terminalLines` after Task 1 added it to the JSON block.
- **Fix:** Updated expected key array to include `terminalLines` and updated test description to remove hardcoded "4".
- **Files modified:** `src/store/pmChatSettingsStore.test.ts`
- **Commit:** `429c8db`

## Known Stubs

None. All wiring is live. The `terminalLines` value is forwarded to sidecar but sidecar-side injection is Plan 02's scope — the field is intentionally a no-op on the sidecar until Plan 02 implements it.

## Threat Flags

None. T-36-01 and T-36-02 both accepted per plan's threat model — single-user local app, localhost-only, no authorization model.

## Self-Check: PASSED

Files verified:
- `sidecar/src/protocol.ts` — contains `history?` and `terminalLines?` on line 26
- `src/protocol.ts` — contains `history?` and `terminalLines?` on line 58
- `src/store/pmChatStore.ts` — contains `MAX_MESSAGES = 40` and `next.slice`
- `src/store/pmChatSettingsStore.ts` — contains `terminalLines: number`, `terminalLines: 30`, `terminalLines: next.terminalLines`
- `src/components/PMChatTab.tsx` — contains `getState().streaming`, `messages.slice(0, -1).map`, `history,`, `terminalLines,`
- `src/store/pmChatStore.test.ts` — exists with 14 tests (5 FIFO cap tests)

Commits verified:
- `3b6d449` — feat(36-01): protocol history field, FIFO cap, terminalLines setting
- `429c8db` — feat(36-01): PMChatTab history wiring and streaming guard fix
