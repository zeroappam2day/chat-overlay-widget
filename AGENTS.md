# AGENTS.md — Chat Overlay Widget Project Manifest
# Auto-generated: 2026-04-05T15:20:00Z
# Purpose: LLM orientation file — read this FIRST to understand project structure

## Project Overview
A Tauri-based desktop application that provides a polished GUI overlay for Claude Code's CLI, using a Node.js sidecar for PTY management and terminal rendering.

## Folder Structure
```
project_root/
├── 00_archive/                     # Archived stale files and debug debris
├── docs/
│   ├── build-environment/          # Build environment logs and lessons learned
│   ├── implementation_plans/       # Active implementation and feature plans
│   └── user_guides/                # User-facing documentation and guides
├── scripts/                        # Operational utility scripts (build, kill, etc.)
├── sidecar/                        # Node.js sidecar source and dependencies
├── src/                            # Frontend React application source
├── src-tauri/                      # Tauri Rust backend and configuration
└── {root config files}             # Build and environment configurations
```

## Key Files (Root)
- `AGENTS.md` — LLM orientation manifest (this file)
- `CLAUDE.md` — Project instructions and adaptive pipeline rules
- `index.html` / `overlay.html` — Main UI entry points
- `package.json` — Frontend dependencies and scripts
- `start.bat` / `stop.bat` — One-click launcher and cleanup scripts
- `vite.config.ts` — Frontend build configuration
- `tauri.conf.json` (in src-tauri) — Tauri app configuration

## HANDS-OFF Files (Do NOT move, rename, or delete)
- `CLAUDE.md` — Contains critical pipeline and safety instructions
- `package.json` / `package-lock.json` — Core dependency management
- `src-tauri/Cargo.toml` — Rust dependency management
- `start.bat` / `stop.bat` — Essential operational utilities
- `*.config.*` / `tsconfig.json` — Essential build/tooling configuration
- `00_archive/` — Should be ignored by active development processes

## Testing
- `npm test` — Runs vitest for frontend components
- `sidecar/src/*.test.ts` — Sidecar unit tests (run via sidecar scripts)

## Environment
- OS: Windows 11
- Shell: PowerShell
- Runtime: Node.js, Rust (Tauri v1.8)
- Tech: React, xterm.js, node-pty, WebSocket
