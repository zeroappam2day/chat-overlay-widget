---
phase: 20-metadata-injection-integration
plan: 02
subsystem: ui
tags: [react, websocket, integration, window-capture]

# Dependency graph
requires:
  - phase: 20-metadata-injection-integration
    plan: 01
    provides: formatCaptureBlock utility for formatting capture metadata

provides:
  - pendingInjection prop pattern for ChatInputBar multi-line text injection
  - handleWindowSelect callback wiring picker -> WS capture -> format -> inject
  - capture-result-with-metadata WS message handling in TerminalPane

affects:
  - Future phases may extend injection pattern for other capture types

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Ref-based state access in useCallback (currentShellRef) to avoid stale closures in WS handler
    - Immediate UI update before async operation (close picker before WS roundtrip)
    - pendingInjection/onInjectionConsumed prop pair mirrors pendingImagePath pattern

key-files:
  created: []
  modified:
    - src/components/ChatInputBar.tsx
    - src/components/TerminalPane.tsx
---

## What was done

Wired the full metadata injection pipeline: thumbnail click in WindowPicker closes the picker immediately, sends `capture-window-with-metadata` WS message to sidecar, sidecar captures the window and returns bounds/DPI metadata, `capture-result-with-metadata` response is formatted by `formatCaptureBlock()`, and the result is injected into ChatInputBar's textarea via `pendingInjection` prop.

### Task 1: ChatInputBar pendingInjection prop
Added `pendingInjection?: string | null` and `onInjectionConsumed?: () => void` props. New `useEffect` injects multi-line capture block using `\n` separator, calls `onInjectionConsumed`, and focuses textarea.

### Task 2: TerminalPane selection flow wiring
- Imported `formatCaptureBlock` from utils
- Added `pendingInjection` state and `currentShellRef` (ref pattern to avoid stale closure)
- Added `case 'capture-result-with-metadata'` to handleServerMessage switch
- Created `handleWindowSelect` callback: closes picker → sends WS capture message
- Passed `onSelect={handleWindowSelect}` to WindowPicker
- Passed `pendingInjection` and `onInjectionConsumed` to ChatInputBar

### Task 3: Visual verification (human checkpoint)
User verified end-to-end flow: open picker → select window → picker closes → ChatInputBar populated with shell-quoted path + 5 metadata comment lines.

## Deviations

1. **Sidecar C# escaping bug (fix: c69c302):** The `captureWindowWithMetadata` C# code used `string.Format` with JSON braces `{{...}}` and inner `\"` quotes. After JS template literal processing, `\"` became unescaped `"` inside the C# string, causing C# compilation failure. Fixed by switching to pipe-delimited output format (`OK|path|bx|by|bw|bh|cw|ch|dpi`) which has no special characters to escape across the JS→PS→C# pipeline. Also fixed path double-backslash issue by using PS single-quote escaping instead of C# string escaping.

2. **Chrome title-race (known limitation, not fixed):** Browser windows change their `GetWindowText` title when the active tab changes. If user switches Chrome tabs between thumbnail enumeration and capture click, the title no longer matches → `NO_MATCH` error. This is inherent to title-based window matching and out of Phase 20 scope. Future enhancement: use HWND or process ID for matching.

## Self-Check: PASSED
- [x] ChatInputBar has pendingInjection + onInjectionConsumed props
- [x] TerminalPane wires full selection → capture → format → inject flow
- [x] Picker closes immediately on selection (no UI freeze)
- [x] `npx tsc --noEmit` passes
- [x] `npx vitest run` passes (73/73)
- [x] Human verified end-to-end flow
