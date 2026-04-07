# Enhanced Agent Capabilities — Implementation Plan

> **Document type:** Self-contained, multi-conversation implementation plan
> **Created:** 2026-04-04
> **Repository:** https://github.com/zeroappam2day/chat-overlay-widget.git
> **Branch:** `main`
> **Working directory:** `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget`

---

## INITIALIZING PROMPT (copy-paste into every new conversation)

```
You are implementing the Enhanced Agent Capabilities plan for the Chat Overlay Widget.

REPOSITORY: https://github.com/zeroappam2day/chat-overlay-widget.git
WORKING DIR: C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget
PLAN LOCATION: docs/TEMP/ENHANCED_AGENT_CAPABILITIES_PLAN.md

INSTRUCTIONS:
1. Read the plan file above FIRST.
2. Find the NEXT phase with status "PENDING" in the Progress Tracker.
3. Read the MANDATORY PRE-FLIGHT section before writing any code.
4. Implement ONLY that one phase. Do not skip ahead.
5. Follow the EXACT file paths, patterns, and code conventions documented.
6. After implementation: run tests, verify the feature flag toggle works, update the Progress Tracker status to "DONE", and write handover notes in the designated section.
7. Create an atomic git commit with message format: "feat(eac-N): <description>" where N is the phase number.
8. Do NOT modify any existing code that is not part of the current phase. All new features are ADDITIVE — behind new feature flags, new files, new endpoints. Zero breakage to existing functionality.

CRITICAL RULES:
- Every new feature MUST have a feature flag (default OFF) in featureFlagStore.ts
- Every new flag MUST be added to useFlagSync.ts for sidecar sync
- Every new sidecar endpoint MUST check its feature flag before executing
- Every new MCP tool MUST follow the existing registration pattern in mcp-server.ts
- The app uses Tauri v1.8 (NOT v2, NOT Electron). Do not use Tauri v2 APIs.
- Platform: Windows 11 only. Shell: PowerShell primary.
- Node.js sidecar runs node-pty. Frontend is React 18 + Zustand + xterm.js 5.x.
- All WebSocket messages go through protocol.ts (both sidecar/src/protocol.ts and src/protocol.ts must stay in sync).
```

---

## MANDATORY PRE-FLIGHT (read before every phase)

### Existing Architecture (do NOT change)

```
Frontend (React/Vite)          Sidecar (Node.js)           OS
  src/                           sidecar/src/
  ├── store/                     ├── server.ts        ← HTTP + WebSocket server
  │   └── featureFlagStore.ts    ├── mcp-server.ts    ← MCP tool registration (thin HTTP proxy)
  ├── hooks/                     ├── protocol.ts      ← WebSocket message types
  │   └── useFlagSync.ts         ├── ptySession.ts    ← PTY shell wrapper
  ├── components/                ├── multiPtyManager.ts
  │   ├── TerminalPane.tsx       ├── annotationStore.ts
  │   ├── Overlay.tsx            ├── walkthroughEngine.ts
  │   ├── ConsentDialog.tsx      ├── inputSimulator.ts
  │   └── FeatureFlagPanel.tsx   ├── uiAutomation.ts
  └── protocol.ts                └── consentManager.ts
```

### Pattern: Adding a New Feature (checklist)

1. **Feature flag** — add to `src/store/featureFlagStore.ts`:
   - Add to `FeatureFlags` interface (line ~4-32)
   - Add default in `defaults` object (line ~45-73) — always `false` for agent features
   - Add to `localStorage.setItem` serialization block (line ~88-117)

2. **Flag sync** — add to `src/hooks/useFlagSync.ts`:
   - Add `useFeatureFlagStore(s => s.yourFlag)` selector (line ~11-17)
   - Add to the `sendMessage` call's `flags` object (line ~25)
   - Add to the `useEffect` dependency array (line ~27)

3. **Sidecar flag storage** — add to `sidecar/src/server.ts`:
   - Add to `sidecarFlags` object (search for `const sidecarFlags`)
   - The `set-flags` handler uses `Object.assign` so it auto-applies

4. **HTTP endpoint** — add to `sidecar/src/server.ts`:
   - Follow existing pattern: check `sidecarFlags.yourFlag` first, return 403 if disabled
   - Parse request, process, return JSON

5. **MCP tool** — add to `sidecar/src/mcp-server.ts`:
   - Use `server.tool('name', 'description', { ...zod schema }, async handler)`
   - Handler reads discovery file, makes HTTP call to sidecar, returns result

6. **Protocol types** — add to BOTH `sidecar/src/protocol.ts` AND `src/protocol.ts`

7. **Frontend component** — add to `src/components/`, conditionally render behind feature flag

### Key File Paths (absolute)

| File | Purpose |
|------|---------|
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/store/featureFlagStore.ts` | Feature flag definitions + defaults |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/hooks/useFlagSync.ts` | Frontend-to-sidecar flag sync |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/server.ts` | HTTP/WS server + flag gating |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/mcp-server.ts` | MCP tool registration (10 existing tools) |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/protocol.ts` | Sidecar WebSocket message types |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/protocol.ts` | Frontend WebSocket message types |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src/components/FeatureFlagPanel.tsx` | UI for toggling flags |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/src-tauri/tauri.conf.json` | Tauri window/allowlist config |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/.mcp.json` | MCP server config for Claude Code |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/annotationStore.ts` | Annotation state (in-memory) |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/walkthroughEngine.ts` | Walkthrough step orchestration |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/walkthroughWatcher.ts` | Terminal pattern auto-advance |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/inputSimulator.ts` | Win32 SendInput via PowerShell |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/uiAutomation.ts` | Windows UI Automation tree |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/consentManager.ts` | Consent request/response flow |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/multiPtyManager.ts` | Multi-PTY session manager |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/terminalBuffer.ts` | Terminal ring buffer |
| `C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/src/discoveryFile.ts` | api.port discovery file |

### Existing Feature Flags (31 total — 23 original + 8 EAC)

| Flag | Default | Phase |
|------|---------|-------|
| outputBatching | true | Phase 1 |
| autoTrust | false | Phase 2 |
| planWatcher | true | Phase 3 |
| diffViewer | true | Phase 4 |
| terminalBookmarks | true | Phase 5 |
| promptHistory | true | Phase 6 |
| exitNotifications | true | Phase 7 |
| keyboardNavigation | true | Phase 8 |
| inactivePaneDimming | false | Phase 9 |
| enhancedPersistence | true | Phase 10 |
| annotationOverlay | false | Phase 11 |
| themePresets | true | Phase 12 |
| ctrlWheelZoom | true | Phase 13 |
| diffSearch | true | Phase 14 |
| diffSyntaxHighlight | true | Phase 15 |
| askAboutCode | true | Phase 16 |
| completionStats | true | Phase 17 |
| focusTrap | true | Phase 18 |
| githubUrlDetection | true | Phase 19 |
| inlineEditing | true | Phase 20 |
| errorBoundaries | true | Phase 21 |
| guidedWalkthrough | false | Annotation Phase 6 |
| terminalWriteMcp | false | Agent Runtime Phase 1 |
| conditionalAdvance | false | Agent Runtime Phase 2 |
| multiPty | false | Agent Runtime Phase 3 |
| uiAccessibility | false | Agent Runtime Phase 4 |
| osInputSimulation | false | Agent Runtime Phase 5 |
| consentGate | false | Agent Runtime Phase 6 |

### Existing MCP Tools (20 total — 11 original + 9 EAC)

1. `read_terminal_output` — Read terminal buffer
2. `query_session_history` — Query SQLite session history
3. `capture_screenshot` — Capture app window as WebP
4. `send_annotation` — Draw annotations on overlay
5. `start_guided_walkthrough` — Start multi-step walkthrough
6. `advance_walkthrough` — Move to next step
7. `stop_walkthrough` — Stop walkthrough
8. `write_terminal` — Send text to terminal (flag: `terminalWriteMcp`)
9. `get_ui_elements` — Discover UI elements (flag: `uiAccessibility`)
10. `send_input` — Simulate mouse/keyboard (flags: `osInputSimulation` + `uiAccessibility` + `consentGate`)

### Existing WebSocket Messages (protocol.ts)

**Client->Server:** `input`, `resize`, `spawn`, `kill`, `history-list`, `history-replay`, `save-image`, `list-windows-with-thumbnails`, `capture-window-with-metadata`, `set-flags`, `plan-read`, `request-diff`, `ask-code`, `cancel-ask-code`, `annotations`, `consent-response`

**Server->Client:** `output`, `pty-ready`, `pty-exit`, `shell-list`, `error`, `session-start`, `history-sessions`, `history-chunk`, `history-end`, `save-image-result`, `window-thumbnails`, `capture-result-with-metadata`, `agent-event`, `auto-trust-event`, `plan-update`, `diff-result`, `ask-code-response`, `annotation-update`, `walkthrough-step`, `consent-request`

---

## PROGRESS TRACKER

| Phase | Name | Status | Conversation | Handover Notes |
|-------|------|--------|-------------|----------------|
| EAC-1 | Element-Bound Annotations | DONE | 2026-04-04 | See handover below |
| EAC-2 | Batch Consent & Trust Escalation | DONE | 2026-04-04 | See handover below |
| EAC-3 | Window Focus Manager | DONE | 2026-04-04 | See handover below |
| EAC-4 | Clipboard Integration | DONE | 2026-04-04 | See handover below |
| EAC-5 | Web Fetch & Documentation Tool | DONE | 2026-04-04 | See handover below |
| EAC-6 | Agent Task Orchestrator | DONE | 2026-04-04 | See handover below |
| EAC-7 | Screenshot-Based Step Verification | DONE | 2026-04-04 | See handover below |
| EAC-8 | Enhanced Accessibility Bridge | DONE | 2026-04-04 | See handover below |
| EAC-9 | Workflow Recording & Replay | DONE | 2026-04-04 | See handover below |
| EAC-10 | Integration Testing & Stress Test | PENDING | — | — |

---

## PHASE EAC-1: Element-Bound Annotations

**Problem:** Current annotations use fixed screen coordinates (`x`, `y`, `w`, `h`). When a user scrolls, resizes, or moves a window, annotations become stale and point to the wrong location. The overlay cannot track UI elements.

**Solution:** Add an `elementBinding` property to annotations that links them to a UI Automation element (by `automationId`, `name+role`, or `hwnd` coordinates). A periodic refresh cycle re-queries element positions and updates annotation coordinates.

**Feature flag:** `elementBoundAnnotations` (default: `false`)

**Depends on:** Existing `uiAccessibility` (Phase 4), `annotationOverlay` (Phase 11)

### Files to CREATE

#### `sidecar/src/elementTracker.ts`

Purpose: Periodically re-queries UI Automation for bound elements and updates annotation positions.

```
Class: ElementTracker
  - constructor(opts: { pollIntervalMs: number, annotationState: AnnotationState, uiAutomation: typeof import('./uiAutomation') })
  - start(): void — begins polling interval (default 500ms)
  - stop(): void — clears interval
  - bindAnnotation(annotationId: string, binding: ElementBinding): void
  - unbindAnnotation(annotationId: string): void
  - onPositionsUpdated: ((annotations: Annotation[]) => void) | undefined — callback for server.ts to broadcast

