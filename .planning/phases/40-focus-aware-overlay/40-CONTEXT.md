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
- **D-01:** Use a persistent PowerShell process for Win32 focus calls. Spawn one `powershell.exe -NoProfile -NoExit -Command -` at sidecar startup, send the `Add-Type` C# block once, then query via stdin/stdout JSON line protocol. Eliminates per-call process spawn overhead (300-500ms → 1-5ms). Zero new npm dependencies. Reuses existing C# DllImport patterns from `windowFocusManager.ts`.
- **D-02:** Poll at 250ms intervals via `setTimeout` chains (not `setInterval`, to avoid post-wake bursts).
- **D-03:** Create `sidecar/src/win32Bridge.ts` module that manages the persistent PowerShell process and exports `getForegroundWindow(): Promise<number>`, `getWindowThreadProcessId(hwnd): Promise<{threadId, pid}>`, `isWindow(hwnd): Promise<boolean>`, `isIconic(hwnd): Promise<boolean>`, `getOwnerWindow(hwnd): Promise<number>`. Request-ID based JSON framing for stdin/stdout correlation.
- **D-04:** Include health-check heartbeat (3s timeout per request). Auto-restart the persistent process on crash/hang. Warmup the Add-Type block on sidecar startup so first focus check is fast.

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
- Exact PowerShell stdin/stdout framing protocol details (delimiter choice, error format)
- FocusTracker internal implementation details (class structure, event emission pattern)
- Whether to consolidate other PowerShell callers (windowEnumerator, spatial_engine) into the persistent process in this phase or defer

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Overlay infrastructure
- `src/store/overlayStore.ts` — showOverlay/hideOverlay via Tauri WebviewWindow API
- `src/store/annotationBridgeStore.ts` — Existing overlay show/hide on walkthrough lifecycle (Phase 39 pattern)
- `src-tauri/tauri.conf.json` lines 79-91 — Overlay window config (fullscreen, transparent, alwaysOnTop, click-through)

### Focus & window management
- `sidecar/src/windowFocusManager.ts` — Existing GetForegroundWindow/SetForegroundWindow via PowerShell (Add-Type C# blocks to reuse in persistent process)
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

- The persistent PowerShell `win32Bridge.ts` should be designed as a general-purpose Win32 bridge — future phases can add more commands without architectural changes. The Add-Type C# block compiles once; adding new DllImport functions is just adding to the class.
- The affiliated set should be built dynamically on each poll (resolve PID of foreground window, walk ownership chain) rather than cached — windows can be created/destroyed at any time
- Primary monitor only — no multi-monitor overlay positioning needed
- If persistent PowerShell proves unreliable (stdout buffering, process hangs), koffi-cream (3.6MB, platform-specific prebuilts) is the drop-in replacement with 0.01ms/call and synchronous API

</specifics>

<deferred>
## Deferred Ideas

- Multi-monitor overlay repositioning — separate phase if ever needed (primary monitor only for now)
- App restart with new hwnd (re-binding walkthrough to new window after target app closes and reopens) — future phase
- Consolidating other PowerShell callers (windowEnumerator, spatial_engine, windowCapture) into the persistent process — good follow-up but not Phase 40 scope
- koffi-cream as a future upgrade if persistent PowerShell proves unreliable — 0.01ms/call, synchronous, 3.6MB platform-specific
- SetWinEventHook (event-driven focus detection) — evaluate during Phase 41/42 research if event-driven hooks are needed for visual change detection and UI Automation

</deferred>

---

*Phase: 40-focus-aware-overlay*
*Context gathered: 2026-04-11*
