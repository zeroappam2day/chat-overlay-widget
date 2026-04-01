# Phase 27: MCP Server - Context

**Gathered:** 2026-04-01 (assumptions mode — stress-tested from 7+ adversarial views)
**Status:** Ready for planning

<domain>
## Phase Boundary

Any MCP-capable LLM can autonomously read terminal output, query session history, and capture screenshots via standard MCP tools. Delivers an stdio MCP server with exactly 3 tools, wrapping existing sidecar HTTP APIs. Does NOT build adapters (Phase 28), sidebar UI (Phase 28), or auto-configuration (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Process Model
- **D-01:** Single binary, subcommand routing. `sidecar.exe mcp` enters MCP stdio mode. No second caxa binary, no unbundled script, no Node.js-on-PATH dependency.
- **D-02:** `mcp-server.ts` compiles to `dist/mcp-server.js` — auto-bundled by caxa (confirmed: `index.mts` globs `**/*` from input dir, `.js` files not in default excludes).
- **D-03:** Early exit in `server.ts`: check `process.argv[2] === 'mcp'` BEFORE any initialization (SQLite, PTY, WS, discovery file). MCP mode loads only `mcp-server.js` + HTTP client + SDK. No port conflict, no native addon loading in MCP path.
- **D-04:** CLI arg passthrough confirmed: caxa `stub.go` line 272-274 passes `os.Args[1:]` to the command array. `sidecar.exe mcp` → `node.exe server.js mcp`.
- **D-05:** `.mcp.json` config format: `{ "mcpServers": { "chat-overlay": { "command": "<path>/sidecar.exe", "args": ["mcp"] } } }`. Phase 29 auto-config will write this.

### SDK Choice
- **D-06:** Use official `@modelcontextprotocol/sdk` (v1.29.0) with `zod` for tool schemas. Not hand-rolled.
- **D-07:** Import paths: `@modelcontextprotocol/sdk/server` (McpServer) and `@modelcontextprotocol/sdk/server/stdio` (StdioServerTransport). Both have CJS exports — `require()` works.
- **D-08:** Runtime deps confirmed minimal: only SDK + zod actually load. Express/hono/cors (17 listed deps) are for HTTP/SSE transport — dead code in stdio mode. Import time: ~130ms cold.
- **D-09:** Disk cost: SDK ~5.6MB + zod ~5.7MB = ~11MB added to caxa bundle (73MB → ~84MB, 15% increase). Justified by protocol compliance, image content support, and future-proofing.
- **D-10:** No native addons in SDK — pure JS. No caxa bundling risk.

### Tool Scope
- **D-11:** Exactly 3 tools. Locked per SC1-SC3 and LLM-01. No agent_events query, no list_sessions, no health check tool.
- **D-12:** `read_terminal_output` — wraps `GET /terminal-state?lines=N&since=C&scrub=true`. Input: `{ lines?: number (1-500, default 50), since?: number (cursor for pagination) }`. Output: text (JSON of `{ lines, cursor, warning }`).
- **D-13:** `query_session_history` — wraps `GET /session-history?sessionId=N&lines=L&scrub=true`. Input: `{ sessionId: number, lines?: number (1-500, default 100) }`. Output: text (JSON of `{ lines, sessionId, total, warning }`).
- **D-14:** `capture_screenshot` — wraps `GET /screenshot?blur=true`. Input: `{ }` (no params — always blur, always current window). Output: image (base64 PNG via SDK's `{ type: 'image', data, mimeType }` content block).

### Trust & Scrubbing Policy
- **D-15:** MCP server always passes `scrub=true` and `blur=true` to sidecar HTTP APIs. No trust tier parameter exposed to MCP clients. Rationale: MCP tool results flow to cloud LLMs (Claude API, Cursor, Windsurf). Raw access available via HTTP directly for advanced/local use.
- **D-16:** Screenshot always blurred. Terminal output always scrubbed. Session history always scrubbed. Non-negotiable for MCP path.

### Discovery & Connection
- **D-17:** MCP server reads `%APPDATA%/chat-overlay-widget/api.port` on each tool call (not cached). Picks up sidecar restarts automatically. Validated by A2 spike: external process can read discovery file and hit all 3 HTTP APIs successfully.
- **D-18:** If sidecar not running (discovery file missing or HTTP unreachable), tool calls return clear error text: "Chat Overlay Widget not running. Start the app first." MCP server stays alive — doesn't crash.

### Logging & Error Handling
- **D-19:** All logging to stderr (stdout reserved for MCP JSON-RPC protocol). Prefix: `[mcp]`.
- **D-20:** HTTP errors from sidecar mapped to MCP tool error responses with human-readable messages. No raw stack traces to LLM.

### Claude's Discretion
- Tool description wording (informative for LLMs but concise)
- Whether to add connection retry logic or fail-fast on each tool call
- zod schema refinements (min/max constraints on lines parameter)
- Whether to include a `list_sessions` parameter mode inside `query_session_history` (sessionId undefined → list mode) or keep it strict

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sidecar HTTP APIs (these are what the MCP tools wrap)
- `sidecar/src/server.ts` §123-143 — `GET /terminal-state` route: lines, since, scrub params, cursor pagination
- `sidecar/src/server.ts` §146-170 — `GET /session-history` route: sessionId, lines, scrub params
- `sidecar/src/server.ts` §172-210 — `GET /screenshot` route: blur param, async sharp processing, error codes (404/409/502)
- `sidecar/src/server.ts` §36-41 — Bearer auth pattern (all HTTP routes require `Authorization: Bearer {token}`)

### Discovery file (MCP server reads this)
- `sidecar/src/discoveryFile.ts` — `writeDiscoveryFile()` writes `{ port, token }` to `%APPDATA%/chat-overlay-widget/api.port`

### Protocol types (for understanding response shapes)
- `sidecar/src/protocol.ts` — ServerMessage/ClientMessage types, AgentEvent interface
- `sidecar/src/agentEvent.ts` — AgentEvent schema, normalizeAgentEvent (NOT needed for Phase 27 tools, but context for future extensibility)

### Secret scrubbing (trust tier context)
- `sidecar/src/secretScrubber.ts` — `scrub()` function, 18-pattern best-effort scrubber
- `sidecar/src/screenshotSelf.ts` — `captureSelfScreenshot()` with blur, `blurSecretLines()`

### Requirements
- `.planning/REQUIREMENTS.md` — LLM-01 (MCP server with 3 tools)
- `.planning/ROADMAP.md` §Phase 27 — Success criteria 1-4

### Phase 26 context (hook receiver — adjacent but independent)
- `.planning/phases/26-hook-receiver-event-schema/26-CONTEXT.md` — Hook endpoint decisions, discovery file pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server.ts` handleHttpRequest: All 3 target HTTP endpoints exist and are battle-tested (Phase 23-25). MCP tools are pure HTTP proxy calls.
- `discoveryFile.ts`: `{ port, token }` JSON format. MCP server reads this — same pattern as Phase 26 hook scripts (validated E2E).
- `secretScrubber.ts` scrub(): Applied server-side via `?scrub=true` query param. MCP server doesn't need to import or call it directly.

### Established Patterns
- Bearer auth on all HTTP endpoints — MCP server includes `Authorization: Bearer {token}` header
- JSON response bodies from all GET endpoints — MCP tools parse and return as text content
- `/screenshot` returns binary PNG with metadata headers — MCP tool base64-encodes for image content block
- Sidecar logs prefixed with `[sidecar]` — MCP server uses `[mcp]` prefix to stderr

### Integration Points
- `server.ts` line 1-2 area: Add early `process.argv[2] === 'mcp'` check before any initialization
- `sidecar/package.json` dependencies: Add `@modelcontextprotocol/sdk` and `zod`
- `sidecar/tsconfig.json`: Ensure `mcp-server.ts` is included in compilation
- Caxa bundle: No changes needed — `dist/mcp-server.js` auto-included by glob

### Validated Assumptions
- **A2 confirmed:** External process reads discovery file, hits `/health`, `/terminal-state`, `/session-history`, `/screenshot` — all succeed. Tested 2026-04-01.
- **Phase 26 E2E confirmed:** `POST /hook-event` returns 200 in 1.8ms. Auth 401, validation 400 all correct. Tested 2026-04-01.

</code_context>

<specifics>
## Specific Ideas

- MCP server is a thin HTTP proxy (~100-150 lines of tool code). The heavy lifting is in the existing sidecar endpoints.
- `capture_screenshot` is the most complex tool: `/screenshot` returns binary PNG, MCP tool must buffer the response and base64-encode it for the SDK's image content block.
- The SDK's `McpServer.tool()` API takes zod schemas — type-safe parameter validation for free.
- Read discovery file fresh on each tool call (not at startup) so sidecar restarts are transparent.
- The sidecar already handles all error cases (no active session → 404, minimized → 409, blank capture → 502). MCP tools translate HTTP status codes to human-readable error text.

</specifics>

<deferred>
## Deferred Ideas

- **Agent events MCP tool** (`query_agent_events`) — evaluate when Phase 28 adapter layer establishes the event delivery pattern
- **`list_sessions` tool** — could be added as a separate tool or as a parameter mode in `query_session_history`. Not in LLM-01 requirements.
- **SSE transport** (SSE-01 in REQUIREMENTS.md) — SDK supports it. Add when remote LLM access is needed.
- **Trust tier parameter for MCP clients** — rejected for Phase 27 (always scrub). Revisit if local LLM MCP clients emerge.
- **Connection pooling / keep-alive** — evaluate if tool call latency becomes an issue. Currently each call is a fresh HTTP request.

</deferred>

---

*Phase: 27-mcp-server*
*Context gathered: 2026-04-01*
