---
phase: 26-hook-receiver-event-schema
plan: 01
subsystem: sidecar/schema
tags: [agent-events, normalization, ring-buffer, protocol, typescript, tdd]
dependency_graph:
  requires: []
  provides: [AgentEvent interface, normalizeAgentEvent, RingBuffer, agentEventBuffer, agent-event ServerMessage]
  affects: [sidecar/src/server.ts (Plan 02 wires route), src/components (Plan 04 sidebar)]
tech_stack:
  added: []
  patterns: [TDD red-green, ring buffer with FIFO eviction, inline interface copy for frontend protocol sync]
key_files:
  created:
    - sidecar/src/agentEvent.ts
    - sidecar/src/agentEvent.test.ts
  modified:
    - sidecar/src/protocol.ts
    - src/protocol.ts
decisions:
  - AgentEvent defined only in agentEvent.ts — protocol.ts imports from there (one-directional, no circular dep)
  - Frontend src/protocol.ts defines AgentEvent inline — cannot import from sidecar modules
  - hook_event_name takes priority over type field in normalization (Pitfall 6 avoidance)
  - transcript_path presence as sole heuristic for claude-code source inference — Phase 28 adapters own deeper detection
metrics:
  duration: ~2 minutes
  completed: 2026-04-01
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 26 Plan 01: AgentEvent Schema Module Summary

AgentEvent interface with normalizeAgentEvent normalization, 500-entry RingBuffer, and agent-event protocol extension across both sidecar and frontend protocol files — verified by 18 unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create AgentEvent module with TDD | 85baf18 | sidecar/src/agentEvent.ts, sidecar/src/agentEvent.test.ts |
| 2 | Extend protocol.ts with agent-event ServerMessage variant | 5cb7396 | sidecar/src/protocol.ts, src/protocol.ts |

## What Was Built

**sidecar/src/agentEvent.ts:**
- `AgentEvent` interface (tool, type, timestamp, sessionId, payload required; filePath, toolName, status optional)
- `normalizeAgentEvent()` — maps `hook_event_name ?? type ?? 'unknown'`, assigns server timestamp when absent, promotes filePath from `tool_input.file_path`, promotes toolName/status from top-level fields, preserves raw payload verbatim
- `inferSource()` — returns `'claude-code'` when `transcript_path` present, else `'unknown'`
- `RingBuffer<T>` class — push/getAll/size with FIFO eviction via `Array.shift()` when at capacity
- `agentEventBuffer` singleton — `RingBuffer<AgentEvent>(500)`
- `AGENT_EVENT_BUFFER_SIZE = 500` — exported constant for easy tuning

**sidecar/src/agentEvent.test.ts:** 18 unit tests covering all normalization behaviors and ring buffer capacity enforcement.

**sidecar/src/protocol.ts:** Added `import type { AgentEvent } from './agentEvent.js'` and `| { type: 'agent-event'; event: AgentEvent }` variant.

**src/protocol.ts:** Added `AgentEvent` interface inline (frontend cannot import from sidecar) and `| { type: 'agent-event'; event: AgentEvent }` variant.

## Verification Results

- `npx vitest run sidecar/src/agentEvent.test.ts`: 18/18 passed
- `npx tsc --noEmit --project sidecar/tsconfig.json`: clean (no output)
- Both protocol.ts files contain `agent-event` variant
- agentEvent.ts has zero imports from protocol.ts (no circular dep)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are fully implemented and tested. The `agentEventBuffer` singleton is a live in-memory ring buffer (not a stub).

## Self-Check: PASSED

- [x] sidecar/src/agentEvent.ts exists
- [x] sidecar/src/agentEvent.test.ts exists
- [x] sidecar/src/protocol.ts modified
- [x] src/protocol.ts modified
- [x] Commit 85baf18 exists (Task 1)
- [x] Commit 5cb7396 exists (Task 2)