Interface: ElementBinding
  - strategy: 'automationId' | 'nameRole' | 'coordinates'
  - automationId?: string      — for 'automationId' strategy
  - name?: string              — for 'nameRole' strategy
  - role?: string              — for 'nameRole' strategy
  - hwnd?: number              — target window handle (required for all strategies)
  - offsetX?: number           — pixel offset from element top-left
  - offsetY?: number           — pixel offset from element top-left

Logic:
  1. Every pollIntervalMs, iterate all bound annotations
  2. For each, call uiAutomation.getElements(hwnd, maxDepth=3, roleFilter)
  3. Find matching element by strategy
  4. If found: update annotation x/y/w/h from element's bounding rect + offsets
  5. If NOT found: mark annotation with `stale: true` (do NOT delete — element may reappear)
  6. Fire onPositionsUpdated with updated annotations
```

### Files to MODIFY

#### `sidecar/src/annotationStore.ts`

Add to `Annotation` interface:
```typescript
elementBinding?: {
  strategy: 'automationId' | 'nameRole' | 'coordinates';
  automationId?: string;
  name?: string;
  role?: string;
  hwnd?: number;
  offsetX?: number;
  offsetY?: number;
};
stale?: boolean;  // true when bound element not found
```

Do NOT change any existing fields or behavior. The `elementBinding` field is optional — all existing annotations continue to work as before.

#### `sidecar/src/server.ts`

1. Add `elementBoundAnnotations: false` to `sidecarFlags` object
2. Import `ElementTracker` from `./elementTracker.js`
3. Instantiate `ElementTracker` after server starts
4. In the `set-flags` handler, start/stop tracker when flag changes
5. Wire `onPositionsUpdated` to `broadcastAnnotations()`
6. Add endpoint `POST /annotations/bind`:
   - Body: `{ annotationId: string, binding: ElementBinding }`
   - Returns: `{ ok: true }` or error
   - Gated by `elementBoundAnnotations` AND `uiAccessibility` flags

#### `sidecar/src/mcp-server.ts`

Add MCP tool #11: `bind_annotation_to_element`
- Params: `annotationId` (string), `strategy` ('automationId'|'nameRole'|'coordinates'), `automationId?`, `name?`, `role?`, `hwnd` (number), `offsetX?`, `offsetY?`
- Makes POST to `/annotations/bind`
- Returns: `{ ok: true, annotationId, strategy }`

#### `src/store/featureFlagStore.ts`

Add `elementBoundAnnotations: boolean` to `FeatureFlags` interface, `defaults` (false), and serialization block.

#### `src/hooks/useFlagSync.ts`

Add `elementBoundAnnotations` to flag sync.

#### `src/protocol.ts` and `sidecar/src/protocol.ts`

No new message types needed — uses existing `annotation-update` broadcast.

### Acceptance Criteria

- [ ] Annotations with `elementBinding` track their target element when the window scrolls/resizes
- [ ] Annotations without `elementBinding` behave exactly as before (no regression)
- [ ] Feature flag `elementBoundAnnotations` toggles tracking on/off at runtime
- [ ] MCP tool `bind_annotation_to_element` is callable when flags are enabled
- [ ] Stale annotations (element not found) get `stale: true` but are NOT deleted
- [ ] Polling stops when flag is OFF or no annotations are bound (no CPU waste)
- [ ] Unit test: `elementTracker.test.ts` with mock UI Automation responses

### Rollback

Set `elementBoundAnnotations: false`. The tracker stops, annotations revert to static coordinates. No data loss. Remove the feature by deleting `elementTracker.ts` and reverting the additions to the 5 modified files.

---

## PHASE EAC-2: Batch Consent & Trust Escalation

**Problem:** Every `send_input` action requires individual user consent via modal dialog (30s timeout). A Google Sheets macro creation needing 30+ actions means 30+ modal approvals. This makes multi-step GUI automation impractical.

**Solution:** Add three consent modes: (1) per-action (existing), (2) batch consent (approve a plan of N actions upfront), (3) time-limited trust (approve all actions for a window for N seconds). All modes go through the existing `ConsentManager` and `ConsentDialog`.

**Feature flag:** `batchConsent` (default: `false`)

**Depends on:** Existing `consentGate` (Agent Runtime Phase 6)

### Files to CREATE

#### `sidecar/src/batchConsentManager.ts`

Purpose: Manages batch consent plans and time-limited trust windows.

```
Class: BatchConsentManager
  - constructor(consentManager: ConsentManager)
  
  Batch Consent:
  - submitPlan(plan: ActionPlan): Promise<BatchConsentResult>
    - ActionPlan: { planId: string, description: string, actions: ConsentAction[], targetWindow?: string }
    - Sends entire plan to frontend for review
    - User approves/denies the whole plan
    - Returns: { approved: boolean, planId: string }
  - isActionPreApproved(planId: string, actionIndex: number): boolean
    - Returns true if the plan was approved and this action hasn't been consumed yet
  - consumeAction(planId: string, actionIndex: number): void
    - Marks one action as used (cannot be reused)
  
  Time-Limited Trust:
  - grantTimeLimitedTrust(opts: { targetTitle: string, durationSec: number, allowedActions: string[] }): string
    - Returns trustId
    - Max duration: 120 seconds (hard cap, not configurable)
    - allowedActions: subset of ['click', 'type', 'keyCombo', 'drag']
  - isTrusted(targetTitle: string, actionType: string): boolean
    - Returns true if there's an active trust grant matching this target+action
  - revokeTrust(trustId: string): void
  - revokeAll(): void — called on disconnect/shutdown (safety)
  
  Safety Invariants:
  - Plans expire after 5 minutes if not fully consumed
  - Trust grants hard-capped at 120 seconds (2 minutes)
  - Each approved action in a plan can only be consumed ONCE
  - revokeAll() on WebSocket disconnect (user closed app)
  - Plans store action descriptions for audit log
