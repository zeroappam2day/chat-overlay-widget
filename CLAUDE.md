<!-- GSD:project-start source:PROJECT.md -->
## Project

**Chat Overlay Widget**

A Tauri v1.8 desktop application that wraps Claude Code's CLI terminal in a polished GUI. It uses node-pty (ConPTY) to bridge GUI input to a real shell, xterm.js for terminal rendering, and WebSocket for communication between the browser-based UI and the Node.js backend. Built for a single user on Windows 11 — a local power tool for interacting with Claude Code.

**Core Value:** The CLI must think GUI input is real keyboard input — the PTY bridge is the heart. If everything else fails, the ability to send commands to Claude Code and see output must work flawlessly.

### Constraints

- **Tech stack:** Tauri v1.8 (stable, stress-tested version) — not Electron
- **Platform:** Windows 11 only, no Docker, no WSL
- **Shell:** PowerShell (primary), cmd.exe, Git Bash (if installed)
- **Deployment:** Local machine only, single user
- **Node.js sidecar:** Required for node-pty since Tauri webview doesn't include Node.js runtime
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tauri | 1.7.2 | Desktop shell, native window controls, webview host | Latest stable v1.x (Aug 2024). v2 exists but PROJECT.md specifies v1. Rust-based, lighter than Electron. No Node.js bundled — sidecar pattern required. |
| @tauri-apps/cli | ^1.5 | Build toolchain, sidecar bundling, dev server proxy | Required CLI for Tauri v1 builds. `@tauri-apps/api` is the JS runtime companion. |
| node-pty | 1.1.0 | PTY bridge — spawns shell, streams I/O via ConPTY | Stable release Dec 2025. Maintained by Microsoft, powers VS Code terminal. ConPTY (Windows 10 1809+) — no winpty fallback anymore. Native C++ addon; requires Node.js runtime, NOT compatible with bundled webview. Must run in Node.js sidecar process. |
| ws | 8.20.0 | WebSocket server (Node.js sidecar) and client (webview) | De facto WebSocket library for Node.js. 28k+ dependents. Low overhead, no framework lock-in. Bridges sidecar PTY output to webview xterm.js. |
| @xterm/xterm | 5.5.0 | Terminal emulator rendering in webview | v6.0.0 released Dec 2023 (latest). Use v5.x if webview compatibility is uncertain. Handles ANSI escape codes, cursor movement, colors. Cannot be replaced with a plain textarea — real terminal emulator is mandatory for Claude Code's interactive output. |
| React | 18.x | Frontend UI framework | Tauri v1 official templates support React + Vite. Ecosystem breadth for split-pane UI, state management. |
| Vite | 5.x | Frontend build tool and dev server | Official recommendation in Tauri v1 docs for SPA frameworks. Fast HMR. Configured to proxy to Tauri devServer. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xterm/addon-fit | 0.11.0 | Resize terminal to fill container | Always — without this the terminal renders at a fixed size and breaks pane layouts |
| @xterm/addon-web-links | 0.12.0 | Clickable URLs in terminal output | When Claude Code outputs file paths or URLs you want to open in browser |
| caxa | latest | Bundle Node.js sidecar into a standalone executable | Required — packages the Node.js sidecar (with native node-pty .node binary) into an .exe that Tauri can ship as `externalBin`. See Bundler Strategy below. |
| better-sqlite3 | latest | Chat history persistence (synchronous SQLite) | Simpler API than async sqlite3, faster for single-user workload. Use in the Node.js sidecar process for chat history. |
| @tauri-apps/api | ^1.5 | JS API to invoke Tauri commands from webview | Required for window controls (always-on-top, resize), file dialogs for screenshot drag-drop |
| typescript | ^5.x | Type safety across sidecar and frontend | Use throughout — both frontend and sidecar benefit from typed PTY/WebSocket message contracts |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Rust toolchain (stable) | Required for Tauri compilation | Install via rustup. Target: `x86_64-pc-windows-msvc`. Required for Tauri v1 build. |
| Visual Studio Build Tools 2022 | node-pty native compilation, Rust MSVC linker | Must include "Desktop development with C++" and Spectre-mitigated libraries. Required on Windows for node-pty `npm install`. |
| Node.js 18 LTS or 20 LTS | Sidecar runtime + build tooling | node-pty requires Node.js 16+. Use 18 or 20 LTS for stability. Avoid Node.js 22+ until node-pty beta stabilizes. |
| electron-rebuild / node-gyp | Rebuild native addons for target Node.js ABI | node-pty compiles a `.node` binary tied to the Node.js ABI. Must match the Node.js version bundled in the sidecar. |
## Installation
# Frontend (webview)
# Frontend dev
# Node.js sidecar
# Sidecar bundler
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| caxa | vercel/pkg | pkg is deprecated (last release 5.8.1, no Node.js 22 support). caxa handles native addons (node-pty .node binary) correctly by self-extracting the archive — pkg cannot reliably bundle native addons on Windows. |
| caxa | Node.js SEA | SEA (Node.js 19.7+) is the future but CANNOT bundle native addons like node-pty — the .node file must remain external. Viable only if node-pty gets a pure-JS alternative. |
| caxa | nexe | nexe is unmaintained. Last meaningful commit 2021. Skip entirely. |
| ws | socket.io | socket.io adds unnecessary complexity (rooms, namespaces, auto-reconnect). For a local single-user app, raw ws is sufficient and lighter. |
| @xterm/xterm v5 | @xterm/xterm v6 | v6 (Dec 2023) adds synchronous output, shadow DOM WebGL, progress addon. Use v6 if you verify your Tauri v1 webview (Edge WebView2) supports the newer DOM APIs. Risk: WebView2 version on end-user machines may lag behind. |
| better-sqlite3 | Tauri SQLite plugin | Tauri's built-in SQLite plugin is v2-only. For Tauri v1, run SQLite in the Node.js sidecar using better-sqlite3 — simpler, synchronous API for single-user chat history. |
| React | Svelte | Svelte would reduce bundle size but the React ecosystem (split-pane libraries, drag-drop) has broader coverage for this UI pattern. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| vercel/pkg | Deprecated. 5.8.1 is final. Cannot reliably bundle node-pty native .node addon on Windows. Breaks silently at runtime when native module loads. | caxa |
| nexe | Unmaintained since ~2021. No Node.js 18+ support. | caxa |
| xterm (unscoped npm package) | Deprecated. Stuck at 5.3.0, published 3 years ago. Security: package namespace squatting risk. | @xterm/xterm (scoped) |
| xterm-addon-fit (unscoped) | Deprecated. Use scoped @xterm/addon-fit instead. | @xterm/addon-fit |
| socket.io | Over-engineered for a local single-process IPC use case. Adds ~200KB+ and reconnection complexity you don't need. | ws |
| node:sqlite (Node.js built-in) | Experimental as of Node.js 22.5. API unstable. Not appropriate for production use. | better-sqlite3 |
| Tauri v2 | PROJECT.md explicitly specifies Tauri v1.8 (meaning v1.x stable). v2 is a breaking API change — shell allowlist, sidecar config, and plugin system differ significantly. Do not mix v1 and v2 docs. | Tauri v1.7.2 |
## Stack Patterns by Variant
- Use `tauri-plugin-pty` or a custom Rust PTY crate (e.g., `portable-pty`)
- Because Rust can call ConPTY directly — eliminates the sidecar entirely
- Tradeoff: Rust PTY APIs are less battle-tested on Windows than node-pty; VS Code chose node-pty deliberately
- node-pty 1.x dropped winpty fallback — it only supports ConPTY (Windows 10 1809+)
- Windows 11 requirement in PROJECT.md makes this moot — Windows 11 always has ConPTY
- Each pane gets its own `Terminal` instance from `@xterm/xterm`
- Each pane maps to a separate `node-pty` spawn and separate WebSocket channel (or multiplexed message envelope with pane ID)
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| node-pty 1.1.0 | Node.js 16, 18, 20 | Compiled .node binary is ABI-locked to Node.js version. Match the Node.js version inside caxa sidecar exactly. |
| @xterm/xterm 5.x | @xterm/addon-fit 0.11.0, @xterm/addon-web-links 0.12.0 | Addon versions are versioned separately from xterm core. The 0.x addon versions track xterm v5. |
| @xterm/xterm 6.x | Requires WebView2 with shadow DOM support | Tauri v1 on Windows uses Edge WebView2. v6 shadow DOM WebGL may not render correctly on older WebView2 versions. Test before committing to v6. |
| Tauri v1.7.2 | @tauri-apps/api ^1.5 | API version must match Tauri crate version. Do not mix v1 JS API with v2 Rust crate or vice versa. |
| better-sqlite3 | Node.js 18, 20 | Prebuilt binaries available for LTS. Requires rebuild if Node.js version changes. |
| caxa | Node.js 18, 20 | caxa self-extracts with bundled Node.js binary — must ship matching arch binary (x86_64 for Windows x64). |
## Bundler Strategy: Node.js Sidecar
# In sidecar/ directory
## Sources
- [Tauri v1 Releases (GitHub)](https://github.com/tauri-apps/tauri/releases/tag/tauri-v1.7.2) — latest v1.x is 1.7.2 (Aug 23, 2024), MEDIUM confidence (no v1.8 found)
- [Tauri v1 Sidecar Guide](https://v1.tauri.app/v1/guides/building/sidecar/) — sidecar config and binary naming, HIGH confidence
- [node-pty GitHub](https://github.com/microsoft/node-pty) — stable 1.1.0 (Dec 2025), Windows ConPTY requirements, HIGH confidence
- [xterm.js Releases](https://github.com/xtermjs/xterm.js/releases) — v6.0.0 latest, v5 still supported, HIGH confidence
- [@xterm/addon-fit npm](https://www.npmjs.com/package/@xterm/addon-fit) — 0.11.0, MEDIUM confidence (npm 403 on direct fetch)
- [@xterm/addon-web-links npm](https://www.npmjs.com/package/@xterm/addon-web-links) — 0.12.0, MEDIUM confidence
- [ws npm](https://www.npmjs.com/package/ws) — 8.20.0 (Mar 2026), HIGH confidence
- [caxa GitHub](https://github.com/leafac/caxa) — native addon support confirmed, MEDIUM confidence (limited node-pty + caxa + Windows specific data found)
- [vercel/pkg deprecation](https://github.com/vercel/pkg) — deprecated, 5.8.1 final, HIGH confidence
- [Node.js SEA docs](https://nodejs.org/api/single-executable-applications.html) — cannot bundle native addons, HIGH confidence
- [better-sqlite3 vs sqlite3](https://npm-compare.com/better-sqlite3,sqlite3) — synchronous API, faster for single-user, MEDIUM confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
