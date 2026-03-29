# Phase 10: Split Pane Preservation - Context

**Gathered:** 2026-03-29 (assumptions mode — stress-tested, no user corrections needed)
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can split a pane without losing the live PTY session running in the original pane. Terminal scrollback, ANSI output, and xterm.js dimensions must survive the split in both panes. This phase is primarily verification + edge-case hardening of the existing Phase 4 architecture.

</domain>

<decisions>
## Implementation Decisions

### Session Preservation on Split
- **D-01:** Original pane's WebSocket and PTY session are untouched by split — `splitInTree()` keeps the original `PaneNode` (same `id`) in the layout tree; React reconciliation preserves the component via `key={node.id}`
- **D-02:** xterm.js Terminal instance stays bound to its DOM container element across layout changes — the container is never unmounted, only resized
- **D-03:** Scrollback buffer (10,000+ lines per TERM-02) lives in xterm.js Terminal memory — layout changes do not clear it

### xterm.js Refit After Split
- **D-04:** ResizeObserver + 150ms debounce (already in `useTerminal`) triggers FitAddon.fit() when panel dimensions change after split
- **D-05:** `onResize` callback sends `{ type: 'resize', cols, rows }` to sidecar → `ptyProcess.resize(cols, rows)` → shell stty size updates automatically
- **D-06:** Verify debounce timing is sufficient for react-resizable-panels animation settling — if FitAddon.fit() fires mid-animation, the final stty size may be wrong. Fix: ensure final fit fires after panel dimensions stabilize

### New Pane Behavior
- **D-07:** New pane gets its own WebSocket connection → new PTY session (Phase 4 D-05: 1:1 WS→PTY mapping)
- **D-08:** New pane auto-spawns default shell via existing `useEffect` in TerminalPane (line 136-147) — no change needed
- **D-09:** Focus stays on original pane after split — `splitPane()` does not change `activePaneId`, consistent with success criterion 1

### Edge Cases
- **D-10:** Splitting during heavy streaming output: WS messages are ordered, PTY resize is synchronous, no interleaving risk — but must verify no partial ANSI escape sequence corruption at resize boundary
- **D-11:** Max panes remains 4 (paneStore line 110-112, per Phase 4 research)
- **D-12:** `react-resizable-panels` `onLayout` should propagate final sizes back to paneStore `setSizes()` for persistence — verify this wiring exists or add it

### Claude's Discretion
- FitAddon debounce tuning (150ms may need adjustment based on testing)
- Whether to add a brief visual flash/indicator on successful split
- Test procedure design for the 3 success criteria
- Any integration test scaffolding

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — SPLIT-01, SPLIT-02, SPLIT-03 definitions
- `.planning/ROADMAP.md` — Phase 10 success criteria (3 specific assertions)

### Phase 4 Foundation (architecture decisions)
- `.planning/phases/04-differentiating-features/04-CONTEXT.md` — D-05 (1:1 WS→PTY), D-07 (recursive split tree), D-09 (IDisposable), D-12 (react-resizable-panels), D-15 (FitAddon + ResizeObserver)

### Frontend — split/pane system
- `src/store/paneStore.ts` — Zustand store: `splitInTree()`, `removeFromTree()`, `setSizes()`, 4-pane cap
- `src/components/PaneContainer.tsx` — `renderLayout()` recursive renderer, react-resizable-panels Group/Panel/Separator
- `src/components/TerminalPane.tsx` — Per-pane WS/PTY lifecycle, auto-spawn, focus gating, ResizeObserver integration

### Frontend — terminal hooks
- `src/hooks/useTerminal.ts` — xterm.js Terminal + FitAddon + ResizeObserver + 150ms debounce + onResize callback
- `src/hooks/useWebSocket.ts` — Per-pane WS connection with reconnect logic

### Sidecar
- `sidecar/src/ptySession.ts` — PTYSession with resize() and IDisposable
- `sidecar/src/server.ts` — WS→PTYSession routing, resize message handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paneStore.splitInTree()` — Already preserves original PaneNode identity on split
- `useTerminal` ResizeObserver — Already refits FitAddon on container size change with 150ms debounce
- `TerminalPane` auto-spawn useEffect — Already handles new pane shell initialization
- `react-resizable-panels` Group/Panel/Separator — Already renders split layout with drag handles

### Established Patterns
- Cross-hook stable refs (`writeRef`, `sendMessageRef`, `getDimensionsRef`) — prevent stale closures during rapid state changes like split
- IDisposable pattern for PTY listeners — prevents memory leaks when panes are created/destroyed
- `key={node.id}` on React elements — ensures reconciliation preserves existing components during layout tree mutations

### Integration Points
- `paneStore.setSizes()` ↔ react-resizable-panels `onLayout` — may need wiring to sync final panel sizes after split
- `useTerminal.onResize` → `useWebSocket.sendMessage({ type: 'resize' })` → sidecar `ptyProcess.resize()` — full resize chain already connected
- FitAddon.fit() → xterm.js Terminal.cols/rows → onResize callback — resize measurement chain

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all decisions derived from existing architecture analysis and Phase 4 context. This phase is verification-heavy: the architecture was designed for this in Phase 4, and the main work is proving it works under stress (mid-output split, stty correctness, scrollback integrity).

</specifics>

<deferred>
## Deferred Ideas

- **Session cloning/multiplexing** (tmux-style split sharing same PTY) — fundamentally different architecture, would require PTY multiplexer layer. Separate phase if ever desired.
- **Split animation** — cosmetic enhancement, not needed for preservation correctness.

</deferred>

---

*Phase: 10-split-pane-preservation*
*Context gathered: 2026-03-29*
