# Parallel-Code Feature Adoption Plan

> **Status:** ACTIVE
> **Created:** 2026-04-03
> **Source project:** `C:\Users\anujd\Documents\01_AI\219_parallel_code\parallel-code` (Electron + SolidJS)
> **Target project:** `C:\Users\anujd\Documents\01_AI\214_Chat_overlay_widget` (Tauri v1.8 + React 18 + node-pty sidecar)
> **Constraint:** NO Electron. NO changes to existing code. All features toggleable.

---

## Reusable Initializing Prompt

Paste this at the start of every new conversation:

```
I am continuing a multi-phase implementation plan. Read the plan document:

  C:\Users\anujd\Documents\01_AI\214_Chat_overlay_widget\docs\PARALLEL_FEATURES_PLAN.md

This file contains:
- The FULL project context (architecture, file paths, protocols, types)
- 10 feature phases with EXACT implementation specs
- A progress tracker showing what is DONE and what is NEXT
- Handover notes from the previous session

Rules:
1. Read the plan FIRST. Find the next phase marked "PENDING" in the Progress Tracker.
2. Do NOT modify any existing files listed under "Existing Files (DO NOT MODIFY)".
3. Every new feature MUST be behind a feature flag in src/store/featureFlagStore.ts.
4. After completing a phase, update the Progress Tracker in this plan file: set status to DONE, add completion date, and write handover notes.
5. Run tests if any exist. Do not break existing functionality.
6. This project uses Tauri v1.8 (NOT v2, NOT Electron), React 18, Zustand, xterm.js 5.5, node-pty 1.1, WebSocket (ws 8.18).
7. The sidecar is a Node.js process at sidecar/src/. The frontend is at src/. They communicate via WebSocket JSON messages defined in sidecar/src/protocol.ts.
8. Start work through a GSD command: /gsd:quick for the phase, or /gsd:execute-phase if phase is already planned.

Begin by reading the plan file now.
```

---

## Progress Tracker

| # | Phase | Status | Date | Handover Notes |
|---|-------|--------|------|----------------|
| 0 | Feature Flag Store | DONE | 2026-04-03 | ff7dc13 — featureFlagStore.ts + FeatureFlagPanel.tsx + AppHeader wired |
| 1 | Terminal Output Batching | DONE | 2026-04-03 | ringBuffer + outputBatcher + batchedPtySession + set-flags protocol + useFlagSync hook |
| 2 | Auto-Trust Dialog Detection | DONE | 2026-04-03 | bf48136/83b05c4 — autoTrust.ts + batchedPtySession integration + protocol + server wiring |
| 3 | Plan File Watcher | PENDING | — | — |
| 4 | Unified Diff Viewer | PENDING | — | — |
| 5 | Terminal Bookmarks | PENDING | — | — |
| 6 | Prompt History & Notes | PENDING | — | — |
| 7 | Agent Exit Notifications | PENDING | — | — |
| 8 | Keyboard Navigation System | PENDING | — | — |
| 9 | Inactive Pane Dimming | PENDING | — | — |
| 10 | Enhanced Session Persistence | PENDING | — | — |

---

## Project Architecture (Zero-Context Reference)

### Directory Structure

```
C:\Users\anujd\Documents\01_AI\214_Chat_overlay_widget\
  src/                          # React 18 frontend (Vite, TypeScript)
    main.tsx                    # Entry: ReactDOM.createRoot
    App.tsx                     # Renders <PaneContainer />
    components/
      PaneContainer.tsx         # Layout tree renderer, react-resizable-panels
      TerminalPane.tsx          # Per-pane: xterm.js + WebSocket + ChatInputBar
      TerminalHeader.tsx        # Shell selector, split/close buttons
      ChatInputBar.tsx          # Textarea input, image paste, injection
      AppHeader.tsx             # Title bar, pin, overlay toggle, exit
      AgentSidebar.tsx          # Agent event list (collapsible)
      HistorySidebar.tsx        # Session history list
      HistoryViewer.tsx         # Replay viewer
      SearchOverlay.tsx         # Ctrl+F search
      WindowPicker.tsx          # Window capture picker
      ConnectionStatus.tsx      # Full-screen connection overlay
    hooks/
      useWebSocket.ts           # WebSocket connect/retry/reconnect
      useTerminal.ts            # xterm.js Terminal + FitAddon + SearchAddon
      useSessionHistory.ts      # History fetch/replay
    store/
      paneStore.ts              # Zustand: layout tree, split/close/active pane
      agentEventStore.ts        # Zustand: agent events, collapsed state
      overlayStore.ts           # Zustand: overlay toggle
    protocol.ts                 # Mirrors sidecar/src/protocol.ts types
    utils/
      formatCaptureBlock.ts     # Window capture block formatter
      shellQuote.ts             # Shell-aware path quoting

  sidecar/src/                  # Node.js sidecar (compiled to dist/, bundled via caxa)
    server.ts                   # HTTP + WebSocket server, message routing
    protocol.ts                 # ClientMessage / ServerMessage union types
    ptySession.ts               # PTYSession class (node-pty wrapper)
    terminalBuffer.ts           # TerminalBuffer class (64KB rolling, ANSI strip)
    historyStore.ts             # SQLite session persistence
    secretScrubber.ts           # Secret pattern redaction
    screenshotSelf.ts           # Self-screenshot capture
    discoveryFile.ts            # Port/token discovery file for MCP
    agentEvent.ts               # AgentEvent type, normalizer, buffer
    adapters/adapter.ts         # Hook event adapter selector
    shellDetect.ts              # Available shell detection
    mcp-server.ts               # MCP stdio server (conditional load)
    windowEnumerator.ts         # Win32 window listing
    windowCapture.ts            # Window screenshot capture
    windowThumbnailBatch.ts     # Batch thumbnail generation
    spatial_engine.ts           # Active window rect

  src-tauri/
    src/main.rs                 # Tauri app: sidecar spawn, port extraction, events
    tauri.conf.json             # Window config, allowlist, externalBin
    binaries/                   # Bundled sidecar .exe

  docs/                         # Documentation
  scripts/                      # Build/dev scripts
  .planning/                    # GSD workflow state
```

