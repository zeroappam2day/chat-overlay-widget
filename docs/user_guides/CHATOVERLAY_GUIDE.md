# Chat Overlay Widget — End User Guide

> **What this is:** A Tauri desktop app that wraps Claude Code's CLI in a GUI with an MCP-powered agent toolkit. The LLM can see your screen, read your terminal, draw annotations, focus windows, type text, click buttons, manage tasks across multiple terminals, fetch documentation, discover skills, record workflows, and more — all through 22 MCP tools gated behind feature flags you control. Two interactive modes — **Walk Me Through** (guided observation) and **Work With Me** (collaborative action) — let you activate the right capabilities with a single click.

---

## 1. Getting Started

### Launch the app
```
start.bat          # starts the Tauri app + Node.js sidecar
```

### Stop the app
```
stop.bat           # cleanly shuts down both processes
```

### Verify MCP connection
Once the app is running, any MCP-compatible LLM client (Claude Code, Cursor, Windsurf, etc.) can connect. The MCP server discovers the running app automatically via `%APPDATA%/chat-overlay-widget/api.port`.

Test from Claude Code:
```
Use read_terminal_output to see what's in my terminal
```
If it returns terminal text, you're connected.

---

## 2. Feature Flags — You Control What the LLM Can Do

Every agent capability is behind a feature flag (default OFF for safety-critical features). Toggle them via the **gear icon** in the header bar.

### Core Flags (ON by default)
| Flag | Purpose |
|------|---------|
| Output Batching | Groups rapid terminal output into fewer UI updates |
| Plan Watcher | Watches for plan files and shows them in the UI |
| Diff Viewer | Renders git diffs with syntax highlighting |
| Terminal Bookmarks | Save/recall positions in terminal output |
| Prompt History | Remembers commands you've sent |
| Keyboard Navigation | Enables Alt+Shift+X and other shortcuts |
| Enhanced Persistence | Saves layout, flags, and window state across restarts |

### Agent Runtime Flags (OFF by default — enable to unlock agent capabilities)
| Flag | What it unlocks | Safety |
|------|----------------|--------|
| **Terminal Write (MCP)** | LLM can type commands into your terminal | LLM can execute shell commands |
| **Conditional Walkthrough Advance** | Walkthroughs auto-advance when terminal output matches a pattern | Passive — just watches output |
| **Multi-PTY Panes** | LLM can spawn up to 4 terminal sessions | Multiple shells running |
| **UI Accessibility Tree** | LLM can discover UI elements on screen (buttons, inputs, labels) | Read-only inspection |
| **OS Input Simulation** | LLM can simulate mouse clicks and keyboard input | LLM controls your mouse/keyboard |
| **Action Consent Gate** | Every simulated input requires your approval via modal dialog | **Required safety gate for input simulation** |
| **Annotation Overlay** | LLM can draw boxes, arrows, text, and highlights on your screen | Visual only — click-through |
| **Guided Walkthrough Panel** | Shows step-by-step panel during walkthroughs | Visual only |

### Enhanced Agent Capabilities (EAC) Flags (OFF by default)
| Flag | What it unlocks | Depends on |
|------|----------------|------------|
| **Element-Bound Annotations** | Annotations track UI elements when windows scroll/resize | UI Accessibility Tree |
| **Batch Consent** | Approve a plan of N actions at once, or grant time-limited trust | Action Consent Gate |
| **Window Focus Manager** | LLM auto-focuses the target window before input | OS Input Simulation |
| **Clipboard Access** | LLM can read/write clipboard and paste via Ctrl+V | OS Input Simulation + Consent Gate |
| **Web Fetch Tool** | LLM can fetch web pages for documentation lookups | None (standalone) |
| **Agent Task Orchestrator** | LLM manages named tasks across PTY sessions with lifecycle tracking | Multi-PTY + Terminal Write |
| **Screenshot Verification** | Walkthroughs verify step completion via pixel sampling or screenshot diff | Guided Walkthrough |
| **Enhanced Accessibility** | Deeper UI tree search + native Invoke/SetValue (no SendInput needed) | UI Accessibility Tree |
| **Workflow Recording** | Record, save, and replay sequences of agent actions as workflow files | None (uses all above) |

