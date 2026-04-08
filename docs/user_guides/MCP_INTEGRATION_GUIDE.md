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
total-count: 22

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

<tool name="modify_walkthrough">
purpose: dynamically modify an active walkthrough — append new steps, replace the current step, or update all remaining steps
returns: text — JSON with updated step counts and current step info
parameters:
  - action: enum, required, one of: append_steps | replace_current_step | update_remaining_steps
  - steps: array, required for append_steps and update_remaining_steps — same step schema as start_guided_walkthrough
  - step: object, required for replace_current_step — single step with stepId, title, instruction, annotations, advanceWhen
use-when: you need to adapt a walkthrough in real-time based on screen observation or user progress
flags: guidedWalkthrough
<note>max 50 steps total across all modifications; replaceCurrentStep re-applies annotations immediately</note>
</tool>

<tool name="list_external_windows">
purpose: list all visible windows on the desktop with titles, process names, and handles
returns: text — formatted numbered list of windows
parameters: none
use-when: you need to discover what applications the user has open before capturing a specific window
flags: externalWindowCapture
</tool>

<tool name="capture_external_window">
purpose: capture a screenshot of an external application window by title — returns a vision-optimized WebP image
returns: image (base64 WebP) + text metadata (dimensions, size, token estimate)
parameters:
  - title: string, required, 1-500 chars, window title or substring (case-insensitive partial match)
use-when: you need to see the visual state of an external application window
flags: externalWindowCapture
<note>use list_external_windows first to discover available windows; image optimized for LLM vision (max 1568px long edge, WebP quality 85)</note>
</tool>

<tool name="discover_skills">
purpose: discover available skills from the Postgres skill index based on the current context
returns: text — ranked list of matching skills with taxonomy, use cases, and instruction summaries
parameters:
  - query: string, required, 1-500 chars, natural language description of what you need
  - windowTitle: string, optional, max 200 chars, title of the user's active window for context-aware matching
use-when: you need to find relevant skills for the user's active application or task (used in Work With Me mode)
flags: skillDiscovery
<note>requires Postgres running on localhost:5432 with global_db database; uses full-text search on tsv column</note>
</tool>

<tool name="announce_action">
purpose: announce an intended action to the user before executing it — shows a highlighted annotation with a configurable delay
returns: text — { cancelled: boolean, actionId: string }
parameters:
  - description: string, required, 1-500 chars, human-readable description of the action
  - x: number, optional, 0-10000, X position for announcement overlay
  - y: number, optional, 0-10000, Y position for announcement overlay
use-when: you are in Work With Me mode and about to perform an action that modifies the user's screen
flags: batchConsent
<note>default 2-second delay; user can cancel via the cancel-pending-action WebSocket message; orange highlight annotation clears after delay</note>
</tool>
</tools>

<screen-recording>
<overview>
Screen recording is available via the `screenrec` CLI tool, invoked through `write_terminal`.
The LLM can record screens, windows, and optionally capture system audio and/or microphone.
tool-path: C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py
runtime: Python 3.11 (already on PATH)
dependencies: dxcam, pywin32, numpy, pyaudiowpatch (already installed)
encoder: h264_nvenc (RTX 4080 GPU) with libx264 CPU fallback
output-format: H.264 MP4 with optional AAC audio
output-location: C:/Users/anujd/Videos/Screen Recordings/
naming-convention: auto-generated from foreground window title — <5char>_<5char>_<5char>_<ddmmm>.mp4
  --output flag overrides auto-naming when provided
</overview>

<workflow name="list-capture-targets">
purpose: discover available screens and windows before recording
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py list --format json\n"
  2. call read_terminal_output to capture the JSON result
  3. parse the JSON array — each element has: name, id, type (display/window), width, height
use-when: you need to know what targets are available before starting a recording
output-schema:
```json
[
  {"name": "\\\\.\\DISPLAY1", "id": "display:0:0", "type": "display", "width": 2560, "height": 1600},
  {"name": "Visual Studio Code", "id": 12345, "type": "window", "width": 1920, "height": 1080}
]
```
</workflow>

<workflow name="record-screen-video-only">
purpose: record a display or window to MP4 (video only, no audio)
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration 30 --fps 30\n"
  2. wait for duration to elapse (or use --stop-file for manual stop)
  3. call read_terminal_output to confirm "Recording saved:" message — output path is printed to stderr
parameters:
  --target: "display:0" for primary display, or window name like "Visual Studio Code" (substring match)
  --output: optional — omit to auto-generate filename in C:/Users/anujd/Videos/Screen Recordings/
  --duration: seconds (omit for indefinite, stop via --stop-file or Ctrl+C)
  --fps: frame rate, default 30
use-when: you need a silent screen recording — demos, bug captures, UI walkthroughs
</workflow>