### WebSocket Protocol (sidecar/src/protocol.ts)

**Client -> Server (ClientMessage):**

| type | Fields | Purpose |
|------|--------|---------|
| `spawn` | shell, cols?, rows? | Start PTY session |
| `input` | data | Send keystrokes to PTY |
| `resize` | cols, rows | Resize PTY |
| `kill` | — | Kill PTY |
| `history-list` | — | List saved sessions |
| `history-replay` | sessionId | Replay session |
| `save-image` | base64 | Save clipboard image |
| `list-windows-with-thumbnails` | — | Enumerate windows |
| `capture-window-with-metadata` | hwnd, pid, title | Capture window |

**Server -> Client (ServerMessage):**

| type | Fields | Purpose |
|------|--------|---------|
| `output` | data | PTY output chunk |
| `pty-ready` | pid, shell | PTY spawned |
| `pty-exit` | exitCode | PTY exited |
| `shell-list` | shells[] | Available shells |
| `error` | message | Error |
| `session-start` | sessionId | Session ID |
| `history-sessions` | sessions[] | Session list |
| `history-chunk` | data | History data |
| `history-end` | sessionId | History complete |
| `save-image-result` | path | Saved image path |
| `window-thumbnails` | windows[] | Window list |
| `capture-result-with-metadata` | path, title, hwnd, pid, bounds, captureSize, dpiScale | Capture result |
| `agent-event` | event | Agent hook event |

### Key Types

```typescript
// Zustand stores use create<T>() pattern
// paneStore: layout tree (PaneNode | SplitNode), activePaneId
// agentEventStore: events[], collapsed, pushEvent(), toggleCollapsed()

// TerminalBuffer (sidecar): 64KB rolling buffer, cursor-paginated getLines()
// PTYSession (sidecar): node-pty wrapper, sends output/pty-ready/pty-exit

// useWebSocket: auto-connects via invoke('get_sidecar_port'), reconnects
// useTerminal: xterm.js Terminal + FitAddon + SearchAddon, 150ms resize debounce
```

### Build & Run

```bash
# Dev mode (from project root):
# Option 1: scripts/start.bat (launches sidecar + tauri dev)
# Option 2: npm run tauri:dev

# Sidecar builds to: sidecar/dist/server.js (tsc)
# Sidecar bundles to: src-tauri/binaries/sidecar-x86_64-pc-windows-msvc.exe (caxa)
# Frontend builds to: dist/ (vite)
```

### Existing Files (DO NOT MODIFY)

These files exist and MUST NOT be changed. New features add NEW files or extend via composition:

```
src/App.tsx
src/main.tsx
src/components/PaneContainer.tsx
src/components/TerminalPane.tsx
src/components/TerminalHeader.tsx
src/components/ChatInputBar.tsx
src/components/AppHeader.tsx
src/components/AgentSidebar.tsx
src/components/HistorySidebar.tsx
src/components/HistoryViewer.tsx
src/components/SearchOverlay.tsx
src/components/WindowPicker.tsx
src/components/ConnectionStatus.tsx
src/hooks/useWebSocket.ts
src/hooks/useTerminal.ts
src/hooks/useSessionHistory.ts
src/store/paneStore.ts
src/store/agentEventStore.ts
src/store/overlayStore.ts
src/protocol.ts
sidecar/src/protocol.ts
sidecar/src/server.ts
sidecar/src/ptySession.ts
sidecar/src/terminalBuffer.ts
sidecar/src/historyStore.ts
sidecar/src/agentEvent.ts
sidecar/src/secretScrubber.ts
sidecar/src/discoveryFile.ts
sidecar/src/mcp-server.ts
src-tauri/src/main.rs
src-tauri/tauri.conf.json
```

**HOW TO ADD FEATURES WITHOUT MODIFYING EXISTING FILES:**

The constraint "do not modify existing files" means we use COMPOSITION and WRAPPING patterns:

1. **Wrapper Components:** Create `EnhancedTerminalPane.tsx` that renders `<TerminalPane>` plus new UI (bookmarks bar, diff panel, etc.). Then update ONLY `PaneContainer.tsx` to import the wrapper instead of `TerminalPane` — this is the ONE allowed minimal change per phase (swapping an import).

2. **Protocol Extension:** Add new message types to a NEW file `sidecar/src/protocolExt.ts` that re-exports all existing types plus new ones. New sidecar modules import from `protocolExt.ts`.

3. **Store Composition:** New Zustand stores in new files. Never modify existing stores.

4. **Sidecar Extension:** New route handlers in new files. `server.ts` gets ONE line added per feature: an import + registration call. This is the minimal, unavoidable touch point.

**IMPORTANT EXCEPTION:** `sidecar/src/server.ts` and `src/components/PaneContainer.tsx` are the two integration points where minimal, additive-only changes (import + wire-up) are unavoidable. Each phase specifies EXACTLY what line to add. No existing lines are changed or removed.

---

## Phase 0: Feature Flag Store (Foundation)

**Goal:** Create a centralized feature flag store that controls all 10 features. Every subsequent phase checks its flag before activating.

**New files to create:**

### `src/store/featureFlagStore.ts`