### Interactive Mode Flags (OFF by default)
| Flag | What it unlocks |
|------|----------------|
| **External Window Capture** | LLM can list and screenshot external application windows (not just the overlay) |
| **Skill Discovery** | LLM can query the Postgres skill index to find relevant skills for the current task |
| **Multi-PTY Panes** | LLM can spawn up to 4 terminal sessions |
| **Consent Gate** | Every simulated input requires your approval via modal dialog |

> **Tip:** You rarely need to toggle these individually. Use the **Walk Me Through** or **Work With Me** buttons in the header bar instead — they activate the right flags automatically and restore your settings when you stop.

---

## 3. The 22 MCP Tools

| # | Tool | What it does | Required flags |
|---|------|-------------|----------------|
| 1 | `read_terminal_output` | Read current terminal buffer | (always available) |
| 2 | `query_session_history` | Query past session output from SQLite | (always available) |
| 3 | `capture_screenshot` | Capture the app window as an image | (always available) |
| 4 | `send_annotation` | Draw/update/clear annotations on overlay | annotationOverlay |
| 5 | `start_guided_walkthrough` | Start a multi-step guided walkthrough | guidedWalkthrough |
| 6 | `advance_walkthrough` | Move to the next walkthrough step | guidedWalkthrough |
| 7 | `stop_walkthrough` | Stop walkthrough and clear annotations | guidedWalkthrough |
| 8 | `modify_walkthrough` | Dynamically append/replace/update walkthrough steps | guidedWalkthrough |
| 9 | `write_terminal` | Type text into the terminal | terminalWriteMcp |
| 10 | `submit_action_plan` | Submit a batch of N actions for one-click approval | batchConsent |
| 11 | `request_trust_window` | Request time-limited trust (up to 120s) for a target window | batchConsent |
| 12 | `focus_window` | Focus a specific window by handle or title | windowFocusManager |
| 13 | `clipboard` | Read, write, or paste clipboard text | clipboardAccess |
| 14 | `web_fetch` | Fetch a web page and extract readable text | webFetchTool |
| 15 | `manage_tasks` | Submit/list/cancel named tasks across PTY sessions | agentTaskOrchestrator |
| 16 | `verify_walkthrough_step` | Verify walkthrough step via pixel sampling or screenshot diff | screenshotVerification + guidedWalkthrough |
| 17 | `interact_with_element` | Search/invoke/set value on UI elements natively | enhancedAccessibility |
| 18 | `workflow` | Record, save, replay sequences of actions | workflowRecording |
| 19 | `list_external_windows` | List all visible desktop windows with titles and handles | externalWindowCapture |
| 20 | `capture_external_window` | Capture screenshot of an external app window (vision-optimized) | externalWindowCapture |
| 21 | `discover_skills` | Query the Postgres skill index for relevant skills by context | skillDiscovery |
| 22 | `announce_action` | Announce an intended action to the user before executing (2s delay) | batchConsent |

---

## 4. Interactive Modes

Instead of toggling individual flags, use the two interactive modes in the header bar. Each mode activates the right flags, and restores your previous settings when you stop.

### Walk Me Through (observation-only)

> *The LLM watches your screen and guides you step-by-step. It does NOT take any actions on your behalf.*

**Activate:** Click the **Walk Me Through** button in the header bar, or press **Alt+Shift+W**.

**What gets enabled:** Annotation Overlay, Guided Walkthrough, Conditional Advance, Screenshot Verification, Web Fetch, External Window Capture (6 flags).

