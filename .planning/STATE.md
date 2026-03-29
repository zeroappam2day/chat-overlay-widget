---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Live App Awareness & Capture
status: planning
stopped_at: null
last_updated: "2026-03-29T00:00:00.000Z"
last_activity: 2026-03-29
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart
**Current focus:** Defining requirements for v1.2

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-29 — Milestone v1.2 started

## Accumulated Context

### Decisions

Baseline decisions: see PROJECT.md Key Decisions table.
Phase-specific decisions affecting current/future work:

- [Phase 01]: @appthreat/caxa (not archived caxa) for sidecar bundling — active fork with native .node support
- [Phase 01]: sidecar tsconfig requires module:Node16 + moduleResolution:Node16 (TS 5)
- [Phase 01]: sidecar npm install under Node.js 20.17.0 — node-pty ABI locked to Node 20
- [Phase 01]: Arc<Mutex<Option<u16>>> for sidecar port state — Mutex alone is not Clone
- [Phase 01]: Built caxa sidecar .exe in Plan 02 (not 03) — tauri-build validates externalBin at cargo check time
- [Phase 01]: Removed event.all from tauri.conf.json — not valid Tauri v1 field
- [Phase 02]: IDisposable pattern via onData/onExit callable IEvent<T> — must call dispose()
- [Phase 02]: useConpty: true explicit — Windows 11 always has ConPTY
- [Phase 02]: onMessage callback (not lastMessage state) to avoid re-running connection effect
- [Phase 02]: requestAnimationFrame before spawn for xterm.js dimension measurement
- [Phase 02]: Cross-hook refs (writeRef, sendMessageRef, getDimensionsRef) — coordinate hooks without render cycles
- [Phase 03]: SearchAddon ref from useTerminal for imperative SearchOverlay calls
- [Phase 03]: Ctrl+F intercepted at document level to block WebView2 native find-in-page
- [Phase 03]: recorder.end() in PTYSession.destroy() — ensures ended_at on normal close; crash sessions → orphans caught by markOrphans()
- [Phase 03]: CSS class selector (.chat-input-textarea) for Escape-to-focus — avoids ref prop drilling
- [Phase 03]: Escape handler co-located with Ctrl+F, searchOpen as dependency
- [Phase 03]: CSS hidden (not unmount) for live terminal during replay — xterm.js Terminal.open() binds to DOM
- [Phase 03]: handleHistoryMessageRef — stable ref bridges useSessionHistory into handleServerMessage
- [Phase 04]: 4-pane soft cap in splitPane — getPaneCount() >= 4 returns early
- [Phase 04]: No cleanup-images message — PTYSession.destroy() handles SCRN-04 implicitly
- [Phase 04]: removeFromTree collapses SplitNode with single child → replace with remaining child
- [Phase 04]: saveImage async, cleanupTempFiles fire-and-forget; SCREENSHOT_DIR exported from ptySession.ts
- [Phase 04]: sweepScreenshotTempFiles() at sidecar startup after markOrphans()
- [Phase 04]: react-resizable-panels v4: Group/Panel/Separator (not PanelGroup/PanelResizeHandle); orientation not direction
- [Phase 04]: isActiveRef pattern for document event handlers — avoids stale closures in multi-pane keyboard gating
- [Phase 04]: gatedToggleSearch custom event gated to active pane — prevents Ctrl+F in all panes
- [v1.1]: Phase 6 has no new npm deps — zero caxa rebuild until Phase 7
- [v1.1]: shellPath.ts formatPathForShell needed in sidecar before Phase 8 HTTP responses
- [v1.1]: Phase 7 uses Node.js built-in http — no new npm deps; puppeteer-core in Phase 9 triggers rebuild
- [v1.1]: Port discovery at %TEMP%/chat-overlay-api — atomic write, bearer token, delete on shutdown
- [Phase 06]: quotePathForShell applied at pendingImagePath injection time (useEffect), not send time — per D-04
- [Phase 06]: UUID-only filenames for temp screenshots — PATH-02 compliance
- [Phase 06]: vitest@4.1.2 added as dev dep; vitest.config.ts targets src/**/*.test.ts

### Blockers/Concerns

- [Phase 8]: DPI capture validation — SetHighDpiMode(PerMonitorV2) + CopyFromScreen on 125%+ displays is MEDIUM confidence. Must validate before accepting.
- [Phase 9]: Chrome CDP single-process — flag ignored if Chrome already running. Treat browser capture as best-effort; always fall back to window capture.
- [v1.1]: caxa + Defender — extend existing workaround (MEMORY.md) to caxa extraction dir when adding puppeteer-core in Phase 9.

## Session Continuity

Last session: 2026-03-28T12:02:35.324Z
Stopped at: Completed 06-01-PLAN.md
Resume file: None
