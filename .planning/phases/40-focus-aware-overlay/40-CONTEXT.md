# Phase 40: Focus-Aware Overlay - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Overlay visibility tracks whether the user is focused on the walkthrough's target window, hiding when they switch away and reappearing when they return. Primary monitor only. No multi-monitor repositioning.

</domain>

<decisions>
## Implementation Decisions

### Focus Detection Method
- **D-01:** Use `koffi` npm package for direct FFI to `user32.dll!GetForegroundWindow` from the Node.js sidecar. No PowerShell spawning for focus checks.
- **D-02:** Poll at 250ms intervals via `setTimeout` chains (not `setInterval`, to avoid post-wake bursts).
- **D-03:** Create `sidecar/src/win32.ts` module that loads user32.dll via koffi and exports `getForegroundWindow(): number`. This module can later replace all PowerShell P/Invoke calls across the codebase.
- **D-04:** Verify caxa bundling works with koffi (koffi ships prebuilt N-API .node binaries, same pattern as node-pty and better-sqlite3).

### Overlay Visibility Rules (Affiliated Set Model)
- **D-05:** Use hybrid hwnd-tree + PID matching. Walk `GetWindow(fgHwnd, GW_OWNER)` up to 5 levels first. PID fallback only if no ownership chain found. Exclude `ApplicationFrameHost.exe` from PID matching (shared PID across UWP apps).
- **D-06:** Chat widget's own windows (main + annotation-overlay) are always affiliated — overlay stays visible when user clicks main window to type Claude commands.
- **D-07:** Overlay's own hwnd is in the affiliated set — specifically because WalkthroughPanel has `pointerEvents: 'auto'`, clicking it makes overlay the foreground window.
- **D-08:** Target child dialogs (same PID or ownership chain) keep overlay visible — File > Save As, dropdowns, tooltips, modal dialogs.
- **D-09:** Target minimized (`IsIconic(targetHwnd)`) hides overlay regardless of focus state.

### Transitions & Debounce
- **D-10:** Instant `.show()` / `.hide()` — no CSS fade animation. The overlay is transparent, click-through, and sparse (annotation boxes). Fade complexity not justified.
- **D-11:** 150ms hide debounce — catches Alt+Tab switcher UI (~100-200ms foreground hold) without feeling sticky. Worst-case hide latency: 250ms poll + 150ms debounce = 400ms.
- **D-12:** Zero show debounce — overlay appears on the very next poll when user returns to target. Worst-case show latency: 250ms poll = 250ms.

### Edge Case Handling
- **D-13:** Stale hwnd detection on each poll via `GetWindowThreadProcessId` (reuse existing HWND-02 pattern from `windowCapture.ts`). If stale: hide overlay, stop tracking, emit `target-lost` WebSocket event.
- **D-14:** Focus tracker does NOT modify walkthrough engine state — no pause() method. Overlay visibility is separate from walkthrough state (follows existing pattern in `annotationBridgeStore.ts`).
- **D-15:** FocusTracker class with explicit `start(targetHwnd)` / `stop()` / `destroy()` lifecycle. Wire `stop()` to walkthrough engine stop/complete events. Use `isTracking` boolean to discard stale callbacks.
- **D-16:** Elevated/admin windows work out of the box — `GetForegroundWindow()` works cross-privilege on Windows 11. No mitigation needed.

### Claude's Discretion
- Exact koffi API usage patterns (sync vs async, type definitions)
- Whether to also export `getWindowThreadProcessId` and `isIconic` from win32.ts or keep those in PowerShell initially
- FocusTracker internal implementation details (class structure, event emission pattern)
- Whether to migrate existing `windowFocusManager.ts` to koffi in this phase or defer to a follow-up

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Overlay infrastructure
- `src/store/overlayStore.ts` — showOverlay/hideOverlay via Tauri WebviewWindow API
- `src/store/annotationBridgeStore.ts` — Existing overlay show/hide on walkthrough lifecycle (Phase 39 pattern)
- `src-tauri/tauri.conf.json` lines 79-91 — Overlay window config (fullscreen, transparent, alwaysOnTop, click-through)

### Focus & window management
- `sidecar/src/windowFocusManager.ts` — Existing GetForegroundWindow/SetForegroundWindow via PowerShell (reference pattern, not to be used for polling)
- `sidecar/src/windowCapture.ts` — HWND-02 stale hwnd detection via GetWindowThreadProcessId (reuse this pattern)
- `sidecar/src/windowEnumerator.ts` — Window enumeration with PID, processName, GetParent infrastructure

### Walkthrough engine
- `sidecar/src/walkthroughEngine.ts` — getTargetHwnd() at line 120, start/stop/advance lifecycle
- `src/components/WalkthroughPanel.tsx` — Has pointerEvents: 'auto' (affects focus detection)

### Requirements
- `.planning/REQUIREMENTS.md` — FOCUS-01, FOCUS-02, FOCUS-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `windowFocusManager.ts`: `getActiveWindowHwnd()`, `verifyFocus()`, `focusAndVerify()` — reference implementations for Win32 focus calls (PowerShell-based, not suitable for polling but shows the API surface)
- `windowCapture.ts`: Stale hwnd detection via `GetWindowThreadProcessId` + PID cross-check — proven pattern to reuse
- `windowEnumerator.ts`: `GetParent`, `GetWindowThreadProcessId` P/Invoke blocks — reference for new koffi equivalents
- `overlayStore.ts`: `showOverlay()`/`hideOverlay()` — direct integration point for focus tracker
- `annotationBridgeStore.ts`: Existing walkthrough lifecycle → overlay visibility wiring

### Established Patterns
- PowerShell `Add-Type` with C# DllImport for all Win32 calls — koffi replaces this for simple calls
- WebSocket messages from sidecar to frontend for state changes (e.g., `annotation-update`, `walkthrough-step`)
- Zustand stores for frontend state management
- Feature flags in `featureFlagStore.ts` gate overlay features

### Integration Points
- FocusTracker starts when `walkthroughEngine.start()` is called with a `targetHwnd`
- FocusTracker stops when walkthrough stops/completes
- FocusTracker emits WebSocket events to frontend (`overlay-focus-show`, `overlay-focus-hide`, `target-lost`)
- Frontend `overlayStore` receives focus events and calls `.show()`/`.hide()`

</code_context>

<specifics>
## Specific Ideas

- koffi's `win32.ts` module should be designed as a general-purpose Win32 FFI layer — future phases can add more exports without architectural changes
- The affiliated set should be built dynamically on each poll (resolve PID of foreground window, walk ownership chain) rather than cached — windows can be created/destroyed at any time
- Primary monitor only — no multi-monitor overlay positioning needed

</specifics>

<deferred>
## Deferred Ideas

- Multi-monitor overlay repositioning — separate phase if ever needed (primary monitor only for now)
- App restart with new hwnd (re-binding walkthrough to new window after target app closes and reopens) — future phase
- Migration of existing `windowFocusManager.ts` and `spatial_engine.ts` from PowerShell to koffi — good follow-up but not Phase 40 scope
- SetWinEventHook (event-driven focus detection) — evaluate during Phase 41/42 research if event-driven hooks are needed for visual change detection and UI Automation

</deferred>

---

*Phase: 40-focus-aware-overlay*
*Context gathered: 2026-04-11*