**What the LLM can do during this mode:**
- See your screen via `list_external_windows` and `capture_external_window`
- Create adaptive walkthroughs with `start_guided_walkthrough` and `modify_walkthrough`
- Draw annotations and highlights via `send_annotation`
- Research documentation via `web_fetch`
- Verify step completion via `verify_walkthrough_step`

**What the LLM cannot do:** Type in your terminal, click buttons, paste text, or take any action.

**Stop:** Click the red **Stop** button in the status bar, or press **Alt+Shift+W** again. All annotations clear, walkthroughs stop, and your flags return to their previous state.

### Work With Me (collaborative action)

> *The LLM works alongside you — it can interact with applications, discover skills, and coordinate actions with you.*

**Activate:** Click the **Work With Me** button in the header bar, or press **Alt+Shift+M**.

**What gets enabled:** All 14 agent flags — everything from Walk Me Through plus Terminal Write, Batch Consent, Window Focus Manager, Clipboard Access, Agent Task Orchestrator, Enhanced Accessibility, Workflow Recording, and Skill Discovery.

**What the LLM can do during this mode:**
- Everything from Walk Me Through, plus:
- Discover relevant skills via `discover_skills` (queries the Postgres skill index)
- Announce intended actions via `announce_action` (shows an orange highlight for 2 seconds — you can cancel)
- Type terminal commands, paste clipboard text, focus windows, invoke UI elements
- Record and replay workflows

**Action coordination:** Before the LLM acts on your screen, it calls `announce_action` which shows an orange annotation describing what it's about to do. You have 2 seconds to cancel via the overlay. This prevents the LLM and you from acting on the same window simultaneously.

**Stop:** Click **Stop** or press **Alt+Shift+M**. All consent grants are revoked, pending actions are cancelled, walkthroughs stop, and flags restore.

### Crash recovery

If the app crashes or is force-killed during an active mode, a recovery marker file at `%APPDATA%/chat-overlay-widget/active-mode.json` preserves your pre-mode flag settings. On next startup, the sidecar detects this file, restores your flags, and deletes the marker.

### Mutual exclusion

Only one mode can be active at a time. While Walk Me Through is active, the Work With Me button is disabled (and vice versa). Attempting to activate a second mode via WebSocket returns an error.

---

## 5. Real-World Scenarios

### Scenario A: Multi-Step GUI Task (e.g., Create a Google Sheets Macro)

> *"Create a macro in Google Sheets that auto-formats my data table"*

**What the user needs to enable:**
- UI Accessibility Tree
- OS Input Simulation
- Action Consent Gate
- Window Focus Manager
- Batch Consent (for efficiency)
- Clipboard Access (for pasting code)

**What happens:**

1. **LLM discovers the screen** — Calls `get_ui_elements` to find the Google Sheets window, its toolbar, menu items, and cells.

2. **LLM focuses the target** — Calls `focus_window` with the Google Sheets window title. The Window Focus Manager calls `SetForegroundWindow` to bring it to the front and verifies it's active.

3. **LLM submits a batch plan** — Instead of asking you to approve 30 individual clicks, the LLM calls `submit_action_plan` with all the steps described:
   ```
   Plan: "Create auto-format macro"
   1. Click Extensions menu
   2. Click Apps Script
   3. Wait for editor to load
   4. Select all existing code (Ctrl+A)
   5. Paste macro code
   6. Click Save
   7. Click Run
   ...
   ```
   You see the full plan in a dialog and approve or deny with one click.

4. **LLM executes the plan** — Each approved action is consumed one by one. `send_input` simulates clicks and key combos. `clipboard` pastes the macro code (faster than typing character-by-character via SendInput).

5. **Annotations track progress** — `send_annotation` draws a box around the current target. With `bind_annotation_to_element`, the box moves with the element if you scroll.

6. **OR: Use time-limited trust** — For rapid sequences, the LLM calls `request_trust_window` to request 60 seconds of trust for the Google Sheets window. You approve once, and all actions execute without prompts for 60 seconds.

