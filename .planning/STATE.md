---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Screenshot Automation & Input Polish
status: planning
stopped_at: Phase 6 context gathered (assumptions mode)
last_updated: "2026-03-28T11:34:44.361Z"
last_activity: 2026-03-28 — v1.1 roadmap created (Phases 6-9)
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart
**Current focus:** v1.1 roadmap defined — ready to plan Phase 6

## Current Position

Phase: Phase 6 (Shell Path Formatting & Input Bar) — Not started
Plan: —
Status: Roadmap defined, awaiting phase planning
Last activity: 2026-03-28 — v1.1 roadmap created (Phases 6-9)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.1)
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
| Phase 04-differentiating-features P03 | 12 | 2 tasks | 4 files |

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
- [Phase 04-differentiating-features P03]: react-resizable-panels v4 exports Group/Panel/Separator (not PanelGroup/PanelResizeHandle as in v1/v2); orientation prop not direction
- [Phase 04-differentiating-features P03]: isActiveRef pattern: stable ref updated from reactive state used in document event handlers to avoid stale closures in multi-pane keyboard gating
- [Phase 04-differentiating-features P03]: gatedToggleSearch: terminal-toggle-search custom event gated to active pane — prevents Ctrl+F from opening search in all panes simultaneously
- [v1.1 Roadmap]: Phase 6 (shell path + input bar) has no new npm deps — zero caxa rebuild required until Phase 7
- [v1.1 Roadmap]: shellPath.ts formatPathForShell pure function needed in sidecar before Phase 8 uses it in HTTP responses — build it in Phase 6 even though Phase 6 has no HTTP server
- [v1.1 Roadmap]: Phase 7 uses Node.js built-in http module — no new npm deps; puppeteer-core added in Phase 9 triggers caxa rebuild
- [v1.1 Roadmap]: Port discovery file at %TEMP%/chat-overlay-api — write atomically (tmp-then-rename), bearer token required on all HTTP endpoints, file deleted on clean shutdown (CAPI-04)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 8]: DPI capture validation — SetHighDpiMode(PerMonitorV2) interaction with CopyFromScreen on 125%+ scaled displays is MEDIUM confidence. Must validate on non-100% display before accepting Phase 8.
- [Phase 9]: Chrome CDP single-process constraint — Chrome running without --remote-debugging-port cannot be attached to; flag ignored if Chrome already running. Treat browser capture as best-effort opt-in; always fall back to window capture.
- [v1.1 general]: caxa extraction + Windows Defender — extend existing Defender workaround (see MEMORY.md: project_windows_defender_cargo_fix.md) to caxa extraction directory when adding puppeteer-core in Phase 9.

## Session Continuity

Last session: 2026-03-28T11:34:44.356Z
Stopped at: Phase 6 context gathered (assumptions mode)
Resume file: .planning/phases/06-shell-path-formatting-input-bar/06-CONTEXT.md