```typescript
import { create } from 'zustand';

export interface FeatureFlags {
  outputBatching: boolean;       // Phase 1
  autoTrust: boolean;            // Phase 2
  planWatcher: boolean;          // Phase 3
  diffViewer: boolean;           // Phase 4
  terminalBookmarks: boolean;    // Phase 5
  promptHistory: boolean;        // Phase 6
  exitNotifications: boolean;    // Phase 7
  keyboardNavigation: boolean;   // Phase 8
  inactivePaneDimming: boolean;  // Phase 9
  enhancedPersistence: boolean;  // Phase 10
}

const STORAGE_KEY = 'chat-overlay-feature-flags';

function loadFlags(): Partial<FeatureFlags> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const defaults: FeatureFlags = {
  outputBatching: true,
  autoTrust: false,           // OFF by default — safety-critical
  planWatcher: true,
  diffViewer: true,
  terminalBookmarks: true,
  promptHistory: true,
  exitNotifications: true,
  keyboardNavigation: true,
  inactivePaneDimming: false, // OFF by default — visual preference
  enhancedPersistence: true,
};

interface FeatureFlagStore extends FeatureFlags {
  setFlag: (key: keyof FeatureFlags, value: boolean) => void;
  resetAll: () => void;
}

export const useFeatureFlagStore = create<FeatureFlagStore>((set) => ({
  ...defaults,
  ...loadFlags(),

  setFlag: (key, value) =>
    set((state) => {
      const next = { ...state, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        outputBatching: next.outputBatching,
        autoTrust: next.autoTrust,
        planWatcher: next.planWatcher,
        diffViewer: next.diffViewer,
        terminalBookmarks: next.terminalBookmarks,
        promptHistory: next.promptHistory,
        exitNotifications: next.exitNotifications,
        keyboardNavigation: next.keyboardNavigation,
        inactivePaneDimming: next.inactivePaneDimming,
        enhancedPersistence: next.enhancedPersistence,
      }));
      return { [key]: value };
    }),

  resetAll: () =>
    set(() => {
      localStorage.removeItem(STORAGE_KEY);
      return { ...defaults };
    }),
}));
```

### `src/components/FeatureFlagPanel.tsx`

A settings panel component that renders toggle switches for each flag. Rendered inside AppHeader as a dropdown or in a new settings dialog. Reads/writes via `useFeatureFlagStore`.

**UI spec:** Gear icon button in AppHeader. Clicking opens a dropdown panel with labeled toggle switches for each feature. Each toggle calls `setFlag(key, !currentValue)`. Panel closes on click-outside.

**Acceptance criteria:**
- [ ] `featureFlagStore.ts` created with all 10 flags
- [ ] Flags persist to localStorage under key `chat-overlay-feature-flags`
- [ ] `FeatureFlagPanel.tsx` renders all flags with toggle switches
- [ ] Panel accessible from AppHeader gear icon
- [ ] `resetAll()` restores defaults

---

## Phase 1: Terminal Output Batching

**Goal:** Batch PTY output on the sidecar side to prevent UI stutter during heavy Claude output. Add a ring buffer for efficient scrollback access.

**Source reference:** `parallel-code/electron/ipc/pty.ts` lines 56-315

**Feature flag:** `outputBatching`

### New files to create:

#### `sidecar/src/ringBuffer.ts`

```typescript
/**
 * Fixed-capacity circular byte buffer.
 * Adapted from parallel-code/electron/remote/ring-buffer.ts
 *
 * Capacity: 64KB (65536 bytes)
 * write(data: Buffer): void — wraps with modulo arithmetic
 * read(): Buffer — returns data in chronological order
 * toBase64(): string — serialized form for IPC
 */
export class RingBuffer {
  private buf: Buffer;
  private capacity: number;
  private writePos = 0;
  private filled = false;

  constructor(capacity = 65536) {
    this.capacity = capacity;
    this.buf = Buffer.alloc(capacity);
  }

  write(data: Buffer): void { /* circular write */ }
  read(): Buffer { /* chronological concat */ }
  toBase64(): string { return this.read().toString('base64'); }
  clear(): void { this.writePos = 0; this.filled = false; }
}
```

#### `sidecar/src/outputBatcher.ts`

```typescript
/**
 * Three-tier output batching for PTY data.
 * Adapted from parallel-code/electron/ipc/pty.ts lines 241-315
 *
 * Strategy:
 *   1. Large chunks (>= 64KB): flush immediately
 *   2. Small chunks (< 1024 bytes): flush immediately (interactive prompt)
 *   3. Medium chunks: schedule 8ms debounce timer then flush
 *
 * Constants:
 *   BATCH_MAX = 65536 (64KB)
 *   BATCH_INTERVAL = 8 (ms)
 *   SMALL_CHUNK = 1024 (bytes)
 */

import { RingBuffer } from './ringBuffer.js';

export interface BatcherOptions {
  onFlush: (data: string) => void;
  enabled?: boolean; // feature flag gate
}

export class OutputBatcher {
  private buffer = '';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private ringBuffer: RingBuffer;
  private onFlush: (data: string) => void;
  private _enabled: boolean;

  constructor(opts: BatcherOptions) { /* ... */ }

  push(chunk: string): void {
    if (!this._enabled) { this.onFlush(chunk); return; }
    /* three-tier batching logic */
  }

  flush(): void { /* send accumulated buffer, clear timer */ }
  set enabled(v: boolean) { this._enabled = v; }
  getScrollback(): string { return this.ringBuffer.toBase64(); }
  destroy(): void { /* clear timer */ }
}
```

### Integration point (sidecar/src/ptySession.ts):

The `OutputBatcher` wraps the existing `ws.send(JSON.stringify({ type: 'output', data }))` call inside `PTYSession`. Since we cannot modify `ptySession.ts`, we create:

#### `sidecar/src/batchedPtySession.ts`

A subclass or wrapper of PTYSession that intercepts output and routes through OutputBatcher. The sidecar `server.ts` spawn handler uses `BatchedPTYSession` when the feature is enabled (checked via a sidecar-side config flag read from a JSON file or environment variable).

**Sidecar feature flag mechanism:** Read `CHAT_OVERLAY_FLAGS` env var or a `flags.json` file at startup. The frontend writes this file via a new WebSocket message `set-flags`.

### New protocol messages:

```typescript
// Client -> Server
{ type: 'set-flags', flags: Record<string, boolean> }

// Server -> Client (no new messages — batching is transparent)
```

**Acceptance criteria:**
- [ ] `RingBuffer` class with 64KB capacity, circular write, chronological read
- [ ] `OutputBatcher` with three-tier strategy (64KB/1KB/8ms thresholds)
- [ ] When `outputBatching` flag is OFF, output passes through unbatched (zero behavior change)
- [ ] When ON, heavy output is batched, small/interactive output flushes immediately
- [ ] Ring buffer accessible for scrollback queries
- [ ] No modification to existing `ptySession.ts` — uses wrapper/composition

---

## Phase 2: Auto-Trust Dialog Detection

