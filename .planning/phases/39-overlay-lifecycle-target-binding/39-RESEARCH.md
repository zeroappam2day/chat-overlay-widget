# Phase 39: Overlay Lifecycle & Target Binding - Research

**Researched:** 2026-04-10
**Domain:** Tauri cross-window IPC, walkthrough engine lifecycle, Zustand store wiring
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVRL-01 | Overlay auto-shows when a walkthrough starts (no manual toggle needed) | `setWalkthroughStep` in `annotationBridgeStore` is the correct wiring point — fires on every step including the first |
| OVRL-02 | Overlay auto-hides when walkthrough completes or is cancelled | `broadcastWalkthroughStep(null)` is already called on all stop paths; frontend needs to call `hideOverlay()` when `step === null` |
| OVRL-03 | Walkthrough can be bound to a target hwnd at start time | `WalkthroughSchema` and `WalkthroughEngine.active` must be extended with optional `targetHwnd`; MCP schema is a duplicate and must also be updated |
</phase_requirements>

---

## Summary

Phase 39 is a pure brownfield integration. The walkthrough lifecycle pipeline is already complete (engine, HTTP endpoints, WebSocket broadcast, frontend listener). The overlay window is pre-created at app launch (`visible: false`) and `showOverlay`/`hideOverlay` already exist in `overlayStore.ts`. The only missing wiring is: (1) calling `showOverlay()`/`hideOverlay()` in response to walkthrough lifecycle events, and (2) adding an optional `targetHwnd` field to the schemas and engine state.

**Primary recommendation:** Wire auto-show/hide in `annotationBridgeStore.setWalkthroughStep` — it is the single choke point all walkthrough step events pass through on the frontend, including the first step (show) and the null sentinel (hide). Add `targetHwnd?: number` to `WalkthroughSchema`, `ActiveWalkthrough`, and the MCP tool schema. Expose a getter on `walkthroughEngine` for downstream phases.

The three success criteria map to three discrete code changes with no architectural risk.

---

## Project Constraints (from CLAUDE.md)

- Platform: Windows 11 only, no Docker, no WSL
- Tech stack: Tauri v1.8, React 18, Zustand, node-pty, ws WebSocket, TypeScript throughout
- GSD workflow enforcement: use GSD entry points before file edits
- Repowise MCP tools must be called before reading/modifying hotspot files (`sidecar/src/server.ts` is 98.2th percentile churn)
- Build: `npm run build` | Dev: `npm run dev`

---

## Walkthrough Data Flow (Verified)

[VERIFIED: direct codebase read]

### Complete Lifecycle Path: Start

```
MCP tool call (start_guided_walkthrough)
  → mcp-server.ts sidecarPost('/walkthrough/start', body)
  → server.ts POST /walkthrough/start
  → WalkthroughSchema.parse(raw)            ← schema validated here
  → walkthroughEngine.start(walkthrough)    ← sets active, applies step 0 annotations
  → broadcastWalkthroughStep(result)        ← WebSocket to all connected clients
  → TerminalPane.tsx onmessage handler
  → terminalMessageDispatcher.ts case 'walkthrough-step'
  → cb.setWalkthroughStep(msg.step)
  → annotationBridgeStore.setWalkthroughStep(step)
      → checks guidedWalkthrough feature flag
      → emit('update-walkthrough-step', step)   ← Tauri cross-window IPC
      → WalkthroughPanel.tsx listen('update-walkthrough-step') → renders panel
```

### Complete Lifecycle Path: Stop / Complete

All stop paths converge on `broadcastWalkthroughStep(null)`, which propagates through the same chain with `step === null`.

**Verified stop trigger locations in server.ts:**

| Location | Line | Trigger |
|----------|------|---------|
| `POST /walkthrough/stop` | ~238 | Explicit stop call |
| `POST /walkthrough/advance` — done branch | ~210 | Advanced past last step |
| ModeManager `onModeChanged(false)` | ~1313 | Work With Me mode deactivated |
| WalkthroughWatcher `onAdvance` — done branch | ~1470 | Terminal-match auto-advance completes walkthrough |

[VERIFIED: `sidecar/src/server.ts` lines 210, 238, 1313, 1470]

---

## Architecture Patterns

### Pattern 1: Auto-Show/Hide Wiring Point

**Where:** `src/store/annotationBridgeStore.ts` — `setWalkthroughStep`

**Why this is the correct point (not alternatives):**