```

### Files to MODIFY

#### `sidecar/src/server.ts`

1. Add `batchConsent: false` to `sidecarFlags`
2. Import `BatchConsentManager`
3. Instantiate and wire to existing `consentManager`
4. Add endpoints:
   - `POST /consent/submit-plan` — Submit batch action plan for approval
     - Body: `{ planId, description, actions: ConsentAction[], targetWindow? }`
     - Gated by `batchConsent` AND `consentGate`
     - Broadcasts `consent-plan-request` to frontend
   - `POST /consent/grant-trust` — Request time-limited trust
     - Body: `{ targetTitle, durationSec, allowedActions }`
     - Gated by `batchConsent` AND `consentGate`
     - Broadcasts `consent-trust-request` to frontend
   - `POST /consent/revoke` — Revoke trust or plan
     - Body: `{ trustId?: string, planId?: string }`
5. Modify the `send-input` endpoint: before falling through to per-action consent, check if action is pre-approved (batch) or trusted (time-limited)

#### `sidecar/src/protocol.ts` and `src/protocol.ts`

Add to ServerMessage:
```typescript
| { type: 'consent-plan-request'; planId: string; description: string; actions: ConsentAction[]; targetWindow?: string }
| { type: 'consent-trust-request'; trustId: string; targetTitle: string; durationSec: number; allowedActions: string[] }
| { type: 'consent-trust-active'; trustId: string; expiresAt: number }
| { type: 'consent-trust-expired'; trustId: string }
```

Add to ClientMessage:
```typescript
| { type: 'consent-plan-response'; planId: string; approved: boolean }
| { type: 'consent-trust-response'; trustId: string; approved: boolean }
```

#### `src/components/ConsentDialog.tsx`

Extend to handle two new modes (keep existing per-action mode unchanged):

- **Plan review mode:** Shows a scrollable list of all planned actions with descriptions. Single "Approve Plan" / "Deny Plan" button pair. Still has 30s timeout.
- **Trust request mode:** Shows target window, duration, allowed actions. "Grant Trust" / "Deny" with countdown showing how long trust will last.
- **Active trust indicator:** Small persistent badge in corner showing "Trusted: [window] — Xs remaining" with a "Revoke" button.

#### `sidecar/src/mcp-server.ts`

Add MCP tool #12: `submit_action_plan`
- Params: `planId`, `description`, `actions[]` (each with type, description, coordinates, target), `targetWindow?`
- Makes POST to `/consent/submit-plan`
- Returns: `{ approved, planId }`

Add MCP tool #13: `request_trust_window`
- Params: `targetTitle`, `durationSec` (1-120), `allowedActions[]`
- Makes POST to `/consent/grant-trust`
- Returns: `{ approved, trustId, expiresAt }`

#### `src/store/featureFlagStore.ts`

Add `batchConsent: boolean` (default: false) to interface, defaults, serialization.

#### `src/hooks/useFlagSync.ts`

Add `batchConsent` to sync.

### Acceptance Criteria

- [ ] Batch plan: LLM submits 10 actions → user sees all 10 → one approval → all 10 execute without further prompts
- [ ] Time-limited trust: LLM requests 60s trust for "Google Sheets" → user approves → clicks/types work without prompts for 60s → auto-expires
- [ ] Per-action consent still works identically when `batchConsent` is OFF
- [ ] Trust hard-caps at 120 seconds (server rejects >120)
- [ ] Each batch action consumed exactly once (no replay)
- [ ] Trust auto-revokes on WebSocket disconnect
- [ ] Active trust shows visual indicator in frontend
- [ ] Unit tests for `batchConsentManager.ts`

### Rollback

Set `batchConsent: false`. All calls fall through to existing per-action consent. No data loss.

---

## PHASE EAC-3: Window Focus Manager

**Problem:** `inputSimulator.ts` sends clicks/keys to absolute screen coordinates via `SendInput`, but never ensures the target window is in the foreground. If another window overlaps, input goes to the wrong place.

**Solution:** Add a window focus module that calls `SetForegroundWindow` before every input action, and verifies the target window is active after focusing.

**Feature flag:** `windowFocusManager` (default: `false`)

**Depends on:** Existing `osInputSimulation` (Agent Runtime Phase 5)

### Files to CREATE

#### `sidecar/src/windowFocusManager.ts`

Purpose: Focus target window before input simulation.

```
Functions (all via PowerShell P/Invoke, same pattern as inputSimulator.ts):

focusWindow(hwnd: number): Promise<{ ok: boolean; error?: string }>
  - Calls SetForegroundWindow(hwnd) via PowerShell
  - If fails: tries AllowSetForegroundWindow + retry
  - Timeout: 3 seconds
  - Returns success/failure

getActiveWindowHwnd(): Promise<number>
  - Calls GetForegroundWindow() via PowerShell
  - Returns hwnd of currently active window

verifyFocus(expectedHwnd: number): Promise<boolean>
  - Calls getActiveWindowHwnd(), compares to expected
  - Returns true if match

focusAndVerify(hwnd: number, maxRetries: number = 2): Promise<{ ok: boolean; error?: string }>
  - focusWindow(hwnd)
  - verifyFocus(hwnd)
  - Retry up to maxRetries if verification fails (with 200ms delay)
  - Returns success/failure with error detail

PowerShell P/Invoke signatures (Win32):
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool AllowSetForegroundWindow(int dwProcessId);
```

### Files to MODIFY

#### `sidecar/src/server.ts`

1. Add `windowFocusManager: false` to `sidecarFlags`
2. In the `POST /send-input` handler, AFTER consent check but BEFORE calling `inputSimulator`:
   - If `windowFocusManager` flag is ON and request has `hwnd` or `target`:
     - Resolve hwnd (if `target` title given, look up via `windowEnumerator`)
     - Call `focusAndVerify(hwnd)`
     - If focus fails: return 409 with `{ error: 'Could not focus target window', hwnd }`
     - If focus succeeds: proceed to input simulation
   - If flag is OFF: proceed without focus (existing behavior unchanged)
3. Add endpoint `POST /focus-window`:
   - Body: `{ hwnd?: number, title?: string }`
   - Gated by `windowFocusManager`
   - Calls `focusAndVerify`, returns result

#### `sidecar/src/mcp-server.ts`

Add MCP tool #14: `focus_window`
- Params: `hwnd?` (number), `title?` (string) — one required
- Makes POST to `/focus-window`
- Returns: `{ ok, hwnd, activeTitle }`

Modify existing `send_input` tool description to note: "When windowFocusManager is enabled, automatically focuses the target window before executing the action."

#### `src/store/featureFlagStore.ts`

Add `windowFocusManager: boolean` (default: false).

#### `src/hooks/useFlagSync.ts`

Add `windowFocusManager` to sync.

### Acceptance Criteria

- [ ] When flag ON: target window is focused before every send_input action
- [ ] When flag OFF: existing behavior unchanged (no focus management)
- [ ] Focus verification retries up to 2 times with 200ms delay
- [ ] If focus fails: input is NOT sent, clear error returned
- [ ] `focus_window` MCP tool works standalone (focus without input)
- [ ] Works with hwnd (direct) and title (lookup via windowEnumerator)
- [ ] Unit test with mock PowerShell responses

### Rollback

Set `windowFocusManager: false`. Focus management skipped. No data loss.

---

## PHASE EAC-4: Clipboard Integration

**Problem:** No clipboard read/write capability. For complex data entry (formulas, bulk text), the LLM must type character-by-character via SendInput. This is slow, error-prone, and fails for special characters.

**Solution:** Add clipboard read/write via PowerShell, plus a paste action in the input simulator.

**Feature flag:** `clipboardAccess` (default: `false`)

**Depends on:** Existing `osInputSimulation` (Agent Runtime Phase 5), `consentGate` (Agent Runtime Phase 6)

### Files to CREATE

#### `sidecar/src/clipboardManager.ts`

Purpose: Read/write Windows clipboard via PowerShell.

```
Functions:

readClipboard(): Promise<{ ok: boolean; text?: string; error?: string }>
  - PowerShell: Get-Clipboard -Format Text
  - Max 100KB text (truncate with warning if larger)
  - Timeout: 3 seconds

writeClipboard(text: string): Promise<{ ok: boolean; error?: string }>
  - PowerShell: Set-Clipboard -Value $text
  - Max 100KB text (reject if larger)
  - Timeout: 3 seconds
  - Text is passed via stdin pipe (NOT command-line arg) to avoid shell injection

pasteFromClipboard(): Promise<{ ok: boolean; error?: string }>
  - Writes text to clipboard, then sends Ctrl+V via inputSimulator
  - Combines writeClipboard + keyCombo(['ctrl', 'v'])
  - Requires consent (goes through consentManager)

Safety:
  - NEVER log clipboard contents (may contain passwords)
  - Clear clipboard after paste if clearAfterPaste option is true
  - All PowerShell invocations are isolated (spawnSync, no shell state)
```

### Files to MODIFY

#### `sidecar/src/server.ts`

1. Add `clipboardAccess: false` to `sidecarFlags`
2. Add endpoints:
   - `GET /clipboard` — Read clipboard text
     - Gated by `clipboardAccess`
     - Returns: `{ text: string }` or error
   - `POST /clipboard` — Write clipboard text
     - Body: `{ text: string }`
     - Gated by `clipboardAccess`
   - `POST /clipboard/paste` — Write to clipboard + Ctrl+V
     - Body: `{ text: string, clearAfterPaste?: boolean }`
     - Gated by `clipboardAccess` AND `osInputSimulation` AND `consentGate`
     - Goes through consent flow (user approves the paste action)

#### `sidecar/src/inputSimulator.ts`

Add `paste` action type:
```typescript
// In the action handler switch:
case 'paste':
  // Handled by clipboardManager.pasteFromClipboard()
  // This is a convenience — the actual Ctrl+V is sent via existing keyCombo