**Safety:**
- Batch plans expire after 5 minutes if not fully consumed
- Each action can only be consumed once (no replay)
- Trust auto-revokes if you close the app or disconnect
- Trust hard-capped at 120 seconds

---

### Scenario B: LLM Needs Documentation (e.g., Google Sheets API, Windows COM)

> *"How do I use the Google Sheets API to create a pivot table?"*

**What the user needs to enable:**
- Web Fetch Tool

**What happens:**

1. **LLM fetches documentation** — Calls `web_fetch` with the relevant URL:
   ```
   web_fetch("https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets")
   ```
   The tool fetches the page, strips HTML/scripts/nav, extracts the readable text (max 50KB), and returns it to the LLM.

2. **LLM reads and applies** — With the official documentation in context, the LLM can give accurate, up-to-date instructions rather than relying on training data that may be stale.

3. **Caching** — If the LLM fetches the same URL again within 5 minutes, it gets a cached result instantly.

**Safety:**
- HTTPS only (HTTP rejected)
- Private/internal IPs blocked (SSRF protection)
- Rate limited: 10 requests per minute
- Max 2MB response, 50KB extracted text
- No cookies, no authentication forwarding
- No new npm dependencies (uses Node.js built-in `fetch`)

---

### Scenario C: LLM Needs to Build Something (e.g., User's Custom App)

> *"Add a dark mode toggle to my React app"*

**What the user needs to enable:**
- Terminal Write (MCP)
- Multi-PTY Panes
- Agent Task Orchestrator

**What happens:**

1. **LLM spawns a work terminal** — With Multi-PTY, the LLM can use a separate pane so your main terminal stays untouched.

2. **LLM submits tasks** — Calls `manage_tasks` to submit named tasks:
   ```
   Task: "Install dependencies"
   Pane: pane-2
   Command: npm install @radix-ui/react-switch
   Exit Pattern: "added \\d+ packages"
   Fail Pattern: "ERR!"
   ```

3. **Task lifecycle tracking** — The orchestrator monitors terminal output:
   - `pending` → `running` when the command is written
   - Output matched `"added 5 packages"` → `completed`
   - Or if matched `"ERR!"` → `failed`
   - If no match after 5 minutes → `timeout` + Ctrl+C sent automatically

4. **LLM writes code** — Uses `write_terminal` to run editor commands or `git diff` to verify changes. The LLM reads terminal output between commands to check results.

5. **Parallel work** — The LLM can submit tasks to different panes simultaneously. For example:
   - Pane 1: Running `npm test --watch`
   - Pane 2: Editing files and running build
   - Pane 3: Running the dev server

6. **Status at any time** — `manage_tasks` with action `list` returns all tasks with their current status, so the LLM knows what finished, what failed, and what's still running.

**Safety:**
- Max 20 concurrent tasks
- Completed tasks auto-cleaned after 10 minutes
- Each task has a configurable timeout (default 5 min)
- Timed-out tasks receive Ctrl+C

---

### Scenario D: LLM Interacts with a Live Application (e.g., Google Sheets Dashboard)

> *"Build me a sales dashboard in Google Sheets with charts and formatting"*

**What the user needs to enable:**
- All Agent Runtime flags (Terminal Write, Multi-PTY, UI Accessibility, OS Input, Consent Gate)
- Window Focus Manager
- Batch Consent
- Clipboard Access
- Enhanced Accessibility
- Element-Bound Annotations
- Screenshot Verification (optional, for visual confirmation)
- Workflow Recording (optional, to save the process for replay)

**What happens — full flow:**

**Phase 1: Research**
1. LLM calls `web_fetch` to pull Google Sheets formula references and chart API docs.

