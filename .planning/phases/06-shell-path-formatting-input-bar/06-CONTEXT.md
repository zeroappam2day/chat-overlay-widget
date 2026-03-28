# Phase 6: Shell Path Formatting & Input Bar - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Screenshot paths are safely quoted for the active shell and never break silently, and the chat input bar is tall enough by default for multi-line prompts with user-controlled resize. No new capture mechanisms, no new shell support, no HTTP API work (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Path Quoting Strategy
- **D-01:** Quoting happens in the frontend at injection time (ChatInputBar), not in the sidecar. Both clipboard-paste and drag-drop paths converge at the same injection point (`ChatInputBar.tsx:89`), making frontend the single quoting location. User sees the quoted path before pressing Enter (consistent with Phase 4 D-01: "user sees the path, can edit it").
- **D-02:** Pass `currentShell` as a new prop from TerminalPane to ChatInputBar. TerminalPane already tracks `currentShell` (short name: `powershell.exe` | `cmd.exe` | `bash.exe`). One prop addition.
- **D-03:** Create a pure utility function `quotePathForShell(path: string, shell: string): string` that maps shell name to quoting rules per PATH-01:
  - PowerShell: single-quote with embedded `'` escaped as `''` → `'C:\Users\...\image.png'`
  - cmd.exe: double-quote → `"C:\Users\...\image.png"`
  - Git Bash: convert backslashes to forward slashes + single-quote → `'/c/Users/.../image.png'`
- **D-04:** Shell-switch edge case (paste image, switch shell, press Enter) is accepted as cosmetic-only. Shell switch kills+respawns PTY but textarea value persists as React state. Extremely unlikely user flow, and the quoted path is visible for manual correction. No re-quoting on send.

### Filename Format
- **D-05:** Drop sessionId prefix from temp filenames. Change from `${sessionId}-${UUID}.${ext}` to `${UUID}.${ext}` for strict PATH-02 compliance (UUID characters only: hex + hyphens). Single line change in `ptySession.ts:65`.
- **D-06:** Cleanup is unaffected — `this.tempFiles` array tracks full paths, and `sweepScreenshotTempFiles()` deletes all files in SCREENSHOT_DIR. Both are format-agnostic.

### Input Bar Default Height
- **D-07:** ChatInputBar default height increases to ~144px (INBAR-01). Currently starts at 1 row with auto-expand capped at 96px. Change to a fixed min-height of 144px with the textarea filling the available space.
- **D-08:** Remove the 96px auto-expand cap. With a taller default and user-resizable height, the auto-expand logic becomes unnecessary — textarea should fill the input bar container, with overflow scroll.

### Resize Handle
- **D-09:** Add a thin drag handle div between the terminal container and ChatInputBar inside TerminalPane. Cursor: `row-resize`. Hover highlight matching existing Separator pattern (`hover:bg-[#007acc]`). Not using react-resizable-panels for this — simple mousedown/mousemove/mouseup handler on a styled div is sufficient for a single vertical resize.
- **D-10:** Per-pane resize. ChatInputBar lives inside each TerminalPane — each pane controls its own input bar height independently. Natural architecture, no global coordination needed.
- **D-11:** Min terminal height guard: ~60px (~3 rows) prevents collapsing terminal to zero. FitAddon already guards against `offsetHeight === 0` but a CSS min-height provides better UX than silent failure.
- **D-12:** Resize height is in-memory only (React state). Does not persist across sessions. Requirements are silent on persistence — keep it simple.

### Terminal Refit
- **D-13:** No changes needed to `useTerminal.ts`. Existing ResizeObserver + 150ms debounce + `offsetHeight > 0` guard already handles container size changes from input bar resize. FitAddon triggers automatically when terminal container shrinks/grows.

### Claude's Discretion
- Exact drag handle height and styling (likely 4-6px)
- Whether drag handle shows a subtle grip indicator (dots/lines) or is plain
- Exact min-height value for terminal container
- Whether to show a subtle tooltip on first drag handle hover

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 Requirements
- `.planning/REQUIREMENTS.md` — PATH-01, PATH-02, INBAR-01, INBAR-02, INBAR-03 define Phase 6 acceptance criteria
- `.planning/ROADMAP.md` — Phase 6 success criteria (5 observable outcomes)

### Path Injection Code (must read to understand quoting integration points)
- `src/components/ChatInputBar.tsx` — Textarea injection at line 89 (pendingImagePath), paste handler, onSend flow
- `src/components/TerminalPane.tsx` — currentShell state (line 21), save-image-result handler (line 82), pendingImagePath flow (line 285)
- `src/components/PaneContainer.tsx` — Drag-drop path flow (lines 64-86), droppedImagePath state
- `sidecar/src/ptySession.ts` — saveImage() filename generation (line 65), SCREENSHOT_DIR (line 10), temp file tracking

### Shell Detection (must read for quoting logic)
- `sidecar/src/shellDetect.ts` — Shell enumeration, short names (powershell.exe, cmd.exe, bash.exe)
- `src/protocol.ts` — pty-ready message with shell field, shell-list message

### Input Bar Layout (must read for resize implementation)
- `src/components/TerminalPane.tsx` — Flex column layout (line 229-289), terminal container with min-h-0 (line 271), ChatInputBar mount (line 282)
- `src/hooks/useTerminal.ts` — ResizeObserver + 150ms debounce (lines 118-128), FitAddon dimension guards (line 123)
- `src/components/PaneContainer.tsx` — Separator styling pattern (lines 46-52) for drag handle reference

### Prior Architecture Decisions
- `.planning/phases/04-differentiating-features/04-CONTEXT.md` — D-01 (path in input box, user edits before send), D-02 (drag-drop + paste both supported)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `react-resizable-panels` Separator pattern (PaneContainer.tsx:46-52): hover color, cursor change, transition — reuse styling for input bar drag handle
- `currentShell` state in TerminalPane (line 21): already tracks active shell as short name — just pass as prop
- ResizeObserver + debounce pattern (useTerminal.ts:118-128): already handles container size changes — no modifications needed

### Established Patterns
- Typed message envelope: `{ type: MessageType, ...payload }` discriminated union — no protocol changes needed for this phase
- Cross-hook refs (writeRef, sendMessageRef, getDimensionsRef): stable ref pattern for coordinating hooks
- Tailwind utility classes throughout — drag handle styling should follow same convention
- `shrink-0` on ChatInputBar container (line 97) — will change to controlled height

### Integration Points
- `ChatInputBar` props interface (line 3-9): add `currentShell` prop for quoting
- `ChatInputBar` pendingImagePath injection (line 89): apply `quotePathForShell()` before concatenation
- `TerminalPane` ChatInputBar mount (line 282): pass `currentShell` prop
- `ptySession.ts` saveImage (line 65): change filename format to UUID-only
- `TerminalPane` layout (lines 271-282): insert drag handle div between terminal container and ChatInputBar

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all decisions are deterministic from requirements spec + brownfield code analysis. This phase is pure mechanical implementation with no vision/UX ambiguity.

</specifics>

<deferred>
## Deferred Ideas

- Persist input bar height across sessions (localStorage) — future enhancement if users request it
- Re-quote path on shell switch (if user pastes image then switches shell before Enter) — extremely unlikely flow, accepted as cosmetic edge case
- Input bar height synced across all panes (global resize) — per-pane is simpler and more flexible

</deferred>

---

*Phase: 06-shell-path-formatting-input-bar*
*Context gathered: 2026-03-28*
