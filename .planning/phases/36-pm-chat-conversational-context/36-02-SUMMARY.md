---
phase: 36-pm-chat-conversational-context
plan: "02"
subsystem: sidecar
tags: [pm-chat, ollama, multi-turn, terminal-context, history, scrubber]
dependency_graph:
  requires: [36-01]
  provides: [CHAT-02, CHAT-03]
  affects: [sidecar/src/pmChat.ts, sidecar/src/server.ts]
tech_stack:
  added: []
  patterns:
    - "Multi-turn Ollama messages array: [system, ...history, user_with_context]"
    - "Terminal context injected per-turn with scrub() applied"
    - "activeSessions.get(ws) guard pattern for no-PTY edge case"
key_files:
  created: []
  modified:
    - sidecar/src/pmChat.ts
    - sidecar/src/server.ts
    - sidecar/src/pmChat.test.ts
decisions:
  - "Terminal context enrichment happens in sidecar (server.ts), not in pmChat.ts — pmChat.ts is a pure Ollama transport layer"
  - "history field passed through directly from WS message; sidecar does not modify history content"
  - "scrub() applied to joined terminal lines before injection per T-36-03"
  - "terminalLines ?? 30 fallback when frontend omits the field"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 36 Plan 02: Sidecar Multi-Turn History and Terminal Context Injection Summary

**One-liner:** Multi-turn Ollama messages array `[system, ...history, user_with_context]` with scrubbed terminal context injected per-turn from the active PTY session.

## What Was Built

### Task 1: streamOllamaChat multi-turn history (TDD)

`sidecar/src/pmChat.ts` — Added `history?: Array<{role: 'user'|'assistant'; content: string}>` to the `opts` parameter type. Replaced the static `[system, user]` messages construction with `[system, ...(opts.history ?? []), user]` spread pattern.

`sidecar/src/pmChat.test.ts` — Added a `describe('streamOllamaChat — multi-turn history')` block with 4 tests:
- Test 1: empty history yields `[system, user]` (backward compatible)
- Test 2: 2-turn history yields `[system, user_hi, assistant_hello, user_current]`
- Test 3: undefined history yields `[system, user]` (backward compatible)
- Test 4: enriched message (terminal context block) becomes the final user message content

**TDD cycle:** Tests written first and confirmed failing on the old code (Test 2 failed — messages.length was 2, not 4). Then implementation added and all 12 tests passed.

### Task 2: Terminal context injection in pm-chat handler

`sidecar/src/server.ts` — Replaced the 14-line `case 'pm-chat'` block with a 46-line implementation:

1. Widened the pmMsg cast to include `history?` and `terminalLines?` fields
2. Log line now includes `historyLen=` for observability
3. `activeSessions.get(ws)` lookup with `if (session)` guard — handles no-PTY session (D-08)
4. `session.terminalBuffer.getLines(nLines)` call with `if (lines.length > 0)` guard — prevents empty context blocks
5. `scrub(rawContext)` applied to joined terminal lines before injection (D-07, T-36-03)
6. Terminal context block prepended to user message: `--- Terminal Output (last N lines) ---\n...\n---\n\n{message}`
7. `streamOllamaChat` called with `enrichedMessage` and `history: pmMsg.history`

## Verification

All acceptance criteria met:

- `sidecar/src/pmChat.ts` opts type contains `history?: Array<{role: 'user'|'assistant'; content: string}>`
- `sidecar/src/pmChat.ts` body messages is `[system, ...(opts.history ?? []), user]`
- `sidecar/src/pmChat.test.ts` contains multi-turn describe block with 4 new tests
- `sidecar/src/server.ts` pm-chat case contains all required guards and calls
- Full vitest suite: 444 tests across 30 files, all passed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data paths are live (PTY buffer, scrubber, Ollama transport).

## Threat Flags

No new threat surface introduced beyond what was in the plan's threat model. The `scrub()` call for T-36-03 is implemented as required.

## Self-Check: PASSED

- `sidecar/src/pmChat.ts` — modified, confirmed
- `sidecar/src/server.ts` — modified, confirmed  
- `sidecar/src/pmChat.test.ts` — modified, confirmed
- Commit `52a31b4` — Task 1 (pmChat.ts + pmChat.test.ts)
- Commit `e86fffb` — Task 2 (server.ts)
- `npx vitest run` — 444/444 passed
