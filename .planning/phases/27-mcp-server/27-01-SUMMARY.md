---
phase: 27-mcp-server
plan: 01
subsystem: api
tags: [mcp, stdio, typescript, zod, modelcontextprotocol, node-http]

# Dependency graph
requires:
  - phase: 23-terminal-buffer-layer
    provides: GET /terminal-state with cursor pagination and scrub param
  - phase: 24-secret-scrubber-trust-tiers
    provides: scrub=true query param on HTTP endpoints
  - phase: 25-screenshot-self-capture
    provides: GET /screenshot with blur=true param returning binary PNG
provides:
  - MCP stdio server with 3 tools wrapping sidecar HTTP APIs
  - sidecar.exe mcp subcommand routing (argv[2] guard in server.ts)
  - read_terminal_output, query_session_history, capture_screenshot tools
  - Discovery file reader for fresh port/token per call
affects:
  - 28-adapter-layer (MCP server is the tool delivery layer adapters build on)
  - 29-auto-config (will write .mcp.json pointing to sidecar.exe mcp)

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/sdk@^1.29.0 (McpServer, StdioServerTransport)"
    - "zod@^3.25.x (tool parameter schema validation)"
  patterns:
    - "argv[2] subcommand routing with throw guard to prevent native addon loading"
    - "uncaughtException handler in MCP module swallows server.ts guard throw"
    - "Fresh discovery file read per tool call (no startup caching) for sidecar restart transparency"
    - "All MCP tool errors mapped to isError: true text content blocks"

key-files:
  created:
    - sidecar/src/mcp-server.ts
  modified:
    - sidecar/package.json
    - sidecar/src/server.ts

key-decisions:
  - "uncaughtException handler swallows throw from server.ts guard — cleanest way to prevent native addon loading while preserving async stdio transport"
  - "McpServer found at @modelcontextprotocol/sdk/server/mcp.js not /server/index.js"
  - "mcp-server.ts is self-contained with no imports from server.ts, protocol.ts, or any native addon module"

patterns-established:
  - "MCP tool error responses: return { content: [{ type: 'text', text: msg }], isError: true }"
  - "Discovery file read fresh on every tool call — sidecar restarts are transparent to MCP clients"
  - "Screenshot tool: binary PNG buffer → toString('base64') → image content block"

requirements-completed:
  - LLM-01

# Metrics
duration: 5min
completed: 2026-04-01
---

# Phase 27 Plan 01: MCP Server Summary

**MCP stdio server with read_terminal_output, query_session_history, capture_screenshot tools wrapping sidecar HTTP APIs — delivered as sidecar.exe subcommand with argv[2]==='mcp' routing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T09:45:29Z
- **Completed:** 2026-04-01T09:50:30Z
- **Tasks:** 2
- **Files modified:** 3 (created 1, modified 2)

## Accomplishments

- Created `sidecar/src/mcp-server.ts` (192 lines) — McpServer with 3 tool handlers, discovery file reader, HTTP helper, and uncaughtException guard
- All 3 tools always use `scrub=true` and `blur=true` — no raw access via MCP path (per D-15, D-16)
- Screenshot tool returns image content block with base64-encoded PNG
- server.ts early-exit guard prevents node-pty, better-sqlite3, and sharp from loading in MCP mode

## Task Commits

1. **Task 1: Install MCP SDK dependencies and add server.ts early-exit guard** - `c976f9c` (chore)
2. **Task 2: Create MCP server with 3 tool handlers** - `af5c97d` (feat)

## Files Created/Modified

- `sidecar/src/mcp-server.ts` — Self-contained MCP stdio server with 3 tool handlers, discovery file reader, HTTP helper, and async startup
- `sidecar/src/server.ts` — Added argv[2]==='mcp' guard at top of file (before all imports) with throw to prevent native addon loading
- `sidecar/package.json` — Added @modelcontextprotocol/sdk@^1.29.0 and zod@^3.25.x as production dependencies

## Decisions Made

- **McpServer import path:** `@modelcontextprotocol/sdk/server/mcp.js` (not `/server/index.js` which only exports the lower-level `Server` class)
- **Guard mechanism:** server.ts throws `'mcp-server should not return'` to prevent native addon loading. mcp-server.ts installs `uncaughtException` handler that swallows this specific error so the async stdio transport can run. This is the cleanest approach for preventing native addon initialization without killing the event loop.
- **No module-level caching:** Discovery file is read fresh on every tool call so sidecar restarts are transparent to MCP clients

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MCP server crashed due to throw firing before async main() could connect**
- **Found during:** Task 2 (verification)
- **Issue:** The plan's `throw new Error('mcp-server should not return')` guard fires synchronously after `require('./mcp-server.js')` returns, but mcp-server's `main()` is async. The throw fired before the stdio transport could connect, crashing the process.
- **Fix:** Added `process.on('uncaughtException')` handler in mcp-server.ts that swallows the specific error `'mcp-server should not return'`. The handler lets other uncaughtExceptions pass through to `process.exit(1)`. The throw in server.ts is preserved (prevents native addon loading) while the async event loop continues.
- **Files modified:** sidecar/src/mcp-server.ts (added uncaughtException handler before main() call)
- **Verification:** `echo '{}' | node dist/server.js mcp` logs `[mcp] MCP server starting...` and `[mcp] MCP server connected via stdio` with no SQLite initialization message
- **Committed in:** af5c97d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Essential fix for basic operation. The throw/uncaughtException pattern is the cleanest way to prevent native addon loading while preserving the async stdio transport event loop.

## Issues Encountered

- `@modelcontextprotocol/sdk` exports `McpServer` at `/server/mcp.js`, not `/server/index.js` (which exports lower-level `Server`). Verified via `node -e "require(...)"` before writing the file.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `sidecar.exe mcp` (or `node dist/server.js mcp`) starts a working MCP stdio server
- 3 tools registered: read_terminal_output, query_session_history, capture_screenshot
- Discovery file pattern validated — fresh read per call
- Phase 28 (adapter layer) can now reference this MCP server as the tool delivery layer
- Phase 29 (auto-config) knows the command: `sidecar.exe mcp` and args: `["mcp"]`

---
*Phase: 27-mcp-server*
*Completed: 2026-04-01*