<workflow name="record-screen-with-system-audio">
purpose: record display/window with system audio (what the user hears from speakers)
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration 30 --fps 30 --audio\n"
  2. wait for duration to elapse
  3. call read_terminal_output to confirm "Recording saved:" with "encoder=h264_nvenc+aac"
parameters: same as video-only plus --audio flag
audio-source: WASAPI loopback — captures all system audio (YouTube, music, apps, notifications)
audio-format: AAC 128kbps stereo 48kHz
use-when: recording tutorials with app sounds, capturing video calls, preserving audio context
</workflow>

<workflow name="record-screen-with-microphone">
purpose: record display/window with microphone input (user's voice)
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration 30 --fps 30 --mic\n"
  2. wait for duration to elapse
  3. call read_terminal_output to confirm recording saved
parameters: same as video-only plus --mic flag
audio-source: WASAPI default input device (Microphone Array)
use-when: recording narrated walkthroughs, voice annotations over screen capture
</workflow>

<workflow name="record-screen-with-all-audio">
purpose: record display/window with BOTH system audio and microphone mixed together
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration 30 --fps 30 --audio --mic\n"
  2. wait for duration to elapse
  3. call read_terminal_output to confirm recording saved
parameters: same as video-only plus --audio --mic flags
audio-mixing: both streams mixed via ffmpeg amix filter into single AAC track
use-when: recording video calls with user commentary, full-context screen captures
</workflow>

<workflow name="record-with-agent-stop">
purpose: start an indefinite recording that the LLM can stop programmatically
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --stop-file C:/Users/anujd/Videos/Screen\ Recordings/.stop_rec --audio\n"
  2. recording runs indefinitely in the terminal — output path is printed to stderr
  3. when ready to stop, call write_terminal in another pane (or use manage_tasks): "echo. > \"C:/Users/anujd/Videos/Screen Recordings/.stop_rec\"\n"
  4. recording stops cleanly, stop file is auto-deleted
  5. call read_terminal_output to confirm "Recording saved:"
use-when: recording duration is unknown upfront — the LLM decides when to stop based on context
<note>the stop file can be created from any terminal pane or process — it is just a filesystem sentinel</note>
</workflow>

<workflow name="record-specific-window">
purpose: record only a specific application window (not the full display)
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py list --format json\n"
  2. call read_terminal_output, parse JSON, find the target window name
  3. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target \"Window Title Here\" --duration 30 --audio\n"
  4. call read_terminal_output to confirm window matched and recording saved
targeting: substring match (case-insensitive) — "Visual Studio" matches "main.py - Visual Studio Code"
limitation: window region is fixed at recording start — moving/resizing the window during recording captures the wrong area
use-when: recording a specific app for a focused demo or bug report
</workflow>

<workflow name="compress-for-sharing">
purpose: compress a recorded MP4 for a target platform
steps:
  1. call write_terminal with text: "python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py compress --input \"C:/Users/anujd/Videos/Screen Recordings/source_file.mp4\" --preset whatsapp\n"
  2. call read_terminal_output to confirm "Compressed:" message with file size savings
presets:
  whatsapp: <=16MB, 960px wide, H.264 Main, mono 64k audio — output tagged _wa
  youtube: high quality, H.264 High, stereo 320k audio, native resolution — output tagged _yt
  small: HEVC 1080p, aggressive compression, mono 64k — output tagged _sm
  archive: HEVC native resolution, best quality/size ratio, mono 96k — output tagged _ar
output: auto-named next to source file with preset tag (e.g. sourc_words_wa_08apr.mp4)
  --output flag overrides auto-naming when provided
use-when: you need to share a recording via WhatsApp, upload to YouTube, or reduce file size
</workflow>

<quick-reference>
<critical>
The screenrec tool is at: C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py
Output saves to: C:/Users/anujd/Videos/Screen Recordings/
Filenames auto-generated: <5char>_<5char>_<5char>_<ddmmm>.mp4

Common invocations via write_terminal (--output is optional, omit for auto-naming):

list targets:
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py list --format json

record display (video only):
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration {N} --fps 30

record display (with system audio):
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration {N} --fps 30 --audio

record display (with mic):
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration {N} --fps 30 --mic

record display (system audio + mic):
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --duration {N} --fps 30 --audio --mic

record with agent stop:
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py record --target display:0 --stop-file "C:/Users/anujd/Videos/Screen Recordings/.stop_rec" --audio

stop a recording:
  echo. > "C:/Users/anujd/Videos/Screen Recordings/.stop_rec"

compress for whatsapp:
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py compress --input "{recorded_file}" --preset whatsapp

compress for youtube:
  python C:/Users/anujd/Documents/01_AI/218_screenrec/screenrec.py compress --input "{recorded_file}" --preset youtube
</critical>
</quick-reference>
</screen-recording>

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
