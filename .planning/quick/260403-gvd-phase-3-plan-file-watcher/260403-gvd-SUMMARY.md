---
phase: quick-260403-gvd
plan: 01
subsystem: plan-watcher
tags: [sidecar, websocket, file-watcher, zustand, react, markdown]
dependency_graph:
  requires: [quick-260403-g0f, quick-260403-gkx]
  provides: [plan-file-watcher, plan-panel-ui]
  affects: [sidecar/src/server.ts, src/components/TerminalPane.tsx]
tech_stack:
  added: [node:fs.watch, createPortal]
  patterns: [poll-for-directory-creation, debounced-watch, portal-overlay]
key_files:
  created:
    - sidecar/src/planWatcher.ts
    - src/store/planStore.ts
    - src/components/PlanPanel.tsx
  modified:
    - sidecar/src/protocol.ts
    - src/protocol.ts
    - sidecar/src/server.ts
    - src/components/TerminalPane.tsx
    - src/components/FeatureFlagPanel.tsx
decisions:
  - "PlanPanel uses ReactDOM.createPortal to render at document.body — enables mounting from FeatureFlagPanel without requiring App.tsx modification"
  - "plan-update handling added to TerminalPane.tsx switch (same additive pattern as Phase 1 useFlagSync) — cleanest access point for WebSocket messages"
  - "Regex-based markdown renderer built inline — no external dep, handles headings/lists/checkboxes/code blocks/bold/italic"
  - "PlanWatcher uses dual mechanism: fs.watch for active dirs, setInterval(3s) poll for dirs that don't exist yet"
metrics:
  duration_seconds: 210
  completed_date: "2026-04-03"
  tasks_completed: 3
  files_changed: 7
---

# Phase quick-260403-gvd Plan 01: Phase 3 Plan File Watcher Summary

PlanWatcher sidecar class with fs.watch + poll + debounce, plan-update/plan-read protocol messages, planStore Zustand store, and PlanPanel portal component with inline markdown renderer.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create PlanWatcher class and extend protocol | 2ef9018 | planWatcher.ts, protocol.ts (x2), server.ts |
| 2 | Create planStore and PlanPanel frontend components | a6ab2f0 | planStore.ts, PlanPanel.tsx, TerminalPane.tsx, FeatureFlagPanel.tsx |
| 3 | Integration test — verify end-to-end plan watcher flow | (verify only) | — |

## What Was Built

### sidecar/src/planWatcher.ts

`PlanWatcher` class:
- `start(cwd)` — for each of `.claude/plans` and `docs/plans`: if dir exists call `watchDir()`, start 3s poll timer for directories that don't exist yet
- `watchDir(dirPath)` — `fs.watch()` with 200ms debounce, calls `scanAndNotify()` on change
- `scanAndNotify()` — scans all plan dirs for `.md` files, finds newest by `mtimeMs`, reads content, calls `onPlanUpdate`
- `readNow(cwd)` — one-shot scan without starting watchers (for `plan-read` requests)
- `stop()` — closes all FSWatcher instances, clears poll and debounce timers
- `set enabled(v)` — when toggled OFF, calls `stop()`

Error handling: all `fs.*` calls wrapped in try/catch, errors logged, never thrown.

### Protocol additions (additive only)

Both `sidecar/src/protocol.ts` and `src/protocol.ts`:
- `ClientMessage` + `| { type: 'plan-read'; cwd?: string }`
- `ServerMessage` + `| { type: 'plan-update'; fileName: string | null; content: string | null; mtime: number }`

### sidecar/src/server.ts (additive wiring)

- `import { PlanWatcher } from './planWatcher.js'`
- `const planWatchers = new Map<WebSocket, PlanWatcher>()`
- `planWatcher: true` added to `sidecarFlags`
- `spawn` case: creates PlanWatcher, starts it, stores in map
- `kill` case: calls `planWatcher.stop()`, deletes from map
- `ws.close`: same cleanup
- `set-flags` case: handles `planWatcher` flag — creates watchers on turn-ON, stops all on turn-OFF
- `plan-read` case: returns one-shot scan result via `plan-update` message

### src/store/planStore.ts

Zustand store with `content`, `fileName`, `visible`, `setContent`, `toggleVisible`, `setVisible`.

### src/components/PlanPanel.tsx

- Reads `planWatcher` flag — returns null if OFF
- Returns null if not visible or no content
- Regex markdown renderer: headings (h1/h2/h3), checkboxes (`- [ ]`/`- [x]`), bullet lists, fenced code blocks, `**bold**`, `*italic*`, inline `` `code` ``
- Portal renders into `document.body` as a 320px fixed right-side panel
- Header: file name + close button (calls `toggleVisible`)
- Scrollable content area

### src/components/TerminalPane.tsx (additive)

- Added import `usePlanStore`
- Added `case 'plan-update': usePlanStore.getState().setContent(msg.content, msg.fileName)` in onmessage switch

### src/components/FeatureFlagPanel.tsx (additive)

- Added import `PlanPanel`
- Renders `<PlanPanel />` in the component (portal handles body-level positioning)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files created:
- sidecar/src/planWatcher.ts — FOUND
- src/store/planStore.ts — FOUND
- src/components/PlanPanel.tsx — FOUND

Commits:
- 2ef9018 — FOUND (feat(quick-260403-gvd-01): create PlanWatcher class and extend protocol)
- a6ab2f0 — FOUND (feat(quick-260403-gvd-01): add planStore, PlanPanel, and plan-update wiring)

TypeScript: both `npx tsc --noEmit` and `npx tsc -p sidecar/tsconfig.json --noEmit` pass clean.
