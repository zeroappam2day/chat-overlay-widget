# Phase 10: Split Pane Preservation - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-29
**Phase:** 10-split-pane-preservation
**Mode:** assumptions (stress-tested)
**Areas analyzed:** Session Preservation, xterm.js Refit, New Pane Behavior, Edge Cases

## Assumptions Presented

### Session Preservation on Split
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Original pane WS/PTY untouched by split | Confident | `paneStore.ts:29-48` — splitInTree keeps original PaneNode id |
| xterm.js Terminal stays bound to DOM | Confident | `TerminalPane.tsx` — container never unmounted, React key={node.id} |
| Scrollback buffer preserved | Confident | xterm.js Terminal memory, no clear on layout change |

### xterm.js Refit After Split
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| ResizeObserver + debounce handles refit | Likely | `useTerminal.ts` — 150ms debounce, but untested with react-resizable-panels animation |
| stty size updates via resize message chain | Confident | `TerminalPane.tsx:118-120` → `useWebSocket` → sidecar `ptyProcess.resize()` |
| Debounce timing sufficient for animation | Likely | 150ms may fire before panel animation settles — needs verification |

### New Pane Behavior
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New pane auto-spawns default shell | Confident | `TerminalPane.tsx:136-147` auto-spawn useEffect |
| Focus stays on original pane | Confident | `paneStore.splitPane()` does not change activePaneId |

### Edge Cases
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Mid-output split safe (ordered WS messages) | Likely | WebSocket message ordering guarantee, but ANSI escape interleaving untested |
| Max panes = 4 enforced | Confident | `paneStore.ts:110-112` |
| setSizes() wiring for persistence | Unclear | `PaneContainer.tsx` uses react-resizable-panels but no onLayout→setSizes visible |

## Stress Test

User requested adversarial stress test across 5 perspectives:

1. **Brownfield Optimist** — Architecture already handles all 3 success criteria by design
2. **Timing Skeptic** — Possible FitAddon.fit() mid-animation issue with debounce
3. **UX Critic** — Focus, animation, shell choice all answered by existing code
4. **Scope Creeper** — Session cloning/tmux-style deferred as separate capability
5. **Implementation Realist** — Phase is primarily verification + edge-case fixes

**Outcome:** All assumptions Confident or Likely. No user corrections needed. One Unclear item (setSizes wiring) auto-resolved as implementation detail for Claude's discretion.

## Corrections Made

No corrections — all assumptions confirmed via stress test.
