<overview>
purpose: enable ANY LLM client to connect to Chat Overlay Widget's MCP server
transport: stdio (JSON-RPC over stdin/stdout)
protocol: Model Context Protocol (MCP) v1.x
platform: Windows 11 only
runtime: Node.js 18 or 20 LTS
</overview>

<prerequisites>
<critical>
ALL THREE conditions MUST be true before the MCP server will respond to any tool call:
1. Node.js 18+ installed and on PATH
2. sidecar built — file `sidecar/dist/mcp-server.js` exists
3. Chat Overlay Widget app is running — the sidecar writes a discovery file at startup
</critical>

node-check: run `node --version` — must print v18.x or v20.x
build-check: run `ls sidecar/dist/mcp-server.js` — file must exist
app-check: file `%APPDATA%/chat-overlay-widget/api.port` must exist and contain valid JSON

<if-sidecar-not-built>
cd sidecar
npm install
npm run build
</if-sidecar-not-built>
</prerequisites>

<architecture>
<critical>
The MCP server is NOT the app itself. It is a THIN PROXY that forwards tool calls to the running sidecar over localhost HTTP.

data-flow: LLM client --[stdio JSON-RPC]--> mcp-server.js --[HTTP 127.0.0.1:{port}]--> running sidecar

The MCP server discovers the sidecar's port and auth token by reading a discovery file.
discovery-file-path: %APPDATA%/chat-overlay-widget/api.port
discovery-file-format: {"port": <number>, "token": "<string>"}
discovery-file-lifecycle: created when app starts, deleted when app exits
</critical>

<failure-mode>
If the app is not running, every tool call returns: "Chat Overlay Widget not running. Start the app first."
This is NOT a bug. Start the app, then retry.
</failure-mode>
</architecture>

<connection>
transport: stdio ONLY — the MCP server reads JSON-RPC from stdin, writes JSON-RPC to stdout
logging: all diagnostic output goes to stderr (never contaminates the protocol stream)
server-name: chat-overlay-widget
server-version: 1.0.0

<critical>
The MCP server entry point is a COMPILED JavaScript file, not TypeScript.
entry-point-absolute: C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js
entry-point-relative (from repo root): sidecar/dist/mcp-server.js
launch-command: node sidecar/dist/mcp-server.js

DO NOT run `node sidecar/src/mcp-server.ts` — that is the source file. It will fail.
DO NOT run `node sidecar/dist/server.js` — that launches the full sidecar with PTY, not the MCP server.
DO NOT run `node sidecar/dist/server.js mcp` — that is an internal code path used by the bundled exe only.
</critical>
</connection>

<configuration>
<for-claude-code>
file: .mcp.json (in project root)
content:
```json
{
  "mcpServers": {
    "chat-overlay": {
      "command": "node",
      "args": ["C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js"]
    }
  }
}
```
</for-claude-code>

<for-claude-desktop>
file: %APPDATA%/Claude/claude_desktop_config.json
action: add the following entry inside the "mcpServers" object
```json
"chat-overlay": {
  "command": "node",
  "args": ["C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js"]
}
```
</for-claude-desktop>

<for-cursor>
location: Cursor Settings > MCP Servers > Add Server
type: stdio
command: node
args: C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js
</for-cursor>

<for-windsurf>
file: ~/.windsurf/mcp_config.json
action: add the following entry inside the "mcpServers" object
```json
"chat-overlay": {
  "command": "node",
  "args": ["C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js"]
}
```
</for-windsurf>

<for-continue-dev>
file: ~/.continue/config.json
action: add to the "experimental.modelContextProtocolServers" array
```json
{
  "transport": { "type": "stdio", "command": "node", "args": ["C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js"] }
}
```
</for-continue-dev>

<for-cline>
file: VS Code settings or .cline/mcp_settings.json
```json
{
  "mcpServers": {
    "chat-overlay": {
      "command": "node",
      "args": ["C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js"]
    }
  }
}
```
</for-cline>

<for-any-unknown-client>
<critical>
If your client supports MCP over stdio, the universal config is:
command: node
args: ["C:/Users/anujd/Documents/01_AI/214_Chat_overlay_widget/sidecar/dist/mcp-server.js"]
transport: stdio
encoding: utf-8
protocol: JSON-RPC 2.0 over stdin/stdout

No environment variables are required.
No API keys are required for the MCP server itself.
No network ports need to be opened — the server communicates with the sidecar over loopback only.
</critical>
</for-any-unknown-client>
</configuration>