The function is called on every walkthrough step event including:
- First step on start (show)
- Each subsequent step (already visible — no-op)
- `null` sentinel on any stop path (hide)

It already has the `guidedWalkthrough` feature flag gate. Adding `showOverlay`/`hideOverlay` calls here means all four stop paths are covered automatically with no per-endpoint duplication.

**Why NOT `WalkthroughPanel.tsx` useEffect:**
The `WalkthroughPanel` lives in the overlay window (`overlay.html` / `overlay_main.tsx`). `overlayStore.ts` calls `WebviewWindow.getByLabel('annotation-overlay')` — this is a Tauri API that controls the **other** window from the main window context. Calling it from within the overlay window itself would call `getByLabel` on the overlay window looking for itself, which is incorrect. The show/hide must be called from the main window context.

**Why NOT `terminalMessageDispatcher.ts`:**
The dispatcher is a pure function, not a Zustand store. It receives callbacks. Adding overlay control there would require threading `showOverlay`/`hideOverlay` through `DispatchCallbacks` in every call site, which is unnecessary complexity. `annotationBridgeStore` already imports from `overlayStore` context and is a better home.

**Adversarial check — race condition risk:**
`showOverlay` and `hideOverlay` are async (await `overlay.show()` / `overlay.hide()`). `setWalkthroughStep` is synchronous. The `emit('update-walkthrough-step', step)` call is also async (`.catch` only). Current pattern is fire-and-forget. Adding show/hide as fire-and-forget async calls (no await, catch errors) is consistent with existing pattern and safe.

**Adversarial check — flag gate:**
`setWalkthroughStep` already has `if (!useFeatureFlagStore.getState().guidedWalkthrough) return;` before the emit. The auto-show/hide calls should go AFTER this gate (inside the gate) so they only fire when the walkthrough feature is active.

**Adversarial check — `annotationOverlay` flag on `showOverlay`:**
`overlayStore.toggleOverlay()` checks `annotationOverlay` flag. But `showOverlay()` and `hideOverlay()` do NOT check `annotationOverlay` — they directly call `overlay.show()` / `overlay.hide()`. This means auto-show/hide works regardless of the `annotationOverlay` flag, which is the correct behavior for walkthrough-driven overlay management.

### Pattern 2: WalkthroughSchema targetHwnd Extension

**Current shape** (`sidecar/src/walkthroughEngine.ts` lines 39-43):
```typescript
export const WalkthroughSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().max(300),
  steps: z.array(WalkthroughStepSchema).min(1).max(50),
});
```

**Extended shape:**
```typescript
export const WalkthroughSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().max(300),
  steps: z.array(WalkthroughStepSchema).min(1).max(50),
  targetHwnd: z.number().int().positive().optional(),
});
```

`targetHwnd` must be optional (backward compatible — existing callers do not pass it).

**ActiveWalkthrough interface** (`walkthroughEngine.ts` lines 47-50):
```typescript
interface ActiveWalkthrough {
  walkthrough: Walkthrough;
  currentIndex: number;
  targetHwnd?: number;   // ADD THIS
}
```

Store in `walkthroughEngine.start()`: extract `walkthrough.targetHwnd` and assign to `this.active.targetHwnd`.

**Expose getter** for Phase 40/41/42:
```typescript
getTargetHwnd(): number | null {
  return this.active?.targetHwnd ?? null;
}
```

### Pattern 3: MCP Schema Duplication

[VERIFIED: `sidecar/src/mcp-server.ts` lines 366-388]

The MCP tool `start_guided_walkthrough` defines its own inline Zod schema in the `server.tool()` call — it does NOT import `WalkthroughSchema` from `walkthroughEngine.ts`. These two schemas are fully independent.

**This means:** Adding `targetHwnd` to `WalkthroughSchema` in `walkthroughEngine.ts` does NOT automatically expose it to MCP callers. The MCP schema must be updated separately.

MCP schema addition (in `mcp-server.ts` tool definition):
```typescript
targetHwnd: z.number().int().positive().optional()
  .describe('Windows HWND of the target application window. Stored for focus tracking and verification in subsequent phases.'),
```