**Goal:** Detect Claude Code's "Do you trust this folder?" and similar permission prompts in PTY output. Auto-send Enter with safety guards.

**Source reference:** `parallel-code/src/store/taskStatus.ts` lines 7-390

**Feature flag:** `autoTrust`

### New files to create:

#### `sidecar/src/autoTrust.ts`

```typescript
/**
 * Auto-trust dialog detection and response.
 * Adapted from parallel-code/src/store/taskStatus.ts
 *
 * TRUST_PATTERNS (detect dialog):
 *   /\btrust\b.*\?/i
 *   /\ballow\b.*\?/i
 *   /trust.*folder/i
 *
 * EXCLUSION_KEYWORDS (safety block — NEVER auto-accept if these appear):
 *   /\b(delet|remov|credential|secret|password|key|token|destro|format|drop)\b/i
 *
 * Three-phase timing:
 *   Phase 1 — Detection:  50ms delay before sending Enter (let TUI render)
 *   Phase 2 — Settling:   1000ms cooldown (block auto-send while agent initializes)
 *   Phase 3 — Cooldown:   3000ms lockout (prevent re-triggering same dialog)
 *
 * ANSI stripping regex (applied before pattern matching):
 *   /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g
 */

export interface AutoTrustState {
  detectionTimer: ReturnType<typeof setTimeout> | null;
  cooldownTimer: ReturnType<typeof setTimeout> | null;
  settleUntil: number; // Date.now() + 1000ms
  lastAcceptedAt: number;
  tailBuffer: string;  // last 4KB of output
}

export class AutoTrustDetector {
  private state: AutoTrustState;
  private enabled: boolean;
  private onAccept: () => void; // callback to send Enter keystroke

  constructor(opts: { onAccept: () => void; enabled?: boolean }) { /* ... */ }

  /** Feed raw PTY output chunks. Strips ANSI, appends to tail buffer (4KB cap),
   *  runs pattern matching. */
  feed(rawChunk: string): void { /* ... */ }

  /** Returns true if currently in settling or cooldown phase */
  isSettling(): boolean { /* ... */ }

  set enabled(v: boolean) { this._enabled = v; }
  destroy(): void { /* clear all timers */ }
}
```

### Integration approach:

The `AutoTrustDetector` is instantiated alongside each PTY session. It receives raw output chunks (before batching). When it detects a trust dialog, it calls `onAccept` which writes `\r` (Enter) to the PTY.

Created inside `batchedPtySession.ts` (from Phase 1) or a new `enhancedPtySession.ts` wrapper.

### New protocol messages:

```typescript
// Server -> Client (informational)
{ type: 'auto-trust-event', action: 'accepted' | 'blocked', pattern: string, timestamp: string }
```

**Acceptance criteria:**
- [ ] Detects all three trust patterns in ANSI-stripped output
- [ ] Blocks auto-accept when exclusion keywords appear
- [ ] 50ms detection delay, 1000ms settle, 3000ms cooldown
- [ ] Tail buffer capped at 4KB, oldest data evicted
- [ ] When `autoTrust` flag is OFF, detector does nothing (no output scanning)
- [ ] `auto-trust-event` message sent to frontend for UI display
- [ ] Unit tests covering: trust dialog detection, exclusion keyword blocking, timing phases

---

## Phase 3: Plan File Watcher

**Goal:** Watch Claude Code's `.claude/plans/` directory for engineering plan files. Display the newest plan in a side panel.

**Source reference:** `parallel-code/electron/ipc/plans.ts` lines 1-256

**Feature flag:** `planWatcher`

### New files to create:

#### `sidecar/src/planWatcher.ts`

```typescript
/**
 * Watches .claude/plans/ and docs/plans/ for Claude Code engineering plans.
 * Adapted from parallel-code/electron/ipc/plans.ts
 *
 * PLAN_DIRS = ['.claude/plans', 'docs/plans']  (relative to CWD)
 * DIR_POLL_INTERVAL = 3000ms  (poll for directory creation)
 * CHANGE_DEBOUNCE = 200ms     (debounce file change events)
 *
 * Discovery: finds newest .md file by mtime in each plan directory.
 * Watching: uses fs.watch() for existing dirs, polls for non-existent ones.
 * Output: { fileName: string, content: string, mtime: number }
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PlanContent {
  fileName: string;
  content: string;
  mtime: number;
}

export class PlanWatcher {
  private fsWatchers: fs.FSWatcher[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private watchedDirs: Set<string> = new Set();
  private onPlanUpdate: (plan: PlanContent | null) => void;
  private enabled: boolean;

  constructor(opts: { onPlanUpdate: (plan: PlanContent | null) => void; enabled?: boolean }) { /* ... */ }

  start(cwd: string): void { /* begin watching PLAN_DIRS relative to cwd */ }
  stop(): void { /* cleanup all watchers and timers */ }
  readNow(cwd: string): PlanContent | null { /* one-shot read of newest plan */ }
  set enabled(v: boolean) { this._enabled = v; }
}
```

#### `src/components/PlanPanel.tsx`

```typescript
/**
 * Displays Claude Code's engineering plan as rendered Markdown.
 * Receives plan content via WebSocket message.
 * Renders inside AgentSidebar as a tab, or as a standalone collapsible panel.
 *
 * Props:
 *   content: string | null  — raw markdown
 *   fileName: string | null — plan file name
 *   onClose: () => void
 *
 * Uses a lightweight Markdown renderer (dangerouslySetInnerHTML with
 * sanitized HTML, or a simple regex-based renderer for headers/lists/code).
 * NO external markdown library dependency — keep it minimal.
 */
```

#### `src/store/planStore.ts`

```typescript
import { create } from 'zustand';

interface PlanStore {
  content: string | null;
  fileName: string | null;
  visible: boolean;
  setContent: (content: string | null, fileName: string | null) => void;
  toggleVisible: () => void;
}
```

### New protocol messages:

```typescript
// Server -> Client
{ type: 'plan-update', fileName: string | null, content: string | null, mtime: number }

// Client -> Server
{ type: 'plan-read', cwd?: string }  // manual refresh request
```

