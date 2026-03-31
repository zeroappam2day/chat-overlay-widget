# Roadmap: Chat Overlay Widget

## Milestones

- **v1.0 Core Application** — Phases 1-5 (shipped 2026-03-28)
- **v1.1 Screenshot Automation & Input Polish** — Phases 6-9 (shipped 2026-03-30)
- **v1.2 Live App Awareness & Capture** — Phases 10-15 (shipped 2026-03-30)
- **v1.3 Window Picker & LLM-Actionable Capture** — Phases 16-20 (in progress)

## v1.0 Core Application (SHIPPED)

<details>
<summary>Phases 1-5 — completed 2026-03-28</summary>

Five phases, dependency-ordered. PTY bridge is root dependency.

| Phase | Goal | Requirements | Status |
|-------|------|-------------|--------|
| 1. Scaffolding | Tauri + sidecar compiling, node-pty builds, WebSocket bridge | INFRA-01–05 | Complete |
| 2. PTY Bridge | Keystroke → shell → xterm.js roundtrip, shell selector, resize, cleanup | PTY-01–07 | Complete |
| 3. Chat Overlay MVP | Chat input overlay, session history, terminal features (copy/paste/search/scrollback) | TERM-01–05, INPUT-01–03, HIST-01/02/04 | Complete |
| 4. Differentiating Features | Screenshots, multi-pane, persistent history, always-on-top, adaptive layout | SCRN-01–04, HIST-03, PSMUX-01–04, WIN-01–03 | Complete |
| 5. Production Hardening | WebSocket heartbeat/reconnect, process cleanup, crash recovery | Cross-cutting verification | Complete |

Detailed success criteria and verification: see phase VERIFICATION.md files in `.planning/phases/`.

</details>

## v1.1 Screenshot Automation & Input Polish (SHIPPED)

<details>
<summary>Phases 6-9 — completed 2026-03-30</summary>

**Milestone Goal:** Make the app a platform AI CLI tools can leverage for visual context — capture windows and browser pages, deliver paths shell-correctly into terminals, CLI wrapper for programmatic capture.

### Phase 6: Shell Path Formatting & Input Bar
**Goal**: Screenshot paths safely quoted for active shell; input bar tall enough for multi-line prompts with user-controlled resize
**Depends on**: Phase 5
**Requirements**: PATH-01, PATH-02, INBAR-01, INBAR-02, INBAR-03
**Success Criteria**:
  1. Dropping image + Enter sends correctly quoted path per shell (PS: single-quoted, cmd: double-quoted, bash: forward-slash + single-quoted)
  2. Screenshot filenames contain only UUID chars (hex + hyphens)
  3. Input bar opens at ~144px default (3 lines)
  4. User drags resize handle to change height; terminal panes refit correctly
  5. After drag release, xterm.js cols/rows update without collapsing to zero
**Plans**: 2 plans
- [x] 06-01-PLAN.md — Shell path quoting utility, ChatInputBar integration, UUID-only filenames
- [x] 06-02-PLAN.md — Taller default input bar with drag-resizable height

### Phase 7: Capture HTTP Server
**Goal**: Sidecar exposes secure HTTP API discoverable by local processes for capture operations
**Depends on**: Phase 6
**Requirements**: CAPI-01, CAPI-02, CAPI-03, CAPI-04
**Status**: Superseded by v1.2

### Phase 8: Window Screenshot Capture
**Goal**: Any visible window capturable by title via HTTP API, DPI-correct on high-density displays
**Depends on**: Phase 7
**Requirements**: WCAP-01, WCAP-02, WCAP-03, WCAP-04
**Status**: Superseded by v1.2

### Phase 9: Browser CDP Capture & CLI Wrapper
**Goal**: Full-page browser screenshots when Chrome has remote debugging; CLI script for AI tool invocation
**Depends on**: Phase 7, Phase 8
**Status**: Superseded by v1.2

</details>

## v1.2 Live App Awareness & Capture (SHIPPED)

<details>
<summary>Phases 10-15 — completed 2026-03-30</summary>

**Milestone Goal:** Fix session-killing split bug, let the app see and screenshot live Windows applications, and give Claude a skill to do the same automatically.

