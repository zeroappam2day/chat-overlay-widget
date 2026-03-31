---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Stable Window Targeting
status: verifying
stopped_at: Completed 22-02-PLAN.md — human-verified
last_updated: "2026-03-31T10:29:50.756Z"
last_activity: 2026-03-31
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 85
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart
**Current focus:** Phase 22 — HWND-Based Capture

## Current Position

Phase: 22 (HWND-Based Capture) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-03-31

Progress: [████████████░░] 85% (20/22 phases complete across all milestones)

## Performance Metrics

Plans executed: 0 (v1.4)
Plans needing revision: 0
Revision rate: 0%

## Accumulated Context

### Decisions

Baseline decisions: see PROJECT.md Key Decisions table.
All v1.0–v1.3 decisions archived — see phase SUMMARY.md files and PROJECT.md.

Recent decisions affecting v1.4:

- HWND serialized as decimal `number` in TypeScript — JS number safe (upper 32 bits always zero on Windows 64-bit)
- `ToInt64()` is the only permitted HWND serialization call — `ToInt32()` and raw `IntPtr` are forbidden
- Parallel functions pattern: `captureWindowByHwnd` is additive alongside existing `captureWindowWithMetadata` — no regression on CLI/HTTP paths
- [Phase 21]: PS_SCRIPT exported from windowEnumerator.ts to enable structural assertions in Tests 9/10
- [Phase 21]: WindowThumbnail type extended with hwnd: number and pid: number in protocol.ts (PROT-01/02 downstream readiness)
- [Phase 21-protocol-extension]: hwnd and pid are required fields on WindowThumbnail — all callers must supply them
- [Phase 21-protocol-extension]: PROT-05 preserved: captureWindowWithMetadata(msg.title) unchanged — HWND-based capture deferred to Phase 22
- [Phase 22-hwnd-based-capture]: captureWindowByHwnd accepts (hwnd, pid, titleLabel) — HWND-04 fallback uses listWindows pid lookup to derive processName without protocol change
- [Phase 22-hwnd-based-capture]: parseOkLine extracted as private helper shared between captureWindowWithMetadata and captureWindowByHwnd — avoids duplication
- [Phase 22-hwnd-based-capture]: [Phase 22-02]: Human-verified HWND routing — capture-window-with-metadata routes through captureWindowByHwnd, HTTP path unchanged

### Todos

(None)

### Blockers/Concerns

- Blank-bitmap pixel-sampling threshold (average luminance < 5/255) needs empirical tuning in Phase 22 — not a blocker, calibrate during implementation against Task Manager and Windows Settings
- Process-name fallback (HWND-04) is safe only for single-window processes — implementation must gate on single visible window count

## Session Continuity

Last session: 2026-03-31T10:29:48.659Z
Stopped at: Completed 22-02-PLAN.md — human-verified
Resume file: None
Next action: /gsd:plan-phase 21