The MCP handler passes `{ id, title, steps }` to `sidecarPost`. This destructuring must be updated to include `targetHwnd`:
```typescript
async ({ id, title, steps, targetHwnd }) => {
  const body = JSON.stringify({ id, title, steps, targetHwnd });
  // ...
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Cross-window show/hide | Custom Tauri commands in Rust | `WebviewWindow.getByLabel('annotation-overlay').show()/.hide()` — already in `overlayStore.ts` |
| Overlay window creation | Dynamic window creation | Window is pre-declared in `tauri.conf.json` with `visible: false` — already created at app launch |
| Feature flag checks | New flag system | Use existing `guidedWalkthrough` flag already gating `setWalkthroughStep` |
| HWND validation | Custom int validation | Zod `.int().positive()` is sufficient — HWND is always a positive integer |

**Key insight:** The overlay window is NOT dynamically created. It is pre-registered in `tauri.conf.json` as a second window with `"visible": false`. `WebviewWindow.getByLabel('annotation-overlay')` returns the existing window. Calling `.show()` on it works immediately from app launch — there is no initialization delay. [VERIFIED: `src-tauri/tauri.conf.json` lines 79-90]

---

## Common Pitfalls

### Pitfall 1: Calling Show/Hide from the Overlay Window Context
**What goes wrong:** `WebviewWindow.getByLabel('annotation-overlay')` called from within `overlay.html`'s React context returns the overlay window looking for itself — this may work or produce unexpected behavior, but it is architecturally wrong.
**Why it happens:** `WalkthroughPanel.tsx` runs inside `overlay_main.tsx` / `overlay.html`. Adding overlay control to `WalkthroughPanel` would be in the wrong window context.
**How to avoid:** All `showOverlay`/`hideOverlay` calls must remain in `annotationBridgeStore.ts` which runs in the main window context (`src/main.tsx`).
**Warning signs:** If you add a `listen` handler inside `WalkthroughPanel` that calls `overlayStore`, check which window context it runs in.

### Pitfall 2: Forgetting the MCP Schema is a Duplicate
**What goes wrong:** Developer updates `WalkthroughSchema` in `walkthroughEngine.ts` but MCP callers still cannot pass `targetHwnd` because the MCP tool schema is a separate inline Zod object.
**Why it happens:** `mcp-server.ts` duplicates the schema rather than importing it (D-03 requires self-containment — mcp-server.ts must not import from walkthroughEngine.ts).
**How to avoid:** Update both locations. `walkthroughEngine.ts` schema + `mcp-server.ts` tool schema + MCP handler destructuring.

### Pitfall 3: `annotationOverlay` Flag Blocking Auto-Show
**What goes wrong:** Developer adds `annotationOverlay` flag check to auto-show, which would prevent overlay from appearing during walkthroughs unless user manually enables the flag.
**Why it happens:** `toggleOverlay()` has this gate; confusion about which method to use.
**How to avoid:** Use `showOverlay()` and `hideOverlay()` directly — they do NOT check `annotationOverlay`. Only `toggleOverlay()` has that gate.

### Pitfall 4: Double-Show Race on Rapid Step Advances
**What goes wrong:** `showOverlay()` called on every step (including step 2+) when overlay is already visible, causing redundant `.show()` calls.
**Why it happens:** Naive implementation calls show on every non-null step.
**How to avoid:** Only call `showOverlay()` when `step !== null` AND overlay is currently hidden. Pattern:
```typescript
setWalkthroughStep: (step) => {
  if (!useFeatureFlagStore.getState().guidedWalkthrough) return;
  emit('update-walkthrough-step', step).catch(...);
  if (step !== null) {
    useOverlayStore.getState().showOverlay().catch(...);
  } else {
    useOverlayStore.getState().hideOverlay().catch(...);
  }
},
```
`showOverlay()` calls `overlay.show()` which is idempotent — a no-op if already visible. But calling it every step is still unnecessary Tauri IPC overhead. However, since this is a local single-user app, idempotent calls are acceptable; checking current visibility adds `overlay.isVisible()` async overhead. Recommendation: call unconditionally on start step, skip on intermediate steps.

---

## Code Examples

### Auto-Show/Hide in annotationBridgeStore

```typescript
// Source: verified against src/store/annotationBridgeStore.ts
setWalkthroughStep: (step) => {
  if (!useFeatureFlagStore.getState().guidedWalkthrough) return;
  emit('update-walkthrough-step', step).catch((err) => {
    console.warn('[annotation-bridge] Failed to emit walkthrough step:', err);
  });
  // OVRL-01 / OVRL-02: auto-manage overlay visibility with walkthrough lifecycle
  if (step !== null) {
    useOverlayStore.getState().showOverlay().catch((err) => {
      console.warn('[annotation-bridge] Failed to show overlay:', err);
    });
  } else {
    useOverlayStore.getState().hideOverlay().catch((err) => {
      console.warn('[annotation-bridge] Failed to hide overlay:', err);
    });
  }
},
```

The import of `useOverlayStore` already exists in the project at `src/store/overlayStore.ts`. Add it to `annotationBridgeStore.ts` imports.

### WalkthroughEngine targetHwnd Storage

```typescript
// Source: verified against sidecar/src/walkthroughEngine.ts
start(walkthrough: Walkthrough): { stepId: string; title: string; instruction: string; totalSteps: number; currentStep: number } {
  this.active = { walkthrough, currentIndex: 0, targetHwnd: walkthrough.targetHwnd };
  // ... rest unchanged
}

