/**
 * MCP stdio server for Chat Overlay Widget.
 * Loaded via require('./mcp-server.js') from server.ts when process.argv[2] === 'mcp'.
 * Self-contained — no imports from server.ts, protocol.ts, or any native addon.
 * All logging to stderr (stdout is reserved for MCP JSON-RPC protocol).
 */
export {};