<tools>
total-count: 20

<tool name="read_terminal_output">
purpose: read the current terminal buffer from the running Chat Overlay Widget
returns: text — JSON object with terminal lines, ANSI stripped, secrets scrubbed
parameters:
  - lines: integer, 1-500, default 50, number of lines to return
  - since: integer, optional, cursor from previous call for pagination (returns only new lines)
  - paneId: string, optional, target pane ID for multi-PTY
use-when: you need to see what is currently displayed in the terminal
flags: none (always available)
</tool>

<tool name="query_session_history">
purpose: query historical terminal output from a past session stored in SQLite
returns: text — JSON object with historical terminal lines, secrets scrubbed
parameters:
  - sessionId: integer, required, the session ID to query
  - lines: integer, 1-500, default 100, number of lines to return
use-when: you need terminal output from a previous session, not the current one
flags: none (always available)
</tool>

<tool name="capture_screenshot">
purpose: capture a PNG screenshot of the Chat Overlay Widget window
returns: image — base64-encoded PNG with sensitive areas blurred
parameters: none
use-when: you need to see the visual state of the application window
flags: none (always available)
<note>only useful for multimodal LLMs that can process images</note>
</tool>

<tool name="send_annotation">
purpose: draw visual annotations (boxes, arrows, text, highlights) on the transparent overlay window
returns: text — confirmation with count of active annotations
parameters:
  - action: enum, required, one of: set | merge | clear | clear-group | clear-all
  - annotations: array, required for set/merge — each item has:
      id: string, required, unique identifier
      type: enum, required, one of: box | arrow | text | highlight
      x: integer, required, 0-10000, pixels from left
      y: integer, required, 0-10000, pixels from top
      width: integer, optional, 0-10000, pixels
      height: integer, optional, 0-10000, pixels
      label: string, optional, max 500 chars, text to display
      color: string, optional, hex format #RRGGBB, default #ff3e00
      ttl: integer, optional, 0-3600, auto-expire after N seconds (0 = never)
      group: string, optional, max 100 chars, for batch clearing
  - ids: array of strings, required for clear action
  - group: string, required for clear-group action
use-when: you need to visually highlight something on screen for the user
flags: annotationOverlay
</tool>

<tool name="start_guided_walkthrough">
purpose: start a multi-step guided walkthrough with per-step annotations
returns: text — JSON with walkthrough state and first step details
parameters:
  - id: string, required, unique walkthrough identifier
  - title: string, required, max 300 chars
  - steps: array, required, 1-50 items, each step has:
      stepId: string, required, unique step identifier
      title: string, required, max 200 chars
      instruction: string, required, max 1000 chars, what the user should do
      annotations: array, required, max 50 items, same schema as send_annotation annotations
      advanceWhen: optional, one of: terminal-match (pattern), pixel-sample (regions), screenshot-diff (threshold), manual
use-when: guiding a user through a multi-step process
flags: guidedWalkthrough
<critical>only one walkthrough can be active at a time — starting a new one replaces the previous</critical>
</tool>

<tool name="advance_walkthrough">
purpose: move to the next step in the active guided walkthrough
returns: text — JSON with next step details or completion indicator
parameters: none
use-when: the user has completed the current walkthrough step and is ready for the next
flags: guidedWalkthrough
</tool>

<tool name="stop_walkthrough">
purpose: stop the active walkthrough and clear all its annotations
returns: text — confirmation message
parameters: none
use-when: the user wants to exit the walkthrough early or the walkthrough is complete
flags: guidedWalkthrough
</tool>

<tool name="write_terminal">
purpose: type text into the terminal (as if the user typed it)
returns: text — confirmation
parameters:
  - text: string, required, text to type (can include \n for Enter)
  - paneId: string, optional, target pane for multi-PTY
use-when: you need to execute shell commands or type into the terminal
flags: terminalWriteMcp
</tool>

<tool name="get_ui_elements">
purpose: discover UI elements (buttons, inputs, labels, menus) in a window via Windows UI Automation
returns: text — JSON tree of UI elements with names, roles, bounding rects, automation IDs
parameters:
  - hwnd: number, optional, target window handle
  - title: string, optional, target window title (alternative to hwnd)
  - maxDepth: integer, optional, default 5, how deep to traverse the UI tree
  - roleFilter: string, optional, filter by element role (e.g., "Button", "Edit")
use-when: you need to discover what UI elements exist on screen before interacting with them
flags: uiAccessibility
</tool>