getTargetHwnd(): number | null {
  return this.active?.targetHwnd ?? null;
}
```

---

## Feature Flags

[VERIFIED: `src/store/featureFlagStore.ts` and `sidecar/src/server.ts`]

| Flag | Default | Controls |
|------|---------|---------|
| `guidedWalkthrough` | `false` | Gates `setWalkthroughStep` emit and WalkthroughPanel rendering |
| `annotationOverlay` | `false` | Gates `toggleOverlay()` only — does NOT gate `showOverlay()`/`hideOverlay()` |

**No new feature flag needed for Phase 39.** Auto-show/hide is part of the existing `guidedWalkthrough` feature. The `targetHwnd` field is additive and optional — no flag required.

**Important:** `/walkthrough/start`, `/walkthrough/stop`, and `/walkthrough/advance` HTTP endpoints are NOT gated by `guidedWalkthrough` in `server.ts`. Only `/walkthrough/modify` and `/walkthrough/status` are gated. This means walkthrough calls work regardless of the sidecar flag state.

---

## All Stop Paths (Exhaustive)

[VERIFIED: `sidecar/src/server.ts`]

1. **Explicit cancel:** `POST /walkthrough/stop` → `walkthroughEngine.stop()` → `broadcastWalkthroughStep(null)`
2. **Step exhaustion:** `POST /walkthrough/advance` when `currentIndex >= steps.length` → `walkthroughEngine.stop()` internally → `broadcastWalkthroughStep(null)`
3. **Mode deactivation:** `ModeManager.onModeChanged(false)` at line ~1305 → `walkthroughEngine.stop()` → `broadcastWalkthroughStep(null)` at line ~1313
4. **Terminal-match auto-advance completes walkthrough:** `session.walkthroughWatcherInstance.onAdvance` at line ~1469 → `walkthroughEngine.advance()` returns `{ done: true }` → `broadcastWalkthroughStep(null)`
5. **Session disconnect:** When WebSocket closes, `walkthroughEngine` is NOT stopped — engine stays active. Overlay would remain visible if no reconnect occurs. This is pre-existing behavior, not introduced by Phase 39.

Session disconnect is not a new concern for Phase 39. The overlay would remain visible until reconnect + stop is called. This is acceptable for Phase 39 scope.

---

## Existing Tests That Must Be Updated

[VERIFIED: codebase glob + grep]

| File | Current Coverage | What Must Be Updated |
|------|-----------------|----------------------|
| `src/components/terminalMessageDispatcher.test.ts` | Tests `walkthrough-step` dispatch to `setWalkthroughStep` callback | No change needed — dispatcher is unchanged |
| `src/components/__tests__/TerminalPane.test.tsx` | Mocks `setWalkthroughStep: vi.fn()` | No change needed — TerminalPane is unchanged |
| `sidecar/src/server.test.ts` | No walkthrough tests found | No walkthrough tests to update |

**New tests needed (Wave 0 gap):**
- `src/store/annotationBridgeStore.test.ts` — test that `setWalkthroughStep(step)` calls `showOverlay`, and `setWalkthroughStep(null)` calls `hideOverlay`
- `sidecar/src/walkthroughEngine.test.ts` — test that `start()` stores `targetHwnd` and `getTargetHwnd()` returns it; test that `start()` without `targetHwnd` returns null from getter

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend), node test runner (sidecar) |
| Config file | `vitest.config.ts` (frontend) |
| Quick run command | `npx vitest run src/store/annotationBridgeStore.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVRL-01 | `setWalkthroughStep(stepInfo)` calls `showOverlay()` | unit | `npx vitest run src/store/annotationBridgeStore.test.ts` | No — Wave 0 |
| OVRL-02 | `setWalkthroughStep(null)` calls `hideOverlay()` | unit | `npx vitest run src/store/annotationBridgeStore.test.ts` | No — Wave 0 |
| OVRL-03 | `walkthroughEngine.start({...targetHwnd})` stores hwnd; getter returns it | unit | `cd sidecar && npx vitest run src/walkthroughEngine.test.ts` | No — Wave 0 |