**Phase 2: Discover the UI**
2. LLM calls `get_ui_elements` on the Chrome/Edge window to find the spreadsheet, cells, menus, and toolbar buttons.
3. LLM calls `interact_with_element` with action `search` to find specific elements like "Insert" menu, "Chart" button, or cell A1.

**Phase 3: Start recording (optional)**
4. If workflow recording is on, LLM calls `workflow` with action `startRecording` to capture every action for replay later.

**Phase 4: Execute the work**
5. LLM calls `focus_window` to bring Google Sheets to the foreground.
6. LLM calls `submit_action_plan` with a batch of actions:
   - Navigate to cell A1
   - Type column headers (via `clipboard` paste — faster and handles special characters)
   - Enter formulas in cells
   - Select data range
   - Insert chart
   - Format cells
7. You approve the plan. Actions execute sequentially.
8. For elements that support it, LLM uses `interact_with_element` with action `setValue` — this uses Windows UI Automation's native `IValuePattern`, which is more reliable than simulating keystrokes.
9. For buttons, `interact_with_element` with action `invoke` uses native `IInvokePattern` — no coordinate-based clicking needed.

**Phase 5: Annotate and guide**
10. As work progresses, `send_annotation` draws highlights on the current target area.
11. `bind_annotation_to_element` keeps annotations pinned to UI elements — if you scroll the spreadsheet, the annotation follows.

**Phase 6: Verify**
12. After key steps, LLM calls `verify_walkthrough_step` with `pixel-sample` strategy to check that a chart appeared where expected, or `screenshot-diff` to compare before/after states.
13. If verification fails, LLM adjusts and retries.

**Phase 7: Save workflow**
14. LLM calls `workflow` with action `stopRecording`. The workflow is saved as a JSON file in `%APPDATA%/chat-overlay-widget/workflows/`.
15. Next time you need to create a similar dashboard, LLM calls `workflow` with action `replay` — optionally with `dryRun: true` to preview, or `pauseBeforeEach: true` to approve each step.

---

## 6. Consent & Safety Model

### Three consent modes

| Mode | How it works | When to use |
|------|-------------|-------------|
| **Per-action** (default) | Every `send_input` action shows a modal dialog. You have 30 seconds to approve or deny. | Small tasks, high caution |
| **Batch consent** | LLM submits a full plan. You review all actions at once and approve/deny the entire batch. | Multi-step workflows (10-30+ actions) |
| **Time-limited trust** | You grant trust for a specific window + action types for up to 120 seconds. | Rapid automation where per-action approval is too slow |

### Safety invariants
- **Plans expire** after 5 minutes if not fully consumed
- **Trust hard-capped** at 120 seconds (server rejects longer)
- **Each action consumed once** — no replay of approved actions
- **Trust auto-revokes** on WebSocket disconnect (you closed the app)
- **All consent requires `consentGate` flag** — turn it off to instantly block all input simulation
- **Clipboard contents never logged** (may contain passwords)
- **Web fetch is HTTPS-only** with SSRF protection (private IPs blocked)
- **Secret scrubbing** on all terminal output before the LLM sees it

---

## 7. Workflow Recording & Replay

Record any sequence of agent actions for later replay:

```
1. Enable "Workflow Recording" flag
2. Ask the LLM: "Record a workflow while you create this dashboard"
3. LLM calls workflow(action: 'startRecording', name: 'Sales Dashboard', description: '...')
4. LLM performs the work normally — each tool call is recorded as a workflow step
5. LLM calls workflow(action: 'stopRecording')
6. Workflow saved to %APPDATA%/chat-overlay-widget/workflows/
```

### Replay options
| Option | Effect |
|--------|--------|
| Normal replay | Steps execute sequentially with configurable delays |
| `dryRun: true` | Logs every action without executing — preview what will happen |
| `pauseBeforeEach: true` | Requires consent per step during replay |
| `startFromStep: N` | Skip to step N (resume a partial replay) |

### Limits
- Max 100 saved workflows
- Max 200 steps per workflow
- Workflow metadata records which feature flags are required