### Phase 10: Split Pane Preservation
**Goal**: Users can split a pane without losing the live PTY session running in the original pane
**Depends on**: Phase 9 (or Phase 6 for v1.2 start point)
**Requirements**: SPLIT-01, SPLIT-02, SPLIT-03
**Success Criteria** (what must be TRUE):
  1. User splits a pane while Claude Code is producing output — original pane continues showing output without reconnecting
  2. Terminal scrollback and ANSI output in the original pane remain visible after split completes
  3. xterm.js in both panes refits to their new panel dimensions after split (stty size reports correct cols/rows)
**Plans**: 2 plans
- [x] 10-01-PLAN.md — CSS visibility flat-render refactor + paneStore tests + onLayout wiring
- [x] 10-02-PLAN.md — Manual verification of split preservation (checkpoint)
**UI hint**: yes

### Phase 11: Capture Infrastructure
**Goal**: Sidecar exposes a secure HTTP API alongside the WebSocket server, discoverable by any local process via a port/token file
**Depends on**: Phase 10
**Requirements**: CAPI-01, CAPI-02, CAPI-03, CAPI-04
**Success Criteria** (what must be TRUE):
  1. App startup writes `%APPDATA%\chat-overlay-widget\api.port` containing port number and bearer token
  2. curl request without Authorization header to any endpoint returns 401
  3. curl request with correct Bearer token returns a successful response
  4. Port discovery file is deleted on clean sidecar shutdown; file absent after app closes
**Plans**: 2 plans
- [x] 11-01-PLAN.md — Shared HTTP+WS server with Bearer auth, health endpoint, discovery file
- [x] 11-02-PLAN.md — Manual verification checkpoint (curl + discovery file lifecycle)

### Phase 12: Window Enumeration
**Goal**: Users and the CLI can retrieve the current list of visible taskbar applications filtered to only user-facing windows
**Depends on**: Phase 11
**Requirements**: ENUM-01, ENUM-02, ENUM-03, ENUM-04
**Success Criteria** (what must be TRUE):
  1. GET /list-windows returns a JSON array containing titles and process names for apps visible in Alt+Tab
  2. System noise windows (MSCTFIME UI, Default IME, tooltips, WS_EX_TOOLWINDOW windows) are absent from the result
  3. Calling /list-windows twice within 5 seconds does not spawn a second powershell.exe process (cache hit observable in sidecar logs)
  4. Response arrives in under 2 seconds on a cold cache (first call after startup)
**Plans**: 1 plan
- [x] 12-01-PLAN.md — Window enumerator module with filter chain, 5s cache, GET /list-windows route

### Phase 13: Window Capture
**Goal**: Any visible window can be captured to a PNG file by title, with correct dimensions on high-DPI displays; minimized windows return actionable error
**Depends on**: Phase 11, Phase 12
**Requirements**: WCAP-01, WCAP-02, WCAP-03, WCAP-04, WCAP-05
**Success Criteria** (what must be TRUE):
  1. POST /capture/window with a title substring returns JSON containing an absolute path to a PNG file that exists on disk
  2. Captured PNG dimensions match the window's actual pixel size on a 125% DPI display (not the logical size)
  3. A minimized Chrome window returns ERROR:MINIMIZED with HTTP 404 — caller restores window before capturing
  4. POST /capture/window with a title that matches no window returns an error JSON response; sidecar continues serving
**Plans**: 2 plans
- [x] 13-01-PLAN.md — windowCapture.ts module with TDD: PS inline C#, PrintWindow, DPI awareness, minimized fallback
- [x] 13-02-PLAN.md — POST /capture/window route in server.ts + manual DPI/minimized verification

### Phase 14: CLI Wrapper
**Goal**: overlay-capture script callable from any shell, reads sidecar discovery file, and prints a captured file path to stdout for downstream consumers
**Depends on**: Phase 11
**Requirements**: CLIP-01, CLIP-02, CLIP-03
**Success Criteria** (what must be TRUE):
  1. `node scripts/overlay-capture.js list` prints a human-readable list of visible window titles to stdout
  2. `node scripts/overlay-capture.js window --title "Chrome"` prints an absolute PNG path to stdout; file exists on disk
  3. Script exits with non-zero code when sidecar is unreachable or title has no match; stderr contains a human-readable error