<tool name="send_input">
purpose: simulate mouse clicks, keyboard input, key combos, or drag operations
returns: text — confirmation or error
parameters:
  - action: enum, required, one of: click | type | keyCombo | drag
  - x, y: numbers, required for click/drag, screen coordinates
  - text: string, required for type action
  - keys: array of strings, required for keyCombo (e.g., ["ctrl", "c"])
  - button: string, optional for click, "left" or "right"
  - target: string, optional, target window title (for window focus)
  - hwnd: number, optional, target window handle
use-when: you need to interact with a GUI application
flags: osInputSimulation + uiAccessibility + consentGate
<note>when windowFocusManager is enabled, automatically focuses the target window first</note>
<note>when batchConsent is enabled, can be pre-approved via submit_action_plan</note>
</tool>

<tool name="bind_annotation_to_element">
purpose: bind an annotation to a UI element so it tracks the element's position when windows scroll/resize
returns: text — confirmation with annotation ID and binding strategy
parameters:
  - annotationId: string, required, ID of an existing annotation
  - strategy: enum, required, one of: automationId | nameRole | coordinates
  - automationId: string, optional, for automationId strategy
  - name: string, optional, for nameRole strategy
  - role: string, optional, for nameRole strategy
  - hwnd: number, required, target window handle
  - offsetX, offsetY: numbers, optional, pixel offset from element
use-when: you want annotations to follow UI elements when windows move or scroll
flags: elementBoundAnnotations + uiAccessibility
</tool>

<tool name="submit_action_plan">
purpose: submit a batch of N actions for the user to approve all at once
returns: text — { approved: boolean, planId: string }
parameters:
  - planId: string, required, unique plan identifier
  - description: string, required, human-readable description of the plan
  - actions: array, required, list of actions with type and description
  - targetWindow: string, optional, target window for the plan
use-when: you need to execute many actions and want the user to approve them as a group
flags: batchConsent + consentGate
<note>plans expire after 5 minutes; each action consumed exactly once</note>
</tool>

<tool name="request_trust_window">
purpose: request time-limited trust for a window — all actions of specified types execute without prompts
returns: text — { approved: boolean, trustId: string, expiresAt: number }
parameters:
  - targetTitle: string, required, window title to trust
  - durationSec: integer, required, 1-120 seconds
  - allowedActions: array of strings, required, subset of [click, type, keyCombo, drag]
use-when: you need rapid automation and per-action consent is too slow
flags: batchConsent + consentGate
<note>hard-capped at 120 seconds; auto-revokes on disconnect</note>
</tool>

<tool name="focus_window">
purpose: bring a specific window to the foreground
returns: text — { ok: boolean, hwnd: number }
parameters:
  - hwnd: number, optional, window handle
  - title: string, optional, window title (searches for match)
use-when: you need to ensure the target window is in the foreground before interacting with it
flags: windowFocusManager
</tool>

<tool name="clipboard">
purpose: read, write, or paste clipboard text
returns: text — { ok: boolean, text?: string }
parameters:
  - action: enum, required, one of: read | write | paste
  - text: string, required for write/paste
  - clearAfterPaste: boolean, optional, clear clipboard after pasting
use-when: you need to transfer text via clipboard (faster than typing, handles special characters)
flags: clipboardAccess (paste also requires osInputSimulation + consentGate)
<note>clipboard contents are never logged; text passed via stdin to prevent shell injection</note>
</tool>

<tool name="web_fetch">
purpose: fetch a web page and extract readable text (for documentation lookups)
returns: text — { ok, url, statusCode, text, truncated, cached }
parameters:
  - url: string, required, must be https://
  - extractText: boolean, optional, default true, strip HTML and return plain text
use-when: you need to look up API docs, tutorials, or reference material
flags: webFetchTool
<note>HTTPS only; private IPs blocked; rate limit 10/min; 50KB max text; 5-min cache</note>
</tool>

<tool name="manage_tasks">
purpose: submit, list, get, or cancel named tasks running across PTY sessions
returns: text — task object(s) with status
parameters:
  - action: enum, required, one of: submit | list | get | cancel
  - taskId: string, required for get/cancel
  - name: string, required for submit
  - command: string, required for submit
  - paneId: string, required for submit
  - exitPattern: string, optional, regex to detect completion
  - failPattern: string, optional, regex to detect failure
  - timeoutMs: integer, optional, default 300000 (5 min)
use-when: you need to run and track shell commands across multiple terminal panes
flags: agentTaskOrchestrator + multiPty + terminalWriteMcp
<note>max 20 tasks; auto-clean after 10 min; timeout sends Ctrl+C</note>
</tool>