### Integration:

- Sidecar starts `PlanWatcher` on first PTY spawn (uses PTY's CWD).
- On plan change, broadcasts `plan-update` to all WebSocket clients.
- Frontend `TerminalPane` handles `plan-update` message, stores in `planStore`.
- `PlanPanel` reads from `planStore`, renders when `planWatcher` flag is ON.

**Acceptance criteria:**
- [ ] Watches `.claude/plans/` and `docs/plans/` relative to shell CWD
- [ ] Finds newest `.md` file by modification time
- [ ] 3s poll for non-existent directories, fs.watch() for existing ones
- [ ] 200ms debounce on file changes
- [ ] Plan content sent to frontend via `plan-update` WebSocket message
- [ ] `PlanPanel` renders markdown content in sidebar area
- [ ] When `planWatcher` flag is OFF, no file watching occurs
- [ ] Cleanup: all watchers and timers destroyed on PTY exit

---

## Phase 4: Unified Diff Viewer

**Goal:** Show git diff output in a structured, color-coded panel after Claude makes changes.

**Source reference:** `parallel-code/src/lib/unified-diff-parser.ts` (138 lines)

**Feature flag:** `diffViewer`

### New files to create:

#### `src/lib/diffParser.ts`

```typescript
/**
 * Unified diff parser. Pure TypeScript, zero dependencies.
 * Adapted from parallel-code/src/lib/unified-diff-parser.ts
 *
 * Types:
 *   DiffLineType = 'add' | 'remove' | 'context'
 *   DiffLine = { type: DiffLineType, content: string, oldLine: number | null, newLine: number | null }
 *   Hunk = { oldStart, oldCount, newStart, newCount, lines: DiffLine[] }
 *   FileDiff = { path: string, status: 'M' | 'A' | 'D', binary: boolean, hunks: Hunk[] }
 *
 * Functions:
 *   parseUnifiedDiff(raw: string): FileDiff[]
 *   isBinaryDiff(raw: string): boolean
 *
 * Regexes:
 *   HUNK_HEADER: /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
 *   FILE_HEADER: /^diff --git a\/(.+) b\/(.+)/
 *   NEW_FILE:    /^new file mode/
 *   DEL_FILE:    /^deleted file mode/
 *   BINARY:      /Binary files .* differ/
 */
```

#### `src/components/DiffPanel.tsx`

```typescript
/**
 * Color-coded diff viewer panel.
 *
 * Props:
 *   diffs: FileDiff[]
 *   onClose: () => void
 *
 * Rendering:
 *   - File headers with path and status badge (M/A/D)
 *   - Line numbers (old | new) in gutter
 *   - Green background for additions (#1e3a1e)
 *   - Red background for deletions (#3a1e1e)
 *   - Gray for context lines
 *   - Scrollable, collapsible per file
 *   - Binary files shown as "[Binary file]" placeholder
 *
 * No external dependency. Uses Tailwind classes.
 */
```

#### `src/store/diffStore.ts`

```typescript
import { create } from 'zustand';
import type { FileDiff } from '../lib/diffParser';

interface DiffStore {
  diffs: FileDiff[];
  visible: boolean;
  setDiffs: (diffs: FileDiff[]) => void;
  toggleVisible: () => void;
  clear: () => void;
}
```

### New protocol messages:

```typescript
// Client -> Server
{ type: 'request-diff', cwd?: string }

// Server -> Client
{ type: 'diff-result', raw: string, cwd: string }
```

### Sidecar handler:

#### `sidecar/src/diffHandler.ts`

Executes `git diff HEAD` (or `git diff --cached` + `git diff`) in the shell CWD via `child_process.execSync`. Returns raw unified diff string. Capped at 500KB output.

**Acceptance criteria:**
- [ ] `parseUnifiedDiff` correctly parses: additions, deletions, context, multi-file, binary
- [ ] `DiffPanel` renders color-coded lines with line numbers
- [ ] Diff requested via button in TerminalHeader or keyboard shortcut
- [ ] When `diffViewer` flag is OFF, diff button hidden, no git commands executed
- [ ] Unit tests for diff parser covering: empty diff, single file, multi-file, binary, new/deleted files

---

## Phase 5: Terminal Bookmarks

**Goal:** Save and recall frequently used commands per shell session.

**Source reference:** `parallel-code/src/lib/bookmarks.ts` (27 lines)

**Feature flag:** `terminalBookmarks`

### New files to create:

#### `src/store/bookmarkStore.ts`

```typescript
import { create } from 'zustand';

export interface Bookmark {
  id: string;        // crypto.randomUUID()
  label: string;     // extracted or user-provided
  command: string;   // full command text
  createdAt: number; // Date.now()
}

const STORAGE_KEY = 'chat-overlay-bookmarks';

interface BookmarkStore {
  bookmarks: Bookmark[];
  addBookmark: (command: string, label?: string) => void;
  removeBookmark: (id: string) => void;
  reorderBookmarks: (fromIndex: number, toIndex: number) => void;
  loadFromStorage: () => void;
}

/**
 * Label extraction algorithm (from parallel-code/src/lib/bookmarks.ts):
 * Walk words right-to-left, skip flags (starts with -),
 * strip path separators and file extensions, return first non-empty base.
 * Fallback: first word.
 */
function extractLabel(command: string): string { /* ... */ }
```

#### `src/components/BookmarkBar.tsx`

```typescript
/**
 * Horizontal strip of bookmark buttons above ChatInputBar.
 * Each bookmark: clickable pill that sends command to PTY on click.
 * Right-click: delete option.
 * Plus (+) button: bookmark current input box content.
 *
 * Props:
 *   onSendCommand: (command: string) => void
 *   currentInput: string  — for "bookmark this" action
 *
 * Height: 32px. Horizontally scrollable if bookmarks overflow.
 * Hidden when terminalBookmarks flag is OFF.
 */
```

**Acceptance criteria:**
- [ ] Bookmarks stored in localStorage under `chat-overlay-bookmarks`
- [ ] Click sends command text + `\r` to PTY via existing `onSend` callback
- [ ] Label auto-extracted from command, editable
- [ ] Add/remove/reorder operations
- [ ] When `terminalBookmarks` flag is OFF, BookmarkBar is not rendered
- [ ] Bookmarks persist across sessions

---

## Phase 6: Prompt History & Notes

**Goal:** Store sent prompts and per-session notes for recall across app restarts.

**Feature flag:** `promptHistory`

### New files to create:

#### `src/store/promptHistoryStore.ts`

```typescript
import { create } from 'zustand';

export interface PromptEntry {
  text: string;
  timestamp: number;
  paneId: string;
}

const STORAGE_KEY = 'chat-overlay-prompt-history';
const MAX_ENTRIES = 200;

interface PromptHistoryStore {
  entries: PromptEntry[];
  notes: string;              // free-text notes field
  addEntry: (text: string, paneId: string) => void;
  clearEntries: () => void;
  setNotes: (notes: string) => void;
  getRecent: (n?: number) => PromptEntry[];
}

// Persists to localStorage. Entries capped at MAX_ENTRIES (oldest evicted).
```

#### `src/components/PromptHistoryPanel.tsx`

```typescript
/**
 * Searchable list of previously sent prompts.
 * Click to re-send or copy to input box.
 * Includes a notes textarea for free-form session notes.
 *
 * Accessible via keyboard shortcut (Ctrl+H) or button in TerminalHeader.
 * Renders as a dropdown or slide-in panel.
 *
 * Hidden when promptHistory flag is OFF.
 */
```

### Integration with ChatInputBar:

A wrapper component `EnhancedChatInputBar.tsx` wraps `ChatInputBar` and intercepts `onSend` to also call `addEntry()` on the prompt history store.

**Acceptance criteria:**
- [ ] All sent prompts recorded with timestamp and pane ID
- [ ] History capped at 200 entries
- [ ] Click on entry copies text to ChatInputBar
- [ ] Notes field persists to localStorage
- [ ] When `promptHistory` flag is OFF, no recording occurs, panel hidden
- [ ] Search/filter within history entries

---

## Phase 7: Agent Exit Notifications

**Goal:** Desktop notification when Claude Code (or any PTY process) exits.

**Source reference:** `parallel-code/src/store/desktopNotifications.ts` (123 lines)

**Feature flag:** `exitNotifications`

### New files to create:

#### `src/lib/exitNotifier.ts`

```typescript
/**
 * Desktop notification on agent/PTY exit.
 * Adapted from parallel-code/src/store/desktopNotifications.ts
 *
 * Uses Tauri v1 notification API:
 *   import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification';
 *
 * Debounce: 3000ms window to batch multiple exits.
 * Suppression: No notification if app window is focused.
 * Focus detection: document.hasFocus()
 *
 * Flow:
 *   1. TerminalPane receives 'pty-exit' message
 *   2. Calls exitNotifier.notify({ exitCode, shell, paneId })
 *   3. If window not focused AND flag ON → Tauri sendNotification()
 */

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification';

const DEBOUNCE_MS = 3000;

export class ExitNotifier {
  private pending: Array<{ exitCode: number; shell: string }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enabled: boolean;

  constructor(enabled?: boolean) { /* ... */ }

  notify(info: { exitCode: number; shell: string; paneId: string }): void {
    if (!this.enabled || document.hasFocus()) return;
    /* batch and debounce */
  }

  private async flush(): Promise<void> {
    /* check permission, send notification, clear pending */
  }

  set enabled(v: boolean) { this._enabled = v; }
  destroy(): void { /* clear timer */ }
}
```

### Tauri allowlist addition:

Add to `tauri.conf.json` under `tauri.allowlist`:

```json
"notification": { "all": true }
```

**NOTE:** This is the ONE required config change. It is additive (adds a new key, does not change existing keys).

**Acceptance criteria:**
- [ ] Notification fires when PTY exits AND window is not focused
- [ ] 3s debounce batches rapid exits
- [ ] Permission requested on first use via Tauri API
- [ ] When `exitNotifications` flag is OFF, no notifications sent
- [ ] Notification shows exit code and shell name

---

## Phase 8: Keyboard Navigation System

**Goal:** Global keyboard shortcuts for pane navigation, common actions.

**Source reference:** `parallel-code/src/lib/shortcuts.ts` (67 lines)

**Feature flag:** `keyboardNavigation`

### New files to create:

#### `src/lib/shortcuts.ts`

```typescript
/**
 * Global keyboard shortcut system.
 * Adapted from parallel-code/src/lib/shortcuts.ts
 *
 * Interface:
 *   Shortcut = {
 *     key: string,           // e.g. 'f', 'ArrowLeft'
 *     ctrl?: boolean,
 *     alt?: boolean,
 *     shift?: boolean,
 *     global?: boolean,      // fires even when input/textarea focused
 *     dialogSafe?: boolean,  // fires even when dialog open
 *     handler: (e: KeyboardEvent) => void,
 *   }
 *
 * registerShortcut(shortcut: Shortcut): () => void  // returns unregister fn
 * initShortcutListener(): () => void                // returns cleanup fn
 *
 * Context-aware suppression:
 *   - Skip if target is INPUT/TEXTAREA/SELECT (unless global=true)
 *   - Skip if .dialog-overlay exists (unless dialogSafe=true)
 *
 * Matching: case-insensitive key, exact modifier match
 */

/**
 * Default shortcuts (registered when keyboardNavigation flag is ON):
 *
 *   Alt+Left     → focus previous pane
 *   Alt+Right    → focus next pane
 *   Alt+1-4      → focus pane by index
 *   Ctrl+Shift+D → request diff (Phase 4)
 *   Ctrl+H       → toggle prompt history (Phase 6)
 *   Ctrl+B       → toggle bookmarks (Phase 5)
 *   Ctrl+P       → toggle plan panel (Phase 3)
 *   F11          → toggle fullscreen
 */
```

#### `src/hooks/useShortcuts.ts`

```typescript
/**
 * React hook that registers default shortcuts on mount, unregisters on unmount.
 * Reads keyboardNavigation flag — if OFF, registers nothing.
 *
 * Usage: call useShortcuts() once in PaneContainer or App.
 */
```

**Acceptance criteria:**
- [ ] Shortcut registry with register/unregister pattern
- [ ] Context-aware: input/dialog suppression with opt-in overrides
- [ ] Default shortcuts for pane navigation and feature toggles
- [ ] When `keyboardNavigation` flag is OFF, no shortcuts registered
- [ ] No conflicts with existing Ctrl+F (search) or Ctrl+Alt+C (copy) handlers

---

## Phase 9: Inactive Pane Dimming

**Goal:** Visually dim non-focused panes for clarity.

**Source reference:** `parallel-code/src/styles.css` lines 614-625

**Feature flag:** `inactivePaneDimming`

### New files to create:

#### `src/hooks/usePaneDimming.ts`

```typescript
/**
 * Applies CSS opacity to inactive panes.
 * Reads inactivePaneDimming flag and activePaneId from stores.
 *
 * CSS approach:
 *   Active pane: opacity 1
 *   Inactive panes: opacity var(--inactive-pane-opacity, 0.6)
 *   Transition: opacity 150ms ease
 *
 * Opacity range: 0.3 to 1.0 (clamped)
 * Default: 0.6
 *
 * Implementation: sets CSS custom property on document.documentElement,
 * applies .pane-active / .pane-inactive classes via PaneContainer.
 *
 * When flag is OFF: all panes get opacity 1 (no visual difference).
 */
```

#### `src/styles/paneDimming.css`

```css
.pane-wrapper {
  transition: opacity 150ms ease;
}
.pane-wrapper.pane-inactive {
  opacity: var(--inactive-pane-opacity, 0.6);
}
.pane-wrapper.pane-active {
  opacity: 1;
}
```

**Acceptance criteria:**
- [ ] Inactive panes dim to 60% opacity (configurable)
- [ ] Active pane always full opacity
- [ ] Smooth 150ms transition
- [ ] When `inactivePaneDimming` flag is OFF, all panes full opacity
- [ ] No layout shift or reflow during opacity change

---

## Phase 10: Enhanced Session Persistence

**Goal:** Persist and restore app state across restarts: pane layout, active pane, feature flags, bookmarks, notes, window geometry.

**Source reference:** `parallel-code/electron/ipc/persistence.ts` (84 lines)

**Feature flag:** `enhancedPersistence`

### New files to create:

#### `src/lib/persistence.ts`

```typescript
/**
 * Atomic state persistence to Tauri app data directory.
 * Adapted from parallel-code/electron/ipc/persistence.ts
 *
 * Strategy:
 *   1. Validate JSON (JSON.parse round-trip)
 *   2. Write to temp file (.tmp suffix)
 *   3. Copy existing state to backup (.bak suffix)
 *   4. Rename temp to state file (atomic)
 *
 * Fallback: if primary file corrupted, load from .bak
 *
 * State shape:
 *   {
 *     version: 1,
 *     layout: LayoutNode,
 *     activePaneId: string,
 *     bookmarks: Bookmark[],
 *     notes: string,
 *     promptHistory: PromptEntry[],
 *     featureFlags: FeatureFlags,
 *     windowState: { width, height, x, y, maximized },
 *   }
 *
 * Save trigger: 30s debounce after any store change.
 * Uses Tauri filesystem API:
 *   import { writeTextFile, readTextFile, renameFile, copyFile } from '@tauri-apps/api/fs';
 *   import { appDataDir } from '@tauri-apps/api/path';
 */

const AUTOSAVE_DEBOUNCE = 30_000; // 30 seconds
const STATE_FILE = 'chat-overlay-state.json';
const BACKUP_FILE = 'chat-overlay-state.json.bak';
const TEMP_FILE = 'chat-overlay-state.json.tmp';
```

#### `src/hooks/usePersistence.ts`

```typescript
/**
 * React hook that subscribes to all stores and triggers autosave.
 * On mount: loads state, hydrates stores.
 * On store change: debounced save (30s).
 * On unmount: immediate save.
 *
 * When enhancedPersistence flag is OFF: uses localStorage fallback
 * (existing behavior for individual stores).
 */
```

### Tauri allowlist addition:

Add to `tauri.conf.json` under `tauri.allowlist`:

```json
"fs": {
  "scope": ["$APPDATA/**"],
  "all": true
}
```

**Acceptance criteria:**
- [ ] State saved atomically (temp → backup → rename)
- [ ] Backup file used as fallback when primary is corrupted
- [ ] 30s debounce prevents excessive writes
- [ ] Layout tree, active pane, bookmarks, notes, prompt history all restored
- [ ] When `enhancedPersistence` flag is OFF, falls back to localStorage (no Tauri FS)
- [ ] Window geometry saved and restored on next launch

---

## Adversarial Stress Test

### View A: "The Scope Creeper"

> "This plan adds 10 features — scope is massive. What if Phase 4 (diff) takes a week?"

**Mitigation:** Each phase is fully independent. Skip any phase, come back later. No phase depends on another except Phase 0 (feature flags) which is trivial. The plan tracks progress per-phase.

### View B: "The Breaking Change Detector"

> "You say 'don't modify existing files' but Phases 1-3 need sidecar changes. How?"

**Mitigation:** Clarified in the Architecture section above. Two files (`server.ts` and `PaneContainer.tsx`) are integration points where additive-only changes (import + one-line wire-up) are unavoidable. Every phase specifies EXACTLY what to add. No existing lines are deleted or changed.

### View C: "The Context-Loss Skeptic"

> "New conversation has zero context. The LLM will hallucinate file paths."

**Mitigation:** This plan contains every file path, every type definition, every protocol message, every constant. The initializing prompt forces the LLM to read this file first. The Progress Tracker with handover notes carries session-to-session context.

### View D: "The Feature Flag Doubter"

> "Feature flags in localStorage are fragile. What if they're wiped?"

**Mitigation:** Defaults are hardcoded in `featureFlagStore.ts`. If localStorage is cleared, all features revert to documented defaults. Safety-critical features (`autoTrust`) default to OFF.

### View E: "The Electron Contamination Checker"

> "Are any Electron APIs leaking into this plan?"

**Mitigation:** Every reference to parallel-code patterns specifies the Tauri equivalent:
- `app.getPath('userData')` → `appDataDir()` from `@tauri-apps/api/path`
- Electron IPC → Tauri `invoke()` + `emit()` + `listen()`
- Electron notification → `@tauri-apps/api/notification`
- `fs.watch()` stays (Node.js in sidecar, not Electron)
- No `ipcRenderer`, no `BrowserWindow`, no `electron` import anywhere.

### View F: "The Regression Tester"

> "How do we know existing features still work?"

**Mitigation:** Existing files are not modified. New components wrap existing ones via composition. Feature flags gate all new behavior. When all flags are OFF, the app behaves identically to before this plan was executed. Existing tests continue to pass because existing code is unchanged.

---

## Dependency Graph

```
Phase 0 (Feature Flags) ← required by ALL subsequent phases
  │
  ├── Phase 1 (Output Batching) ← standalone
  ├── Phase 2 (Auto-Trust) ← depends on Phase 1 wrapper pattern
  ├── Phase 3 (Plan Watcher) ← standalone
  ├── Phase 4 (Diff Viewer) ← standalone
  ├── Phase 5 (Bookmarks) ← standalone
  ├── Phase 6 (Prompt History) ← standalone
  ├── Phase 7 (Exit Notifications) ← standalone
  ├── Phase 8 (Keyboard Navigation) ← standalone, but references Phases 3-6 for shortcuts
  ├── Phase 9 (Pane Dimming) ← standalone
  └── Phase 10 (Persistence) ← aggregates state from Phases 0, 5, 6
```

**Recommended execution order:** 0 → 1 → 2 → 5 → 9 → 3 → 4 → 7 → 6 → 8 → 10

(Starts with highest-value, lowest-effort phases. Phase 10 last because it aggregates all stores.)

---

## Handover Notes Section

*Updated after each phase completion. Each entry includes: what was done, what changed, any gotchas for the next session.*

### Phase 0 Handover
- **Commit:** ff7dc13
- **Files created:** `src/store/featureFlagStore.ts`, `src/components/FeatureFlagPanel.tsx`
- **Files modified:** `src/components/AppHeader.tsx` (added import + `<FeatureFlagPanel />` in button row)
- **All 10 flags:** outputBatching, autoTrust, planWatcher, diffViewer, terminalBookmarks, promptHistory, exitNotifications, keyboardNavigation, inactivePaneDimming, enhancedPersistence
- **Defaults OFF:** autoTrust, inactivePaneDimming. All others ON.
- **localStorage key:** `chat-overlay-feature-flags`
- **Exports:** `useFeatureFlagStore`, `FeatureFlags` (interface), `FeatureFlagPanel`
- **Gotcha:** .planning/ is gitignored — plan artifacts stay local only

### Phase 1 Handover
- **Files created:**
  - `sidecar/src/ringBuffer.ts` — 64KB circular byte buffer with write/read/toBase64/clear
  - `sidecar/src/outputBatcher.ts` — Three-tier batching: >=64KB flush immediate, <1KB flush immediate (interactive), medium 8ms debounce
  - `sidecar/src/batchedPtySession.ts` — Proxy wrapper over PTYSession that intercepts `output` messages and routes through OutputBatcher
  - `src/hooks/useFlagSync.ts` — Sends `set-flags` message to sidecar on mount and when flags change
- **Files modified (additive only):**
  - `sidecar/src/protocol.ts` — Added `set-flags` to ClientMessage union
  - `src/protocol.ts` — Mirror: added `set-flags` to ClientMessage union
  - `sidecar/src/server.ts` — Import BatchedPTYSession; sidecarFlags state; spawn uses BatchedPTYSession; `set-flags` case in switch; live-updates batching on active sessions
  - `src/components/TerminalPane.tsx` — Import + call `useFlagSync(sendMessage, connected)`
- **Architecture:** BatchedPTYSession uses a Proxy on the WebSocket `send` method to intercept `output` messages before they reach the wire. Non-output messages (pty-ready, pty-exit, etc.) pass through unmodified. The OutputBatcher always records to the RingBuffer regardless of enabled state.
- **Flag sync:** Frontend sends `{ type: 'set-flags', flags: { outputBatching: bool } }` on connect and on change. Sidecar stores in `sidecarFlags` and live-updates active BatchedPTYSession instances.
- **When OFF:** OutputBatcher passes chunks through unbatched — zero behavior change from pre-Phase-1.
- **Gotcha:** The Proxy approach means PTYSession's internal `send(ws, msg)` helper function calls `ws.send()` which gets intercepted. This works because `send()` stringifies to JSON first, and the proxy parses it back. Slight overhead but negligible for this use case.

### Phase 2 Handover
- **Commits:** bf48136 (AutoTrustDetector class), 83b05c4 (integration + wiring)
- **Files created:** `sidecar/src/autoTrust.ts`
- **Files modified (additive only):** `sidecar/src/batchedPtySession.ts`, `sidecar/src/protocol.ts`, `src/protocol.ts`, `sidecar/src/server.ts`
- **Default:** `autoTrust: false` in both `sidecarFlags` and `featureFlagStore` — safety-critical, user must opt in
- **Deferred write pattern:** `ptyWrite` closure variable set after `PTYSession` construction; `onAccept` calls `ptyWrite?.('\r')`
- **Proxy intercept order:** `autoTrust.feed()` → `batcher.push()` — raw output seen by detector before batching
- **Frontend event:** `auto-trust-event` message sent on `accepted` or `blocked` — no frontend handler yet (future phase)
- **Gotcha:** `AutoTrustDetector.destroy()` is called in `BatchedPTYSession.destroy()` before batcher — ensure timer cleanup on session teardown

### Phase 3 Handover
*(pending)*

### Phase 4 Handover
*(pending)*

### Phase 5 Handover
*(pending)*

### Phase 6 Handover
*(pending)*

### Phase 7 Handover
*(pending)*

### Phase 8 Handover
*(pending)*

### Phase 9 Handover
*(pending)*

### Phase 10 Handover
*(pending)*