**Plans**: 1 plan
- [x] 14-01-PLAN.md — overlay-capture.cjs CLI script with list/window commands

### Phase 15: Claude Skill
**Goal**: Claude Code can enumerate live Windows applications and capture a selected window autonomously using the /capture-app skill, without any user clipboard interaction
**Depends on**: Phase 14
**Requirements**: SKIL-01, SKIL-02, SKIL-03
**Success Criteria** (what must be TRUE):
  1. `/capture-app` slash command is recognized in a Claude Code session and the skill loads without error
  2. Invoking `/capture-app Chrome` causes Claude to run overlay-capture, receive a file path, and reference the captured image in its response — with no manual user steps
  3. The skill's dynamic window list injection shows the current list of open apps at skill invocation time (not a static hardcoded list)
**Plans**: 1 plan
- [x] 15-01-PLAN.md — Claude Code /capture-app skill with dynamic window list

</details>

## v1.3 Window Picker & LLM-Actionable Capture (In Progress)

**Milestone Goal:** Add a visual window picker UI with thumbnail previews, one-click capture, and LLM-actionable coordinate metadata so Claude can reason about spatial positions.

### Phases

- [x] **Phase 16: Protocol Extension** — WebSocket message types for batch thumbnails and enriched capture (completed 2026-03-30)
- [x] **Phase 17: Batch Thumbnail Backend** — Sidecar generates 240x180 thumbnails for all visible windows in a single async operation (completed 2026-03-30)
- [x] **Phase 18: Enriched Capture Backend** — Capture result includes bounds, DPI scale, capture dimensions; backward-compatible HTTP endpoints (completed 2026-03-30)
- [ ] **Phase 19: Window Picker UI** — Thumbnail grid popover with keyboard navigation, search filter, and manual refresh
- [ ] **Phase 20: Metadata Injection & Integration** — Structured computer_use metadata block injected into active pane's ChatInputBar on window selection

## Phase Details

### Phase 16: Protocol Extension
**Goal**: Both sidecar and frontend share typed message contracts for the new thumbnail and enriched-capture WS messages before any implementation starts
**Depends on**: Phase 15
**Requirements**: INTG-01
**Success Criteria** (what must be TRUE):
  1. A `list-windows-with-thumbnails` request message and its response type are defined and exported from both `sidecar/src/protocol.ts` and `src/protocol.ts`
  2. A `capture-window-with-metadata` request message and its response type are defined and exported from both protocol files
  3. TypeScript compiler accepts imports of the new types in sidecar server.ts and frontend useWebSocket.ts without errors
  4. Existing WS message types (pty-input, pty-output, resize, etc.) are unaffected — no regressions in running app
**Plans**: 1 plan
Plans:
- [x] 16-01-PLAN.md -- Protocol types for batch thumbnails and enriched capture
**UI hint**: no

### Phase 17: Batch Thumbnail Backend
**Goal**: Sidecar can enumerate all visible windows and return a base64 240x180 thumbnail for each in a single async operation without blocking the WebSocket event loop
**Depends on**: Phase 16
**Requirements**: THUMB-01, THUMB-02, THUMB-03
**Success Criteria** (what must be TRUE):
  1. Sending `list-windows-with-thumbnails` over WebSocket returns a response containing an array where each entry has title, processName, and a base64-encoded PNG thumbnail
  2. Thumbnails are visually recognizable mini-captures of each window (240x180 via PrintWindow PW_RENDERFULLCONTENT)
  3. A second `list-windows-with-thumbnails` request within the cache TTL returns immediately (no second PowerShell spawn observable in sidecar logs)
  4. Thumbnail generation uses a single async PowerShell spawn for the entire batch — not one spawn per window
**Plans**: 1 plan
Plans:
- [x] 17-01-PLAN.md -- Batch thumbnail module (TDD) + server.ts wiring