---

## 8. Task Orchestration Across Multiple Terminals

With Multi-PTY + Agent Task Orchestrator:

```
Terminal Layout:
┌──────────────────┬──────────────────┐
│ Pane 1 (main)    │ Pane 2 (build)   │
│ Your terminal    │ npm run build    │
│                  │ [RUNNING]        │
├──────────────────┼──────────────────┤
│ Pane 3 (test)    │ Pane 4 (server)  │
│ npm test --watch │ npm run dev      │
│ [COMPLETED]      │ [RUNNING]        │
└──────────────────┴──────────────────┘
```

The LLM can:
- Submit tasks to specific panes
- Monitor output for success/failure patterns
- Auto-detect completion via regex matching
- Cancel stuck tasks (sends Ctrl+C)
- List all task statuses at any time
- Run up to 20 tasks concurrently

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| "Chat Overlay Widget not running" | Start the app with `start.bat` |
| "Feature disabled. Enable the X flag." | Open gear icon, toggle the named flag ON |
| Annotations don't appear | Enable "Annotation Overlay" flag + click pen icon (or Alt+Shift+X) |
| Annotations in wrong position | Coordinates are screen pixels from top-left. Check display scaling (DPI). |
| Input simulation does nothing | Enable ALL THREE flags: OS Input Simulation + UI Accessibility Tree + Action Consent Gate |
| Consent dialog timeout | You have 30 seconds to approve. If it times out, the action is denied. Retry. |
| "Could not focus target window" | The target window may be minimized or on another desktop. Restore it first. |
| Clipboard paste failed | Enable Clipboard Access + OS Input Simulation + Action Consent Gate |
| Web fetch rejected | Only HTTPS URLs are allowed. HTTP, file://, and private IPs are blocked. |
| Task stuck in "running" | Use `manage_tasks(action: 'cancel')` to send Ctrl+C, or wait for timeout (default 5 min) |
| Mode won't activate | Another mode is already active. Stop the current mode first. |
| Flags didn't restore after crash | Check `%APPDATA%/chat-overlay-widget/active-mode.json` — delete it manually if it's stuck |
| Skill discovery returns no results | Postgres must be running on localhost:5432 with the `global_db` database |
| "External window capture disabled" | Enable the External Window Capture flag, or activate Walk Me Through / Work With Me mode |
| Announce action not showing | Batch Consent flag must be enabled (activated automatically by Work With Me mode) |
| MCP tool returns 401 | Auth token mismatch. Restart the app. |
| "Cannot find module" | Sidecar not built. Run `cd sidecar && npm install && npm run build` |

---

## 10. Quick Reference: Flag Combinations by Use Case

| I want the LLM to... | Easiest way | Manual flags |
|-----------------------|-------------|-------------|
| Read my terminal | (always available) | (none) |
| Guide me step-by-step | **Walk Me Through** mode | Annotation Overlay + Guided Walkthrough + Conditional Advance + Screenshot Verification + Web Fetch + External Window Capture |
| Watch my screen and advise | **Walk Me Through** mode | External Window Capture |
| Work alongside me on any app | **Work With Me** mode | All 14 agent flags |
| Draw annotations on screen | — | Annotation Overlay |
| Type commands in my terminal | — | Terminal Write (MCP) |
| Run tasks in multiple terminals | — | Terminal Write + Multi-PTY + Agent Task Orchestrator |
| See external app windows | — | External Window Capture |
| Find skills for the current task | — | Skill Discovery |
| Look up documentation online | — | Web Fetch Tool |
| Click buttons without coordinates | — | Enhanced Accessibility |
| Copy/paste text into apps | — | Clipboard Access |
| Verify steps visually | — | Guided Walkthrough + Screenshot Verification |
| Record and replay workflows | — | Workflow Recording |
| Full autonomous agent mode | **Work With Me** mode | ALL flags ON |
