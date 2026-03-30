---
phase: 16-protocol-extension
plan: "01"
subsystem: protocol
tags: [protocol, websocket, typescript, types]
dependency_graph:
  requires: []
  provides: [window-thumbnail-protocol, enriched-capture-protocol]
  affects: [Phase 17 batch thumbnails, Phase 19 window picker UI]
tech_stack:
  added: []
  patterns: [discriminated-union-append, manual-sync-D12]
key_files:
  created: []
  modified:
    - sidecar/src/protocol.ts
    - src/protocol.ts
decisions:
  - "WindowThumbnail defined as named interface (not inline) for reuse across message types"
  - "capture-result-with-metadata uses inline field shape (not named CaptureMetadata) — single use case"
  - "JSDoc added to WindowThumbnail.thumbnail field to clarify absent-on-failure semantics"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-30T16:06:26Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 16 Plan 01: Protocol Extension Summary

Appended four new WebSocket message types and the WindowThumbnail interface to both sidecar and frontend protocol files. Unblocks Phase 17 (batch thumbnails) and Phase 19 (window picker UI) which import from these typed contracts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add new message types and interfaces to sidecar protocol | 50908a7 | sidecar/src/protocol.ts |
| 2 | Sync new types to frontend protocol file | da2c3c7 | src/protocol.ts |

## What Was Built

Four new WebSocket message types appended to existing discriminated unions:

**ClientMessage additions (2):**
- `list-windows-with-thumbnails` — triggers batch thumbnail capture (no payload)
- `capture-window-with-metadata` — triggers enriched single-window capture (`{ title: string }`)

**ServerMessage additions (2):**
- `window-thumbnails` — carries `{ windows: WindowThumbnail[] }` batch result
- `capture-result-with-metadata` — carries `{ path, title, bounds: {x,y,w,h}, captureSize: {w,h}, dpiScale }` enriched result

**New interface:**
- `WindowThumbnail` — `{ title, processName, thumbnail?: string, error?: string }` — thumbnail is base64 PNG (240x180), absent on per-window capture failure

Both files compile clean with zero TypeScript errors. Existing union members unchanged (7 ClientMessage + 2 new = 9 total; 10 ServerMessage + 2 new = 12 total).

## Decisions Made

- `WindowThumbnail` defined as a named exported interface (not inline) — reused in both `window-thumbnails` response and potentially by Phase 17/19 handlers
- `capture-result-with-metadata` uses inline field shape for the bounds/captureSize/dpiScale — single message type, no separate interface needed
- JSDoc comment on `WindowThumbnail.thumbnail` clarifies the absent-on-failure semantics upfront

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] sidecar/src/protocol.ts exists and contains all 4 new type strings
- [x] src/protocol.ts exists and contains all 4 new type strings + D-12 header
- [x] Commit 50908a7 exists
- [x] Commit da2c3c7 exists
- [x] Both files compile clean (tsc --noEmit, zero errors)