### Phase 18: Enriched Capture Backend
**Goal**: Window capture via WebSocket returns pixel-accurate bounds, DPI scale, and capture dimensions alongside the file path; existing HTTP endpoints continue working unchanged
**Depends on**: Phase 17
**Requirements**: CAPT-01, INTG-02
**Success Criteria** (what must be TRUE):
  1. `capture-window-with-metadata` WS response includes a `bounds` object `{x, y, w, h}`, `captureSize` object `{w, h}`, and `dpiScale` number alongside the file path
  2. Bounds values are physical pixel coordinates (DwmGetWindowAttribute), correct on 125% scaled display
  3. Existing `POST /capture/window` and `GET /list-windows` HTTP endpoints return the same response shape as before Phase 18 — overlay-capture CLI still works without changes
**Plans**: 1 plan
Plans:
- [x] 18-01-PLAN.md -- captureWindowWithMetadata TDD + server.ts WS handler wiring

### Phase 19: Window Picker UI
**Goal**: User can open a popover showing a live thumbnail grid of open windows, navigate it with keyboard or mouse, search/filter by title or process name, and manually refresh the list
**Depends on**: Phase 16, Phase 17
**Requirements**: PICK-01, PICK-02, PICK-03, THUMB-04
**Success Criteria** (what must be TRUE):
  1. A button in the app toolbar opens a picker popover/panel displaying thumbnail cards for all visible windows
  2. User can type in a search box inside the picker to filter thumbnails by window title or process name; non-matching cards disappear in real time
  3. User can navigate the thumbnail grid with arrow keys and activate a selection with Enter (no mouse required)
  4. A refresh button inside the picker triggers a new `list-windows-with-thumbnails` request and updates the grid without closing the picker
**Plans**: 2 plans
Plans:
- [x] 19-01-PLAN.md — WindowPicker component with TDD + test infrastructure
- [ ] 19-02-PLAN.md — TerminalPane/TerminalHeader integration wiring + visual checkpoint
**UI hint**: yes

### Phase 20: Metadata Injection & Integration
**Goal**: Selecting a window in the picker captures it with full coordinate metadata and injects a structured block into the active pane's ChatInputBar, ready for Claude to perform spatial reasoning
**Depends on**: Phase 18, Phase 19
**Requirements**: CAPT-02, CAPT-03, INTG-03
**Success Criteria** (what must be TRUE):
  1. Clicking or pressing Enter on a thumbnail triggers `capture-window-with-metadata` and automatically closes the picker
  2. The active pane's ChatInputBar receives the captured file path plus a structured metadata block containing bounds, captureSize, and dpiScale in computer_use coordinate format
  3. The injected metadata block is formatted so Claude can read pixel coordinates and reason about spatial positions without any additional parsing
  4. End-to-end flow works: open picker → select window → ChatInputBar populated → user sends → Claude references the image and its coordinates
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Status | Completed |
|-------|-----------|--------|-----------|
| 1-5 | v1.0 | Complete | 2026-03-28 |
| 6. Shell Path & Input Bar | v1.1 | Complete | 2026-03-30 |
| 7. Capture HTTP Server | v1.1 | Superseded by v1.2 | — |
| 8. Window Screenshot Capture | v1.1 | Superseded by v1.2 | — |
| 9. Browser CDP & CLI Wrapper | v1.1 | Superseded by v1.2 | — |
| 10. Split Pane Preservation | v1.2 | Complete | 2026-03-30 |
| 11. Capture Infrastructure | v1.2 | Complete | 2026-03-30 |
| 12. Window Enumeration | v1.2 | Complete | 2026-03-30 |
| 13. Window Capture | v1.2 | Complete | 2026-03-30 |
| 14. CLI Wrapper | v1.2 | Complete | 2026-03-30 |
| 15. Claude Skill | v1.2 | Complete | 2026-03-30 |
| 16. Protocol Extension | 1/1 | Complete    | 2026-03-30 |
| 17. Batch Thumbnail Backend | 1/1 | Complete    | 2026-03-30 |
| 18. Enriched Capture Backend | 1/1 | Complete    | 2026-03-30 |
| 19. Window Picker UI | 1/2 | In Progress|  |
| 20. Metadata Injection & Integration | v1.3 | Not started | — |
