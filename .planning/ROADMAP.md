# Roadmap: Chat Overlay Widget

## Milestones

- **v1.0 Core Application** — Phases 1-5 (shipped 2026-03-28)
- **v1.1 Screenshot Automation & Input Polish** — Phases 6-9 (in progress)
- **v1.2 Live App Awareness & Capture** — Phases 10-15 (planned)

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

## v1.1 Screenshot Automation & Input Polish (In Progress)

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
- [ ] 06-02-PLAN.md — Taller default input bar with drag-resizable height

### Phase 7: Capture HTTP Server
**Goal**: Sidecar exposes secure HTTP API discoverable by local processes for capture operations
**Depends on**: Phase 6
**Requirements**: CAPI-01, CAPI-02, CAPI-03, CAPI-04
**Success Criteria**:
  1. Discovery file at `%TEMP%/chat-overlay-api` with port + bearer token
  2. Requests without valid Authorization header → 401; authenticated → success
  3. GET `/list-windows` returns JSON array of visible window titles + process names
  4. Discovery file deleted on clean shutdown
**Plans**: TBD

### Phase 8: Window Screenshot Capture
**Goal**: Any visible window capturable by title via HTTP API, DPI-correct on high-density displays
**Depends on**: Phase 7
**Requirements**: WCAP-01, WCAP-02, WCAP-03, WCAP-04
**Success Criteria**:
  1. POST `/capture/window` with title → JSON response with PNG filepath
  2. Captured PNG dimensions correct on 125% scaled display
  3. `/list-windows` returns visible windows with titles and process names
  4. Captured file accessible immediately after HTTP response
**Plans**: TBD

### Phase 9: Browser CDP Capture & CLI Wrapper
**Goal**: Full-page browser screenshots when Chrome has remote debugging; CLI script for AI tool invocation
**Depends on**: Phase 7, Phase 8
**Requirements**: BCAP-01, BCAP-02, BCAP-03, CLIP-01, CLIP-02, CLIP-03
**Success Criteria**:
  1. Chrome with `--remote-debugging-port=9222` → POST `/capture/browser` returns full-page PNG
  2. Chrome without flag → returns window screenshot with `fallback: true`
  3. `overlay-capture window "Title"` prints filepath to stdout
  4. `overlay-capture list` prints titles; `overlay-capture help` prints usage

## v1.2 Live App Awareness & Capture (Planned)

**Milestone Goal:** Fix session-killing split bug, let the app see and screenshot live Windows applications, and give Claude a skill to do the same automatically.

### Phases

- [x] **Phase 10: Split Pane Preservation** — Fix React unmount destroying PTY session on split (completed 2026-03-30)
- [ ] **Phase 11: Capture Infrastructure** — Sidecar HTTP server + port/token discovery file
- [ ] **Phase 12: Window Enumeration** — List visible taskbar apps via PowerShell, 5s cache, HTTP endpoint
- [ ] **Phase 13: Window Capture** — Capture any window by title, DPI-aware, PrintWindow for occluded windows
- [ ] **Phase 14: CLI Wrapper** — overlay-capture script reads discovery file, issues HTTP, prints path to stdout
- [ ] **Phase 15: Claude Skill** — capture-app SKILL.md registers /capture-app command with dynamic window list

## Phase Details

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
  1. App startup writes `%APPDATA%\chat-overlay-widget\api.port` (or equivalent) containing port number and bearer token
  2. curl request without Authorization header to any endpoint returns 401
  3. curl request with correct Bearer token returns a successful response
  4. Port discovery file is deleted on clean sidecar shutdown; file absent after app closes
**Plans**: 2 plans
- [x] 11-01-PLAN.md — Shared HTTP+WS server with Bearer auth, health endpoint, discovery file
- [ ] 11-02-PLAN.md — Manual verification checkpoint (curl + discovery file lifecycle)

### Phase 12: Window Enumeration
**Goal**: Users and the CLI can retrieve the current list of visible taskbar applications filtered to only user-facing windows
**Depends on**: Phase 11
**Requirements**: ENUM-01, ENUM-02, ENUM-03, ENUM-04
**Success Criteria** (what must be TRUE):
  1. GET /list-windows returns a JSON array containing titles and process names for apps visible in Alt+Tab (Chrome, VS Code, Notepad, etc.)
  2. System noise windows (MSCTFIME UI, Default IME, tooltips, WS_EX_TOOLWINDOW windows) are absent from the result
  3. Calling /list-windows twice within 5 seconds does not spawn a second powershell.exe process (cache hit observable in sidecar logs)
  4. Response arrives in under 2 seconds on a cold cache (first call after startup)
**Plans**: TBD

### Phase 13: Window Capture
**Goal**: Any visible (or minimized/occluded) window can be captured to a PNG file by title, with correct dimensions on high-DPI displays
**Depends on**: Phase 11, Phase 12
**Requirements**: WCAP-01, WCAP-02, WCAP-03, WCAP-04, WCAP-05
**Success Criteria** (what must be TRUE):
  1. POST /capture/window with a title substring returns a JSON response containing an absolute path to a PNG file that exists on disk
  2. Captured PNG dimensions match the window's actual pixel size on a 125% DPI display (not the logical size)
  3. A minimized Chrome window is captured via PrintWindow PW_RENDERFULLCONTENT — PNG shows the actual window content, not a black rectangle
  4. POST /capture/window with a title that matches no window returns an error JSON response; sidecar continues serving requests
**Plans**: TBD

### Phase 14: CLI Wrapper
**Goal**: overlay-capture script callable from any shell, reads sidecar discovery file, and prints a captured file path to stdout for downstream consumers
**Depends on**: Phase 11
**Requirements**: CLIP-01, CLIP-02, CLIP-03
**Success Criteria** (what must be TRUE):
  1. `node scripts/overlay-capture.js list` prints a human-readable list of visible window titles to stdout
  2. `node scripts/overlay-capture.js window --title "Chrome"` prints an absolute PNG path to stdout; file exists on disk
  3. Script exits with non-zero code when sidecar is unreachable or title has no match; stderr contains a human-readable error
**Plans**: TBD

### Phase 15: Claude Skill
**Goal**: Claude Code can enumerate live Windows applications and capture a selected window autonomously using the /capture-app skill, without any user clipboard interaction
**Depends on**: Phase 14
**Requirements**: SKIL-01, SKIL-02, SKIL-03
**Success Criteria** (what must be TRUE):
  1. `/capture-app` slash command is recognized in a Claude Code session and the skill loads without error
  2. Invoking `/capture-app Chrome` causes Claude to run overlay-capture, receive a file path, and reference the captured image in its response — with no manual user steps
  3. The skill's dynamic window list injection shows the current list of open apps at skill invocation time (not a static hardcoded list)
**Plans**: TBD

## Progress

| Phase | Milestone | Status | Completed |
|-------|-----------|--------|-----------|
| 1-5 | v1.0 | Complete | 2026-03-28 |
| 6. Shell Path & Input Bar | v1.1 | In Progress (1/2 plans) | |
| 7. Capture HTTP Server | v1.1 | Not started | |
| 8. Window Screenshot Capture | v1.1 | Not started | |
| 9. Browser CDP & CLI Wrapper | v1.1 | Not started | |
| 10. Split Pane Preservation | 2/2 | Complete    | 2026-03-30 |
| 11. Capture Infrastructure | 1/2 | In Progress|  |
| 12. Window Enumeration | v1.2 | Not started | |
| 13. Window Capture | v1.2 | Not started | |
| 14. CLI Wrapper | v1.2 | Not started | |
| 15. Claude Skill | v1.2 | Not started | |