```

#### `sidecar/src/mcp-server.ts`

Add MCP tool #15: `clipboard`
- Params: `action` ('read'|'write'|'paste'), `text?` (for write/paste), `clearAfterPaste?` (boolean)
- read: GET /clipboard
- write: POST /clipboard
- paste: POST /clipboard/paste (goes through consent)
- Returns: `{ ok, text? }` or error

#### `src/store/featureFlagStore.ts`

Add `clipboardAccess: boolean` (default: false).

#### `src/hooks/useFlagSync.ts`

Add `clipboardAccess` to sync.

### Acceptance Criteria

- [ ] Read clipboard text via MCP tool
- [ ] Write text to clipboard via MCP tool
- [ ] Paste (write + Ctrl+V) goes through consent flow
- [ ] Clipboard contents never logged
- [ ] Max 100KB text enforced
- [ ] `clearAfterPaste` option works
- [ ] Flag OFF: all clipboard endpoints return 403
- [ ] Shell injection prevented (text via stdin, not args)
- [ ] Unit test for clipboardManager

### Rollback

Set `clipboardAccess: false`. All endpoints return 403. No data loss.

---

## PHASE EAC-5: Web Fetch & Documentation Tool

**Problem:** The app has zero external information retrieval. If the LLM needs to look up API documentation, tutorials, or reference material (e.g., Google Sheets API, Windows COM automation), it has no way to do so through the MCP server.

**Solution:** Add a web fetch MCP tool that retrieves web pages and extracts readable text. NOT a browser — a server-side HTTP fetch with HTML-to-text conversion. Rate-limited, domain-allowlisted, cached.

**Feature flag:** `webFetchTool` (default: `false`)

**Depends on:** Nothing (standalone)

### Files to CREATE

#### `sidecar/src/webFetcher.ts`

Purpose: Fetch web pages, extract readable text, cache results.

```
Class: WebFetcher
  constructor(opts?: { 
    maxResponseSizeBytes?: number,  // default 2MB
    timeoutMs?: number,             // default 10000
    maxCacheEntries?: number,       // default 50
    cacheTtlMs?: number,            // default 300000 (5 min)
  })

  fetch(url: string, opts?: { extractText?: boolean }): Promise<WebFetchResult>
    - Uses Node.js built-in `fetch()` (Node 18+) — NO new dependencies
    - Validates URL: must be https:// (http:// rejected)
    - Validates not a private/internal IP (127.x, 10.x, 192.168.x, 172.16-31.x)
    - Sets User-Agent: 'ChatOverlayWidget/0.1 (documentation-fetch)'
    - If extractText: strips HTML tags, extracts <main>/<article>/<body> text content
    - HTML-to-text: regex-based tag stripping + entity decoding (no new dependency)
    - Truncates result to 50KB text (with truncation notice)
    - Caches by URL for cacheTtlMs
    - Returns: { ok, url, statusCode, contentType, text, truncated, cached, error? }

  clearCache(): void

  Safety:
    - HTTPS only (no HTTP, no file://, no ftp://)
    - No private IPs (SSRF protection)
    - Max 2MB response size
    - 10-second timeout
    - Rate limit: max 10 requests per minute (rolling window)
    - No cookies, no sessions, no authentication forwarding
    - Response text is sanitized (no script tags in returned text)

  HTML-to-text extraction (built-in, no dependency):
    1. Find <main> or <article> or <body> content
    2. Remove <script>, <style>, <nav>, <header>, <footer> blocks
    3. Replace <br>, <p>, <div>, <li> with newlines
    4. Strip remaining HTML tags
    5. Decode common HTML entities (&amp; &lt; &gt; &quot; &nbsp;)
    6. Collapse whitespace
    7. Truncate to 50KB
```

### Files to MODIFY

#### `sidecar/src/server.ts`

1. Add `webFetchTool: false` to `sidecarFlags`
2. Import `WebFetcher`
3. Instantiate on server start
4. Add endpoint `POST /web-fetch`:
   - Body: `{ url: string, extractText?: boolean }`
   - Gated by `webFetchTool`
   - Returns: `{ ok, url, statusCode, text, truncated, cached }`

#### `sidecar/src/mcp-server.ts`

Add MCP tool #16: `web_fetch`
- Params: `url` (string, must be https://), `extractText?` (boolean, default true)
- Description: "Fetch a web page and extract readable text. Use for documentation lookups, API references, tutorials. HTTPS only, max 50KB text, 5-minute cache."
- Makes POST to `/web-fetch`
- Returns: text content or error

#### `src/store/featureFlagStore.ts`

Add `webFetchTool: boolean` (default: false).

#### `src/hooks/useFlagSync.ts`

Add `webFetchTool` to sync.

### Acceptance Criteria

- [ ] MCP tool `web_fetch` retrieves web pages and returns readable text
- [ ] HTTPS-only enforced (HTTP rejected with clear error)
- [ ] SSRF protection: private IPs rejected
- [ ] Rate limit: 10 requests/minute
- [ ] 2MB max response, 50KB max extracted text
- [ ] 5-minute cache (same URL returns cached result)
- [ ] HTML-to-text extraction removes scripts, styles, nav
- [ ] No new npm dependencies (uses Node built-in fetch)
- [ ] Flag OFF: endpoint returns 403
- [ ] Unit test with mock HTTP responses

### Rollback

Set `webFetchTool: false`. Endpoint returns 403. Cache cleared on restart. No data loss.

---

## PHASE EAC-6: Agent Task Orchestrator

**Problem:** Multi-PTY exists (up to 4 shells), but there's no task management layer. The LLM must manually `write_terminal` to each pane and poll `read_terminal_output` to check results. No callbacks, no job tracking, no error detection.

**Solution:** Add a task orchestrator that manages named tasks across PTY sessions, tracks their lifecycle (pending → running → completed/failed), detects completion via output patterns, and provides a single MCP tool to check all task statuses.

**Feature flag:** `agentTaskOrchestrator` (default: `false`)

**Depends on:** Existing `multiPty` (Agent Runtime Phase 3), `terminalWriteMcp` (Agent Runtime Phase 1)

### Files to CREATE

#### `sidecar/src/taskOrchestrator.ts`

Purpose: Named task management across PTY sessions.

```
Class: TaskOrchestrator
  constructor(opts: { multiPtyManager: MultiPtyManager, maxTasks: number = 20 })

  Interface: AgentTask {
    taskId: string;           // UUID
    name: string;             // human-readable name
    paneId: string;           // which PTY session
    command: string;          // the shell command
    status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
    createdAt: number;        // timestamp
    startedAt?: number;
    completedAt?: number;
    exitPattern?: string;     // regex to detect completion in terminal output
    failPattern?: string;     // regex to detect failure
    timeoutMs?: number;       // max runtime (default 300000 = 5 min)
    lastOutput?: string;      // last 500 chars of output (for status check)
    exitCode?: number;        // if PTY exits
  }

  submitTask(opts: {
    name: string;
    command: string;
    paneId: string;
    exitPattern?: string;     // e.g., "\\$ $" (shell prompt returned)
    failPattern?: string;     // e.g., "error|Error|FAILED"
    timeoutMs?: number;
  }): Promise<{ taskId: string; status: 'pending' }>
    - Creates task, writes command to PTY via terminal write
    - Monitors PTY output for exit/fail patterns
    - Auto-completes on PTY exit event

  getTask(taskId: string): AgentTask | undefined

  getAllTasks(): AgentTask[]

  cancelTask(taskId: string): Promise<void>
    - Sends Ctrl+C to the PTY session

  onTaskStateChange: ((task: AgentTask) => void) | undefined
    - Called when any task changes status

  Lifecycle:
    - Tasks start as 'pending', move to 'running' when command is written
    - Monitor PTY output chunks (subscribe to session output)
    - If exitPattern matches: status → 'completed'
    - If failPattern matches: status → 'failed'
    - If PTY exits: status → 'completed' or 'failed' based on exit code
    - If timeout: status → 'timeout', Ctrl+C sent
    - Completed tasks kept for 10 minutes then auto-cleaned
```

### Files to MODIFY

#### `sidecar/src/server.ts`

1. Add `agentTaskOrchestrator: false` to `sidecarFlags`
2. Import `TaskOrchestrator`
3. Instantiate with multiPtyManager
4. Wire `onTaskStateChange` to broadcast `task-state-change` via WebSocket
5. Add endpoints:
   - `POST /tasks/submit` — Submit a task
     - Body: `{ name, command, paneId, exitPattern?, failPattern?, timeoutMs? }`
     - Gated by `agentTaskOrchestrator` AND `multiPty` AND `terminalWriteMcp`
   - `GET /tasks` — List all tasks
     - Gated by `agentTaskOrchestrator`
   - `GET /tasks/:taskId` — Get specific task
   - `POST /tasks/:taskId/cancel` — Cancel a task

#### `sidecar/src/protocol.ts` and `src/protocol.ts`

Add to ServerMessage:
```typescript
| { type: 'task-state-change'; task: { taskId: string; name: string; status: string; paneId: string; lastOutput?: string } }
```

#### `sidecar/src/mcp-server.ts`

Add MCP tool #17: `manage_tasks`
- Params: `action` ('submit'|'list'|'get'|'cancel'), `taskId?`, `name?`, `command?`, `paneId?`, `exitPattern?`, `failPattern?`, `timeoutMs?`
- submit: POST /tasks/submit
- list: GET /tasks
- get: GET /tasks/{taskId}
- cancel: POST /tasks/{taskId}/cancel
- Returns: task object(s) with current status

#### `src/store/featureFlagStore.ts`

Add `agentTaskOrchestrator: boolean` (default: false).

#### `src/hooks/useFlagSync.ts`

Add `agentTaskOrchestrator` to sync.

### Acceptance Criteria

- [ ] Submit a task → command runs in specified pane → task tracked
- [ ] Exit pattern detection → task auto-completes
- [ ] Fail pattern detection → task marked failed
- [ ] Timeout → task marked timeout + Ctrl+C sent
- [ ] List/get/cancel tasks via MCP tool
- [ ] Task state changes broadcast via WebSocket
- [ ] Max 20 concurrent tasks
- [ ] Completed tasks auto-cleaned after 10 minutes
- [ ] Flags OFF: all endpoints return 403
- [ ] Unit test for TaskOrchestrator lifecycle

### Rollback

Set `agentTaskOrchestrator: false`. All endpoints return 403. Running tasks continue in their PTY sessions but are no longer tracked. No data loss.

---

## PHASE EAC-7: Screenshot-Based Step Verification

**Problem:** Walkthrough advancement is terminal-regex-only. For GUI tasks (clicking buttons, filling forms), there's no way to verify a step succeeded. Screenshots exist but aren't used for verification.

**Solution:** Add an `advanceWhen` strategy that captures a screenshot after each action and asks the LLM (via a callback) whether the step was completed. Also add a simpler pixel-sampling strategy for deterministic checks.

**Feature flag:** `screenshotVerification` (default: `false`)

**Depends on:** Existing `capture_screenshot` (MCP tool #3), `guidedWalkthrough`

### Files to CREATE

#### `sidecar/src/screenshotVerifier.ts`

Purpose: Verify walkthrough step completion via screenshot analysis.

```
Class: ScreenshotVerifier
  constructor(opts: { screenshotFn: () => Promise<Buffer> })

  Strategy 1 — Pixel Sampling:
  verifyPixelSample(opts: {
    regions: Array<{ x: number; y: number; w: number; h: number; expectedColor?: string; minBrightness?: number }>;
  }): Promise<{ passed: boolean; results: Array<{ region, passed, actualColor? }> }>
    - Uses sharp to sample specific pixel regions from screenshot
    - Checks if region matches expected color (hex, tolerance +-15)
    - Checks brightness thresholds (e.g., "is this region not black?")
    - Deterministic, fast, no LLM needed

  Strategy 2 — Screenshot Diff:
  verifyScreenshotDiff(opts: {
    referenceScreenshot: Buffer;
    diffThreshold: number;     // 0-1, percentage of pixels that can differ
    maskRegions?: Array<{ x, y, w, h }>;  // ignore these regions (dynamic content)
  }): Promise<{ passed: boolean; diffPercentage: number }>
    - Compares current screenshot to a reference
    - Uses sharp for pixel-level comparison
    - Masks specified regions (clocks, dynamic text)
    - Passes if diff below threshold

  Strategy 3 — Content Check (returns data for LLM to evaluate):
  captureForVerification(opts?: {
    cropRegion?: { x, y, w, h };
  }): Promise<{ screenshot: Buffer; width: number; height: number }>
    - Captures and optionally crops screenshot
    - Returns raw image data for LLM vision analysis
    - The MCP tool returns this as an image content block
```

### Files to MODIFY

#### `sidecar/src/walkthroughEngine.ts`

Extend `AdvanceWhenSchema` to support new strategies:
```typescript
export const AdvanceWhenSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('terminal-match'), pattern: z.string().min(1).max(500) }),
  z.object({ type: z.literal('pixel-sample'), regions: z.array(z.object({
    x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    expectedColor: z.string().optional(), minBrightness: z.number().optional(),
  })).min(1).max(10) }),
  z.object({ type: z.literal('screenshot-diff'), diffThreshold: z.number().min(0).max(1),
    maskRegions: z.array(z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })).optional() }),
  z.object({ type: z.literal('manual') }),  // LLM calls advance_walkthrough explicitly
]).optional();
```

This is backward compatible — existing `terminal-match` type still works. The `.optional()` means steps without `advanceWhen` also still work.

#### `sidecar/src/server.ts`

1. Add `screenshotVerification: false` to `sidecarFlags`
2. Import `ScreenshotVerifier`
3. Wire verifier to walkthrough engine's step advancement
4. Add endpoint `POST /walkthrough/verify-step`:
   - Gated by `screenshotVerification` AND `guidedWalkthrough`
   - Runs the current step's advanceWhen verification
   - Returns: `{ passed, details }`

#### `sidecar/src/mcp-server.ts`

Add MCP tool #18: `verify_walkthrough_step`
- Params: none (verifies current active step)
- Makes POST to `/walkthrough/verify-step`
- Returns: `{ passed, strategy, details }` + screenshot image if strategy is 'content-check'

#### `src/store/featureFlagStore.ts`

Add `screenshotVerification: boolean` (default: false).

#### `src/hooks/useFlagSync.ts`

Add `screenshotVerification` to sync.

### Acceptance Criteria

- [ ] Pixel sampling: verifies specific regions match expected colors
- [ ] Screenshot diff: compares to reference with tolerance and masking
- [ ] Content check: returns cropped screenshot for LLM vision analysis
- [ ] Existing terminal-match strategy unchanged
- [ ] Manual advance still works (no advanceWhen required)
- [ ] MCP tool returns verification result + image
- [ ] Flag OFF: endpoint returns 403, walkthrough works as before
- [ ] Unit test with mock screenshots

### Rollback

Set `screenshotVerification: false`. Walkthrough uses only terminal-match and manual advance. No data loss.

---

## PHASE EAC-8: Enhanced Accessibility Bridge

**Problem:** `uiAutomation.ts` uses Windows UI Automation, but web apps (Google Sheets in Chrome) expose a flat, opaque accessibility tree. Complex web UIs don't map well to Win32 accessibility. Also no way to interact with elements by their automation properties (invoke, setValue) — only by coordinates.

**Solution:** Enhance the accessibility bridge with (1) deeper tree traversal for Chromium-based apps, (2) pattern-based element search, and (3) UI Automation Invoke/SetValue patterns for richer interaction.

**Feature flag:** `enhancedAccessibility` (default: `false`)

**Depends on:** Existing `uiAccessibility` (Agent Runtime Phase 4)

### Files to CREATE

#### `sidecar/src/enhancedAccessibility.ts`

Purpose: Deeper UI Automation capabilities.

```
Functions:

