---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Core Application
status: planning
stopped_at: Phase 10 context gathered (assumptions mode)
last_updated: "2026-03-29T10:17:22.736Z"
last_activity: 2026-03-29 — v1.2 roadmap created (Phases 10-15)
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart
**Current focus:** Phase 10 — Split Pane Preservation (first v1.2 phase)

## Current Position

Phase: 10 — Split Pane Preservation
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-29 — v1.2 roadmap created (Phases 10-15)

Progress bar: [··········] 0/6 phases complete

## Performance Metrics

Plans executed: 0
Plans needing revision: 0
Revision rate: —

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
- [v1.2]: Split fix approach — CSS visibility pattern (render all panes flat, toggle visibility); NOT portal reparenting or session migration
- [v1.2]: Window enumeration via PS Get-Process in sidecar (not Tauri Rust FFI) — same pattern as shellDetect.ts
- [v1.2]: Capture via PS System.Drawing inline template literal in windowCapture.ts — no .ps1 files (caxa bundles JS not assets)
- [v1.2]: Claude skill = thin orchestration layer; business logic in overlay-capture.js CLI script
- [v1.2]: Port/token discovery file path: %APPDATA%\chat-overlay-widget\api.port (not %TEMP% as in v1.1 plan)
- [v1.2]: ENUM filter chain (in order): IsWindowVisible + non-empty title + DwmGetWindowAttribute DWMWA_CLOAKED + not WS_EX_TOOLWINDOW
- [v1.2]: PrintWindow PW_RENDERFULLCONTENT (0x2) required for GPU-composited windows (Chrome, VS Code); BitBlt returns black
- [v1.2]: SetProcessDpiAwarenessContext must be first call in capture PS script (P19)

### Todos

- Phase 10: Lift Terminal instance to stable store OR use CSS visibility + stable key (see P15 in PITFALLS.md)
- Phase 11: HTTP server on separate random port from WS; write port + token file atomically (tmp-then-rename)
- Phase 12: Apply full ENUM filter chain from day one — do not retrofit DwmGetWindowAttribute later
- Phase 13: Test on 125%+ DPI display before marking complete (MEDIUM confidence area)
- Phase 14: overlay-capture.js reads api.port file, exits non-zero on sidecar unreachable
- Phase 15: Skill uses Bash tool per-invocation (not !`cmd` which runs once at load) for capture command

### Blockers/Concerns

- [Phase 13]: DPI capture validation — SetHighDpiMode(PerMonitorV2) + DwmGetWindowAttribute DWMWA_EXTENDED_FRAME_BOUNDS on 125%+ displays is MEDIUM confidence. Must validate before accepting.
- [Phase 11]: caxa rebuild needed when adding puppeteer-core (Phase 9 concern carries forward if Phase 9 not yet shipped)
- [v1.2]: Phases 10-15 depend on v1.1 Phase 6 being complete (INBAR-01–03 still pending)

## Session Continuity

Last session: 2026-03-29T10:17:22.730Z
Stopped at: Phase 10 context gathered (assumptions mode)
Resume file: .planning/phases/10-split-pane-preservation/10-CONTEXT.md
Next action: /gsd:plan-phase 10
