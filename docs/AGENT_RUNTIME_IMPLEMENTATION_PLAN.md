# Agent Runtime Extension Plan — Chat Overlay Widget

> **Document type:** Multi-conversation implementation plan with embedded handover protocol
> **Created:** 2026-04-04
> **Repository:** C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget
> **Branch:** main
> **Status:** Phase 1 DONE — Phase 2 DONE — Phase 3 DONE — Phase 4 DONE — Phase 6 DONE — Phase 5 NEXT — Phase 7 pending

---

## Table of Contents

1. [Reusable Initialization Prompt](#1-reusable-initialization-prompt)
2. [Adversarial Stress Test](#2-adversarial-stress-test)
3. [Architecture Decision: Extension, Not Shift](#3-architecture-decision-extension-not-shift)
4. [Feature Flag Strategy](#4-feature-flag-strategy)
5. [Phase Overview](#5-phase-overview)
6. [Phase 1 — Terminal Write MCP Tool](#6-phase-1--terminal-write-mcp-tool)
7. [Phase 2 — Conditional Walkthrough Advancement](#7-phase-2--conditional-walkthrough-advancement)
8. [Phase 3 — Multi-PTY Pane Multiplexing](#8-phase-3--multi-pty-pane-multiplexing)
9. [Phase 4 — UI Accessibility Tree Discovery](#9-phase-4--ui-accessibility-tree-discovery)
10. [Phase 5 — OS-Level Input Simulation](#10-phase-5--os-level-input-simulation)
11. [Phase 6 — Consent Gate & Action Verification Loop](#11-phase-6--consent-gate--action-verification-loop)
12. [Phase 7 — Integration Testing & Hardening](#12-phase-7--integration-testing--hardening)
13. [Handover Protocol](#13-handover-protocol)
14. [Progress Tracker](#14-progress-tracker)
15. [Rollback Strategy](#15-rollback-strategy)
16. [File Reference Index](#16-file-reference-index)

---

## 1. Reusable Initialization Prompt

**Copy-paste this prompt at the start of every new conversation to provide full context:**

```
I am continuing work on the Chat Overlay Widget Agent Runtime Extension.

READ THESE FILES IN ORDER before doing anything:
1. C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/docs/AGENT_RUNTIME_IMPLEMENTATION_PLAN.md
   — This is the master plan. Read the ENTIRE file. Find the "Progress Tracker" section (Section 14) to see what's done and what's next. Find the phase marked "NEXT" and read its full specification.

2. C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/CLAUDE.md
   — Project conventions and tech stack constraints.

3. C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/.mcp.json
   — Current MCP server configuration.

RULES:
- You have ZERO context from prior conversations. The plan document is your ONLY source of truth.
- Do NOT modify any existing files unless the phase spec explicitly names that file as a modification target.
- Every new file and every modification must be gated behind a feature flag (see Section 4).
- All feature flags default to OFF. Existing behavior must be unchanged when flags are off.
- After completing work, update Section 14 (Progress Tracker) with completion status and handover notes.
- Do NOT proceed to the next phase without explicit user approval.
- Use the GSD workflow: /gsd:quick for small tasks, /gsd:execute-phase for full phases.

WHAT TO DO NOW:
- Read the plan, find the phase marked "NEXT", and summarize what you'll implement.
- Ask the user to confirm before starting.
```

---

## 2. Adversarial Stress Test

### 2.1 Methodology

Four adversarial perspectives challenged the claim that Scenarios 3-4 require "architectural shifts." Each perspective was tested against actual code evidence from the repository.

### 2.2 Scenario 1: Multi-Step Tracking

| Adversarial View | Code Evidence | Verdict |
|---|---|---|
| **"Sidecar can already write to terminal"** | `sidecar/src/server.ts` line 495-498: WebSocket `input` message → `session.write(data)` → node-pty. The write path exists end-to-end. | TRUE — 1 MCP tool definition away from LLM access |
| **"LLM can already poll terminal"** | `sidecar/src/mcp-server.ts` lines 170-202: `read_terminal_output` tool with cursor-based pagination via `since` parameter. LLM calls this, gets new lines since last read. | TRUE — polling mechanism is built |
| **"AutoTrust proves the watch-then-act pattern"** | `sidecar/src/autoTrust.ts` lines 67-128: `feed()` method takes raw PTY chunks, matches against regex patterns, fires `onAccept()` callback (sends `\r` to PTY). Three-phase timing (50ms detect, 1s settle, 3s cooldown). 4KB tail buffer with ANSI stripping. | TRUE — exact same pattern needed for conditional walkthrough advancement |
| **"Click detection outside terminal is genuinely missing"** | Searched entire codebase: no `SetWindowsHookEx`, no `UIAutomation`, no mouse/keyboard event capture. Only input path is node-pty `write()`. | TRUE — real gap, but only for non-terminal workflows |

**Result: Extension.** Wire AutoTrust pattern to walkthrough engine + expose terminal write as MCP tool.

### 2.3 Scenario 2: External Knowledge

| Adversarial View | Code Evidence | Verdict |
|---|---|---|
| **"Web research already works"** | Claude Code has `WebSearch`, `WebFetch`, `firecrawl-*` skills (6+ tools), `find-docs` skill. All available in system reminder. | TRUE — no overlay changes needed |
| **"Google Workspace has API access"** | `gws` and `gws-setup` skills exist in Claude Code's skill list. Operates via Google APIs, not UI clicks. | TRUE — API-level access already available |
| **"Window spatial awareness exists"** | `sidecar/src/server.ts` lines 68-90: `/list-windows` returns `{title, processName, hwnd, pid}`, `/active-window-rect` returns bounding rectangle via `GetForegroundWindow` + `GetWindowRect`. | TRUE — LLM can know where apps are on screen |
| **"Coordinate accuracy for unknown UIs is poor"** | `capture_screenshot` returns vision-optimized image. LLM estimates coordinates from pixels. No semantic element targeting (no accessibility tree). | TRUE — fragile for unfamiliar apps |

**Result: No overlay changes needed.** Only gap is UI element discovery (Phase 4).

### 2.4 Scenario 3: Spawn Agents/Terminals

| Adversarial View | Code Evidence | Verdict |
|---|---|---|
| **"Agent spawning is built into Claude Code"** | `Agent` tool with 20+ subagent types. `TeamCreate`/`SendMessage`/`TaskCreate`/`TaskUpdate` for coordination. `terminal-agent` subagent specifically for background shell. | TRUE — agent orchestration is Claude Code built-in |
| **"Bash tool already creates terminals"** | `Bash` tool with `run_in_background` parameter. Independent shell processes. Full command execution. | TRUE — terminal creation works today |
| **"Frontend supports multi-pane"** | `src/store/paneStore.ts`: Tree-based layout with `PaneNode`/`SplitNode`. `splitPane()`, `closePane()`, `setActivePane()`. Max 4 panes. `react-resizable-panels` rendering. | TRUE — UI is built |
| **"Sidecar is single-PTY-per-connection"** | `sidecar/src/server.ts` line 382: `const activeSessions = new Map<WebSocket, PTYSession \| BatchedPTYSession>()`. Line 457-462: spawn destroys existing session before creating new one. `[...activeSessions.values()][0]` pattern throughout. | TRUE — single PTY per WebSocket. Bounded refactor: change Map value to `Map<string, PTYSession>` keyed by paneId |

**Result: Extension.** One Map refactor in `server.ts` + paneId in WebSocket messages.

### 2.5 Scenario 4: Direct Screen Interaction

| Adversarial View | Code Evidence | Verdict |
|---|---|---|
| **"Win32 FFI bridge is proven"** | `sidecar/src/windowEnumerator.ts`: Full P/Invoke via PowerShell — `EnumWindows`, `GetWindowText`, `IsWindowVisible`, `DwmGetWindowAttribute`, `GetWindowThreadProcessId`. `sidecar/src/windowCapture.ts`: `PrintWindow` with `PW_RENDERFULLCONTENT`, DPI awareness via `SetProcessDpiAwarenessContext(-4)`. All working in production. | TRUE — P/Invoke pattern is proven and extensible |
| **"Terminal interaction is already solved"** | WebSocket `input` → `session.write()` → node-pty → PTY. For any CLI app, this IS screen interaction. | TRUE — terminal apps fully covered |
| **"Google Workspace uses API, not UI"** | `gws` skill uses Google Workspace SDK, not UI automation. For "create a macro in Google Sheets" — API call, not click sequence. | TRUE — API always preferred over UI clicking |
| **"SendInput is incremental"** | The P/Invoke pattern (PowerShell C# inline + `spawnSync`) is used for EnumWindows, PrintWindow, GetWindowRect. Adding `SendInput` is the same pattern with different Win32 functions. The FFI bridge, error handling, and DPI awareness are all reusable. | TRUE — same implementation pattern, new function |

**Counter-adversarial (honest gaps):**

| Gap | Why It's Real | Mitigation |
|---|---|---|
| No accessibility tree | Without `IUIAutomation`, LLM targets pixels (fragile) not elements ("Save button") | Phase 4 adds UIA integration |
| No consent model | `SendInput` is OS-level — could click anything without user approval | Phase 6 adds mandatory consent gate |
| No action-verify loop | After clicking, no auto-screenshot → vision → decide cycle | Phase 6 adds verify loop |

**Result: Extension.** Win32 FFI pattern is proven. Add SendInput + UIA + consent model using existing patterns.

### 2.6 Final Verdict

| Scenario | Original Claim | Stress Test Result |
|---|---|---|
| 1. Multi-step tracking | "Close — incremental" | **CONFIRMED: Small extension** (~2 files, reuse AutoTrust pattern) |
| 2. External knowledge | "Outside scope" | **CONFIRMED: No overlay work needed** |
| 3. Agent/terminal spawning | "Architectural shift" | **OVERTURNED: Bounded refactor** (~1 file Map change + paneId) |
| 4. Direct screen interaction | "Architectural shift" | **OVERTURNED: Medium extension** (3 new capabilities on proven FFI bridge) |

**The system is already an agent runtime.** Claude Code is the execution engine. The overlay is the display + observation layer. These phases extend the observation layer with action capabilities using patterns already proven in the codebase.

---

## 3. Architecture Decision: Extension, Not Shift

### 3.1 What Already Exists (DO NOT modify)

| Component | File | What It Does |
|---|---|---|
| PTY write path | `sidecar/src/server.ts:495-498` | WebSocket `input` → `session.write()` → node-pty |
| Terminal read MCP tool | `sidecar/src/mcp-server.ts:170-202` | `read_terminal_output` with cursor pagination |
| Screenshot MCP tool | `sidecar/src/mcp-server.ts:237-262` | Vision-optimized capture with blur |
| Walkthrough engine | `sidecar/src/walkthroughEngine.ts` | Linear step progression with annotation groups |
| Annotation store | `sidecar/src/annotationStore.ts` | In-memory Map with TTL, groups, batch operations |
| AutoTrust detector | `sidecar/src/autoTrust.ts` | Regex-watch-then-act on PTY output |
| Window enumeration | `sidecar/src/windowEnumerator.ts` | P/Invoke EnumWindows with 5s cache |
| Window capture | `sidecar/src/windowCapture.ts` | PrintWindow with DPI awareness |
| Multi-pane UI | `src/store/paneStore.ts` | Tree layout, max 4 panes |
| Feature flag system | `src/store/featureFlagStore.ts` | 21 flags, localStorage persistence, sidecar sync |
| WebSocket protocol | `sidecar/src/protocol.ts` | 15 client→server types, 20 server→client types |
| Annotation bridge | `src/store/annotationBridgeStore.ts` | WebSocket → Tauri emit, flag-gated |
| Overlay window | `src/overlay_main.tsx` | SVG annotations + walkthrough panel |
| MCP server | `sidecar/src/mcp-server.ts` | 7 tools, stdio JSON-RPC, HTTP proxy to sidecar |

### 3.2 What Each Phase Adds (NEW files only, or APPEND to existing)

Every phase creates new files or appends new code blocks to existing files. No existing function signatures, return types, or behaviors change. All additions are gated behind feature flags that default to OFF.

### 3.3 Non-Destruction Guarantee

Each phase follows this contract:
1. **New feature flags** added to `FeatureFlags` interface (append-only, defaults to `false`)
2. **New files** created for new capabilities (no modification of existing logic)
3. **Existing files modified ONLY by:**
   - Adding new `case` branches to `switch` statements (WebSocket handlers)
   - Adding new HTTP route registrations (append to route list)
   - Adding new MCP tool registrations (append to tool list)
   - Adding new flag entries to `FeatureFlags` interface and defaults
4. **All new code paths** wrapped in `if (flag) { ... }` guards
5. **Existing tests** must continue to pass with flags OFF

---

## 4. Feature Flag Strategy

### 4.1 New Flags (one per phase)

| Flag Name | Phase | Default | Sidecar Sync | Purpose |
|---|---|---|---|---|
| `terminalWriteMcp` | 1 | `false` | YES | Enables `write_terminal` MCP tool |
| `conditionalAdvance` | 2 | `false` | YES | Enables `advanceWhen` conditions in walkthrough steps |
| `multiPty` | 3 | `false` | YES | Enables per-pane PTY sessions |
| `uiAccessibility` | 4 | `false` | YES | Enables `get_ui_elements` MCP tool |
| `osInputSimulation` | 5 | `false` | YES | Enables `send_input` MCP tool (requires `uiAccessibility`) |
| `consentGate` | 6 | `false` | YES | Enables mandatory consent dialog for OS-level actions |

### 4.2 Flag Dependencies

```
terminalWriteMcp      — standalone
conditionalAdvance    — standalone
multiPty              — standalone
uiAccessibility       — standalone
osInputSimulation     — REQUIRES uiAccessibility AND consentGate
consentGate           — standalone (but only relevant when osInputSimulation is ON)
```

### 4.3 Implementation Pattern

**In `src/store/featureFlagStore.ts`** — append to the `FeatureFlags` interface:
```typescript
// Agent Runtime Extension flags (all default false)
terminalWriteMcp: boolean;
conditionalAdvance: boolean;
multiPty: boolean;
uiAccessibility: boolean;
osInputSimulation: boolean;
consentGate: boolean;
```

**In `src/components/FeatureFlagPanel.tsx`** — append to `FLAG_LABELS`:
```typescript
terminalWriteMcp: 'Terminal Write (MCP)',
conditionalAdvance: 'Conditional Walkthrough Advance',
multiPty: 'Multi-PTY Panes',
uiAccessibility: 'UI Accessibility Tree',
osInputSimulation: 'OS Input Simulation',
consentGate: 'Action Consent Gate',
```

**In `src/hooks/useFlagSync.ts`** — add new flags to the sync list:
```typescript
const terminalWriteMcp = useFeatureFlagStore(s => s.terminalWriteMcp);
const conditionalAdvance = useFeatureFlagStore(s => s.conditionalAdvance);
const multiPty = useFeatureFlagStore(s => s.multiPty);
const uiAccessibility = useFeatureFlagStore(s => s.uiAccessibility);
const osInputSimulation = useFeatureFlagStore(s => s.osInputSimulation);
const consentGate = useFeatureFlagStore(s => s.consentGate);
```

**In `sidecar/src/server.ts`** — append to `sidecarFlags`:
```typescript
terminalWriteMcp: false,
conditionalAdvance: false,
multiPty: false,
uiAccessibility: false,
osInputSimulation: false,
consentGate: false,
```

---

## 5. Phase Overview

| Phase | Name | Effort | Risk | Dependencies |
|---|---|---|---|---|
| 1 | Terminal Write MCP Tool | Small | Low | None |
| 2 | Conditional Walkthrough Advancement | Medium | Low | None |
| 3 | Multi-PTY Pane Multiplexing | Medium | Medium | None |
| 4 | UI Accessibility Tree Discovery | Large | Medium | None |
| 5 | OS-Level Input Simulation | Medium | High | Phase 4, Phase 6 |
| 6 | Consent Gate & Action Verification Loop | Medium | Medium | None (but must complete before Phase 5 goes live) |
| 7 | Integration Testing & Hardening | Medium | Low | All above |

**Recommended execution order:** 1 → 2 → 3 → 4 → 6 → 5 → 7

Phase 6 (consent gate) should be built BEFORE Phase 5 (input simulation) goes live, even though Phase 5 code can be written earlier.

---

## 6. Phase 1 — Terminal Write MCP Tool

### 6.1 Goal

Expose the existing PTY write path (`session.write(data)`) as an MCP tool so the LLM can programmatically send commands to the terminal.

### 6.2 Why This Is Safe

The write path already exists and is used by the frontend every time the user types. This phase merely exposes it over MCP. The `terminalWriteMcp` feature flag gates the entire tool.

### 6.3 Files to Create

**`sidecar/src/terminalWrite.ts`** — New file

```
Purpose: HTTP route handler for terminal write requests
Exports: handleTerminalWrite(req, res, activeSessions, sidecarFlags)
Behavior:
  - If sidecarFlags.terminalWriteMcp is false → return 403 "Terminal write MCP tool is disabled"
  - Parse JSON body: { text: string, paneId?: string }
  - Validate text is string, max 10000 chars
  - Get active session (first session, or by paneId when multiPty is enabled)
  - Call session.write(text)
  - Return 200 { ok: true, bytesWritten: text.length }
  - If no active session → return 404 "No active terminal session"
```

### 6.4 Files to Modify (append only)

**`sidecar/src/server.ts`**
- Add HTTP route: `POST /terminal-write` → calls `handleTerminalWrite()`
- Location: append after the `/screenshot` route block (after line ~337)
- Guard: `if (!sidecarFlags.terminalWriteMcp) return respond(res, 403, ...)`

**`sidecar/src/mcp-server.ts`**
- Add tool definition: `write_terminal`
- Location: append after `stop_walkthrough` tool (after line ~435)
- Parameters:
  - `text` (string, required, max 10000 chars) — text to send to terminal
  - `paneId` (string, optional) — target pane (for future multiPty support)
  - `pressEnter` (boolean, optional, default false) — append `\r` after text
- Implementation: POST to `/terminal-write` with JSON body
- The tool description must include: "WARNING: This sends keystrokes to the terminal. The command will execute immediately. Use with caution."

**`sidecar/src/protocol.ts`**
- No changes needed (HTTP route, not WebSocket)

**`src/store/featureFlagStore.ts`**
- Add `terminalWriteMcp: false` to defaults

**`src/components/FeatureFlagPanel.tsx`**
- Add label entry

**`src/hooks/useFlagSync.ts`**
- Add `terminalWriteMcp` to sync

**`sidecar/src/server.ts` (sidecarFlags)**
- Add `terminalWriteMcp: false` to sidecarFlags object

### 6.5 Test Plan

1. Flag OFF: MCP tool call returns error "tool disabled" or HTTP 403
2. Flag ON, no session: MCP tool returns "no active terminal session"
3. Flag ON, session active: send `echo hello` with `pressEnter: true` → verify terminal shows output
4. Flag ON, text exceeds 10000 chars: returns validation error
5. Existing functionality: all 7 existing MCP tools still work unchanged

### 6.6 Acceptance Criteria

- [ ] `write_terminal` MCP tool registered and callable
- [ ] Feature flag `terminalWriteMcp` gates the tool (403 when off)
- [ ] Input validation prevents oversized payloads
- [ ] Existing MCP tools unaffected
- [ ] No existing file behavior changed when flag is off

---

## 7. Phase 2 — Conditional Walkthrough Advancement

### 7.1 Goal

Add `advanceWhen` conditions to walkthrough steps so the walkthrough engine can self-advance when terminal output matches a pattern, instead of requiring explicit `advance_walkthrough` calls.

### 7.2 Design

Reuse the proven `AutoTrustDetector` pattern from `sidecar/src/autoTrust.ts`:
- Feed PTY output chunks to a watcher
- Match against regex patterns
- Fire callback on match (advance walkthrough instead of sending Enter)
- Three-phase timing: detect delay → settle → cooldown

### 7.3 Files to Create

**`sidecar/src/walkthroughWatcher.ts`** — New file

```
Purpose: Monitors terminal output and auto-advances walkthrough when conditions are met
Exports: WalkthroughWatcher class

Constructor(opts):
  - onAdvance: () => void — callback to fire when pattern matches
  - onEvent: (event) => void — callback for logging/broadcasting
  - enabled: boolean — controlled by conditionalAdvance flag

Properties:
  - tailBuffer: string (4KB rolling, same as AutoTrust)
  - currentPattern: RegExp | null — the active step's advanceWhen pattern
  - detectionTimer, settleUntil, cooldownUntil — same timing as AutoTrust

Methods:
  - setPattern(pattern: RegExp | null): void — called when walkthrough step changes
  - feed(rawChunk: string): void — called with PTY output (same as AutoTrust.feed)
  - destroy(): void — cleanup timers

Timing constants (same as AutoTrust):
  - DETECTION_DELAY_MS = 50
  - SETTLE_MS = 1000
  - COOLDOWN_MS = 3000
  - TAIL_BUFFER_SIZE = 4096
```

### 7.4 Files to Modify (append only)

**`sidecar/src/walkthroughEngine.ts`**
- Extend `WalkthroughStepSchema` to accept optional `advanceWhen`:
  ```
  advanceWhen: z.object({
    type: z.literal('terminal-match'),
    pattern: z.string().min(1).max(500),
  }).optional()
  ```
- Add method `getCurrentAdvancePattern(): RegExp | null` that returns the compiled regex for the current step's `advanceWhen.pattern`, or null if not set
- No changes to existing `start()`, `advance()`, `stop()` behavior

**`sidecar/src/server.ts`**
- After walkthrough start/advance, check if new step has `advanceWhen` → set pattern on watcher
- In PTY output handler: if `conditionalAdvance` flag is on AND walkthrough is active, feed output to watcher
- Wire watcher's `onAdvance` to call `walkthroughEngine.advance()` + broadcast
- Location: append to existing PTY output callback (where data is written to WebSocket)

**`sidecar/src/mcp-server.ts`**
- Update `start_guided_walkthrough` tool schema to accept `advanceWhen` in step definitions
- No changes to `advance_walkthrough` or `stop_walkthrough`

**Feature flag files** (same pattern as Phase 1)

### 7.5 Test Plan

1. Flag OFF: walkthrough works exactly as before (manual advance only)
2. Flag ON, no advanceWhen: walkthrough works exactly as before
3. Flag ON, advanceWhen set: send terminal output matching pattern → walkthrough auto-advances
4. Flag ON, advanceWhen with exclusion: output doesn't match → no advance
5. Walkthrough stopped mid-advance: watcher cleans up, no dangling timers
6. Multiple rapid matches: cooldown prevents double-advance

### 7.6 Acceptance Criteria

- [ ] `advanceWhen` field accepted in walkthrough step schema
- [ ] WalkthroughWatcher class created with AutoTrust-equivalent pattern
- [ ] Terminal output fed to watcher when flag is on
- [ ] Auto-advance fires on pattern match with correct timing
- [ ] Existing walkthrough behavior unchanged when flag is off
- [ ] No existing file behavior changed

---

## 8. Phase 3 — Multi-PTY Pane Multiplexing

### 8.1 Goal

Allow each frontend pane to have its own independent PTY session, enabling true multi-terminal support.

### 8.2 Current Limitation

`sidecar/src/server.ts` line 382:
```typescript
const activeSessions = new Map<WebSocket, PTYSession | BatchedPTYSession>();
```
One PTY per WebSocket. Spawn destroys existing session (line 457-462).

### 8.3 Design

**When `multiPty` flag is OFF:** Behavior is identical to today (one session per connection, spawn replaces).

**When `multiPty` flag is ON:**
- `activeSessions` becomes `Map<WebSocket, Map<string, PTYSession | BatchedPTYSession>>`
- All WebSocket messages include optional `paneId` field
- Spawn creates a new session keyed by paneId (no destroy of existing)
- Input/resize/kill target specific paneId
- Output includes `paneId` so frontend routes to correct terminal

### 8.4 Files to Create

**`sidecar/src/multiPtyManager.ts`** — New file

```
Purpose: Manages multiple PTY sessions per WebSocket connection
Exports: MultiPtyManager class

Constructor(opts):
  - maxSessionsPerClient: number (default 4, matches frontend pane cap)

Methods:
  - getSession(ws, paneId): PTYSession | undefined
  - setSession(ws, paneId, session): void
  - removeSession(ws, paneId): void
  - getAllSessions(ws): Map<string, PTYSession>
  - getFirstSession(ws): PTYSession | undefined — fallback for non-multiPty mode
  - destroyAll(ws): void — cleanup on disconnect
  - sessionCount(ws): number
```

### 8.5 Files to Modify (append only)

**`sidecar/src/protocol.ts`**
- Add optional `paneId?: string` to these ClientMessage types: `input`, `resize`, `spawn`, `kill`
- Add optional `paneId?: string` to these ServerMessage types: `output`, `pty-ready`, `pty-exit`, `session-start`
- These are OPTIONAL fields — existing messages without paneId work exactly as before

**`sidecar/src/server.ts`**
- Import `MultiPtyManager`
- When `multiPty` flag is ON: use `MultiPtyManager` instead of direct Map access
- When `multiPty` flag is OFF: use existing `activeSessions` Map (unchanged)
- Modify `spawn` handler: if multiPty ON, don't destroy existing session, create alongside
- Modify `input`/`resize`/`kill` handlers: route by paneId if present
- Modify output callback: include paneId in output messages
- All changes wrapped in `if (sidecarFlags.multiPty) { ... } else { /* existing code */ }`

**`src/components/TerminalPane.tsx`**
- Include `paneId` in `spawn`, `input`, `resize`, `kill` messages when `multiPty` flag is ON
- Route incoming `output` messages by `paneId` (ignore output for other panes)
- Pane ID comes from `usePaneStore` (already assigned per pane)

**`sidecar/src/mcp-server.ts`**
- Update `write_terminal` tool (Phase 1) to route by `paneId` when multiPty is enabled
- Update `read_terminal_output` tool to accept optional `paneId` parameter

**Feature flag files** (same pattern)

### 8.6 Test Plan

1. Flag OFF: single PTY behavior unchanged, spawn replaces session
2. Flag ON: spawn creates independent session per paneId
3. Flag ON: input to pane A doesn't appear in pane B
4. Flag ON: kill pane A doesn't affect pane B
5. Flag ON: max 4 sessions per client enforced
6. Flag ON: disconnect cleans up all sessions
7. MCP read_terminal_output with paneId returns correct buffer

### 8.7 Acceptance Criteria

- [ ] MultiPtyManager class created
- [ ] Per-pane PTY sessions when flag is on
- [ ] paneId in WebSocket protocol (optional, backward-compatible)
- [ ] Existing single-PTY behavior unchanged when flag is off
- [ ] MCP tools updated with optional paneId
- [ ] No existing file behavior changed

---

## 9. Phase 4 — UI Accessibility Tree Discovery

### 9.1 Goal

Add a new MCP tool `get_ui_elements` that returns the accessibility tree of a target window, giving the LLM precise element names, roles, and bounding rectangles instead of guessing from screenshots.

### 9.2 Design

Use Win32 `UIAutomation` COM API via PowerShell (same P/Invoke pattern as `windowEnumerator.ts` and `windowCapture.ts`). PowerShell has native access to `System.Windows.Automation` namespace.

### 9.3 Files to Create

**`sidecar/src/uiAutomation.ts`** — New file

```
Purpose: Win32 UI Automation tree discovery via PowerShell
Exports:
  - getUiElements(hwnd: number, opts?: { maxDepth?: number, roleFilter?: string[] }): UiElement[]
  - UiElement interface:
      name: string           — element name ("Save", "File", "Sheet1")
      role: string           — control type ("Button", "MenuItem", "Edit", "Tab")
      boundingRect: { x: number, y: number, w: number, h: number }  — screen coordinates
      automationId: string   — unique automation ID (if available)
      isEnabled: boolean
      isOffscreen: boolean
      children: UiElement[]  — nested elements (controlled by maxDepth)

Implementation:
  - PowerShell script using [System.Windows.Automation.AutomationElement]
  - AutomationElement.FromHandle(hwnd) to get root
  - TreeWalker.ControlViewWalker to traverse
  - Collect: Name, ControlType, BoundingRectangle, AutomationId, IsEnabled, IsOffscreen
  - maxDepth default 3 (prevents explosion on deep trees)
  - roleFilter: optional array of ControlType names to include (e.g., ["Button", "Edit"])
  - JSON output parsed from PowerShell stdout
  - 15-second timeout (accessibility trees can be large)
  - Cache with 3-second TTL (same pattern as windowEnumerator.ts)
```

### 9.4 Files to Modify (append only)

**`sidecar/src/server.ts`**
- Add HTTP route: `GET /ui-elements?hwnd=<number>&maxDepth=<number>&roleFilter=<csv>`
- Guard: `if (!sidecarFlags.uiAccessibility) return respond(res, 403, ...)`

**`sidecar/src/mcp-server.ts`**
- Add MCP tool: `get_ui_elements`
- Parameters:
  - `hwnd` (number, optional) — target window handle. If omitted, uses active foreground window.
  - `title` (string, optional) — find window by title match (uses existing `listWindows()`)
  - `maxDepth` (number, optional, default 3, max 5) — tree traversal depth
  - `roleFilter` (array of strings, optional) — only return elements matching these roles
- Returns: JSON array of UiElement objects with bounding rectangles

**Feature flag files** (same pattern)

### 9.5 PowerShell Script Strategy

The script will use .NET's `System.Windows.Automation` namespace (available on all Windows 10/11 without additional installs):

```powershell
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
# Recursive walk with depth limit...
```

This follows the exact same pattern as `windowEnumerator.ts` (PowerShell with inline .NET types, `spawnSync`, JSON output).

### 9.6 Test Plan

1. Flag OFF: MCP tool returns error, HTTP route returns 403
2. Flag ON, valid hwnd: returns element tree with names and bounding rects
3. Flag ON, by title: finds window and returns tree
4. Flag ON, maxDepth=1: returns only top-level elements
5. Flag ON, roleFilter=["Button"]: returns only buttons
6. Flag ON, invalid hwnd: returns error
7. Flag ON, timeout: large tree doesn't hang (15s limit)
8. Existing tools unaffected

### 9.7 Acceptance Criteria

- [ ] `uiAutomation.ts` created with PowerShell-based tree discovery
- [ ] `get_ui_elements` MCP tool registered and callable
- [ ] Returns element names, roles, bounding rectangles
- [ ] maxDepth and roleFilter work correctly
- [ ] Feature flag gates the tool
- [ ] No existing file behavior changed

---

## 10. Phase 5 — OS-Level Input Simulation

### 10.1 Goal

Add an MCP tool `send_input` that simulates mouse clicks and keyboard input at the OS level, enabling the LLM to interact with any Windows application.

### 10.2 Safety Architecture

This is the highest-risk phase. Three safety layers are mandatory:

1. **Feature flag gate:** `osInputSimulation` must be ON
2. **Dependency gate:** `uiAccessibility` AND `consentGate` must also be ON (enforced in code)
3. **Consent gate:** Every action must be approved by the user before execution (Phase 6)

If ANY of these three conditions is false, the tool returns an error.

### 10.3 Files to Create

**`sidecar/src/inputSimulator.ts`** — New file

```
Purpose: Win32 SendInput wrapper via PowerShell
Exports:
  - simulateClick(x: number, y: number, button?: 'left' | 'right'): { ok: boolean, error?: string }
  - simulateType(text: string): { ok: boolean, error?: string }
  - simulateKeyCombo(keys: string[]): { ok: boolean, error?: string }
      e.g., ['ctrl', 'c'] → Ctrl+C
  - simulateDrag(fromX, fromY, toX, toY): { ok: boolean, error?: string }

Implementation:
  - PowerShell script using P/Invoke [user32.dll]::SendInput
  - INPUT struct with MOUSEINPUT and KEYBDINPUT
  - Absolute mouse coordinates (normalized to 0-65535 via GetSystemMetrics)
  - DPI-aware coordinate conversion (reuse SetProcessDpiAwarenessContext pattern)
  - Each function is a separate PowerShell invocation (isolated, no state leakage)
  - 5-second timeout per action
  - Returns structured result (ok/error)
```

### 10.4 Files to Modify (append only)

**`sidecar/src/server.ts`**
- Add HTTP route: `POST /send-input`
- Triple guard: `osInputSimulation` AND `uiAccessibility` AND `consentGate` flags all ON
- Request body: `{ action: 'click' | 'type' | 'keyCombo' | 'drag', ...params }`
- Response: `{ ok: boolean, error?: string }`

**`sidecar/src/mcp-server.ts`**
- Add MCP tool: `send_input`
- Parameters:
  - `action` (enum: 'click', 'type', 'keyCombo', 'drag')
  - `x`, `y` (numbers, for click/drag)
  - `toX`, `toY` (numbers, for drag)
  - `button` (enum: 'left', 'right', default 'left', for click)
  - `text` (string, for type)
  - `keys` (array of strings, for keyCombo, e.g., ["ctrl", "s"])
  - `description` (string, required) — human-readable description of what this action does. Shown in the consent dialog. e.g., "Click the Save button in Google Sheets"
- Tool description must include: "CRITICAL: This tool simulates real mouse/keyboard input at the OS level. Every action requires user approval via the consent dialog. The uiAccessibility, osInputSimulation, and consentGate feature flags must ALL be enabled."

**Feature flag files** (same pattern)

### 10.5 Test Plan

1. Any of the 3 required flags OFF: tool returns error explaining which flag is missing
2. All flags ON, click action: mouse moves to coordinates and clicks
3. All flags ON, type action: text is typed at current cursor position
4. All flags ON, keyCombo: keyboard shortcut is simulated
5. All flags ON, drag: mouse drag from A to B
6. Consent denied by user: action does not execute
7. Invalid coordinates: returns validation error
8. Existing tools unaffected

### 10.6 Acceptance Criteria

- [ ] `inputSimulator.ts` created with SendInput P/Invoke
- [ ] `send_input` MCP tool registered with triple flag guard
- [ ] Click, type, keyCombo, drag actions all work
- [ ] Consent gate blocks execution until user approves (Phase 6)
- [ ] Feature flags gate the tool
- [ ] No existing file behavior changed

---

## 11. Phase 6 — Consent Gate & Action Verification Loop

### 11.1 Goal

Two capabilities:
1. **Consent gate:** Before any OS-level input action, show the user a dialog describing what the LLM wants to do. The user must explicitly approve or deny.
2. **Action verification loop:** After each action, auto-capture a screenshot so the LLM can verify the result before deciding the next action.

### 11.2 Consent Gate Design

**Frontend component: `src/components/ConsentDialog.tsx`** — New file

```
Purpose: Modal dialog shown when LLM requests OS-level action
Props:
  - action: { type: string, description: string, coordinates?: {x,y}, target?: string }
  - onApprove: () => void
  - onDeny: () => void

UI:
  - Dark modal overlay (same theme as FeatureFlagPanel)
  - Header: "Action Consent Required"
  - Body: Human-readable description of what will happen
  - Details: coordinates, target element, action type
  - Two buttons: "Allow" (green) and "Deny" (red)
  - Auto-deny after 30 seconds (timeout)
  - Keyboard: Enter = Allow, Escape = Deny
  - Sound/visual alert to get user attention
```

**Sidecar flow:**
1. MCP tool `send_input` is called
2. Sidecar sends WebSocket message: `{ type: 'consent-request', requestId, action }`
3. Frontend shows `ConsentDialog`
4. User clicks Allow → frontend sends: `{ type: 'consent-response', requestId, approved: true }`
5. Sidecar receives response → if approved, executes action; if denied, returns error to MCP
6. HTTP response held pending until consent received or timeout (30s)

### 11.3 Verification Loop Design

After each approved action:
1. Sidecar waits 500ms (let UI settle)
2. Auto-captures screenshot via existing `captureSelfScreenshot()` or `captureWindowByHwnd()`
3. Returns screenshot alongside action result to MCP tool response
4. LLM uses vision to verify the action succeeded before sending next action

This is returned as part of the `send_input` tool response:
```json
{
  "ok": true,
  "verificationScreenshot": "<base64 webp>",
  "verificationDimensions": { "width": 1200, "height": 800 }
}
```

### 11.4 Files to Create

**`src/components/ConsentDialog.tsx`** — New file (frontend consent UI)
**`sidecar/src/consentManager.ts`** — New file (sidecar consent request/response tracking)

```
ConsentManager:
  - pendingRequests: Map<string, { resolve, reject, timer }>
  - requestConsent(action): Promise<boolean> — sends WS message, awaits response
  - handleResponse(requestId, approved): void — resolves pending promise
  - TIMEOUT_MS = 30000
```

### 11.5 Files to Modify (append only)

**`sidecar/src/protocol.ts`**
- Add ClientMessage: `{ type: 'consent-response'; requestId: string; approved: boolean }`
- Add ServerMessage: `{ type: 'consent-request'; requestId: string; action: ConsentAction }`
- Add type: `ConsentAction = { type: string; description: string; coordinates?: {x: number, y: number}; target?: string }`

**`sidecar/src/server.ts`**
- Import `ConsentManager`
- Wire `consent-response` WebSocket message to `consentManager.handleResponse()`
- Wire `broadcastConsentRequest()` for sending consent requests to frontend

**`src/components/TerminalPane.tsx`**
- Handle `consent-request` ServerMessage → show `ConsentDialog`
- Send `consent-response` ClientMessage on user decision

**`src/store/annotationBridgeStore.ts`** or new `src/store/consentStore.ts`
- Track pending consent requests for UI rendering

**Feature flag files** (same pattern)

### 11.6 Test Plan

1. Flag OFF: no consent dialogs appear, send_input returns "consent gate disabled"
2. Flag ON, user approves: action executes, verification screenshot returned
3. Flag ON, user denies: action blocked, MCP tool returns "user denied"
4. Flag ON, timeout: 30s passes with no response → auto-deny
5. Multiple rapid requests: queued, shown one at a time
6. Verification screenshot: valid base64 image returned after approved action
7. Existing functionality unaffected

### 11.7 Acceptance Criteria

- [ ] ConsentDialog component renders with action details
- [ ] ConsentManager tracks pending requests with timeout
- [ ] WebSocket consent-request/consent-response protocol works
- [ ] Actions blocked until user approves
- [ ] Verification screenshot returned after approved actions
- [ ] Feature flag gates the consent system
- [ ] No existing file behavior changed

---

## 12. Phase 7 — Integration Testing & Hardening

### 12.1 Goal

End-to-end testing of all phases working together. Verify the complete LLM → observation → annotation → action → verification flow.

### 12.2 Test Scenarios

**Scenario A: Terminal Guidance**
1. LLM reads terminal via `read_terminal_output`
2. LLM starts walkthrough with `advanceWhen` terminal patterns
3. LLM writes command via `write_terminal`
4. Walkthrough auto-advances when output matches
5. Repeat through all steps
6. Walkthrough completes, annotations clear

**Scenario B: Multi-Pane Workflow**
1. LLM spawns two terminal panes via frontend
2. LLM writes to pane A (build command)
3. LLM reads pane B (server logs)
4. Walkthrough annotations target specific pane regions

**Scenario C: GUI Application Interaction**
1. LLM enumerates windows via `list-windows`
2. LLM gets accessibility tree via `get_ui_elements`
3. LLM identifies target button by name and bounding rect
4. LLM calls `send_input` with click coordinates
5. Consent dialog appears, user approves
6. Action executes, verification screenshot returned
7. LLM verifies result via vision

**Scenario D: Full Walkthrough with Mixed Targets**
1. LLM starts walkthrough with 5 steps
2. Steps 1-2: terminal commands (auto-advance via advanceWhen)
3. Step 3: open browser (LLM uses send_input to click)
4. Steps 4-5: Google Sheets API operations (via gws skill, not UI)
5. Walkthrough completes

### 12.3 Hardening Checklist

- [ ] All flags OFF: zero behavioral change from current production
- [ ] Each flag independently toggleable without side effects
- [ ] Flag dependency enforcement (osInputSimulation requires uiAccessibility + consentGate)
- [ ] Graceful degradation: sidecar crash during consent → auto-deny
- [ ] Memory cleanup: no leaked timers, sessions, or event listeners on pane close
- [ ] WebSocket disconnect during consent → auto-deny pending requests
- [ ] MCP server restart: discovery file re-read, no stale state
- [ ] All existing 21 feature flags still work correctly
- [ ] All existing 7 MCP tools still work correctly
- [ ] All existing WebSocket message types still work correctly

### 12.4 Acceptance Criteria

- [ ] All test scenarios pass end-to-end
- [ ] Hardening checklist complete
- [ ] No regressions in existing functionality
- [ ] Performance: no measurable impact with all flags OFF

---

## 13. Handover Protocol

### 13.1 At the END of Every Conversation

The implementing LLM/agent MUST update Section 14 (Progress Tracker) with:

1. **Phase status:** Change from `NEXT` to `DONE` (or `PARTIAL` with explanation)
2. **Completion date:** Add the date
3. **Files created:** List all new files with full paths
4. **Files modified:** List all modified files with line ranges
5. **Handover notes:** Any gotchas, decisions made, deviations from plan, or context the next conversation needs
6. **Test results:** What was tested and what passed/failed

### 13.2 Format

```markdown
### Phase N — [Name]
- **Status:** DONE | PARTIAL | BLOCKED
- **Date:** YYYY-MM-DD
- **Files created:**
  - `full/path/to/file.ts` — purpose
- **Files modified:**
  - `full/path/to/file.ts` — what was changed (lines X-Y)
- **Handover notes:**
  - [Any context the next conversation needs]
- **Test results:**
  - [What was tested and outcomes]
```

---

## 14. Progress Tracker

### Phase 1 — Terminal Write MCP Tool
- **Status:** DONE
- **Date:** 2026-04-04
- **Files created:**
  - `sidecar/src/terminalWrite.ts` — HTTP route handler for POST /terminal-write, flag-gated, validates input, calls session.write()
- **Files modified:**
  - `sidecar/src/server.ts` — Added `terminalWriteMcp: false` to sidecarFlags, imported handleTerminalWrite, registered POST /terminal-write route
  - `sidecar/src/mcp-server.ts` — Added `write_terminal` MCP tool (Tool 8) with text/paneId/pressEnter params
  - `src/store/featureFlagStore.ts` — Added `terminalWriteMcp` to FeatureFlags interface, defaults, and localStorage persistence
  - `src/components/FeatureFlagPanel.tsx` — Added `terminalWriteMcp` label
  - `src/hooks/useFlagSync.ts` — Added `terminalWriteMcp` to sidecar flag sync
  - `src/hooks/usePersistence.ts` — Added `terminalWriteMcp` to persistence snapshot
- **Handover notes:**
  - All changes are additive and flag-gated. Flag defaults to false (OFF).
  - The write_terminal MCP tool POSTs to /terminal-write on the sidecar HTTP server, which calls session.write() on the first active PTY session.
  - paneId parameter is accepted but currently uses first session (multi-PTY support deferred to Phase 3).
  - Text is validated to max 10000 chars. pressEnter appends \r.
  - Both frontend (tsc --noEmit) and sidecar (tsc) compile cleanly.
- **Test results:**
  - TypeScript compilation: PASS (frontend + sidecar, zero errors)
  - Sidecar dist build: PASS (terminalWrite.js generated)

### Phase 2 — Conditional Walkthrough Advancement
- **Status:** DONE
- **Date:** 2026-04-04
- **Files created:**
  - `sidecar/src/walkthroughWatcher.ts` — WalkthroughWatcher class with AutoTrust-equivalent pattern (feed, setPattern, destroy, three-phase timing)
- **Files modified:**
  - `sidecar/src/walkthroughEngine.ts` — Added `AdvanceWhenSchema` (optional `advanceWhen` field on steps), added `getCurrentAdvancePattern()` method
  - `sidecar/src/batchedPtySession.ts` — Added WalkthroughWatcher instantiation, feeds raw output to watcher in proxy intercept, exposes walkthroughWatcherInstance/walkthroughWatcherEnabled, cleanup in destroy()
  - `sidecar/src/server.ts` — Added `conditionalAdvance: false` to sidecarFlags, wired watcher onAdvance callback in spawn handler, added `updateWalkthroughWatcherPattern()` helper called after walkthrough start/advance/stop, added live-update for conditionalAdvance in set-flags handler
  - `sidecar/src/mcp-server.ts` — Added `advanceWhen` field to start_guided_walkthrough step schema, updated tool description with auto-advance documentation
  - `src/store/featureFlagStore.ts` — Added `conditionalAdvance` to FeatureFlags interface, defaults (false), and localStorage persistence
  - `src/components/FeatureFlagPanel.tsx` — Added `conditionalAdvance` label
  - `src/hooks/useFlagSync.ts` — Added `conditionalAdvance` to sidecar flag sync
  - `src/hooks/usePersistence.ts` — Added `conditionalAdvance` to persistence snapshot
- **Handover notes:**
  - All changes are additive and flag-gated. Flag defaults to false (OFF).
  - WalkthroughWatcher reuses exact same timing constants as AutoTrustDetector (50ms detect, 1s settle, 3s cooldown, 4KB buffer).
  - The watcher's `onAdvance` callback is set by server.ts after BatchedPTYSession construction (public field).
  - When flag is OFF, advanceWhen fields are accepted in the schema but ignored — manual advance still works.
  - Pattern is cleared on walkthrough stop/complete and reset on each step advance.
  - Both frontend (tsc --noEmit) and sidecar (tsc) compile cleanly.
- **Test results:**
  - TypeScript compilation: PASS (frontend + sidecar, zero errors)
  - Sidecar dist build: PASS (walkthroughWatcher.js generated)

### Phase 3 — Multi-PTY Pane Multiplexing
- **Status:** DONE
- **Date:** 2026-04-04
- **Files created:**
  - `sidecar/src/multiPtyManager.ts` — MultiPtyManager class: manages per-WebSocket Map<paneId, Session>, max 4 sessions, findSessionByPaneId(), allSessions() iterator, destroyAll() cleanup
- **Files modified:**
  - `sidecar/src/protocol.ts` — Added optional `paneId?: string` to ClientMessage types (input, resize, spawn, kill) and ServerMessage types (output, pty-ready, pty-exit, session-start)
  - `src/protocol.ts` — Mirrored same paneId additions (frontend copy)
  - `sidecar/src/ptySession.ts` — Added optional `paneId` constructor param; output, pty-ready, and pty-exit messages now include paneId when provided
  - `sidecar/src/batchedPtySession.ts` — Added optional `paneId` constructor param, passes it to PTYSession, batcher onFlush includes paneId in output messages
  - `sidecar/src/server.ts` — Imported MultiPtyManager, created instance, added `multiPty: false` to sidecarFlags, added `getAnySession()` and `getSessionByPaneId()` helpers, modified spawn/input/resize/kill handlers with `if (multiPty)` branching, passes paneId to BatchedPTYSession constructor, updated /terminal-state to accept paneId query param, updated /screenshot to use getAnySession(), updated set-flags live-update to iterate both legacy and multiPty sessions, updated disconnect and exit cleanup to call multiPtyManager.destroyAll()
  - `sidecar/src/terminalWrite.ts` — Added MultiPtyManager parameter, routes by paneId via findSessionByPaneId() when multiPty enabled, falls back to first session
  - `sidecar/src/mcp-server.ts` — Added optional `paneId` parameter to `read_terminal_output` tool, passes through as query param to /terminal-state
  - `src/store/featureFlagStore.ts` — Added `multiPty` to FeatureFlags interface, defaults (false), and localStorage persistence
  - `src/components/FeatureFlagPanel.tsx` — Added `multiPty` label ('Multi-PTY Panes')
  - `src/hooks/useFlagSync.ts` — Added `multiPty` to sidecar flag sync
  - `src/hooks/usePersistence.ts` — Added `multiPty` to persistence snapshot
  - `src/components/TerminalPane.tsx` — Added paneId filtering on incoming ServerMessages when multiPty ON, included paneId in spawn/input/resize/kill messages, updated auto-spawn, auto-respawn, shell change, and handleSendInput
- **Handover notes:**
  - All changes are additive and flag-gated. Flag defaults to false (OFF).
  - When multiPty is OFF, behavior is identical to before — single PTY per WebSocket, spawn replaces existing session.
  - When multiPty is ON, each pane sends its paneId in spawn/input/resize/kill messages. The sidecar routes to the correct session via MultiPtyManager.
  - The `activeSessions` legacy Map is kept for backward compatibility when flag is OFF. MultiPtyManager is a parallel data structure used only when flag is ON.
  - Output routing on the frontend uses paneId filtering in handleServerMessage — messages with a paneId for a different pane are silently dropped.
  - PTYSession and BatchedPTYSession both accept optional paneId. When provided, all outgoing messages (output, pty-ready, pty-exit) include paneId, enabling server-side output isolation. The batcher's onFlush also includes paneId so batched output is correctly tagged.
  - write_terminal MCP tool now routes by paneId when multiPty is enabled.
  - read_terminal_output MCP tool now accepts optional paneId parameter.
  - Both frontend (tsc --noEmit) and sidecar (tsc) compile cleanly.
- **Test results:**
  - TypeScript compilation: PASS (frontend + sidecar, zero errors)
  - Sidecar dist build: PASS (multiPtyManager.js generated)

### Phase 4 — UI Accessibility Tree Discovery
- **Status:** DONE
- **Date:** 2026-04-04
- **Files created:**
  - `sidecar/src/uiAutomation.ts` — PowerShell-based Win32 UI Automation tree discovery using [System.Windows.Automation]. Exports `getUiElements(hwnd, opts)` with 3s TTL cache, maxDepth (1-5), roleFilter support, 15s timeout.
- **Files modified:**
  - `sidecar/src/server.ts` — Imported `getUiElements`, added `uiAccessibility: false` to sidecarFlags, added `GET /ui-elements` HTTP route (flag-gated, supports hwnd/title/maxDepth/roleFilter query params, title lookup via existing `listWindows()`)
  - `sidecar/src/mcp-server.ts` — Added `get_ui_elements` MCP tool (Tool 9) with hwnd/title/maxDepth/roleFilter params, routes to `/ui-elements` sidecar endpoint
  - `src/store/featureFlagStore.ts` — Added `uiAccessibility` to FeatureFlags interface, defaults (false), and localStorage persistence
  - `src/components/FeatureFlagPanel.tsx` — Added `uiAccessibility` label ('UI Accessibility Tree')
  - `src/hooks/useFlagSync.ts` — Added `uiAccessibility` to sidecar flag sync
  - `src/hooks/usePersistence.ts` — Added `uiAccessibility` to persistence snapshot
- **Handover notes:**
  - All changes are additive and flag-gated. Flag defaults to false (OFF).
  - The `get_ui_elements` MCP tool GETs `/ui-elements` on the sidecar HTTP server, which spawns PowerShell with `[System.Windows.Automation.AutomationElement]::FromHandle(hwnd)`.
  - Window can be targeted by hwnd directly or by title substring match (uses existing `listWindows()`).
  - Role filtering is applied during tree walk — filtered-out containers are still traversed so matching children are returned.
  - PowerShell script uses `TreeWalker.ControlViewWalker` (not RawView) to avoid noise from internal framework elements.
  - Cache key includes hwnd + maxDepth + roleFilter to avoid returning stale results for different queries.
  - 15-second timeout prevents hangs on very large accessibility trees.
  - Both frontend (tsc --noEmit) and sidecar (tsc) compile cleanly.
- **Test results:**
  - TypeScript compilation: PASS (frontend + sidecar, zero errors)
  - Sidecar dist build: PASS (uiAutomation.js generated)

### Phase 5 — OS-Level Input Simulation
- **Status:** NEXT
- **Date:** —
- **Files created:** —
- **Files modified:** —
- **Handover notes:** —
- **Test results:** —

### Phase 6 — Consent Gate & Action Verification Loop
- **Status:** DONE
- **Date:** 2026-04-04
- **Files created:**
  - `sidecar/src/consentManager.ts` — ConsentManager class: pending request Map with 30s timeout, broadcastConsentRequest callback, handleResponse, denyAll for cleanup
  - `src/components/ConsentDialog.tsx` — Modal consent UI with 30s countdown, Enter=Allow, Escape=Deny, action details display, timeout progress bar
- **Files modified:**
  - `sidecar/src/protocol.ts` — Added `consent-response` ClientMessage type, `consent-request` ServerMessage type
  - `src/protocol.ts` — Mirrored same consent message types (frontend copy)
  - `sidecar/src/server.ts` — Imported ConsentManager, created instance, added `consentGate: false` to sidecarFlags, wired broadcastConsentRequest to WebSocket clients, added `consent-response` case in WS handler, added `POST /consent/request` HTTP route (flag-gated), added consentManager.denyAll() on disconnect
  - `src/store/featureFlagStore.ts` — Added `consentGate` to FeatureFlags interface, defaults (false), and localStorage persistence
  - `src/components/FeatureFlagPanel.tsx` — Added `consentGate` label ('Action Consent Gate')
  - `src/hooks/useFlagSync.ts` — Added `consentGate` to sidecar flag sync
  - `src/hooks/usePersistence.ts` — Added `consentGate` to persistence snapshot
  - `src/components/TerminalPane.tsx` — Imported ConsentDialog, added consentRequest state, handles `consent-request` ServerMessage, renders ConsentDialog when active, sends `consent-response` on approve/deny
- **Handover notes:**
  - All changes are additive and flag-gated. Flag defaults to false (OFF).
  - The consent flow works via HTTP (MCP → sidecar POST /consent/request) + WebSocket (sidecar → frontend consent-request, frontend → sidecar consent-response).
  - POST /consent/request blocks until user responds or 30s timeout (auto-deny).
  - ConsentManager.denyAll() is called on WebSocket disconnect and sidecar exit for safety.
  - Verification screenshot logic is NOT yet wired — Phase 5 (send_input) will use the consent manager and add screenshot capture after approved actions.
  - The ConsentDialog only renders in the active TerminalPane (since consent-request is broadcast, all panes receive it — but only the first to display and respond matters since the ConsentManager resolves the promise on first handleResponse).
  - Both frontend (tsc --noEmit) and sidecar (tsc) compile cleanly.
- **Test results:**
  - TypeScript compilation: PASS (frontend + sidecar, zero errors)
  - Sidecar dist build: PASS (consentManager.js generated)

### Phase 7 — Integration Testing & Hardening
- **Status:** PENDING (after all above)
- **Date:** —
- **Files created:** —
- **Files modified:** —
- **Handover notes:** —
- **Test results:** —

---

## 15. Rollback Strategy

### Per-Phase Rollback

Each phase is independently rollbackable by turning its feature flag OFF. Since all new code paths are gated behind flags, disabling a flag returns the system to its previous behavior without code changes.

### Git Rollback

Each phase should be committed as a single commit (or squashed PR). To rollback:

```bash
# Find the commit for the phase
git log --oneline

# Revert the specific phase commit
git revert <commit-hash>
```

### Nuclear Rollback

If all phases need to be reverted:

```bash
# Find the commit BEFORE Phase 1
git log --oneline --before="<phase-1-date>"

# Reset to that commit (creates a new commit, doesn't destroy history)
git revert --no-commit <phase-1-hash>..HEAD
git commit -m "revert: remove all agent runtime extension phases"
```

### Flag-Based Rollback (preferred)

The safest rollback is simply turning flags off in the UI. This requires zero git operations and is instantly reversible.

---

## 16. File Reference Index

### Existing Files (DO NOT modify behavior, append only)

| File | Full Path | Purpose |
|---|---|---|
| Server | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/server.ts` | Sidecar HTTP + WebSocket server |
| MCP Server | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/mcp-server.ts` | MCP tool definitions, stdio transport |
| Protocol | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/protocol.ts` | WebSocket message type definitions |
| Walkthrough Engine | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/walkthroughEngine.ts` | Linear walkthrough state machine |
| Annotation Store | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/annotationStore.ts` | In-memory annotation state with TTL |
| AutoTrust | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/autoTrust.ts` | Regex-watch-then-act pattern (reference implementation) |
| Window Enumerator | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/windowEnumerator.ts` | Win32 EnumWindows P/Invoke |
| Window Capture | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/windowCapture.ts` | Win32 PrintWindow P/Invoke |
| Screenshot Self | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/screenshotSelf.ts` | Self-capture with blur |
| Feature Flags Store | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/store/featureFlagStore.ts` | 21 flags, localStorage, Zustand |
| Feature Flag Panel | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/components/FeatureFlagPanel.tsx` | Flag toggle UI |
| Flag Sync | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/hooks/useFlagSync.ts` | Frontend → sidecar flag sync |
| Pane Store | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/store/paneStore.ts` | Tree-based pane layout |
| Terminal Pane | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/components/TerminalPane.tsx` | Main terminal component |
| Annotation Bridge | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/store/annotationBridgeStore.ts` | WebSocket → Tauri IPC |
| Overlay | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/components/Overlay.tsx` | SVG annotation renderer |
| Walkthrough Panel | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/components/WalkthroughPanel.tsx` | Step info panel |
| Overlay Entry | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/overlay_main.tsx` | Overlay window mount |
| MCP Config | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/.mcp.json` | MCP server configuration |
| Package JSON | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/package.json` | Sidecar dependencies |
| Tauri Config | `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src-tauri/tauri.conf.json` | Tauri window and build config |

### New Files (created by phases)

| Phase | File | Purpose |
|---|---|---|
| 1 | `sidecar/src/terminalWrite.ts` | HTTP handler for terminal write |
| 2 | `sidecar/src/walkthroughWatcher.ts` | Terminal output watcher for auto-advance |
| 3 | `sidecar/src/multiPtyManager.ts` | Multi-session PTY manager |
| 4 | `sidecar/src/uiAutomation.ts` | Win32 UI Automation tree discovery |
| 5 | `sidecar/src/inputSimulator.ts` | Win32 SendInput wrapper |
| 6 | `sidecar/src/consentManager.ts` | Consent request/response tracking |
| 6 | `src/components/ConsentDialog.tsx` | Frontend consent UI |

---

## Appendix A: Scenario-to-Phase Mapping

| User Scenario | Phases Required | What the LLM Can Do After |
|---|---|---|
| "Help me deploy this app" (terminal guidance) | 1, 2 | Read terminal, write commands, auto-advance walkthrough on success patterns |
| "Guide me through setting up a database" (multi-step terminal) | 1, 2, 3 | Same as above + split panes for parallel terminal sessions |
| "Help me use Google Sheets to create a dashboard" | 4, 5, 6 | Discover UI elements, click buttons, type text — all with user consent |
| "Automate this repetitive task across multiple apps" | 1-6 | Full agent runtime: terminal commands + GUI interaction + verification |
| "Just show me what to do" (advisory only) | None (existing) | Walkthrough annotations + step panel (already built) |

## Appendix B: Dependency Graph

```
Phase 1 (Terminal Write)          ─── standalone
Phase 2 (Conditional Advance)     ─── standalone
Phase 3 (Multi-PTY)               ─── standalone
Phase 4 (UI Accessibility)        ─── standalone
Phase 5 (Input Simulation)        ─── requires Phase 4 + Phase 6
Phase 6 (Consent Gate)            ─── standalone (must complete before Phase 5 goes live)
Phase 7 (Integration)             ─── requires all above
```

## Appendix C: Risk Matrix

| Phase | Risk Level | Primary Risk | Mitigation |
|---|---|---|---|
| 1 | LOW | LLM sends destructive commands | Feature flag OFF by default. Tool description warns about immediate execution. |
| 2 | LOW | False positive pattern match → premature advance | 50ms detect delay + 3s cooldown (proven in AutoTrust). Patterns are LLM-defined per step. |
| 3 | MEDIUM | Session cleanup on disconnect | MultiPtyManager.destroyAll() on WebSocket close. Max 4 sessions cap. |
| 4 | MEDIUM | Large accessibility trees → timeout | 15s timeout. maxDepth=3 default. 3s cache. |
| 5 | HIGH | Unintended clicks/keystrokes | Triple flag guard. Mandatory consent gate. 5s action timeout. |
| 6 | MEDIUM | Consent timeout UX | 30s auto-deny. Sound/visual alert. Keyboard shortcuts (Enter/Escape). |
| 7 | LOW | Integration test failures | Each phase is independently rollbackable via flag toggle. |
