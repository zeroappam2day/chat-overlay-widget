# Phase 40: Focus-Aware Overlay - Research

**Date:** 2026-04-11
**Phase:** 40-focus-aware-overlay
**Method:** 9 parallel research agents (3 initial + 3 adversarial stress-test + 3 brownfield deep-dive)

## Research Summary

Phase 40 adds focus-aware overlay visibility: hide overlay when user switches away from the walkthrough target app, show when they return. Research covered 3 areas: focus detection method, overlay transition behavior, and edge cases.

## 1. Focus Detection Method

### Options Evaluated (7 total)

| Option | Latency | New Deps | Bundle Size | Brownfield Fit |
|--------|---------|----------|-------------|----------------|
| A: Fresh PowerShell spawn | 300-700ms | None | 0 | Existing — but terrible for polling |
| B: Persistent PowerShell | 1-5ms | None | 0 | Best — evolves existing pattern |
| C: SetWinEventHook (C#) | 1-5ms | C# .exe | +5KB | Good — event-driven, but premature |
| D: Rust native | 1-5ms | windows-rs | Large | Poor — Rust backend deliberately minimal |
| E: koffi (raw) | 0.01ms | koffi | +86MB | Good — but HWND type mismatch + large bundle |
| F: koffi-cream | 0.01ms | koffi-cream | +3.6MB | Good — solves bundle size, but untested with caxa |
| G: C# .exe persistent | 0.1-0.5ms | None | +5KB | Good — but adds build step |

### Decision: Persistent PowerShell (Option B)

**Rationale from adversarial stress-testing:**

1. **Zero new dependencies.** The codebase already has 1,398 lines of PowerShell P/Invoke across 6 files. The persistent PS approach reuses the exact C# DllImport declarations.
2. **1-5ms per call is sufficient.** At 250ms polling intervals, the difference between 1ms and 0.01ms is invisible. Both are <1% of the polling interval.
3. **koffi's HWND problem.** koffi returns opaque pointers, not numbers. The entire codebase passes HWNDs as `number`. Every caller needs `Number(koffi.address(ptr))` conversion — a type mismatch landmine.
4. **koffi-cream + caxa untested.** The combination has zero documented usage. caxa bundles node_modules recursively; koffi-cream's platform-specific optional deps may not resolve correctly inside the self-extracting archive.
5. **Persistent PowerShell is proven.** VS Code PowerShell Extension uses the exact same pattern (persistent process, stdin/stdout communication).
6. **Fallback path clear.** If persistent PS proves unreliable (stdout buffering, hangs), koffi-cream is a drop-in replacement requiring ~20 lines of code change.

### Win32 Functions Required

```csharp
[DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
[DllImport("user32.dll")] static extern bool IsWindow(IntPtr hWnd);
[DllImport("user32.dll")] static extern bool IsIconic(IntPtr hWnd);
[DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);
```

All 5 are already used in existing codebase files (windowFocusManager.ts, windowCapture.ts, windowEnumerator.ts).

### Persistent PowerShell Architecture

```
sidecar startup
  └─ spawn powershell.exe -NoProfile -NoExit -Command -
       └─ stdin: Add-Type C# block (compiles once, ~300ms)
       └─ stdin: {"id":1,"cmd":"getForegroundWindow"}
       └─ stdout: {"id":1,"result":12345}
       └─ ...repeat at 250ms intervals...
  └─ health-check: 3s timeout per request, auto-restart on failure
```

## 2. Overlay Transition Behavior

### Affiliated Set Model

Focus tracking uses hybrid hwnd-tree + PID matching:

1. Walk `GetWindow(fgHwnd, GW_OWNER)` up to 5 levels
2. If any hwnd in chain matches targetHwnd → affiliated
3. If no match, fall back to PID comparison
4. Exclude `ApplicationFrameHost.exe` from PID matching (shared UWP PID)
5. Chat widget's own windows always affiliated
6. Overlay's own hwnd always affiliated (WalkthroughPanel has pointerEvents:'auto')

### Transition Rules

- Instant `.show()` / `.hide()` — no CSS fade (stress-test killed this: cross-window coordination complexity not justified for sparse transparent overlay)
- 150ms hide debounce — catches Alt+Tab (100-200ms). Worst case: 400ms total
- Zero show debounce — overlay appears on next poll. Worst case: 250ms
- Target minimized (`IsIconic`) → hide immediately, no debounce

## 3. Edge Cases

### Must Handle (Phase 40)

| Edge Case | Mitigation | Complexity |
|-----------|-----------|------------|
| Stale hwnd (app closed) | GetWindowThreadProcessId on each poll, reuse HWND-02 pattern | Low |
| Focus tracking lifecycle | FocusTracker class with start/stop/destroy | Low-Medium |
| Target minimized | IsIconic check per poll | Low |
| Overlay self-hwnd in affiliated set | Add overlay hwnd (WalkthroughPanel pointerEvents) | Low |

### Deferred

| Edge Case | Reason |
|-----------|--------|
| Multi-monitor positioning | Primary monitor only per user decision |
| App restart with new hwnd | Future phase |
| Sleep/wake | Computer doesn't use these |
| Elevated windows | GetForegroundWindow works cross-privilege, no mitigation needed |

## 4. Codebase Integration Map

### Files That Touch Win32 (for context)

| File | Win32 Functions | Spawn Method | Lines |
|------|----------------|-------------|-------|
| windowFocusManager.ts | SetForegroundWindow, GetForegroundWindow, AllowSetForegroundWindow | execFile | 141 |
| windowEnumerator.ts | EnumWindows, IsWindowVisible, GetWindowText, GetWindowLongPtr, DwmGetWindowAttribute, GetWindowThreadProcessId, GetParent | spawnSync | 119 |
| windowCapture.ts | EnumWindows, GetWindowText, IsWindowVisible, PrintWindow, DwmGetWindowAttribute, SetProcessDpiAwarenessContext, IsIconic, GetWindowRect, GetWindowThreadProcessId + System.Drawing | spawnSync | 531 |
| spatial_engine.ts | GetForegroundWindow, GetWindowRect | exec | 44 |
| windowThumbnailBatch.ts | EnumWindows, IsWindowVisible, GetWindowText, GetWindowLongPtr, PrintWindow, DwmGetWindowAttribute, GetWindowThreadProcessId, GetParent, SetProcessDpiAwarenessContext, IsIconic | spawnSync | 225 |
| enhancedAccessibility.ts | FindWindow + UIAutomation assemblies | spawnSync | 338 |

### New Files for Phase 40

- `sidecar/src/win32Bridge.ts` — Persistent PowerShell process management + 5 Win32 function exports
- `sidecar/src/focusTracker.ts` — FocusTracker class (start/stop/destroy, polling loop, affiliated set logic, debounce)
- Frontend: modifications to `overlayStore.ts` and `annotationBridgeStore.ts` for focus events

## Validation Architecture

### Requirements Coverage

| Requirement | Success Criteria | Validation Method |
|-------------|-----------------|-------------------|
| FOCUS-01 | Switching focus away hides overlay | E2E: focus target app, click unrelated app, verify overlay hidden |
| FOCUS-02 | Switching focus back shows overlay | E2E: after hide, click target app, verify overlay shown |
| FOCUS-03 | Detection within 500ms | Timing test: measure interval between focus change and overlay state change |

### Test Strategy

1. **Unit tests:** win32Bridge.ts (mock PowerShell process), focusTracker.ts (mock win32Bridge)
2. **Integration test:** Start walkthrough with targetHwnd, verify overlay show/hide on simulated focus changes
3. **Manual UAT:** Run walkthrough on Notepad, Alt+Tab to another app, verify overlay behavior

---

*Research complete: 2026-04-11*