### Wave 0 Gaps
- [ ] `src/store/annotationBridgeStore.test.ts` — covers OVRL-01, OVRL-02
- [ ] `sidecar/src/walkthroughEngine.test.ts` — covers OVRL-03
- [ ] Mock for `useOverlayStore` in annotationBridgeStore test (Zustand store mocking via `vi.mock`)
- [ ] Mock for `@tauri-apps/api/event` emit in annotationBridgeStore test (already pattern exists in project)

### Sampling Rate
- Per task commit: `npx vitest run src/store/annotationBridgeStore.test.ts`
- Per wave merge: `npx vitest run`
- Phase gate: full suite green before `/gsd-verify-work`

---

## Environment Availability

Step 2.6: SKIPPED — Phase 39 is pure code/config changes. No external dependencies beyond the existing project stack (Node.js, npm, Rust toolchain, Tauri). All tooling verified operational (Phase 38 just shipped).

---

## Security Domain

No new attack surface introduced. `targetHwnd` is an integer accepted from MCP tool calls. HWND values are Windows process-owned integers; accepting an arbitrary HWND for storage is safe — Phase 39 only stores the value, not acts on it. Acting on the HWND begins in Phase 40+.

Input validation: `z.number().int().positive().optional()` prevents negative/zero/float values. No additional sanitization needed for storage-only use in Phase 39.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `showOverlay()` / `hideOverlay()` are idempotent (calling show when already visible is safe) | Pitfall 4 | Tauri WebviewWindow.show() behavior — if not idempotent, could cause flicker. Low risk: Tauri docs confirm show/hide are idempotent. [ASSUMED — not verified via Context7 in this session] |
| A2 | Session disconnect does not stop walkthroughEngine | All Stop Paths | If engine is reset on disconnect, overlay hide might fire spuriously on reconnect. Low risk: code shows engine is module-level singleton with no WS cleanup hook. [VERIFIED: server.ts ws.on('close') handler not observed to reset walkthroughEngine] |

---

## Open Questions

1. **Calling `showOverlay` on intermediate steps (step 2+)**
   - What we know: Overlay is already visible; `show()` is idempotent
   - What's unclear: Whether calling `overlay.show()` on an already-visible window has any flicker or z-order side effect on Windows 11
   - Recommendation: Only call `showOverlay` when `step !== null` AND it is the first step OR overlay was manually hidden. Simplest safe approach: check `step !== null` only, rely on idempotency.

2. **`walkthroughEngine.start()` return type vs. stored targetHwnd**
   - What we know: `start()` returns `{ stepId, title, instruction, totalSteps, currentStep }` — no targetHwnd
   - What's unclear: Should `start()` return `targetHwnd` back to caller for confirmation?
   - Recommendation: No — return type is used by `broadcastWalkthroughStep` and MCP response. Adding targetHwnd to the broadcast is not needed for Phase 39. Keep return type unchanged.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `sidecar/src/walkthroughEngine.ts`, `sidecar/src/server.ts`, `src/store/annotationBridgeStore.ts`, `src/store/overlayStore.ts`, `src/store/featureFlagStore.ts`, `src-tauri/tauri.conf.json`, `src/components/terminalMessageDispatcher.ts`, `src/overlay_main.tsx`, `sidecar/src/mcp-server.ts` lines 331-403

### Secondary (MEDIUM confidence)
- `src/hooks/useShortcuts.ts` — confirmed `toggleOverlay()` is the only existing manual trigger; `showOverlay`/`hideOverlay` are unused outside `overlayStore.ts` itself

---

## Metadata

**Confidence breakdown:**
- Walkthrough data flow: HIGH — read every file in the chain
- Auto-show/hide wiring point: HIGH — adversarially validated all three alternatives
- MCP schema duplication: HIGH — confirmed by reading mcp-server.ts tool definition
- Overlay window pre-creation: HIGH — confirmed by tauri.conf.json
- Stop paths: HIGH — grepped all `broadcastWalkthroughStep(null)` occurrences

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase, low churn expected on these files)
