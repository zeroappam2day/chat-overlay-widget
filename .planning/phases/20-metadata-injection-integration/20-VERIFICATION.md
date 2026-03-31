---
phase: 20-metadata-injection-integration
verified: 2026-03-31T08:10:00Z
status: human_needed
score: 7/7 must-haves verified (automated); 1 item requires human confirmation
re_verification: false
human_verification:
  - test: "Open picker, click a thumbnail, verify ChatInputBar is populated and picker closes"
    expected: |
      Picker closes immediately. ChatInputBar textarea contains exactly 6 lines:
        Line 1: shell-quoted file path (single-quoted for PowerShell)
        Line 2: # window: <title>
        Line 3: # bounds: x=N y=N w=N h=N (physical pixels)
        Line 4: # capture_size: NxN
        Line 5: # dpi_scale: N.NNNN
        Line 6: # coordinate_origin: top-left, units: physical pixels
    why_human: "Requires live Tauri app with running sidecar and a real window to capture"
  - test: "Keyboard flow — open picker, arrow-navigate to a thumbnail, press Enter, verify same result"
    expected: "Same 6-line metadata block injected into ChatInputBar via keyboard activation"
    why_human: "Keyboard interaction with running app cannot be verified by grep/static analysis"
---

# Phase 20: Metadata Injection & Integration — Verification Report

**Phase Goal:** Selecting a window in the picker captures it with full coordinate metadata and injects a structured block into the active pane's ChatInputBar, ready for Claude to perform spatial reasoning.
**Verified:** 2026-03-31T08:10:00Z
**Status:** human_needed — all automated checks pass; 2 end-to-end behaviors require live app confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `formatCaptureBlock` produces a multi-line string with shell-quoted path on line 1 | VERIFIED | Implementation at `src/utils/formatCaptureBlock.ts:12-22`; 7/7 unit tests pass |
| 2 | Metadata block contains bounds x,y,w,h in physical pixel values | VERIFIED | Line 17: `# bounds: x=${bounds.x} y=${bounds.y} w=${bounds.w} h=${bounds.h} (physical pixels)` |
| 3 | Metadata block contains captureSize, dpiScale, and coordinate_origin fields | VERIFIED | Lines 18-20 in `formatCaptureBlock.ts`; Test 1 asserts all three fields |
| 4 | Block format uses # comment lines readable by Claude without JSON parsing | VERIFIED | All 5 metadata lines use plain `# key: value` comment format |
| 5 | Clicking a thumbnail closes the picker and sends capture-window-with-metadata WS message | VERIFIED (code) | `handleWindowSelect` in `TerminalPane.tsx:261-264` calls `setPickerOpen(false)` BEFORE `sendMessage`; `WindowPicker.tsx:114-117` calls `onSelect?.(w)` on click |
| 6 | capture-result-with-metadata response populates active pane ChatInputBar with path + metadata | VERIFIED (code) | `TerminalPane.tsx:107-118` case handler calls `formatCaptureBlock` and `setPendingInjection`; `ChatInputBar.tsx:95-104` useEffect injects on `pendingInjection` change |
| 7 | End-to-end flow works: open picker -> select window -> ChatInputBar populated -> user sends | HUMAN NEEDED | All code paths wired and type-checked; live app run required to confirm sidecar responds and textarea populates |