searchElements(opts: {
  hwnd?: number;
  title?: string;
  searchText: string;       // find elements containing this text
  searchProperty: 'name' | 'automationId' | 'className';
  maxResults?: number;      // default 10
  maxDepth?: number;        // default 8 (deeper than current 5)
}): Promise<UIElement[]>
  - Recursive BFS search through UI Automation tree
  - Returns matching elements with full path + bounding rect

invokeElement(opts: {
  hwnd: number;
  automationId?: string;
  name?: string;
  role?: string;
}): Promise<{ ok: boolean; error?: string }>
  - Uses IInvokePattern to click/activate an element by automation property
  - Does NOT use SendInput — uses the native UI Automation invoke
  - Safer and more reliable than coordinate-based clicking

setElementValue(opts: {
  hwnd: number;
  automationId?: string;
  name?: string;
  value: string;
}): Promise<{ ok: boolean; error?: string }>
  - Uses IValuePattern to set text in an input field
  - Does NOT use SendInput — uses native UI Automation
  - Safer for text entry (no character-by-character typing)

getElementPatterns(opts: {
  hwnd: number;
  automationId?: string;
  name?: string;
}): Promise<{ patterns: string[] }>
  - Returns which UI Automation patterns an element supports
  - e.g., ['InvokePattern', 'ValuePattern', 'SelectionItemPattern']
  - Helps the LLM decide which interaction method to use

All functions use PowerShell with System.Windows.Automation namespace.
Cache: element tree cached for 2 seconds (same as uiAutomation.ts).
```

### Files to MODIFY

#### `sidecar/src/server.ts`

1. Add `enhancedAccessibility: false` to `sidecarFlags`
2. Add endpoints:
   - `POST /ui-elements/search` — Search for elements by text/property
     - Gated by `enhancedAccessibility` AND `uiAccessibility`
   - `POST /ui-elements/invoke` — Invoke an element (native click)
     - Gated by `enhancedAccessibility` AND `uiAccessibility` AND `consentGate`
     - Goes through consent flow
   - `POST /ui-elements/set-value` — Set element text value
     - Gated by `enhancedAccessibility` AND `uiAccessibility` AND `consentGate`
     - Goes through consent flow
   - `GET /ui-elements/patterns` — Get supported patterns for element
     - Gated by `enhancedAccessibility` AND `uiAccessibility`

#### `sidecar/src/mcp-server.ts`

Add MCP tool #19: `interact_with_element`
- Params: `action` ('search'|'invoke'|'setValue'|'getPatterns'), `hwnd?`, `title?`, `automationId?`, `name?`, `role?`, `searchText?`, `searchProperty?`, `value?`, `maxResults?`, `maxDepth?`
- Routes to appropriate endpoint
- Returns: element data, action result, or supported patterns

#### `src/store/featureFlagStore.ts`

Add `enhancedAccessibility: boolean` (default: false).

#### `src/hooks/useFlagSync.ts`

Add `enhancedAccessibility` to sync.

### Acceptance Criteria

- [ ] Search finds elements by name/automationId/className text match
- [ ] Deeper traversal (maxDepth 8) finds elements in Chrome/Edge
- [ ] InvokePattern activates buttons without SendInput
- [ ] ValuePattern sets text in inputs without SendInput
- [ ] GetPatterns tells LLM what interactions are available
- [ ] Invoke and setValue go through consent flow
- [ ] Flag OFF: all new endpoints return 403, existing uiAutomation unchanged
- [ ] Unit test with mock UI Automation responses

### Rollback

Set `enhancedAccessibility: false`. All new endpoints return 403. Existing `get_ui_elements` unchanged. No data loss.

---

## PHASE EAC-9: Workflow Recording & Replay

**Problem:** No way to record a workflow of actions for replay. The LLM must re-plan multi-step actions every time. Users can't save and reuse workflows.

**Solution:** Record sequences of MCP tool calls (annotations, input actions, terminal commands) as replayable workflow files. Stored as JSON in the app data directory.

**Feature flag:** `workflowRecording` (default: `false`)

**Depends on:** All previous EAC phases (uses their tools)

### Files to CREATE

#### `sidecar/src/workflowRecorder.ts`

Purpose: Record and replay sequences of agent actions.

```
Class: WorkflowRecorder
  constructor(opts: { storageDir: string })  // %APPDATA%/chat-overlay-widget/workflows/

  Interface: WorkflowStep {
    stepIndex: number;
    tool: string;            // MCP tool name
    params: Record<string, unknown>;  // tool parameters
    description: string;     // human-readable description
    delayAfterMs?: number;   // wait after this step (default 500)
    verification?: {         // optional step verification
      strategy: 'terminal-match' | 'pixel-sample' | 'manual';
      config: Record<string, unknown>;
    };
  }

  Interface: Workflow {
    workflowId: string;
    name: string;
    description: string;
    createdAt: string;       // ISO timestamp
    updatedAt: string;
    steps: WorkflowStep[];
    metadata: {
      targetApp?: string;    // e.g., "Google Sheets"
      estimatedDurationSec?: number;
      requiredFlags: string[];  // which feature flags must be ON
    };
  }

  startRecording(name: string, description: string): string  // returns workflowId
  addStep(step: Omit<WorkflowStep, 'stepIndex'>): void
  stopRecording(): Workflow
  
  listWorkflows(): Array<{ workflowId, name, description, stepCount, createdAt }>
  getWorkflow(workflowId: string): Workflow | null
  deleteWorkflow(workflowId: string): boolean
  
  replayWorkflow(workflowId: string, opts?: {
    startFromStep?: number;
    dryRun?: boolean;        // log actions without executing
    pauseBeforeEach?: boolean;  // require consent per step
  }): AsyncGenerator<{ step: WorkflowStep; status: 'pending'|'executing'|'completed'|'failed'; error?: string }>

  Storage: JSON files in %APPDATA%/chat-overlay-widget/workflows/
    - One file per workflow: {workflowId}.json
    - Max 100 workflows, max 200 steps per workflow
