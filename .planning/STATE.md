---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-02-PLAN.md
last_updated: "2026-03-28T05:06:46.184Z"
last_activity: 2026-03-28
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 14
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart
**Current focus:** Phase 04 — differentiating-features

## Current Position

Phase: 04 (differentiating-features) — EXECUTING
Plan: 3 of 4
Status: Ready to execute
Last activity: 2026-03-28

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-scaffolding P01 | 1500 | 2 tasks | 18 files |
| Phase 01-scaffolding P02 | 490 | 2 tasks | 13 files |
| Phase 02-pty-bridge P01 | 159 | 2 tasks | 4 files |
| Phase 02-pty-bridge P02 | 5 | 2 tasks | 6 files |
| Phase 03-chat-overlay-mvp P01 | 127 | 2 tasks | 5 files |
| Phase 03-chat-overlay-mvp P02 | 15 | 2 tasks | 5 files |
| Phase 03 P03 | 69 | 2 tasks | 2 files |
| Phase 03-chat-overlay-mvp P04 | 25 | 3 tasks | 7 files |
| Phase 04-differentiating-features P01 | 4 | 2 tasks | 5 files |
| Phase 04-differentiating-features P02 | 8 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Tauri v1.7.2 over v2 — stable, user preference, v2 is breaking API change
- [Init]: caxa over vercel/pkg for sidecar bundling — pkg deprecated, caxa self-extracts native .node binaries
- [Init]: node-pty in sidecar only — cannot import in Vite/webview context (build failure)
- [Init]: better-sqlite3 for chat history — synchronous API, Tauri SQLite plugin is v2-only
- [Phase 01-scaffolding]: Used @appthreat/caxa (not archived caxa) for sidecar bundling — active fork with native .node support
- [Phase 01-scaffolding]: sidecar tsconfig requires module:Node16 with moduleResolution:Node16 in TypeScript 5
- [Phase 01-scaffolding]: sidecar npm install under Node.js 20.17.0 — node-pty ABI locked to Node.js 20
- [Phase 01-scaffolding]: Used Arc<Mutex<Option<u16>>> for sidecar port state — Mutex alone is not Clone, Arc required for async move closure in Tauri setup
- [Phase 01-scaffolding]: Built caxa sidecar .exe in Plan 02 (not 03) — tauri-build validates externalBin file existence at cargo check time
- [Phase 01-scaffolding]: Removed event.all from tauri.conf.json allowlist — not a valid Tauri v1 field; Tauri v1 event API works without explicit allowlist entry
- [Phase 02-pty-bridge]: IDisposable pattern via onData/onExit callable IEvent<T> — not EventEmitter — must call dispose() to avoid listener leaks
- [Phase 02-pty-bridge]: useConpty: true passed explicitly to node-pty spawn — Windows 11 always has ConPTY
- [Phase 02-pty-bridge]: onMessage callback pattern instead of lastMessage state to avoid re-running connection effect on each message
- [Phase 02-pty-bridge]: requestAnimationFrame before spawn to ensure xterm.js dimensions are measured before sending cols/rows
- [Phase 02-pty-bridge]: Cross-hook refs (writeRef, sendMessageRef, getDimensionsRef) to coordinate useTerminal and useWebSocket without render cycles
- [Phase 03-chat-overlay-mvp]: SearchAddon ref exposed from useTerminal hook so SearchOverlay calls methods imperatively
- [Phase 03-chat-overlay-mvp]: Ctrl+F intercepted at document level to block WebView2 native find-in-page dialog
- [Phase 03-chat-overlay-mvp]: Use recorder.end() in PTYSession.destroy() not destroy() — ensures ended_at is written on normal close; crash-only sessions become orphans caught by markOrphans() on restart
- [Phase 03]: CSS class selector (.chat-input-textarea) for Escape-to-focus — avoids ref prop drilling from TerminalPane into ChatInputBar
- [Phase 03]: Escape handler co-located with Ctrl+F effect, searchOpen as dependency — gates Escape so it doesn't steal focus when search overlay is open
- [Phase 03-chat-overlay-mvp]: CSS hidden class (not unmount) for live terminal during replay — xterm.js Terminal.open() binds to DOM; unmounting severs reference causing blank terminal on return
- [Phase 03-chat-overlay-mvp]: handleHistoryMessageRef pattern — stable ref bridges useSessionHistory callback into handleServerMessage useCallback without coupling deps
- [Phase 04-differentiating-features P01]: 4-pane soft cap in splitPane — if getPaneCount() >= 4 return without splitting (research open question 1)
- [Phase 04-differentiating-features P01]: No cleanup-images protocol message — PTYSession.destroy() on WS close handles SCRN-04 implicitly
- [Phase 04-differentiating-features P01]: removeFromTree collapses SplitNode with single child — replace with remaining child, not empty split
- [Phase 04-differentiating-features]: saveImage async, cleanupTempFiles fire-and-forget unlink; SCREENSHOT_DIR exported from ptySession.ts for single-source path reference
- [Phase 04-differentiating-features]: sweepScreenshotTempFiles() called at sidecar startup after markOrphans(); no cleanup-images message — destroy-on-close is the single SCRN-04 cleanup path

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: caxa + node-pty + Windows x64 has limited documented examples — spike caxa bundling early in Phase 1 before any other sidecar work
- [Phase 2]: Validate that ConPTY via node-pty satisfies Claude Code's TTY detection check before investing in full UI
- [Phase 4]: psmux event listener lifecycle (node-pty disposable pattern) needs enforcement from the start — MaxListenersExceededWarning risk

## Session Continuity

Last session: 2026-03-28T05:06:46.178Z
Stopped at: Completed 04-02-PLAN.md
Resume file: None