<tool name="verify_walkthrough_step">
purpose: verify the current walkthrough step completed via screenshot analysis
returns: text — { passed: boolean, strategy, details } + optional screenshot image
parameters: none (verifies current active step's advanceWhen criteria)
use-when: you need visual confirmation that a walkthrough step succeeded
flags: screenshotVerification + guidedWalkthrough
<note>supports pixel-sample (color/brightness check), screenshot-diff (image comparison), and manual strategies</note>
</tool>

<tool name="interact_with_element">
purpose: search for UI elements, invoke buttons, set input values, or query supported patterns — all via native UI Automation (no SendInput)
returns: text — element data, action result, or pattern list
parameters:
  - action: enum, required, one of: search | invoke | setValue | getPatterns
  - hwnd: number, optional, target window handle
  - title: string, optional, target window title
  - automationId: string, optional, element automation ID
  - name: string, optional, element name
  - role: string, optional, element role/control type
  - searchText: string, required for search, text to find in elements
  - searchProperty: enum, optional for search, one of: name | automationId | className
  - value: string, required for setValue
  - maxResults: integer, optional, default 10
  - maxDepth: integer, optional, default 8
use-when: you need to interact with UI elements without coordinate-based clicking
flags: enhancedAccessibility + uiAccessibility (invoke/setValue also require consentGate)
<note>invoke uses IInvokePattern; setValue uses IValuePattern — both are native and more reliable than SendInput</note>
</tool>

<tool name="workflow">
purpose: record, save, list, replay, or delete reusable workflows
returns: text — workflow data, recording status, or replay progress
parameters:
  - action: enum, required, one of: startRecording | addStep | stopRecording | list | get | delete | replay
  - workflowId: string, required for get/delete/replay
  - name: string, required for startRecording
  - description: string, required for startRecording
  - tool: string, required for addStep (MCP tool name)
  - params: object, required for addStep
  - startFromStep: integer, optional for replay
  - dryRun: boolean, optional for replay (log without executing)
  - pauseBeforeEach: boolean, optional for replay (consent per step)
use-when: you want to record a sequence of actions for later replay
flags: workflowRecording
<note>max 100 workflows, 200 steps each; stored in %APPDATA%/chat-overlay-widget/workflows/</note>
</tool>
</tools>

<verification>
<critical>
After configuring your MCP client, verify the connection works with this sequence:

step-1: ensure Chat Overlay Widget app is running
step-2: call read_terminal_output with no arguments (uses defaults: 50 lines)
step-3: expected result — JSON text containing terminal buffer lines
step-4: if you get "Chat Overlay Widget not running" — the app is not started, start it first
step-5: if you get a connection error — check that %APPDATA%/chat-overlay-widget/api.port exists and contains valid JSON
</critical>
</verification>

<troubleshooting>
<problem>
symptom: "Chat Overlay Widget not running. Start the app first."
cause: the discovery file does not exist because the app is not running
fix: start the Chat Overlay Widget app, then retry
</problem>

<problem>
symptom: "Chat Overlay Widget not reachable: connect ECONNREFUSED"
cause: discovery file exists but the sidecar process has crashed or the port is stale
fix: restart the Chat Overlay Widget app — this deletes the stale file and writes a fresh one
</problem>

<problem>
symptom: MCP client says "server not found" or "failed to start server"
cause: incorrect path to mcp-server.js or Node.js not on PATH
fix: verify `node --version` works and the absolute path to mcp-server.js is correct
</problem>

<problem>
symptom: "Cannot find module" error on startup
cause: sidecar not built — dist/ directory is missing compiled JS
fix: cd sidecar && npm install && npm run build
</problem>

<problem>
symptom: tool call returns HTTP 401
cause: auth token mismatch — can happen if app was restarted while MCP server was running
fix: restart both the app and the MCP server (the client will relaunch it)
</problem>
</troubleshooting>

<security>
auth: the sidecar generates a random bearer token per session, stored in the discovery file
network: all traffic is 127.0.0.1 loopback only — never exposed to the network
secret-scrubbing: terminal output is scrubbed for secrets before being returned via MCP
screenshot-blurring: sensitive areas are blurred in captured screenshots
<critical>
The discovery file at %APPDATA%/chat-overlay-widget/api.port contains a bearer token.
DO NOT expose this file to remote systems or commit it to version control.
The file is automatically created and deleted by the app lifecycle.
</critical>
</security>