```

### Files to MODIFY

#### `sidecar/src/server.ts`

1. Add `workflowRecording: false` to `sidecarFlags`
2. Import `WorkflowRecorder`
3. Add endpoints:
   - `POST /workflows/start-recording` — Start recording
   - `POST /workflows/add-step` — Add step to active recording
   - `POST /workflows/stop-recording` — Stop and save
   - `GET /workflows` — List saved workflows
   - `GET /workflows/:id` — Get workflow details
   - `DELETE /workflows/:id` — Delete workflow
   - `POST /workflows/:id/replay` — Start replay (returns async stream via WebSocket)
   All gated by `workflowRecording`

#### `sidecar/src/protocol.ts` and `src/protocol.ts`

Add to ServerMessage:
```typescript
| { type: 'workflow-recording-status'; recording: boolean; workflowId?: string; stepCount?: number }
| { type: 'workflow-replay-progress'; workflowId: string; step: number; totalSteps: number; status: string; error?: string }
```

#### `sidecar/src/mcp-server.ts`

Add MCP tool #20: `workflow`
- Params: `action` ('startRecording'|'addStep'|'stopRecording'|'list'|'get'|'delete'|'replay'), plus action-specific params
- Routes to appropriate endpoint
- Returns: workflow data, recording status, or replay progress

#### `src/store/featureFlagStore.ts`

Add `workflowRecording: boolean` (default: false).

#### `src/hooks/useFlagSync.ts`

Add `workflowRecording` to sync.

#### `src-tauri/tauri.conf.json`

Verify `fs.scope` includes `$APPDATA/**` (already does — no change needed).

### Acceptance Criteria

- [ ] Start/stop recording captures tool calls as workflow steps
- [ ] Saved workflows persist across app restarts (JSON files)
- [ ] List/get/delete workflows via MCP tool
- [ ] Replay executes steps sequentially with configurable delays
- [ ] Dry-run mode logs without executing
- [ ] Pause-before-each mode requires per-step consent
- [ ] Replay progress broadcast via WebSocket
- [ ] Max 100 workflows, 200 steps per workflow enforced
- [ ] Flag OFF: all endpoints return 403
- [ ] Required flags listed in workflow metadata
- [ ] Unit test for recorder and replay lifecycle

### Rollback

Set `workflowRecording: false`. All endpoints return 403. Saved workflow files remain on disk but are inaccessible. No data loss.

---

## PHASE EAC-10: Integration Testing & Stress Test

**Problem:** All previous phases are unit-tested individually but not tested as an integrated system. Need to verify end-to-end flows and catch interaction bugs.

**Feature flag:** None (testing phase, not a feature)

**Depends on:** All previous EAC phases completed

### Files to CREATE

#### `sidecar/src/eac-integration.test.ts`

Integration tests covering cross-phase interactions:

```
Test suites:

1. Element Tracking + Annotations
   - Create annotation → bind to element → simulate window resize → verify coordinates update
   - Bind to nonexistent element → verify stale flag set
   - Toggle elementBoundAnnotations flag → verify tracker starts/stops

2. Batch Consent + Input Simulation + Focus
   - Submit 5-action plan → approve → verify all 5 execute without further prompts
   - Submit plan → deny → verify no actions execute
   - Request 30s trust → approve → send 10 actions within window → verify no prompts
   - Trust expires → next action requires consent again

3. Clipboard + Input + Focus
   - Write to clipboard → paste into focused window → verify
   - Read clipboard after manual copy → verify text returned

4. Web Fetch
   - Fetch HTTPS URL → verify text extraction
   - Fetch HTTP URL → verify rejection
   - Fetch private IP → verify SSRF block
   - Rate limit: 11 requests in 1 minute → verify 11th blocked

5. Task Orchestrator + Multi-PTY
   - Submit task to pane-1 → verify running
   - Task completes (exit pattern) → verify status
   - Submit 20 tasks → verify 21st rejected
   - Cancel running task → verify Ctrl+C sent

6. Walkthrough + Screenshot Verification
   - Start walkthrough with pixel-sample advanceWhen → verify auto-advance on match
   - Start walkthrough with screenshot-diff → verify comparison
   - Mix terminal-match and pixel-sample steps in same walkthrough

7. Enhanced Accessibility + Input
   - Search for element → invoke it (native) → verify result
   - Set value on input element → verify without SendInput

8. Workflow Recording + Replay
   - Record 5-step workflow → save → replay → verify all steps execute
   - Replay with dryRun → verify no side effects
   - Replay with pauseBeforeEach → verify consent per step

9. Feature Flag Isolation
   - For each EAC flag: enable only that flag → call its endpoints → verify 200
   - For each EAC flag: disable it → call its endpoints → verify 403
   - Enable all flags → run full workflow → verify no conflicts

10. Regression
    - All 10 existing MCP tools still work with all EAC flags OFF
    - Walkthrough with only terminal-match (no new strategies)
    - Single-PTY mode (multiPty OFF) still works
    - Per-action consent still works when batchConsent OFF
```

### Files to MODIFY

#### `sidecar/package.json`

Verify test script exists: `"test": "vitest run"` (or add if missing — check existing config)

### Acceptance Criteria

- [ ] All 10 test suites pass
- [ ] No existing tests broken
- [ ] Feature flag isolation verified for all 9 new flags
- [ ] All 10 existing MCP tools verified working with all new flags OFF
- [ ] Test coverage report generated

### Rollback

Tests only — nothing to roll back.

---

## NEW FEATURE FLAGS SUMMARY

| Flag | Phase | Default | Depends On |
|------|-------|---------|------------|
| `elementBoundAnnotations` | EAC-1 | false | uiAccessibility, annotationOverlay |
| `batchConsent` | EAC-2 | false | consentGate |
| `windowFocusManager` | EAC-3 | false | osInputSimulation |
| `clipboardAccess` | EAC-4 | false | osInputSimulation, consentGate |
| `webFetchTool` | EAC-5 | false | (standalone) |
| `agentTaskOrchestrator` | EAC-6 | false | multiPty, terminalWriteMcp |
| `screenshotVerification` | EAC-7 | false | guidedWalkthrough |
| `enhancedAccessibility` | EAC-8 | false | uiAccessibility |
| `workflowRecording` | EAC-9 | false | (uses all previous) |

All flags default to OFF. User enables via the Feature Flag Panel (FeatureFlagPanel.tsx). Flags sync to sidecar via useFlagSync.ts → set-flags WebSocket message → sidecarFlags object.

---

## NEW MCP TOOLS SUMMARY

| # | Tool | Phase | Endpoint |
|---|------|-------|----------|
| 11 | `bind_annotation_to_element` | EAC-1 | POST /annotations/bind |
| 12 | `submit_action_plan` | EAC-2 | POST /consent/submit-plan |
| 13 | `request_trust_window` | EAC-2 | POST /consent/grant-trust |
| 14 | `focus_window` | EAC-3 | POST /focus-window |
| 15 | `clipboard` | EAC-4 | GET/POST /clipboard, POST /clipboard/paste |
| 16 | `web_fetch` | EAC-5 | POST /web-fetch |
| 17 | `manage_tasks` | EAC-6 | GET/POST /tasks/* |
| 18 | `verify_walkthrough_step` | EAC-7 | POST /walkthrough/verify-step |
| 19 | `interact_with_element` | EAC-8 | GET/POST /ui-elements/* |
| 20 | `workflow` | EAC-9 | GET/POST/DELETE /workflows/* |

---

## ADVERSARIAL STRESS TEST

### View 1: Security Analyst

**Concern:** Web fetch enables SSRF attacks.
**Mitigation:** EAC-5 enforces HTTPS-only, blocks private IPs (127.x, 10.x, 192.168.x, 172.16-31.x), rate-limits to 10/min, 2MB max response. No cookies/auth forwarding. This is documented in the phase spec.

**Concern:** Clipboard read could leak sensitive data (passwords).
**Mitigation:** EAC-4 never logs clipboard contents, requires feature flag ON, read is logged as an event but content is not persisted.

**Concern:** Batch consent reduces safety — approving 30 actions at once is risky.
**Mitigation:** EAC-2 requires the existing `consentGate` flag as a dependency. Plans have 5-minute expiry. Each action consumed exactly once. Trust windows hard-capped at 120 seconds. All trust auto-revoked on disconnect. Plan review shows every action description before approval.

**Concern:** Workflow replay could execute stale/dangerous actions.
**Mitigation:** EAC-9 replay checks required flags are ON. Dry-run mode available. Pause-before-each mode enables per-step consent during replay.

### View 2: Reliability Engineer

**Concern:** Element tracker polling at 500ms will cause CPU load.
**Mitigation:** EAC-1 tracker only polls when there are bound annotations. When no bindings exist, the interval is inactive. Flag OFF stops all polling.

**Concern:** Task orchestrator could leak PTY sessions.
**Mitigation:** EAC-6 auto-cleans completed tasks after 10 minutes. Max 20 tasks enforced. Tasks are metadata only — PTY sessions managed by existing multiPtyManager which handles cleanup on disconnect.

**Concern:** WebFetcher cache could grow unbounded.
**Mitigation:** EAC-5 caps cache at 50 entries with 5-minute TTL. LRU eviction when full.

### View 3: UX Designer

**Concern:** 9 new feature flags overwhelm the Feature Flag Panel.
**Mitigation:** Flags are grouped by category (existing pattern in FeatureFlagPanel.tsx). The new flags form an "Enhanced Agent Capabilities" section. All default OFF — users only see/enable what they need.

**Concern:** Batch consent UI could be confusing.
**Mitigation:** EAC-2 consent dialog adds two new modes (plan review, trust request) but keeps the existing per-action mode unchanged. Visual indicator shows active trust with revoke button.

### View 4: LLM Agent Perspective

**Concern:** Too many MCP tools (20 total) — LLM may hallucinate tool names.
**Mitigation:** Each tool has a precise name and description. Tools are categorized and well-scoped. The MCP protocol provides tool listings dynamically.

**Concern:** Flag dependencies are complex — LLM might call a tool without enabling prerequisites.
**Mitigation:** Every endpoint returns a clear 403 with the specific flag name that needs to be enabled. Error messages are actionable: "Enable the [flagName] feature flag to use this endpoint."

**Concern:** No way to discover which flags are currently enabled.
**Mitigation:** The existing `set-flags` message broadcasts flag state. The LLM can read terminal output or use the existing feature flag panel state. (Note: Could add a `GET /flags` endpoint as a minor enhancement in any phase.)

### View 5: Backward Compatibility

**Concern:** Modifying walkthroughEngine.ts (EAC-7) could break existing walkthrough.
**Mitigation:** The `AdvanceWhenSchema` change uses `z.discriminatedUnion` which is backward compatible — existing `terminal-match` type is preserved as-is. The `.optional()` means steps without `advanceWhen` still work.

**Concern:** Modifying annotationStore.ts (EAC-1) could break existing annotations.
**Mitigation:** `elementBinding` and `stale` are optional fields added to the interface. No existing fields change. Annotations without `elementBinding` are never processed by the tracker.

**Concern:** Modifying server.ts for 9 phases will create merge conflicts.
**Mitigation:** Each phase adds new code blocks (new flag, new endpoint) without modifying existing blocks. The pattern is additive: new `if` blocks in the HTTP router, new flag in `sidecarFlags`. Each phase is a self-contained addition.

---

## DEPENDENCY GRAPH

```
EAC-1 (Element Tracking)     ← depends on nothing new (uses existing uiAccessibility)
EAC-2 (Batch Consent)        ← depends on nothing new (uses existing consentGate)
EAC-3 (Window Focus)         ← depends on nothing new (uses existing osInputSimulation)
EAC-4 (Clipboard)            ← depends on nothing new (uses existing osInputSimulation + consentGate)
EAC-5 (Web Fetch)            ← depends on nothing (standalone)
EAC-6 (Task Orchestrator)    ← depends on nothing new (uses existing multiPty + terminalWriteMcp)
EAC-7 (Screenshot Verify)    ← depends on nothing new (uses existing capture_screenshot)
EAC-8 (Enhanced Accessibility) ← depends on nothing new (uses existing uiAccessibility)
EAC-9 (Workflow Recording)   ← SHOULD be last before testing (uses tools from all phases)
EAC-10 (Integration Testing) ← MUST be last (tests everything)
```

**Recommended parallel groups:**
- Group A (independent): EAC-1, EAC-2, EAC-3, EAC-4, EAC-5 — can be done in any order
- Group B (independent): EAC-6, EAC-7, EAC-8 — can be done in any order
- Group C (sequential): EAC-9 → EAC-10 — must be last

---

## HANDOVER NOTES TEMPLATE

After completing each phase, update this section:

### EAC-1 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/elementTracker.ts, sidecar/src/elementTracker.test.ts]
Files modified: [sidecar/src/annotationStore.ts, sidecar/src/server.ts, sidecar/src/mcp-server.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (285 tests, 19 files, 0 failures)
Feature flag verified: yes (elementBoundAnnotations added to interface, defaults, serialization, sync, FeatureFlagPanel, persistence)
Unexpected issues: [FeatureFlagPanel.tsx and usePersistence.ts also needed the new flag added — not listed in plan but discovered via tsc]
Notes for next phase: [annotationStore.ts now has Annotation type extended with elementBinding/stale optional fields — future phases should not assume Annotation is purely z.infer]
```

### EAC-2 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/batchConsentManager.ts, sidecar/src/batchConsentManager.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, sidecar/src/protocol.ts, src/protocol.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (batchConsent added to interface, defaults, serialization, sync, panel, persistence, sidecarFlags)
Unexpected issues: [Protocol types needed in both src/protocol.ts and sidecar/src/protocol.ts — 6 new message types total]
Notes for next phase: [BatchConsentManager uses broadcast callback pattern for plan/trust requests; plans expire after 5 min, trust hard-capped at 120s]
```

### EAC-3 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/windowFocusManager.ts, sidecar/src/windowFocusManager.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (windowFocusManager added to all 6 shared files + sidecarFlags)
Unexpected issues: [Simplify pass consolidated duplicate P/Invoke C# declarations into shared ADD_TYPE_BLOCK]
Notes for next phase: [Uses PowerShell SetForegroundWindow/GetForegroundWindow P/Invoke; focusAndVerify retries up to 2 times with 200ms delay]
```

### EAC-4 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/clipboardManager.ts, sidecar/src/clipboardManager.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (clipboardAccess added to all 6 shared files + sidecarFlags)
Unexpected issues: [Integration fix: added @ts-expect-error for optional inputSimulator.js runtime import]
Notes for next phase: [Clipboard text passed via stdin pipe to prevent shell injection; paste action requires osInputSimulation + consentGate flags]
```

### EAC-5 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/webFetcher.ts, sidecar/src/webFetcher.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (webFetchTool added to all 6 shared files + sidecarFlags)
Unexpected issues: [None — standalone phase, cleanest implementation]
Notes for next phase: [HTTPS-only, SSRF protection (private IP block), rate limit 10/min, 50KB text max, 5-min cache, no new dependencies (uses Node built-in fetch)]
```

### EAC-6 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/taskOrchestrator.ts, sidecar/src/taskOrchestrator.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, sidecar/src/protocol.ts, src/protocol.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (agentTaskOrchestrator added to all 6 shared files + sidecarFlags)
Unexpected issues: [Protocol types needed — task-state-change server message added to both protocol.ts files]
Notes for next phase: [Max 20 concurrent tasks, auto-clean after 10 min, exit/fail pattern regex matching, requires multiPty + terminalWriteMcp flags]
```

### EAC-7 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/screenshotVerifier.ts, sidecar/src/screenshotVerifier.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, sidecar/src/walkthroughEngine.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (screenshotVerification added to all 6 shared files + sidecarFlags)
Unexpected issues: [Integration fix: walkthroughEngine.ts needed type narrowing for discriminated union access to .pattern; AdvanceWhenSchema changed from single object to discriminated union]
Notes for next phase: [3 strategies: pixel-sample, screenshot-diff, manual; uses sharp (existing dep); walkthroughEngine AdvanceWhenSchema is now a discriminated union — existing terminal-match still works]
```

### EAC-8 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/enhancedAccessibility.ts, sidecar/src/enhancedAccessibility.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (enhancedAccessibility added to all 6 shared files + sidecarFlags)
Unexpected issues: [Integration fix: renamed undeclared treeCache variable to match actual searchCache declaration]
Notes for next phase: [maxDepth 8 for deeper Chromium traversal; invoke/setValue use native UI Automation patterns (not SendInput); invoke/setValue require consentGate]
```

### EAC-9 Handover
```
Status: DONE
Completed by: 2026-04-04
Files created: [sidecar/src/workflowRecorder.ts, sidecar/src/workflowRecorder.test.ts]
Files modified: [sidecar/src/server.ts, sidecar/src/mcp-server.ts, sidecar/src/protocol.ts, src/protocol.ts, src/store/featureFlagStore.ts, src/hooks/useFlagSync.ts, src/hooks/usePersistence.ts, src/components/FeatureFlagPanel.tsx]
Tests passing: yes (400 tests, 25 files, 0 failures after integration)
Feature flag verified: yes (workflowRecording added to all 6 shared files + sidecarFlags)
Unexpected issues: [Protocol types needed — workflow-recording-status and workflow-replay-progress server messages]
Notes for next phase: [Workflows stored as JSON in %APPDATA%/chat-overlay-widget/workflows/; max 100 workflows, 200 steps; replay supports dryRun and startFromStep]
```

### EAC-10 Handover
```
Status: [PENDING]
Completed by: []
Files created: []
Files modified: []
Tests passing: [yes/no]
Feature flag verified: [yes/no]
Unexpected issues: []
Notes for next phase: []
```
