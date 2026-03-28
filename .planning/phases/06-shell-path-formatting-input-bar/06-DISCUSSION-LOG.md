# Phase 6: Shell Path Formatting & Input Bar - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-28
**Phase:** 06-shell-path-formatting-input-bar
**Mode:** assumptions (stress-tested)
**Areas analyzed:** Path quoting strategy, Filename format, Input bar sizing, Resize handle, Terminal refit

---

## Analysis Method

User requested comprehensive stress testing from multiple perspectives before any recommendations. Four parallel deep-dive agents analyzed:
1. Path lifecycle tracing (creation → injection → PTY write)
2. Input bar layout and resize infrastructure
3. Shell detection and communication mechanism
4. Edge cases and integration risks

All gray areas resolved to single defensible answers from codebase + requirements. No user discussion needed — phase is pure mechanical implementation.

## Assumptions Presented

### Path Quoting Strategy
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Frontend quoting at injection time | Confident | Both paste + drag-drop converge at ChatInputBar.tsx:89; user sees quoted path (Phase 4 D-01) |
| Pass currentShell as prop to ChatInputBar | Confident | TerminalPane.tsx:21 already tracks shell; one prop addition |
| Shell-switch edge case is cosmetic-only | Confident | Shell switch kills PTY; textarea persists but path is visible for manual fix |

### Filename Format
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Drop sessionId prefix for UUID-only | Confident | PATH-02 requires UUID chars only; cleanup is array-based, format-agnostic |

### Input Bar Sizing & Resize
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| 144px default height | Confident | INBAR-01 requirement is explicit |
| Per-pane resize (not global) | Confident | ChatInputBar is inside each TerminalPane; natural architecture |
| Simple drag div, not react-resizable-panels | Confident | Single vertical resize; library overkill |
| In-memory height only | Confident | Requirements silent on persistence |

### Terminal Refit
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| No changes to useTerminal.ts | Confident | ResizeObserver + 150ms debounce + dimension guards already handle it |

## Corrections Made

No corrections — all assumptions confirmed via stress testing. User approved proceeding without discussion.

## Edge Cases Documented

- `os.tmpdir()` can return paths with spaces on some Windows configs — quoting handles this
- PowerShell embedded single-quote escaping (`''`) needed for paths containing `'`
- Git Bash requires backslash-to-forward-slash conversion + drive letter mapping
- Min terminal height guard needed to prevent zero-height collapse during drag
- FitAddon already guards against `offsetHeight === 0` (useTerminal.ts:123)
