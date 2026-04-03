---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Agent Hooks & MCP Integration
status: executing
stopped_at: Phase 29 context gathered
last_updated: "2026-04-01T12:13:37.055Z"
last_activity: 2026-04-01
progress:
  total_phases: 13
  completed_phases: 11
  total_plans: 18
  completed_plans: 20
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart
**Current focus:** Phase 28 — adapter-layer-sidebar

## Current Position

Phase: 28 (adapter-layer-sidebar) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-04-03 - Completed quick task 260403-msm: Phase 14 Diff Search & Context Collapse

Progress: [░░░░░░░░░░] 0% (v1.6 milestone — 0/4 phases complete)

## Performance Metrics

Plans executed: 7 (v1.5)
Plans needing revision: 0
Revision rate: 0%

## Accumulated Context

### Decisions

Baseline decisions: see PROJECT.md Key Decisions table.

- [Phase 26-hook-receiver-event-schema]: AgentEvent defined only in agentEvent.ts; protocol.ts imports from there (one-directional, no circular dep)
- [Phase 26-hook-receiver-event-schema]: hook_event_name takes priority over type in normalizeAgentEvent for Claude Code compatibility
- [Phase 26-hook-receiver-event-schema]: broadcastAgentEvent defined after sendMsg, AgentEvent imported as type separately from normalizeAgentEvent/agentEventBuffer
- [Phase 27-mcp-server]: uncaughtException handler swallows server.ts guard throw in mcp-server.ts — prevents native addon loading while preserving async stdio transport event loop
- [Phase 27-mcp-server]: McpServer at @modelcontextprotocol/sdk/server/mcp.js (not /server/index.js which exports lower-level Server class)
- [Phase 27-mcp-server]: Discovery file read fresh per MCP tool call — sidecar restarts transparent to MCP clients
- [Phase 28-adapter-layer-sidebar]: Sidebar inserted as peer to layoutContainerRef div in flex-row wrapper to prevent terminal resize flash on collapse/expand
- [Phase 28-adapter-layer-sidebar]: useAgentEventStore.getState() used in TerminalPane WebSocket callback — correct Zustand pattern for non-React contexts

### Todos

None.

### Blockers/Concerns

- Phase 27 (MCP) requires Phases 23, 24, 25 all complete (they are — shipped in v1.5).
- Phase 29 (auto-config) must know the MCP server binary path and hook endpoint URL — settle these in Phase 27 before planning Phase 29.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260403-g0f | Implement Phase 0 Feature Flag Store foundation | 2026-04-03 | ff7dc13 | [260403-g0f-implement-phase-0-feature-flag-store-fou](./quick/260403-g0f-implement-phase-0-feature-flag-store-fou/) |
| 260403-gkx | Implement Phase 2 Auto-Trust Dialog Detection | 2026-04-03 | 83b05c4 | [260403-gkx-implement-phase-2-auto-trust-dialog-dete](./quick/260403-gkx-implement-phase-2-auto-trust-dialog-dete/) |
| 260403-gvd | Implement Phase 3 Plan File Watcher | 2026-04-03 | a6ab2f0 | [260403-gvd-phase-3-plan-file-watcher](./quick/260403-gvd-phase-3-plan-file-watcher/) |
| 260403-mgs | Implement Phase 13 Ctrl+Wheel Zoom | 2026-04-03 | 7329f9a | [260403-mgs-implement-phase-13-ctrl-wheel-zoom-wheel](./quick/260403-mgs-implement-phase-13-ctrl-wheel-zoom-wheel/) |
| 260403-msm | Phase 14: Diff Search & Context Collapse | 2026-04-03 | 887fbae | [260403-msm-phase-14-diff-search-context-collapse](./quick/260403-msm-phase-14-diff-search-context-collapse/) |

### Untested Assumptions (validate via spike or during early phases)

| # | Assumption | Affects Phases | Risk if Wrong | Validation Method |
|---|-----------|----------------|---------------|-------------------|
| A1 | Claude Code hooks fire SubagentStart/SubagentStop on this machine (requires v2.0.41+) | 26, 28, 29 | Agent visibility track needs complete redesign | Check `claude --version`, fire a test hook |
| A2 | MCP stdio server launched by Claude Code can connect back to the sidecar HTTP API (no circular dependency) | 27, 29 | MCP architecture may need SSE or different process model | Register a stub MCP server, call a tool that hits localhost sidecar |

**Recommendation:** Validate A1 and A2 via a 30-min spike before Phase 26 planning.
| Phase 26-hook-receiver-event-schema P01 | 2 | 2 tasks | 4 files |
| Phase 27-mcp-server P01 | 5 | 2 tasks | 3 files |
| Phase 28-adapter-layer-sidebar P02 | 15 | 2 tasks | 5 files |

## Session Continuity

Last session: 2026-04-03T10:31:43.440Z
Stopped at: Quick task 260403-g0f complete
Next action: Continue Phase 0 features or `/gsd:quick` for next task
