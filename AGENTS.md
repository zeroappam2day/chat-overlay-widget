# AGENTS.md — Chat Overlay Widget Project Manifest
# Auto-generated: 2026-04-05T15:20:00Z
# Purpose: LLM orientation file — read this FIRST to understand project structure

## Project Overview
A Tauri-based desktop application that provides a polished GUI overlay for Claude Code's CLI, using a Node.js sidecar for PTY management and terminal rendering.

## Folder Structure
```
project_root/
├── 00_archive/                     # Archived stale files and debug debris
├── .repowise/                      # Repowise codebase intelligence (gitignored, ephemeral)
│   ├── config.yaml                 # Ollama provider config (qwen3:8b + nomic-embed-text)
│   ├── wiki.db                     # SQLite index (symbols, graph, git intelligence)
│   ├── mcp.json                    # Auto-generated MCP metadata
│   └── state.json                  # Index state tracking
├── docs/
│   ├── build-environment/          # Build environment logs and lessons learned
│   ├── implementation_plans/       # Active implementation and feature plans
│   ├── user_guides/                # User-facing documentation and guides
│   ├── user-journeys.md            # End-user workflow maps with Mermaid diagrams (14 journeys)
│   └── repowise-setup-template.md  # Reusable Repowise setup guide for any project
├── scripts/                        # Operational utility scripts (build, kill, etc.)
├── sidecar/                        # Node.js sidecar source and dependencies
├── src/                            # Frontend React application source
├── src-tauri/                      # Tauri Rust backend and configuration
└── {root config files}             # Build and environment configurations
```

## Key Files (Root)
- `AGENTS.md` — LLM orientation manifest (this file)
- `CLAUDE.md` — Project instructions, Repowise intelligence, and adaptive pipeline rules
- `index.html` / `overlay.html` — Main UI entry points
- `package.json` — Frontend dependencies and scripts
- `start.bat` / `stop.bat` — One-click launcher and cleanup scripts
- `repowise-dashboard.bat` — Launch Repowise web dashboard (API :8000, UI :8001)
- `vite.config.ts` — Frontend build configuration
- `tauri.conf.json` (in src-tauri) — Tauri app configuration
- `.mcp.json` — Project-scoped MCP server config (chat-overlay, aidesigner, repowise)

## HANDS-OFF Files (Do NOT move, rename, or delete)
- `CLAUDE.md` — Contains critical pipeline and safety instructions
- `package.json` / `package-lock.json` — Core dependency management
- `src-tauri/Cargo.toml` — Rust dependency management
- `start.bat` / `stop.bat` — Essential operational utilities
- `*.config.*` / `tsconfig.json` — Essential build/tooling configuration
- `.mcp.json` — MCP server configuration (repowise, chat-overlay, aidesigner)
- `00_archive/` — Should be ignored by active development processes
- `.repowise/` — Gitignored, ephemeral. Do NOT commit. Safe to delete + re-init.

## Codebase Intelligence (Repowise)
- **Slash command:** `/repowise-maintenance` — update index, doctor, dead code, regenerate CLAUDE.md
- **MCP tools:** 10 tools available via project .mcp.json (get_overview, get_context, get_risk, etc.)
- **Known broken:** get_why() (50% hang), search_codebase() confidence scores (always 1.0)
- **Maintenance script:** `scripts/repowise-maintenance.bat`
- **Setup template:** `docs/repowise-setup-template.md` (for other projects)
- **User journeys:** `docs/user-journeys.md` (14 flows with Mermaid diagrams)
- **Env requirement:** PYTHONUTF8=1 for all repowise commands on Windows

## Testing
- `npm test` — Runs vitest for frontend components
- `sidecar/src/*.test.ts` — Sidecar unit tests (run via sidecar scripts)

## Environment
- OS: Windows 11
- Shell: PowerShell
- Runtime: Node.js, Rust (Tauri v1.8)
- Tech: React, xterm.js, node-pty, WebSocket
