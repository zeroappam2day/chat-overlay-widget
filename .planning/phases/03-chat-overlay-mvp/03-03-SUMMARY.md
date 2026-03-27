---
phase: 03-chat-overlay-mvp
plan: "03"
subsystem: frontend
tags: [chat-input, pty-shadow-typing, focus-management, react]
dependency_graph:
  requires: [03-01]
  provides: [ChatInputBar, TerminalPane-input-wiring]
  affects: [src/components/ChatInputBar.tsx, src/components/TerminalPane.tsx]
tech_stack:
  added: []
  patterns:
    - "Fixed-bottom textarea with auto-expand (scrollHeight capped at 96px)"
    - "\\r carriage return for ConPTY command execution (not \\n)"
    - "CSS class selector (.chat-input-textarea) for cross-component focus targeting"
    - "searchOpen dependency in Escape handler effect to gate focus return"
key_files:
  created:
    - src/components/ChatInputBar.tsx
  modified:
    - src/components/TerminalPane.tsx
decisions:
  - "Used CSS class (.chat-input-textarea) on textarea for Escape-to-focus selector — avoids ref prop drilling from TerminalPane through ChatInputBar"
  - "Escape key handler added to the same effect as Ctrl+F, with searchOpen as dependency — ensures Escape does not steal focus when search overlay is active"
  - "autoFocus on ChatInputBar textarea gives input-first focus on mount (D-02)"
metrics:
  duration_seconds: 69
  completed_date: "2026-03-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 03 Plan 03: ChatInputBar Summary

**One-liner:** Fixed-bottom textarea with Enter-to-send (\\r to ConPTY), Shift+Enter newline, auto-expand to 4 lines, and Escape-to-focus dual-input model.

## What Was Built

### ChatInputBar component (`src/components/ChatInputBar.tsx`)

A fixed-height textarea at the bottom of the window that:
- Sends text as `value + '\r'` on Enter (carriage return required by ConPTY — not `\n`)
- Inserts newline on Shift+Enter without sending
- Auto-expands height up to 96px (approximately 4 lines) via `scrollHeight` measurement
- Preserves focus on the textarea after send (D-03: input-first focus model)
- Disables with opacity when `disabled` prop is true
- Uses `autoFocus` to capture focus on mount (D-02)
- Has CSS class `chat-input-textarea` for cross-component focus targeting via `document.querySelector`

### TerminalPane wiring (`src/components/TerminalPane.tsx`)

- Imported `ChatInputBar` and replaced the `{/* ChatInputBar will go here */}` placeholder
- Added `handleSendInput` callback that calls `sendMessage({ type: 'input', data: text })`
- Placed `<ChatInputBar onSend={handleSendInput} disabled={connectionState !== 'connected'} />` at the bottom of the flex-col layout
- Extended Ctrl+F effect to also handle Escape: when search is closed, Escape focuses `.chat-input-textarea`
- Added `searchOpen` to the keydown effect dependency array to correctly gate Escape behavior

## Decisions Made

1. **CSS class selector for focus:** Used `.chat-input-textarea` class on the textarea element so the Escape handler in TerminalPane can target it with `document.querySelector` — avoids prop drilling a ref from TerminalPane into ChatInputBar.

2. **Escape handler co-located with Ctrl+F:** Both handlers share one `document.addEventListener('keydown', ...)` effect with `searchOpen` as a dependency. This ensures Escape only returns focus to the input bar when the search overlay is not active.

3. **\\r not \\n:** `onSend(value + '\r')` — carriage return is what ConPTY interprets as "execute command". Using `\n` would send a bare newline which shells may interpret differently (or not at all).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — ChatInputBar is fully wired. The `disabled` state correctly reflects WebSocket connection status. No placeholder data or hardcoded values flow to the UI.

## Self-Check

Files created/modified:
- `src/components/ChatInputBar.tsx` — created
- `src/components/TerminalPane.tsx` — modified

Commits:
- `212ff8e` — feat(03-03): create ChatInputBar component
- `3bccf11` — feat(03-03): wire ChatInputBar into TerminalPane with focus management
