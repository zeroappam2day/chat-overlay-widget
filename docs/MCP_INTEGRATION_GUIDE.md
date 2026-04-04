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
total-count: 7

<tool name="read_terminal_output">
purpose: read the current terminal buffer from the running Chat Overlay Widget
returns: text — JSON object with terminal lines, ANSI stripped, secrets scrubbed
parameters:
  - lines: integer, 1-500, default 50, number of lines to return
  - since: integer, optional, cursor from previous call for pagination (returns only new lines)
use-when: you need to see what is currently displayed in the terminal
</tool>

<tool name="query_session_history">
purpose: query historical terminal output from a past session stored in SQLite
returns: text — JSON object with historical terminal lines, secrets scrubbed
parameters:
  - sessionId: integer, required, the session ID to query
  - lines: integer, 1-500, default 100, number of lines to return
use-when: you need terminal output from a previous session, not the current one
</tool>

<tool name="capture_screenshot">
purpose: capture a PNG screenshot of the Chat Overlay Widget window
returns: image — base64-encoded PNG with sensitive areas blurred
parameters: none
use-when: you need to see the visual state of the application window
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

<action-rules>
set: replaces ALL current annotations with the provided list
merge: adds new annotations and updates existing ones by matching id
clear: removes specific annotations by id — requires the "ids" parameter
clear-group: removes all annotations with matching group name — requires the "group" parameter
clear-all: removes every annotation — no additional parameters needed
</action-rules>
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
      annotations: array, required, max 50 items, same schema as send_annotation annotations (without ttl/group)
use-when: guiding a user through a multi-step process
<critical>only one walkthrough can be active at a time — starting a new one replaces the previous</critical>
</tool>

<tool name="advance_walkthrough">
purpose: move to the next step in the active guided walkthrough
returns: text — JSON with next step details or completion indicator
parameters: none
use-when: the user has completed the current walkthrough step and is ready for the next
</tool>

<tool name="stop_walkthrough">
purpose: stop the active walkthrough and clear all its annotations
returns: text — confirmation message
parameters: none
use-when: the user wants to exit the walkthrough early or the walkthrough is complete
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