**Score:** 6/7 automatically verified; 7/7 code-level wired

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/formatCaptureBlock.ts` | Metadata text formatter | VERIFIED | Exports `formatCaptureBlock` and `CaptureBlockInput`; 23 lines, no stubs |
| `src/utils/formatCaptureBlock.test.ts` | 7 unit tests | VERIFIED | 7 `it()` blocks covering PS/cmd/bash/null shells, dpiScale, title passthrough, line count — all passing |
| `src/components/ChatInputBar.tsx` | `pendingInjection` + `onInjectionConsumed` props with useEffect | VERIFIED | Props declared at lines 12-13; `useEffect` at lines 95-104 with `\n` separator and `onInjectionConsumed` call |
| `src/components/TerminalPane.tsx` | `handleWindowSelect`, `capture-result-with-metadata` case, `pendingInjection` state | VERIFIED | All three present at lines 32, 107-118, 261-264 respectively |
| `src/components/WindowPicker.tsx` | `onSelect` prop wired to click and keyboard Enter | VERIFIED | `onSelect` called at line 117 (click) and line 54 (Enter key) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/formatCaptureBlock.ts` | `src/utils/shellQuote.ts` | `import quotePathForShell` | WIRED | Line 1 import; called at line 13 inside `formatCaptureBlock` |
| `src/components/TerminalPane.tsx` | `src/utils/formatCaptureBlock.ts` | `import formatCaptureBlock` | WIRED | Line 13 import; called inside `case 'capture-result-with-metadata'` at line 108 |
| `src/components/TerminalPane.tsx` | `src/components/ChatInputBar.tsx` | `pendingInjection` prop | WIRED | Prop passed at lines 374-375; consumed via useEffect in ChatInputBar |
| `src/components/TerminalPane.tsx` | WebSocket | `sendMessage capture-window-with-metadata` | WIRED | `handleWindowSelect` at line 263 sends `{ type: 'capture-window-with-metadata', title: window.title }` |
| `sidecar/src/server.ts` | `sidecar/src/windowCapture.ts` | `captureWindowWithMetadata` | WIRED | Imported line 13; invoked in `case 'capture-window-with-metadata'` at line 257; returns `capture-result-with-metadata` response |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ChatInputBar.tsx` textarea | `pendingInjection` (string) | `TerminalPane.tsx` state `setPendingInjection` | Yes — populated from `formatCaptureBlock()` which formats live WS response fields | FLOWING |
| `formatCaptureBlock.ts` output | `bounds`, `captureSize`, `dpiScale` | `sidecar/src/windowCapture.ts:captureWindowWithMetadata` | Yes — parsed from PowerShell `OK|path|bx|by|bw|bh|cw|ch|dpi` output via spawnSync | FLOWING |
| `WindowPicker.tsx` thumbnails | `pickerWindows` (WindowThumbnail[]) | `TerminalPane.tsx` `case 'window-thumbnails'` → `setPickerWindows` | Yes — populated from sidecar `window-thumbnails` WS message | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `formatCaptureBlock` unit tests (7 cases) | `npx vitest run src/utils/formatCaptureBlock.test.ts` | 7/7 passed | PASS |
| Full test suite (73 tests) | `npx vitest run` | 73/73 passed | PASS |
| TypeScript compilation | `npx tsc --noEmit` | Exit 0, no errors | PASS |
| End-to-end live flow | Requires running Tauri app | Not run — needs live sidecar | SKIP (human needed) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CAPT-02 | 20-01, 20-02 | Structured metadata block formatted alongside image path in ChatInputBar | SATISFIED | `formatCaptureBlock` produces the block; `pendingInjection` injects it; `useEffect` in ChatInputBar populates textarea |
| CAPT-03 | 20-01 | Metadata follows Claude computer_use coordinate conventions for LLM spatial reasoning | SATISFIED | Block contains `# coordinate_origin: top-left, units: physical pixels`; `dpiScale.toFixed(4)`; bounds labeled `(physical pixels)` |
| INTG-03 | 20-02 | Captured path + metadata injected into active pane's ChatInputBar on window selection | SATISFIED (code) / HUMAN NEEDED (live) | Full wiring exists: picker onSelect -> handleWindowSelect -> WS -> sidecar -> capture-result-with-metadata -> formatCaptureBlock -> pendingInjection -> ChatInputBar useEffect. REQUIREMENTS.md line 157 shows this as `[ ]` Pending — to be marked complete after human visual sign-off |

No orphaned requirements — all three IDs (CAPT-02, CAPT-03, INTG-03) are claimed by plans 20-01 and 20-02 and verified above.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/WindowPicker.tsx` | 8 | `onSelect?: (window: WindowThumbnail) => void; // Phase 20 hook — noop for now` | Info | Comment is a stale doc artifact — `onSelect` IS wired (not a noop); code at lines 54 and 117 both call it. No functional impact. |

No blocker or warning anti-patterns found. The stale comment at line 8 of WindowPicker.tsx is a documentation artifact only — the actual implementation is fully wired.

---

### Human Verification Required

#### 1. Mouse click end-to-end flow

**Test:** Start the app (`start.bat`), open the window picker (4-square grid icon in toolbar), click any window thumbnail.
**Expected:**
- Picker closes immediately (no visible freeze)
- ChatInputBar textarea contains exactly 6 lines:
  - Line 1: shell-quoted file path (single-quoted for PowerShell, e.g. `'C:\Users\...\uuid.png'`)
  - Line 2: `# window: <title of selected window>`
  - Line 3: `# bounds: x=N y=N w=N h=N (physical pixels)`
  - Line 4: `# capture_size: NxN`
  - Line 5: `# dpi_scale: N.NNNN`
  - Line 6: `# coordinate_origin: top-left, units: physical pixels`
- Press Enter — Claude receives image path + metadata and can reference coordinates

**Why human:** Requires live Tauri app with running sidecar; sidecar must spawn PowerShell and invoke C# capture script against a real window.

#### 2. Keyboard navigation flow

**Test:** Open picker, use arrow keys to move selection, press Enter on highlighted thumbnail.
**Expected:** Same result as mouse click — picker closes, ChatInputBar populated with identical 6-line block.
**Why human:** Keyboard event interaction in running Tauri WebView2 cannot be verified statically.

---

### Gaps Summary

No gaps blocking automated goal achievement. All code-level must-haves are satisfied:

- `formatCaptureBlock.ts` exists, is substantive, wired to `shellQuote.ts`, and tested with 7 passing unit tests
- `ChatInputBar.tsx` has the `pendingInjection` prop and `useEffect` injection logic using `\n` separator
- `TerminalPane.tsx` has the complete wiring: `handleWindowSelect` callback, `capture-result-with-metadata` switch case, `currentShellRef` ref pattern, `pendingInjection` state, and all JSX props wired correctly
- `WindowPicker.tsx` calls `onSelect` on both mouse click and keyboard Enter
- Sidecar `server.ts` handles `capture-window-with-metadata` and returns `capture-result-with-metadata` with bounds, captureSize, dpiScale
- TypeScript compiles clean; 73/73 tests pass

The only unverified item is the live end-to-end behavior (INTG-03), which requires a human to run the app. REQUIREMENTS.md correctly marks INTG-03 as `[ ]` Pending — it should be checked off after the human visual checkpoint in Task 3 of Plan 02.

---

_Verified: 2026-03-31T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
