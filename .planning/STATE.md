---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Core Application
status: verifying
stopped_at: Completed 18-01-PLAN.md
last_updated: "2026-03-30T17:34:50.028Z"
last_activity: 2026-03-30
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart
**Current focus:** Phase 18 — enriched-capture-backend

## Current Position

Phase: 18
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-03-30

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
- [Phase 10]: react-resizable-panels v4 uses onLayoutChanged(Layout map) not onLayout(number[]) — adapted with Panel id= prop and map-to-array conversion
- [Phase 10]: Counter suffix on pane/split IDs prevents Date.now() collision on rapid splits in tests
- [Phase 10]: All 4 manual tests passed — PTY session survives split, scrollback preserved, stty size correct, onLayout persistence confirmed
- [Phase 11]: Shared HTTP+WS port via WebSocketServer({ server: httpServer }) — CAPI-01 authoritative over STATE.md todo
- [Phase 11]: Discovery file at %APPDATA%/chat-overlay-widget/api.port with JSON { port, token } format
- [Phase 11]: Bearer auth on all HTTP endpoints; crypto.randomBytes(32) token; log char count only, never value
- [Phase 12-window-enumeration]: spawnSync with args array (not execSync) for PS inline C# — avoids shell quoting escapes in multi-line heredoc
- [Phase 12-window-enumeration]: GetWindowLongPtr (64-bit aware) not GetWindowLong — required on 64-bit Windows 11; WS_EX_TOOLWINDOW declared as long
- [Phase 13]: buildCaptureScript exported for testability — allows PS script content assertions in unit tests without running PowerShell
- [Phase 13]: fs.mkdirSync used for SCREENSHOT_DIR creation (not PS mkdir spawnSync) — simpler, consistent with ptySession.ts pattern
- [v1.3 roadmap]: Thumbnail batch must use single async PS spawn (not spawnSync, not per-window spawns) — THUMB-01 constraint
- [v1.3 roadmap]: Thumbnail size: 240x180 via PrintWindow PW_RENDERFULLCONTENT — same technique as window capture but scaled
- [v1.3 roadmap]: Enriched capture metadata format: { path, bounds: {x,y,w,h}, captureSize: {w,h}, dpiScale } — computer_use compatible
- [v1.3 roadmap]: Protocol extension in Phase 16 must land in both sidecar/src/protocol.ts and src/protocol.ts before Phase 17/19 start
- [Phase 16]: WindowThumbnail as named interface (not inline) for reuse in Phase 17/19 handlers
- [Phase 17]: proc.stdout.setEncoding('utf8') on stream not in spawn options — spawn ignores encoding option unlike spawnSync
- [Phase 17]: buildBatchThumbnailScript() exported for testability — consistent with buildCaptureScript() pattern from Phase 13
- [Phase 18]: DPI scale derived from GetWindowRect/DwmGetWindowAttribute physW/logW ratio at runtime — not hardcoded
- [Phase 18]: captureWindowWithMetadata JSON stdout parsing skips to first '{' to handle Add-Type diagnostic lines

### Todos

- Plan Phase 16 (Protocol Extension) to unblock Phase 17 and Phase 19 work

### Blockers/Concerns

(None)

## Session Continuity

Last session: 2026-03-30T17:31:39.537Z
Stopped at: Completed 18-01-PLAN.md
Resume file: None
Next action: `/gsd:plan-phase 16`
