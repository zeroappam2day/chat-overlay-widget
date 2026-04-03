# Parallel-Code Feature Adoption Plan — Volume 2

> **Status:** ACTIVE
> **Created:** 2026-04-03
> **Continues from:** `docs/PARALLEL_FEATURES_PLAN.md` (Phases 0–11 DONE)
> **Source project:** `C:\Users\anujd\Documents\01_AI\219_parallel_code\parallel-code` (Electron + SolidJS)
> **Target project:** `C:\Users\anujd\Documents\01_AI\214_Chat_overlay_widget` (Tauri v1.8 + React 18 + node-pty sidecar)
> **Constraint:** NO Electron. NO changes to existing code. All features toggleable.

---

## Reusable Initializing Prompt

Paste this at the start of every new conversation:

```
I am continuing a multi-phase implementation plan (Volume 2). Read the plan document:

  C:\Users\anujd\Documents\01_AI\214_Chat_overlay_widget\docs\PARALLEL_FEATURES_PLAN_V2.md

This file contains:
- The FULL project context (architecture, file paths, protocols, types)
- 10 feature phases (12–21) with EXACT implementation specs
- A progress tracker showing what is DONE and what is NEXT
- Handover notes from the previous session

Also read the Volume 1 plan for architecture reference (DO NOT re-implement its phases):

  C:\Users\anujd\Documents\01_AI\214_Chat_overlay_widget\docs\PARALLEL_FEATURES_PLAN.md

Rules:
1. Read BOTH plan files FIRST. Find the next phase marked "PENDING" in the V2 Progress Tracker.
2. Do NOT modify any existing files listed under "Existing Files (DO NOT MODIFY)" in Volume 1.
3. Every new feature MUST be behind a feature flag in src/store/featureFlagStore.ts.
4. After completing a phase, update the Progress Tracker in THIS V2 plan file: set status to DONE, add completion date, and write handover notes.
5. Run tests if any exist. Do not break existing functionality.
6. This project uses Tauri v1.8 (NOT v2, NOT Electron), React 18, Zustand, xterm.js 5.5, node-pty 1.1, WebSocket (ws 8.18).
7. The sidecar is a Node.js process at sidecar/src/. The frontend is at src/. They communicate via WebSocket JSON messages defined in sidecar/src/protocol.ts.
8. Start work through a GSD command: /gsd:quick for the phase, or /gsd:execute-phase if phase is already planned.
9. After implementation, you MUST run the Phase Delivery Protocol (see Volume 1 plan for the full protocol): create feature branch, reset main, push, create PR, squash-merge, pull, clean up branch. Every phase ships as a single revertible squash commit on main via PR. No exceptions.
10. PR descriptions MUST follow the PR Body Template in Volume 1: non-technical user perspective first, file-level details in collapsed <details> section.
11. When adding a new feature flag: update featureFlagStore.ts (add to FeatureFlags interface, defaults, setFlag serialization), update FeatureFlagPanel.tsx (add to FLAG_LABELS), and update src/protocol.ts to mirror any sidecar protocol changes.
12. Volume 1 Phases 0-11 are DONE. Do NOT re-implement them. Their code exists and works.

Begin by reading both plan files now.
```

---

## Progress Tracker

| # | Phase | Status | Date | Handover Notes |
|---|-------|--------|------|----------------|
| 12 | Theme Presets | DONE | 2026-04-03 | Created themes.ts (4 presets, 17 CSS vars each), themeStore.ts (Zustand + localStorage), ThemeSelector.tsx (accent dot buttons), theme.css (fallback vars). Added themePresets flag to featureFlagStore. ThemeSelector renders in FeatureFlagPanel when flag ON. Also added themePresets to usePersistence.ts gatherState to fix TS error. |
| 13 | Ctrl+Wheel Zoom | DONE | 2026-04-03 | Created wheelZoom.ts (pure zoom math), useZoom.ts (React hook with wheel listener + localStorage + custom events), zoom.css (xterm isolation). Added ctrlWheelZoom flag to featureFlagStore. Integrated into PaneContainer (useZoom call + CSS import), useShortcuts (Ctrl+0/+/-), usePersistence (gatherState), FeatureFlagPanel (label). |
| 14 | Diff Search & Context Collapse | DONE | 2026-04-03 | Created diffSearch.ts (search utils + match positions), DiffSearchBar.tsx (32px bar with prev/next/close, Enter/Shift+Enter/Escape), CollapsibleContext.tsx (collapseContextRuns + CollapsedRow), EnhancedDiffPanel.tsx (portal panel with Ctrl+F toggle, search highlighting, context collapse). Added diffSearch flag to featureFlagStore. Added searchQuery/currentMatchIndex to diffStore. Swapped DiffPanel import in TerminalPane to EnhancedDiffPanel. When diffSearch OFF, falls through to original DiffPanel. |
| 15 | Syntax Highlighting in Diffs | DONE | 2026-04-03 | Created syntaxHighlighter.ts (lazy Shiki singleton, detectLanguage 45+ extensions, highlightLines with fallback), useSyntaxHighlight.ts (React hook with content→HTML map, per-file caching). Added diffSyntaxHighlight flag to featureFlagStore. Modified EnhancedDiffPanel: EnhancedDiffLineRow accepts highlightedHtml prop, search highlighting takes precedence, useSyntaxHighlight called per file in EnhancedFileDiffView. Shiki code-split by Vite into lazy chunks. |
| 16 | Ask About Code | PENDING | — | — |
| 17 | Completion Stats | PENDING | — | — |
| 18 | Focus Trap for Dialogs | PENDING | — | — |
| 19 | GitHub URL Detection | PENDING | — | — |
| 20 | Inline Editable Text | PENDING | — | — |
| 21 | Error Boundaries | PENDING | — | — |

---

## Dependency Graph

```
No phase depends on another except as noted below.
All phases depend on Phase 0 (feature flags) which is DONE.

Phase 14 (Diff Search) ← extends Phase 4 DiffPanel (DONE)
Phase 15 (Syntax Highlighting) ← extends Phase 4 DiffPanel (DONE), benefits from Phase 14
Phase 16 (Ask About Code) ← extends Phase 4 DiffPanel (DONE), sidecar protocol extension

All other phases are fully standalone.
```

**Recommended execution order:** 12 → 18 → 21 → 13 → 20 → 17 → 19 → 14 → 15 → 16

(Simplest/lowest-risk first, diff viewer extensions last because they layer on each other.)

---

## Architecture Reference (Zero-Context Supplement)

This section supplements the full architecture reference in Volume 1. Only NEW information relevant to V2 phases is included here.

### Key files from Volume 1 that V2 phases extend:

| File | Phase(s) created | What V2 phases extend |
|------|------------------|-----------------------|
| `src/store/featureFlagStore.ts` | Phase 0 | ALL V2 phases add flags here |
| `src/components/FeatureFlagPanel.tsx` | Phase 0 | ALL V2 phases add labels here |
| `src/components/DiffPanel.tsx` | Phase 4 | Phases 14, 15, 16 |
| `src/lib/diffParser.ts` | Phase 4 | Phases 14, 15 |
| `src/store/diffStore.ts` | Phase 4 | Phases 14, 16 |
| `src/lib/shortcuts.ts` | Phase 8 | Phase 13 |
| `src/hooks/useShortcuts.ts` | Phase 8 | Phase 13 |
| `sidecar/src/protocol.ts` | Phase 1 | Phase 16 |
| `src/protocol.ts` | Phase 1 | Phase 16 |
| `sidecar/src/server.ts` | Core | Phase 16 |

### Feature flag pattern (established in Phase 0):

```typescript
// 1. Add to FeatureFlags interface in featureFlagStore.ts:
export interface FeatureFlags {
  // ... existing flags ...
  newFlag: boolean;  // Phase N
}

// 2. Add default in `defaults` object:
const defaults: FeatureFlags = {
  // ... existing defaults ...
  newFlag: true,  // or false for safety-critical / visual-preference
};

// 3. Add to setFlag serialization (inside the JSON.stringify call):
localStorage.setItem(STORAGE_KEY, JSON.stringify({
  // ... existing keys ...
  newFlag: next.newFlag,
}));

// 4. Add label in FeatureFlagPanel.tsx FLAG_LABELS:
const FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  // ... existing labels ...
  newFlag: 'New Flag Label',
};
```

### Existing files that CAN be modified (additive only):

These files were created in Phases 0–11 and are the designated integration points. Each phase specifies EXACTLY what lines to add. Only additive changes (new imports, new flag entries, new switch cases) — no existing lines changed or removed.

```
src/store/featureFlagStore.ts      — add new flag to interface, defaults, serialization
src/components/FeatureFlagPanel.tsx — add new flag label
src/components/DiffPanel.tsx       — Phase 14/15/16 extend rendering (wrap components)
src/store/diffStore.ts             — Phase 14 adds searchQuery field
src/lib/shortcuts.ts               — Phase 13 may add helpers (or use existing API)
src/hooks/useShortcuts.ts          — Phase 13 adds zoom shortcut registrations
sidecar/src/protocol.ts            — Phase 16 adds ask-code messages
src/protocol.ts                    — Phase 16 mirrors sidecar protocol
sidecar/src/server.ts              — Phase 16 adds ask-code handler import + case
src/components/PaneContainer.tsx   — Phase 13 adds zoom wrapper, Phase 21 adds ErrorBoundary
```

---

## Phase 12: Theme Presets

**Goal:** Provide 4 color theme presets that restyle the entire app via CSS custom properties. Pure frontend, zero risk.

**Source reference:** `parallel-code/src/lib/look.ts` (65 lines)

**Feature flag:** `themePresets` — default: `true`

**Complexity:** S (small) — pure CSS + one store + one component

### New files to create:

#### `src/lib/themes.ts`

```typescript
/**
 * Theme preset system.
 * Adapted from parallel-code/src/lib/look.ts
 *
 * Each preset defines CSS custom properties applied to :root.
 * Tailwind classes are NOT changed. Themes override only custom properties
 * that are referenced by NEW inline styles in V2 components.
 *
 * Existing components use hardcoded Tailwind classes (bg-[#1e1e1e], etc.)
 * and are NOT affected. Themes apply to V2 components that use var(--co-*).
 * Over time, existing hardcoded colors can be migrated to CSS vars in future
 * phases, but this phase does NOT touch existing components.
 */

export type ThemeId = 'default' | 'classic' | 'midnight' | 'ember';

export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  vars: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    label: 'Graphite',
    description: 'Default dark theme',
    vars: {
      '--co-bg-primary': '#1e1e1e',
      '--co-bg-secondary': '#252525',
      '--co-bg-tertiary': '#2d2d2d',
      '--co-bg-hover': '#333333',
      '--co-border': '#404040',
      '--co-text-primary': '#d4d4d4',
      '--co-text-secondary': '#a0a0a0',
      '--co-text-muted': '#666666',
      '--co-accent': '#007acc',
      '--co-accent-hover': '#1a8ad4',
      '--co-success': '#4ec9b0',
      '--co-warning': '#dcdcaa',
      '--co-error': '#f44747',
      '--co-diff-add-bg': '#1e3a1e',
      '--co-diff-remove-bg': '#3a1e1e',
      '--co-diff-add-text': '#86efac',
      '--co-diff-remove-text': '#fca5a5',
    },
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'High-contrast dark',
    vars: {
      '--co-bg-primary': '#0d1117',
      '--co-bg-secondary': '#161b22',
      '--co-bg-tertiary': '#21262d',
      '--co-bg-hover': '#30363d',
      '--co-border': '#30363d',
      '--co-text-primary': '#e6edf3',
      '--co-text-secondary': '#8b949e',
      '--co-text-muted': '#484f58',
      '--co-accent': '#58a6ff',
      '--co-accent-hover': '#79c0ff',
      '--co-success': '#3fb950',
      '--co-warning': '#d29922',
      '--co-error': '#f85149',
      '--co-diff-add-bg': '#0d2818',
      '--co-diff-remove-bg': '#3d1216',
      '--co-diff-add-text': '#7ee787',
      '--co-diff-remove-text': '#ffa198',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep blue tones',
    vars: {
      '--co-bg-primary': '#0f0f23',
      '--co-bg-secondary': '#151530',
      '--co-bg-tertiary': '#1a1a3e',
      '--co-bg-hover': '#25254d',
      '--co-border': '#2a2a5c',
      '--co-text-primary': '#ccccff',
      '--co-text-secondary': '#9999cc',
      '--co-text-muted': '#555577',
      '--co-accent': '#9999ff',
      '--co-accent-hover': '#bbbbff',
      '--co-success': '#99ff99',
      '--co-warning': '#ffcc66',
      '--co-error': '#ff6666',
      '--co-diff-add-bg': '#0f2a0f',
      '--co-diff-remove-bg': '#2a0f0f',
      '--co-diff-add-text': '#aaffaa',
      '--co-diff-remove-text': '#ffaaaa',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Warm amber tones',
    vars: {
      '--co-bg-primary': '#1a1410',
      '--co-bg-secondary': '#221c16',
      '--co-bg-tertiary': '#2a221a',
      '--co-bg-hover': '#352a20',
      '--co-border': '#4a3a2a',
      '--co-text-primary': '#e8d5b5',
      '--co-text-secondary': '#b89a70',
      '--co-text-muted': '#6a5540',
      '--co-accent': '#e89050',
      '--co-accent-hover': '#f0a060',
      '--co-success': '#80c070',
      '--co-warning': '#e8c040',
      '--co-error': '#e06050',
      '--co-diff-add-bg': '#1a2a10',
      '--co-diff-remove-bg': '#2a1a10',
      '--co-diff-add-text': '#a0d890',
      '--co-diff-remove-text': '#e8a090',
    },
  },
];

/** Apply a theme by setting CSS custom properties on :root */
export function applyTheme(themeId: ThemeId): void {
  const preset = THEME_PRESETS.find(t => t.id === themeId);
  if (!preset) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(preset.vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute('data-theme', themeId);
}

/** Remove all theme CSS custom properties from :root */
export function clearTheme(): void {
  const root = document.documentElement;
  // Remove all --co-* properties
  for (const preset of THEME_PRESETS) {
    for (const key of Object.keys(preset.vars)) {
      root.style.removeProperty(key);
    }
  }
  root.removeAttribute('data-theme');
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_PRESETS.some(t => t.id === value);
}
```

#### `src/store/themeStore.ts`

```typescript
import { create } from 'zustand';
import { type ThemeId, applyTheme, clearTheme } from '../lib/themes';

const STORAGE_KEY = 'chat-overlay-theme';

function loadTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && ['default', 'classic', 'midnight', 'ember'].includes(raw)
      ? (raw as ThemeId)
      : 'default';
  } catch {
    return 'default';
  }
}

interface ThemeStore {
  activeTheme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  activeTheme: loadTheme(),
  setTheme: (id) => {
    localStorage.setItem(STORAGE_KEY, id);
    applyTheme(id);
    set({ activeTheme: id });
  },
}));
```

#### `src/components/ThemeSelector.tsx`

```typescript
/**
 * Theme selector dropdown rendered inside FeatureFlagPanel.
 * Shows 4 theme buttons with color preview dots.
 * Reads/writes via useThemeStore.
 *
 * UI: horizontal row of 4 labeled buttons, each with a small
 * colored circle showing the theme's accent color.
 * Active theme has a border highlight.
 *
 * Gated by themePresets feature flag.
 */
```

### Integration points:

1. **`src/store/featureFlagStore.ts`:** Add `themePresets: boolean` to `FeatureFlags` interface, add `themePresets: true` to defaults, add to serialization.

2. **`src/components/FeatureFlagPanel.tsx`:** Add `themePresets: 'Theme Presets'` to FLAG_LABELS. Import and render `<ThemeSelector />` below the flag toggle list (only when `themePresets` is true).

3. **`src/styles/theme.css`** (new file): Base CSS that sets fallback values for all `--co-*` vars matching the 'default' theme. Imported in `main.tsx` or `index.css`.

### Theme initialization:

On app load, `useThemeStore` loads saved theme from localStorage. The `ThemeSelector` component calls `applyTheme()` on mount if a non-default theme is saved. When `themePresets` flag is OFF, `clearTheme()` is called and all `--co-*` vars are removed (components fall back to their hardcoded Tailwind colors).

### Acceptance criteria:

- [ ] 4 theme presets (Graphite, Classic, Midnight, Ember) with distinct color palettes
- [ ] CSS custom properties applied to `:root` — no Tailwind config changes
- [ ] Theme persists to localStorage under key `chat-overlay-theme`
- [ ] Theme selector visible in settings panel when `themePresets` flag is ON
- [ ] When flag is OFF, theme is cleared, app uses default hardcoded colors
- [ ] Existing components are NOT modified — themes affect only `var(--co-*)` consumers
- [ ] `data-theme` attribute on `<html>` for CSS selector targeting

---

## Phase 13: Ctrl+Wheel Zoom

**Goal:** Ctrl+Wheel to zoom the app font scale. Applies to all UI except xterm.js terminal (which manages its own font size via FitAddon).

**Source reference:** `parallel-code/src/lib/wheelZoom.ts` (70 lines)

**Feature flag:** `ctrlWheelZoom` — default: `true`

**Complexity:** S (small) — one utility + one hook + CSS variable

### New files to create:

#### `src/lib/wheelZoom.ts`

```typescript
/**
 * Ctrl+Wheel zoom handler.
 * Adapted from parallel-code/src/lib/wheelZoom.ts
 *
 * Constants:
 *   ZOOM_STEP_PX = 100    — wheel delta pixels per zoom step
 *   MIN_SCALE = 0.7       — minimum zoom (70%)
 *   MAX_SCALE = 1.5       — maximum zoom (150%)
 *   STEP_SIZE = 0.05      — 5% per step
 *
 * Accumulates wheel delta (handling line/page deltaMode conversion).
 * Each 100px of accumulated delta = one zoom step (±5%).
 * Remainder carries forward for smooth feel.
 *
 * Direction: positive deltaY (scroll down) = zoom out, negative = zoom in.
 *
 * Does NOT zoom xterm.js terminals. The CSS variable --app-font-scale
 * is applied via `transform: scale(var(--app-font-scale))` on the
 * app container, or via `font-size: calc(1rem * var(--app-font-scale))`
 * on the root. The xterm.js Terminal manages its own font size.
 */

export interface ZoomState {
  scale: number;
  remainder: number;
}

export function createZoomState(initialScale?: number): ZoomState {
  return { scale: initialScale ?? 1.0, remainder: 0 };
}

/**
 * Process a wheel event and return updated zoom state.
 * Returns null if the event should not be handled (no Ctrl key, etc.).
 */
export function processZoomWheel(
  e: WheelEvent,
  state: ZoomState,
): ZoomState | null {
  if (!e.ctrlKey || e.shiftKey || e.altKey) return null;

  const ZOOM_STEP_PX = 100;
  const MIN_SCALE = 0.7;
  const MAX_SCALE = 1.5;
  const STEP_SIZE = 0.05;

  // Convert deltaMode: 0=pixel, 1=line (40px), 2=page (800px)
  const multiplier = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
  const deltaPx = e.deltaY * multiplier;

  const accumulated = state.remainder + deltaPx;
  const steps = Math.trunc(accumulated / ZOOM_STEP_PX);

  if (steps === 0) {
    return { scale: state.scale, remainder: accumulated };
  }

  const remainder = accumulated - steps * ZOOM_STEP_PX;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale - steps * STEP_SIZE));

  return { scale: newScale, remainder };
}
```

#### `src/hooks/useZoom.ts`

```typescript
/**
 * React hook that attaches a Ctrl+Wheel zoom listener to the document.
 * Reads ctrlWheelZoom flag — if OFF, no listener attached.
 *
 * Applies zoom by setting CSS custom property --app-font-scale on :root.
 * Persists scale to localStorage under 'chat-overlay-zoom-scale'.
 *
 * Usage: call useZoom() once in PaneContainer.
 *
 * Zoom applies to:
 *   - All UI text (via root font-size scaling)
 *   - Panel headers, buttons, labels
 *
 * Zoom does NOT apply to:
 *   - xterm.js Terminal (has its own font size management via FitAddon)
 *   - Elements with class .zoom-exempt
 *
 * Implementation:
 *   useEffect to attach 'wheel' listener with { passive: false }
 *   (must call e.preventDefault() to suppress browser zoom).
 *   Returns cleanup that removes listener.
 *
 * CSS approach:
 *   document.documentElement.style.fontSize = `${scale * 100}%`;
 *   xterm containers get font-size reset: .xterm { font-size: initial !important; }
 */

import { useState, useEffect, useRef } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { createZoomState, processZoomWheel, type ZoomState } from '../lib/wheelZoom';

const STORAGE_KEY = 'chat-overlay-zoom-scale';

export function useZoom(): void {
  /* ... implementation as described above ... */
}
```

#### `src/styles/zoom.css`

```css
/* Prevent zoom from affecting xterm.js terminal */
.xterm {
  font-size: initial !important;
}

/* Prevent zoom from affecting elements that should stay fixed */
.zoom-exempt {
  font-size: initial !important;
}
```

### Integration points:

1. **`src/store/featureFlagStore.ts`:** Add `ctrlWheelZoom: boolean` to interface, `ctrlWheelZoom: true` to defaults.

2. **`src/components/FeatureFlagPanel.tsx`:** Add `ctrlWheelZoom: 'Ctrl+Wheel Zoom'` to FLAG_LABELS.

3. **`src/components/PaneContainer.tsx`:** Import and call `useZoom()`. Import `../styles/zoom.css`.

### Keyboard shortcut integration:

Add to `useShortcuts.ts`:
- `Ctrl+0` → reset zoom to 100% (calls `document.documentElement.style.fontSize = '100%'`)
- `Ctrl+=` → zoom in one step
- `Ctrl+-` → zoom out one step

### Acceptance criteria:

- [ ] Ctrl+Wheel zooms the app UI from 70% to 150% in 5% steps
- [ ] Zoom persists to localStorage under `chat-overlay-zoom-scale`
- [ ] xterm.js terminal font size is NOT affected by zoom (uses FitAddon)
- [ ] `Ctrl+0` resets zoom to 100%
- [ ] `Ctrl+=` and `Ctrl+-` zoom in/out
- [ ] When `ctrlWheelZoom` flag is OFF, no wheel listener, zoom reset to 100%
- [ ] Browser native zoom (Ctrl+Wheel in webview) is suppressed when feature is ON

---

## Phase 14: Diff Search & Context Collapse

**Goal:** Add search highlighting and auto-collapsible context sections to the existing DiffPanel.

**Source reference:** `parallel-code/src/components/ScrollingDiffView.tsx` (search + collapse logic)

**Feature flag:** `diffSearch` — default: `true`

**Complexity:** M (medium) — extends existing DiffPanel with new sub-components

### New files to create:

#### `src/lib/diffSearch.ts`

```typescript
/**
 * Diff search highlighting utilities.
 * Adapted from parallel-code ScrollingDiffView searchQuery logic.
 *
 * Constants:
 *   SEARCH_HIGHLIGHT_BG = 'rgba(255, 200, 50, 0.35)'
 *   CURRENT_MATCH_BG    = 'rgba(100, 160, 255, 0.35)'
 *
 * Functions:
 *
 * highlightSearchMatches(text: string, query: string): SearchMatch[]
 *   - Case-insensitive search for all occurrences of query in text
 *   - Returns array of { start, end } indices
 *
 * renderHighlightedLine(content: string, query: string, currentMatchIndex?: number): React.ReactNode
 *   - Returns content with <mark> tags around matches
 *   - Current match gets CURRENT_MATCH_BG, others get SEARCH_HIGHLIGHT_BG
 *
 * countMatchesInDiff(diffs: FileDiff[], query: string): number
 *   - Total match count across all files/hunks/lines
 *
 * Types:
 *   SearchMatch = { start: number; end: number }
 */
```

#### `src/components/DiffSearchBar.tsx`

```typescript
/**
 * Search input bar for the DiffPanel.
 * Rendered at the top of DiffPanel, below the header.
 *
 * Props:
 *   query: string
 *   onQueryChange: (query: string) => void
 *   matchCount: number
 *   currentMatch: number
 *   onNext: () => void
 *   onPrev: () => void
 *   onClose: () => void
 *
 * UI: Input field + match count + up/down arrows + close button.
 * Height: 32px. Keyboard: Enter = next, Shift+Enter = prev, Escape = close.
 *
 * Toggle: Ctrl+F when DiffPanel is focused (or visible).
 */
```

#### `src/components/CollapsibleContext.tsx`

```typescript
/**
 * Renders a collapsible "... N lines hidden ..." row in diff view.
 * Adapted from parallel-code MIN_COLLAPSE_LINES logic.
 *
 * Props:
 *   lineCount: number — number of context lines to collapse
 *   onExpand: () => void — callback to show the hidden lines
 *
 * Logic:
 *   - Context runs of > MIN_COLLAPSE_LINES (5) consecutive context lines
 *     within a hunk are collapsed into a single clickable row.
 *   - First 2 and last 2 context lines are always shown.
 *   - Click expands the collapsed section.
 *
 * MIN_COLLAPSE_LINES = 5
 */
```

### Integration with existing DiffPanel:

Create `src/components/EnhancedDiffPanel.tsx` that wraps the existing `DiffPanel` rendering logic:

```typescript
/**
 * Enhanced DiffPanel with search bar and context collapsing.
 * Imports DiffPanel's sub-components (FileDiffView, HunkView, DiffLineRow)
 * and adds search highlighting + collapsible context sections.
 *
 * When diffSearch flag is ON: renders EnhancedDiffPanel.
 * When diffSearch flag is OFF: renders original DiffPanel (no changes).
 *
 * The DiffPanel.tsx file is NOT modified. EnhancedDiffPanel re-implements
 * the rendering with additional features, using the same diffStore data.
 */
```

### Store changes:

Add to `src/store/diffStore.ts` (additive only):

```typescript
// Add these fields to DiffStore interface:
searchQuery: string;
currentMatchIndex: number;
setSearchQuery: (query: string) => void;
setCurrentMatchIndex: (index: number) => void;

// Add to create() defaults:
searchQuery: '',
currentMatchIndex: 0,
setSearchQuery: (query) => set({ searchQuery: query, currentMatchIndex: 0 }),
setCurrentMatchIndex: (index) => set({ currentMatchIndex: index }),
```

### Feature flag integration:

1. **`src/store/featureFlagStore.ts`:** Add `diffSearch: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `diffSearch: 'Diff Search'`.

### Acceptance criteria:

- [ ] Search bar in DiffPanel with match count, next/prev navigation
- [ ] Case-insensitive search highlights across all files
- [ ] Current match distinguished from other matches (different background color)
- [ ] Context lines >5 consecutive are auto-collapsed with "N lines hidden" row
- [ ] Click to expand collapsed context
- [ ] First 2 and last 2 context lines always visible
- [ ] Ctrl+F in DiffPanel opens search bar (does NOT conflict with terminal Ctrl+F)
- [ ] When `diffSearch` flag is OFF, original DiffPanel renders unchanged

---

## Phase 15: Syntax Highlighting in Diffs

**Goal:** Syntax-highlighted code in diff view using Shiki.

**Source reference:** `parallel-code/src/lib/shiki-highlighter.ts` (122 lines)

**Feature flag:** `diffSyntaxHighlight` — default: `true`

**Complexity:** M (medium) — npm dependency + lazy loading + DiffPanel integration

### New npm dependency:

```bash
npm install shiki
```

Shiki is a zero-dependency syntax highlighter that uses TextMate grammars. It runs in the browser, no server required. Tree-shaking keeps bundle impact minimal when lazy-loaded.

### New files to create:

#### `src/lib/syntaxHighlighter.ts`

```typescript
/**
 * Lazy-loaded Shiki syntax highlighter.
 * Adapted from parallel-code/src/lib/shiki-highlighter.ts
 *
 * Singleton pattern: getHighlighter() returns a cached Shiki instance.
 * First call imports shiki dynamically (code-split).
 *
 * Functions:
 *
 * detectLanguage(filePath: string): string
 *   Maps file extension to Shiki language ID.
 *   Extensions map (30+ entries):
 *     .ts/.tsx → 'typescript'
 *     .js/.jsx → 'javascript'
 *     .py → 'python'
 *     .rs → 'rust'
 *     .go → 'go'
 *     .java → 'java'
 *     .c/.h → 'c'
 *     .cpp/.cxx/.hpp → 'cpp'
 *     .cs → 'csharp'
 *     .rb → 'ruby'
 *     .php → 'php'
 *     .swift → 'swift'
 *     .kt → 'kotlin'
 *     .scala → 'scala'
 *     .r → 'r'
 *     .sql → 'sql'
 *     .sh/.bash/.zsh → 'bash'
 *     .ps1 → 'powershell'
 *     .yml/.yaml → 'yaml'
 *     .json → 'json'
 *     .toml → 'toml'
 *     .xml → 'xml'
 *     .html → 'html'
 *     .css → 'css'
 *     .scss → 'scss'
 *     .less → 'less'
 *     .md → 'markdown'
 *     .graphql → 'graphql'
 *     .dockerfile → 'dockerfile'
 *     .makefile → 'makefile'
 *   Basename overrides: Dockerfile → 'dockerfile', Makefile → 'makefile'
 *   Fallback: 'plaintext'
 *
 * highlightLines(code: string, lang: string): Promise<string[]>
 *   Returns array of HTML strings, one per line.
 *   Uses 'github-dark' theme.
 *   HTML entities escaped: & < > "
 *   Falls back to plaintext if language grammar fails to load.
 *
 * getHighlighter(): Promise<HighlighterCore>
 *   Lazy singleton. Dynamic import('shiki') on first call.
 *   Caches instance for all subsequent calls.
 */
```

### Integration with DiffPanel:

Modify `DiffLineRow` rendering (in `EnhancedDiffPanel.tsx` from Phase 14, or create a new wrapper if Phase 14 hasn't been done yet):

```typescript
/**
 * SyntaxDiffLineRow: Enhanced DiffLineRow that renders highlighted HTML.
 *
 * On first render of a file's diff, calls highlightLines() for the full
 * file content (reconstructed from hunk lines). Caches result by file path.
 *
 * When syntax highlighting is loading: renders plain text (graceful fallback).
 * When highlight fails: renders plain text (no error shown to user).
 *
 * Uses dangerouslySetInnerHTML for Shiki HTML output.
 * Diff line type (add/remove/context) background colors are preserved
 * as wrapper div backgrounds — Shiki colors apply to text spans inside.
 */
```

### Feature flag integration:

1. **`src/store/featureFlagStore.ts`:** Add `diffSyntaxHighlight: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `diffSyntaxHighlight: 'Diff Syntax Highlighting'`.

### Performance considerations:

- Shiki loaded lazily via dynamic `import('shiki')` — not in initial bundle
- Highlighter instance created once, reused for all files
- Results cached per file path — re-highlighting only on new diff data
- If highlight takes >500ms, show plain text immediately and replace when ready

### Acceptance criteria:

- [ ] Code in diff lines is syntax-highlighted with language-appropriate colors
- [ ] Language detected from file extension (30+ languages supported)
- [ ] Shiki loaded lazily — no bundle size impact until DiffPanel opens
- [ ] Graceful fallback to plain text if highlighting fails
- [ ] Diff add/remove background colors preserved (highlight colors apply to text only)
- [ ] When `diffSyntaxHighlight` flag is OFF, plain text rendering (no Shiki loaded)
- [ ] No flash of unstyled content — plain text shown immediately, highlighted text replaces it

---

## Phase 16: Ask About Code

**Goal:** Select code in the diff viewer and ask Claude a question about it. Spawns `claude` CLI on the sidecar, streams response back.

**Source reference:** `parallel-code/electron/ipc/ask-code.ts` (137 lines), `parallel-code/src/components/AskCodeCard.tsx`

**Feature flag:** `askAboutCode` — default: `true`

**Complexity:** L (large) — sidecar process spawning, streaming protocol, frontend UI

### New files to create:

#### `sidecar/src/askCodeHandler.ts`

```typescript
/**
 * Ask About Code backend handler.
 * Adapted from parallel-code/electron/ipc/ask-code.ts
 *
 * Spawns `claude -p <prompt> --model sonnet --tools '' --no-input` as a child process.
 * Streams stdout chunks back to frontend via WebSocket.
 *
 * Constants:
 *   MAX_PROMPT_LENGTH = 50_000     — truncate prompt if longer
 *   MAX_CONCURRENT = 5             — reject if more than 5 active requests
 *   TIMEOUT_MS = 120_000           — kill process after 2 minutes
 *   MAX_RESPONSE_CHARS = 100_000   — truncate response if longer
 *
 * Environment filtering:
 *   Clears: CLAUDECODE, CLAUDE_CODE_SESSION, CLAUDE_CODE_ENTRYPOINT
 *   (prevents child claude from inheriting parent session)
 *
 * Process management:
 *   - Map<requestId, ChildProcess> tracks active requests
 *   - Map<requestId, NodeJS.Timeout> tracks timeout timers
 *   - cancelAskCode(requestId) kills process with SIGTERM
 *   - On process exit: clear maps, send done/error message
 *
 * Usage:
 *   askAboutCode(ws, requestId, prompt, cwd) → starts streaming
 *   cancelAskCode(requestId) → kills process
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { WebSocket } from 'ws';

const activeRequests = new Map<string, ChildProcess>();
const timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function askAboutCode(
  ws: WebSocket,
  requestId: string,
  prompt: string,
  cwd: string,
): void {
  if (activeRequests.size >= 5) {
    ws.send(JSON.stringify({
      type: 'ask-code-response',
      requestId,
      messageType: 'error',
      text: 'Too many concurrent requests (max 5)',
    }));
    return;
  }

  const truncatedPrompt = prompt.slice(0, 50_000);

  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_SESSION;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const child = spawn('claude', ['-p', truncatedPrompt, '--model', 'sonnet', '--no-input'], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  activeRequests.set(requestId, child);

  let totalChars = 0;

  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    ws.send(JSON.stringify({
      type: 'ask-code-response',
      requestId,
      messageType: 'error',
      text: 'Request timed out (2 minutes)',
    }));
  }, 120_000);
  timeoutTimers.set(requestId, timer);

  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    totalChars += text.length;
    if (totalChars > 100_000) {
      child.kill('SIGTERM');
      ws.send(JSON.stringify({
        type: 'ask-code-response',
        requestId,
        messageType: 'error',
        text: 'Response too large (>100K chars). Truncated.',
      }));
      return;
    }
    ws.send(JSON.stringify({
      type: 'ask-code-response',
      requestId,
      messageType: 'chunk',
      text,
    }));
  });

  child.stderr?.on('data', (data: Buffer) => {
    // Log but don't send — stderr is noisy with progress bars
  });

  child.on('close', (exitCode) => {
    clearTimeout(timer);
    timeoutTimers.delete(requestId);
    activeRequests.delete(requestId);
    ws.send(JSON.stringify({
      type: 'ask-code-response',
      requestId,
      messageType: 'done',
      exitCode: exitCode ?? 0,
    }));
  });

  child.on('error', (err) => {
    clearTimeout(timer);
    timeoutTimers.delete(requestId);
    activeRequests.delete(requestId);
    ws.send(JSON.stringify({
      type: 'ask-code-response',
      requestId,
      messageType: 'error',
      text: `Failed to spawn claude: ${err.message}`,
    }));
  });
}

export function cancelAskCode(requestId: string): void {
  const child = activeRequests.get(requestId);
  if (child) {
    child.kill('SIGTERM');
    clearTimeout(timeoutTimers.get(requestId));
    timeoutTimers.delete(requestId);
    activeRequests.delete(requestId);
  }
}
```

#### `src/components/AskCodeCard.tsx`

```typescript
/**
 * Inline card for asking questions about code in the diff viewer.
 * Adapted from parallel-code/src/components/AskCodeCard.tsx
 *
 * Props:
 *   requestId: string       — unique ID for this request
 *   filePath: string        — file being asked about
 *   startLine: number       — first line of selection
 *   endLine: number         — last line of selection
 *   selectedText: string    — the selected code
 *   onDismiss: () => void   — close the card
 *   sendMessage: (msg: object) => void — WebSocket send function
 *
 * UI States:
 *   1. Input: textarea for question + Submit button + Cancel button
 *   2. Loading: spinner + streaming response text + Cancel button
 *   3. Complete: full response text + Close button
 *   4. Error: error message + Retry button + Close button
 *
 * Prompt construction:
 *   `In file ${filePath}, lines ${startLine}-${endLine}:\n\n\`\`\`${lang}\n${selectedText}\n\`\`\`\n\n${question}`
 *
 * Language detection: reuse detectLanguage() from syntaxHighlighter.ts
 * (or inline the extension→lang map if Phase 15 hasn't been done).
 *
 * WebSocket messages:
 *   Send: { type: 'ask-code', requestId, prompt, cwd }
 *   Send: { type: 'cancel-ask-code', requestId }
 *   Receive: { type: 'ask-code-response', requestId, messageType, text?, exitCode? }
 *
 * Rendered inline in DiffPanel below the selected lines.
 * Max response display: 100K chars with truncation warning.
 */
```

#### `src/lib/diffSelection.ts`

```typescript
/**
 * Extract structured selection from diff viewer.
 * Adapted from parallel-code/src/lib/diff-selection.ts
 *
 * getDiffSelection(): DiffSelection | null
 *   Reads the current window selection.
 *   Walks DOM nodes to find data attributes:
 *     - data-new-line: line number
 *     - data-line-type: 'add' | 'remove' | 'context'
 *     - data-file-path: file path
 *   Returns null if:
 *     - No selection
 *     - Selection spans multiple files
 *     - Selection includes 'remove' lines (can't ask about deleted code)
 *
 * Types:
 *   DiffSelection = {
 *     filePath: string;
 *     startLine: number;
 *     endLine: number;
 *     selectedText: string;
 *   }
 */
```

### New protocol messages:

Add to `sidecar/src/protocol.ts` and `src/protocol.ts`:

```typescript
// Client -> Server
| { type: 'ask-code'; requestId: string; prompt: string; cwd?: string }
| { type: 'cancel-ask-code'; requestId: string }

// Server -> Client
| { type: 'ask-code-response'; requestId: string; messageType: 'chunk' | 'error' | 'done'; text?: string; exitCode?: number }
```

### Sidecar integration:

Add to `sidecar/src/server.ts` (additive only):

```typescript
import { askAboutCode, cancelAskCode } from './askCodeHandler.js';

// In the WebSocket message switch:
case 'ask-code':
  askAboutCode(ws, msg.requestId, msg.prompt, msg.cwd ?? process.cwd());
  break;
case 'cancel-ask-code':
  cancelAskCode(msg.requestId);
  break;
```

### Feature flag integration:

1. **`src/store/featureFlagStore.ts`:** Add `askAboutCode: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `askAboutCode: 'Ask About Code'`.

### Acceptance criteria:

- [ ] Select code lines in DiffPanel → right-click or button → "Ask about this code"
- [ ] Textarea appears inline for entering question
- [ ] Response streams in real-time from `claude` CLI
- [ ] Cancel button kills the background process
- [ ] 2-minute timeout auto-kills
- [ ] Max 5 concurrent requests (rejected with error message)
- [ ] Error states handled gracefully (claude not installed, timeout, too large)
- [ ] When `askAboutCode` flag is OFF, selection UI hidden, no processes spawned
- [ ] Environment variables cleaned to prevent session inheritance
- [ ] Works with or without Phase 15 (syntax highlighting)

---

## Phase 17: Completion Stats

**Goal:** Track completed PTY sessions and display a simple daily counter in the status area.

**Source reference:** `parallel-code/src/store/completion.ts` (42 lines)

**Feature flag:** `completionStats` — default: `true`

**Complexity:** S (small) — one store + one small component

### New files to create:

#### `src/store/completionStore.ts`

```typescript
/**
 * Completion statistics store.
 * Adapted from parallel-code/src/store/completion.ts
 *
 * Tracks:
 *   - completedSessionCount: number (total PTY sessions that exited with code 0)
 *   - completedSessionDate: string (ISO date string, e.g. '2026-04-03')
 *   - todayCount: number (sessions completed today)
 *
 * Functions:
 *   recordSessionCompleted(): void
 *     Increments count. If date differs from today, resets todayCount to 1.
 *
 *   getTodayCount(): number
 *     Returns todayCount if date matches today, else 0.
 *
 * Persists to localStorage under 'chat-overlay-completion-stats'.
 *
 * Integration: called from TerminalPane when 'pty-exit' message
 * has exitCode === 0 AND completionStats flag is ON.
 */

import { create } from 'zustand';

const STORAGE_KEY = 'chat-overlay-completion-stats';

interface CompletionStats {
  totalCompleted: number;
  todayDate: string;   // 'YYYY-MM-DD'
  todayCount: number;
}

function loadStats(): CompletionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { totalCompleted: 0, todayDate: '', todayCount: 0 };
  } catch {
    return { totalCompleted: 0, todayDate: '', todayCount: 0 };
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CompletionStore extends CompletionStats {
  recordCompleted: () => void;
  getTodayCount: () => number;
}

export const useCompletionStore = create<CompletionStore>((set, get) => {
  const initial = loadStats();
  return {
    ...initial,

    recordCompleted: () =>
      set((state) => {
        const today = todayStr();
        const isToday = state.todayDate === today;
        const next = {
          totalCompleted: state.totalCompleted + 1,
          todayDate: today,
          todayCount: isToday ? state.todayCount + 1 : 1,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      }),

    getTodayCount: () => {
      const state = get();
      return state.todayDate === todayStr() ? state.todayCount : 0;
    },
  };
});
```

#### `src/components/CompletionBadge.tsx`

```typescript
/**
 * Small badge showing today's completed session count.
 * Rendered in AppHeader or TerminalHeader area.
 *
 * UI: Green check icon + "N today" text. Only visible when count > 0.
 * Tooltip shows total all-time count.
 *
 * Size: fits in a 20px-height badge.
 * Hidden when completionStats flag is OFF.
 */
```

### Integration points:

1. **`src/store/featureFlagStore.ts`:** Add `completionStats: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `completionStats: 'Completion Stats'`.
3. **`src/components/TerminalPane.tsx`:** In the `pty-exit` case handler, add:
   ```typescript
   if (useFeatureFlagStore.getState().completionStats && msg.exitCode === 0) {
     useCompletionStore.getState().recordCompleted();
   }
   ```
4. **`src/components/FeatureFlagPanel.tsx`:** Render `<CompletionBadge />` somewhere visible (e.g., below the flag list or in the header).

### Acceptance criteria:

- [ ] Counter increments when a PTY session exits with code 0
- [ ] Daily count resets at midnight (date comparison)
- [ ] Badge shows "N today" with green check icon
- [ ] Total count visible in tooltip
- [ ] Persists to localStorage
- [ ] When `completionStats` flag is OFF, no recording, badge hidden

---

## Phase 18: Focus Trap for Dialogs

**Goal:** Trap keyboard focus within modal panels (FeatureFlagPanel, DiffPanel, PlanPanel, PromptHistoryPanel) when open, preventing focus from escaping to the terminal behind them.

**Source reference:** `parallel-code/src/lib/focus-trap.ts` (34 lines)

**Feature flag:** `focusTrap` — default: `true`

**Complexity:** S (small) — one utility hook

### New files to create:

#### `src/hooks/useFocusTrap.ts`

```typescript
/**
 * Focus trap hook for modal panels.
 * Adapted from parallel-code/src/lib/focus-trap.ts
 *
 * Usage:
 *   const containerRef = useFocusTrap(isOpen);
 *
 * When isOpen is true:
 *   - Tab cycles through focusable elements within the container
 *   - Shift+Tab cycles backwards
 *   - Focus wraps from last to first (and first to last)
 *   - Focus is moved to the first focusable element on open
 *
 * Focusable selector (same as parallel-code):
 *   'button:not([disabled]):not([tabindex="-1"]),
 *    [href]:not([tabindex="-1"]),
 *    input:not([disabled]):not([tabindex="-1"]),
 *    select:not([disabled]):not([tabindex="-1"]),
 *    textarea:not([disabled]):not([tabindex="-1"]),
 *    [tabindex]:not([tabindex="-1"])'
 *
 * When isOpen is false or focusTrap flag is OFF: no trapping.
 *
 * Implementation:
 *   useEffect with keydown listener for Tab key.
 *   Queries container for focusable elements.
 *   Computes first/last, intercepts Tab to wrap.
 *   Restores previous activeElement on close.
 */

import { useRef, useEffect } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  '[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(isOpen: boolean): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const enabled = useFeatureFlagStore((s) => s.focusTrap);

  useEffect(() => {
    if (!isOpen || !enabled) return;

    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusables = container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      // Restore previous focus
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, enabled]);

  return containerRef;
}
```

### Integration points:

1. **`src/store/featureFlagStore.ts`:** Add `focusTrap: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `focusTrap: 'Focus Trap'`. Use `useFocusTrap(open)` on the dropdown container.
3. **Other panels (future):** DiffPanel, PlanPanel, PromptHistoryPanel can adopt `useFocusTrap` by passing their `ref` and open state. These are optional follow-up additions, NOT required for this phase.

### Acceptance criteria:

- [ ] Tab cycles within the open panel, wrapping at boundaries
- [ ] Shift+Tab cycles backwards
- [ ] Focus moves to first focusable element when panel opens
- [ ] Previous focus restored when panel closes
- [ ] When `focusTrap` flag is OFF, no trapping (normal Tab behavior)
- [ ] Does NOT interfere with xterm.js keyboard input (trap only active when panel is open)
- [ ] Works with FeatureFlagPanel dropdown immediately; other panels can adopt later

---

## Phase 19: GitHub URL Detection

**Goal:** Detect GitHub URLs pasted into ChatInputBar and auto-format them as contextual references with repo/issue/PR metadata.

**Source reference:** `parallel-code/src/lib/github-url.ts` (64 lines)

**Feature flag:** `githubUrlDetection` — default: `true`

**Complexity:** S (small) — one utility + one hook

### New files to create:

#### `src/lib/githubUrl.ts`

```typescript
/**
 * GitHub URL parsing utilities.
 * Adapted from parallel-code/src/lib/github-url.ts
 *
 * Types:
 *   ParsedGitHubUrl = {
 *     org: string;
 *     repo: string;
 *     type?: 'issues' | 'pull' | 'discussions' | 'actions/runs';
 *     number?: number;
 *     fullUrl: string;
 *   }
 *
 * Functions:
 *
 * parseGitHubUrl(url: string): ParsedGitHubUrl | null
 *   Parses GitHub URLs into structured data.
 *   Handles:
 *     https://github.com/org/repo
 *     https://github.com/org/repo/issues/123
 *     https://github.com/org/repo/pull/456
 *     https://github.com/org/repo/discussions/789
 *     https://github.com/org/repo/actions/runs/123
 *   Returns null for non-GitHub or malformed URLs.
 *
 * extractGitHubUrl(text: string): string | null
 *   Extracts the first GitHub URL from arbitrary text.
 *   Regex: /https?:\/\/(?:www\.)?github\.com\/[^\s)>\]"']+/i
 *
 * formatGitHubRef(parsed: ParsedGitHubUrl): string
 *   Returns a compact reference string:
 *     "org/repo#123 (issue)" or "org/repo#456 (PR)" or "org/repo"
 */

export interface ParsedGitHubUrl {
  org: string;
  repo: string;
  type?: 'issues' | 'pull' | 'discussions' | 'actions/runs';
  number?: number;
  fullUrl: string;
}

const GITHUB_URL_RE = /https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\/(?:(issues|pull|discussions)\/(\d+)|actions\/runs\/(\d+)))?(?:[#?][^\s]*)?$/;

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  const m = url.trim().match(GITHUB_URL_RE);
  if (!m) return null;
  const [, org, repo, type, num, runNum] = m;
  return {
    org,
    repo: repo.replace(/\.git$/, ''),
    type: runNum ? 'actions/runs' : (type as ParsedGitHubUrl['type']),
    number: num ? parseInt(num, 10) : runNum ? parseInt(runNum, 10) : undefined,
    fullUrl: url.trim(),
  };
}

const EXTRACT_RE = /https?:\/\/(?:www\.)?github\.com\/[^\s)>\]"']+/i;

export function extractGitHubUrl(text: string): string | null {
  const m = text.match(EXTRACT_RE);
  return m ? m[0] : null;
}

export function formatGitHubRef(parsed: ParsedGitHubUrl): string {
  const base = `${parsed.org}/${parsed.repo}`;
  if (parsed.type === 'issues' && parsed.number) return `${base}#${parsed.number} (issue)`;
  if (parsed.type === 'pull' && parsed.number) return `${base}#${parsed.number} (PR)`;
  if (parsed.type === 'discussions' && parsed.number) return `${base}#${parsed.number} (discussion)`;
  if (parsed.type === 'actions/runs' && parsed.number) return `${base} run #${parsed.number}`;
  return base;
}
```

#### `src/components/GitHubUrlBadge.tsx`

```typescript
/**
 * Small badge that appears above ChatInputBar when a GitHub URL is detected
 * in the input text.
 *
 * Props:
 *   text: string — the current input text to scan for GitHub URLs
 *
 * Behavior:
 *   - Scans text for GitHub URLs using extractGitHubUrl()
 *   - If found, shows a small pill badge: "🔗 org/repo#123 (issue)"
 *   - Click on badge copies the formatted reference to clipboard
 *   - Badge auto-hides after 5 seconds or when text changes
 *
 * When githubUrlDetection flag is OFF: returns null (not rendered).
 *
 * Size: 20px height, positioned above the input area.
 * Color: subtle blue background (#1a3a5c) with blue text (#58a6ff).
 */
```

### Integration points:

1. **`src/store/featureFlagStore.ts`:** Add `githubUrlDetection: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `githubUrlDetection: 'GitHub URL Detection'`.
3. **`src/components/TerminalPane.tsx`:** Import `GitHubUrlBadge` and render above the BookmarkBar/ChatInputBar area, passing the last sent command as `text`. The badge is passive (informational) and does not modify the command sent to PTY.

### Acceptance criteria:

- [ ] GitHub URLs detected in input text via regex
- [ ] Parsed into structured data (org, repo, type, number)
- [ ] Badge shows formatted reference (e.g., "anthropics/claude-code#100 (issue)")
- [ ] Click copies reference to clipboard
- [ ] Handles: repo URLs, issue URLs, PR URLs, discussion URLs, action run URLs
- [ ] When `githubUrlDetection` flag is OFF, no detection, badge hidden
- [ ] Does NOT modify the actual command sent to PTY — purely informational

---

## Phase 20: Inline Editable Text

**Goal:** Reusable component for double-click-to-edit text fields. Used to rename bookmarks, pane titles, and other labels.

**Source reference:** `parallel-code/src/components/EditableText.tsx` (89 lines)

**Feature flag:** `inlineEditing` — default: `true`

**Complexity:** S (small) — one reusable component

### New files to create:

#### `src/components/EditableText.tsx`

```typescript
/**
 * Inline editable text component.
 * Adapted from parallel-code/src/components/EditableText.tsx
 *
 * Props:
 *   value: string              — current display text
 *   onCommit: (newValue: string) => void — called when edit is confirmed
 *   placeholder?: string       — shown when value is empty
 *   className?: string         — CSS classes for the display span
 *   maxLength?: number         — max input length (default: 100)
 *   disabled?: boolean         — prevent editing
 *
 * Behavior:
 *   Display mode: renders a <span> with the value text.
 *   Double-click on the span → switches to edit mode.
 *   Edit mode: renders an <input> pre-filled with current value.
 *     - Enter or blur → commit (calls onCommit with new value)
 *     - Escape → cancel (revert to original value)
 *     - Input auto-selects all text on focus
 *     - Empty input reverts to original value (no empty commits)
 *
 * Styling:
 *   Display: inherits parent text styles, cursor: text, hover: underline dotted
 *   Edit: matches parent font-size/color, minimal border, transparent background
 *
 * When inlineEditing flag is OFF: renders plain <span> (no double-click handler).
 */

import { useState, useRef, useEffect } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';

interface EditableTextProps {
  value: string;
  onCommit: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function EditableText({
  value,
  onCommit,
  placeholder = '',
  className = '',
  maxLength = 100,
  disabled = false,
}: EditableTextProps) {
  const enabled = useFeatureFlagStore((s) => s.inlineEditing);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const handleCommit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    }
    setEditing(false);
    setDraft(value); // revert draft to committed value
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (!enabled || disabled) {
    return (
      <span className={className} title={value}>
        {value || placeholder}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCommit();
          if (e.key === 'Escape') handleCancel();
        }}
        maxLength={maxLength}
        className={`bg-transparent border border-[#555] rounded px-1 outline-none ${className}`}
        style={{ width: `${Math.max(draft.length, 3)}ch` }}
      />
    );
  }

  return (
    <span
      className={`cursor-text hover:underline hover:decoration-dotted ${className}`}
      onDoubleClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Double-click to edit"
    >
      {value || placeholder}
    </span>
  );
}
```

### Integration points:

1. **`src/store/featureFlagStore.ts`:** Add `inlineEditing: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `inlineEditing: 'Inline Editing'`.
3. **`src/components/BookmarkBar.tsx`:** Replace the inline rename input with `<EditableText>` for bookmark labels. (This is a small additive change to a Phase 5 file — replacing the existing rename logic with the reusable component.)

### Acceptance criteria:

- [ ] Double-click on text switches to inline edit mode
- [ ] Enter commits, Escape cancels, blur commits
- [ ] Empty input reverts to original value
- [ ] Text auto-selected on edit start
- [ ] When `inlineEditing` flag is OFF, renders plain non-editable text
- [ ] Component is generic and reusable (not tied to any specific use case)
- [ ] BookmarkBar labels use EditableText for rename (replaces existing rename logic)

---

## Phase 21: Error Boundaries

**Goal:** Wrap pane content in React Error Boundaries so a crash in one pane doesn't take down the entire app.

**Source reference:** `parallel-code/src/components/TilingLayout.tsx` (ErrorBoundary pattern)

**Feature flag:** `errorBoundaries` — default: `true`

**Complexity:** S (small) — one class component + integration

### New files to create:

#### `src/components/PaneErrorBoundary.tsx`

```typescript
/**
 * React Error Boundary for terminal panes.
 * Adapted from parallel-code TilingLayout error handling.
 *
 * Props:
 *   paneId: string        — ID of the pane (for display and retry)
 *   children: ReactNode   — the pane content to protect
 *
 * Error UI:
 *   - Red border around the pane area
 *   - Error icon + "Pane crashed" heading
 *   - Error message (first 200 chars)
 *   - Stack trace in a collapsible <details> block
 *   - "Retry" button: resets error state, re-mounts children
 *   - "Close Pane" button: calls paneStore.closePane(paneId)
 *
 * Behavior:
 *   - Catches render errors via componentDidCatch
 *   - Logs error to console with pane ID
 *   - Does NOT catch errors in event handlers or async code
 *     (those are caught by global window.onerror / unhandledrejection)
 *   - Retry resets state.hasError, triggering re-render of children
 *
 * When errorBoundaries flag is OFF: renders children directly (no boundary).
 * This is handled by the WRAPPER, not the boundary itself — the boundary
 * class component always catches errors. The wrapper decides whether to
 * use the boundary or pass children through.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { usePaneStore } from '../store/paneStore';

interface Props {
  paneId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PaneErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(`[PaneErrorBoundary] Pane ${this.props.paneId} crashed:`, error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleClose = (): void => {
    usePaneStore.getState().closePane(this.props.paneId);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] border-2 border-red-500/50 rounded p-4 text-center">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="#f44747" className="mb-2">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8.75 8a.75.75 0 0 1-1.5 0V4.5a.75.75 0 0 1 1.5 0V8z" />
          </svg>
          <h3 className="text-sm font-medium text-red-400 mb-1">Pane crashed</h3>
          <p className="text-xs text-gray-400 mb-3 max-w-[300px]">
            {error?.message?.slice(0, 200) ?? 'Unknown error'}
          </p>
          {errorInfo?.componentStack && (
            <details className="mb-3 text-left w-full max-w-[400px]">
              <summary className="text-[10px] text-gray-500 cursor-pointer">Stack trace</summary>
              <pre className="text-[9px] text-gray-600 mt-1 overflow-auto max-h-[150px] bg-[#151515] p-2 rounded">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-3 py-1 text-xs bg-[#333] hover:bg-[#444] text-gray-300 rounded transition-colors"
            >
              Retry
            </button>
            <button
              onClick={this.handleClose}
              className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded transition-colors"
            >
              Close Pane
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

#### `src/components/SafePane.tsx`

```typescript
/**
 * Wrapper that conditionally applies PaneErrorBoundary based on feature flag.
 *
 * Props:
 *   paneId: string
 *   children: ReactNode
 *
 * When errorBoundaries flag is ON: wraps children in <PaneErrorBoundary>.
 * When errorBoundaries flag is OFF: renders children directly.
 */

import { type ReactNode } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { PaneErrorBoundary } from './PaneErrorBoundary';

interface SafePaneProps {
  paneId: string;
  children: ReactNode;
}

export function SafePane({ paneId, children }: SafePaneProps) {
  const enabled = useFeatureFlagStore((s) => s.errorBoundaries);
  if (!enabled) return <>{children}</>;
  return <PaneErrorBoundary paneId={paneId}>{children}</PaneErrorBoundary>;
}
```

### Integration points:

1. **`src/store/featureFlagStore.ts`:** Add `errorBoundaries: boolean`, default `true`.
2. **`src/components/FeatureFlagPanel.tsx`:** Add `errorBoundaries: 'Error Boundaries'`.
3. **`src/components/PaneContainer.tsx`:** Wrap each `<TerminalPane>` render call with `<SafePane paneId={...}>`:

```typescript
// BEFORE (existing code):
<TerminalPane key={pane.id} paneId={pane.id} ... />

// AFTER (wrapped):
<SafePane paneId={pane.id}>
  <TerminalPane key={pane.id} paneId={pane.id} ... />
</SafePane>
```

This is a minimal additive change: import `SafePane` and wrap the existing `TerminalPane` JSX.

### Acceptance criteria:

- [ ] Render errors in one pane show error UI instead of crashing the app
- [ ] Error UI shows error message, stack trace (collapsible), retry button, close button
- [ ] Retry button re-mounts the pane content (fresh start)
- [ ] Close button removes the pane via paneStore
- [ ] Other panes continue working normally when one crashes
- [ ] When `errorBoundaries` flag is OFF, no boundary (errors propagate normally)
- [ ] Error logged to console with pane ID

---

## Adversarial Stress Test

### View A: "The Brownfield Violator"

> "Several phases modify existing files. Isn't that violating the DO NOT MODIFY constraint?"

**Mitigation:** The constraint applies to files listed in Volume 1's "Existing Files (DO NOT MODIFY)" section. Files created in Phases 0–11 (featureFlagStore, FeatureFlagPanel, DiffPanel, diffStore, shortcuts, useShortcuts, PaneContainer, TerminalPane, server.ts, protocol.ts) are designated integration points with documented additive-change patterns. Every V2 phase specifies EXACTLY which lines to add. No existing lines are changed or removed. This is the same pattern used in all 11 completed phases.

### View B: "The Shiki Bundle Bloat"

> "Shiki is huge. This will double the bundle size."

**Mitigation:** Phase 15 uses dynamic `import('shiki')` — Shiki is NOT in the initial bundle. It loads lazily only when DiffPanel opens AND `diffSyntaxHighlight` flag is ON. If the user never opens the diff panel, Shiki is never downloaded. Additionally, Shiki's WASM-based highlighter is ~2MB but loads from CDN/cache efficiently. Tree-shaking via Vite removes unused languages.

### View C: "The Ask About Code Security Risk"

> "Phase 16 spawns arbitrary processes. This is dangerous."

**Mitigation:** The handler ONLY spawns `claude` — hardcoded command name, not user-configurable. The prompt content is user-provided (they selected the code and typed the question), same as if they typed it into the terminal. Environment variables are cleaned to prevent session inheritance. Concurrent limit (5) and timeout (2min) prevent resource exhaustion. The feature requires the `claude` CLI to be installed — if it's not, the spawn fails gracefully with an error message.

### View D: "The Feature Flag Explosion"

> "We now have 21+ feature flags. This is unmanageable."

**Mitigation:** Feature flags are the explicit design pattern chosen in Phase 0. The FeatureFlagPanel renders all flags with labels and toggle switches. The "Reset All" button restores defaults. Flags persist to localStorage. The cognitive overhead is LOW because each flag is independent — toggling one flag does not affect others. The alternative (no flags) would mean features can't be disabled without code changes.

### View E: "The Electron API Leak Check"

> "Any Electron APIs leaking into V2 phases?"

**Mitigation:** No. Phase 12 (themes) is pure CSS. Phase 13 (zoom) is pure DOM. Phases 14-15 (diff extensions) are pure frontend. Phase 16 (ask-code) uses `child_process.spawn` in the Node.js sidecar — this is Node.js, not Electron. Phases 17-21 are pure frontend. No `ipcRenderer`, no `BrowserWindow`, no `electron` import anywhere.

### View F: "The Context Loss Between Conversations"

> "Volume 2 references Volume 1 files. A new conversation won't know what's in them."

**Mitigation:** The initializing prompt instructs the LLM to read BOTH plan files. Volume 2 contains the full list of files created in each phase with their exact interfaces and exports. The Architecture Reference section lists every file that V2 phases extend, with the phase that created it. The handover notes carry forward any non-obvious state.

### View G: "The Dependency Chain Risk"

> "Phase 15 depends on Phase 14. What if Phase 14 isn't done?"

**Mitigation:** Phase 15 says "benefits from Phase 14" but does NOT require it. If Phase 14 hasn't been done, Phase 15 creates its own `EnhancedDiffPanel.tsx` wrapper directly. Phase 16 is similarly independent — it needs DiffPanel (Phase 4, DONE) but not Phases 14 or 15. The recommended execution order minimizes rework but any order works.

### View H: "The CSS Variable Naming Collision"

> "Theme CSS variables (--co-*) might collide with existing styles."

**Mitigation:** All theme variables use the `--co-` prefix (chat-overlay). No existing code uses this prefix. Existing components use hardcoded Tailwind classes (`bg-[#1e1e1e]`) which are NOT affected by CSS custom properties. The theme system only applies to components that explicitly reference `var(--co-*)`.

---

## New Feature Flags Summary

| Flag | Phase | Default | Rationale |
|------|-------|---------|-----------|
| `themePresets` | 12 | `true` | Pure visual, safe to enable |
| `ctrlWheelZoom` | 13 | `true` | Common UX pattern, safe |
| `diffSearch` | 14 | `true` | Enhances existing diff viewer |
| `diffSyntaxHighlight` | 15 | `true` | Lazy-loaded, graceful fallback |
| `askAboutCode` | 16 | `true` | Requires `claude` CLI installed |
| `completionStats` | 17 | `true` | Passive tracking, low impact |
| `focusTrap` | 18 | `true` | Accessibility improvement |
| `githubUrlDetection` | 19 | `true` | Passive detection, informational |
| `inlineEditing` | 20 | `true` | UI enhancement, safe |
| `errorBoundaries` | 21 | `true` | Crash resilience, safe |

---

## Handover Notes Section

*Updated after each phase completion. Each entry includes: what was done, what changed, any gotchas for the next session.*

### Phase 12 (2026-04-03)
- **Created:** `src/lib/themes.ts`, `src/store/themeStore.ts`, `src/components/ThemeSelector.tsx`, `src/styles/theme.css`
- **Modified:** `src/store/featureFlagStore.ts` (+themePresets flag), `src/components/FeatureFlagPanel.tsx` (+ThemeSelector render), `src/index.css` (+theme.css import), `src/hooks/usePersistence.ts` (+themePresets in gatherState)
- **Gotcha:** `usePersistence.ts` has a `gatherState()` function that serializes ALL feature flags — any new flag must be added there too, or TS will error
- **Commits:** `37bf10e` (theme system files), `184344b` (ThemeSelector + integration)

### Phase 13 (2026-04-03)
- **Created:** `src/lib/wheelZoom.ts`, `src/hooks/useZoom.ts`, `src/styles/zoom.css`
- **Modified:** `src/store/featureFlagStore.ts` (+ctrlWheelZoom flag), `src/components/FeatureFlagPanel.tsx` (+label), `src/components/PaneContainer.tsx` (+useZoom call + zoom.css import), `src/hooks/useShortcuts.ts` (+Ctrl+0/+/- shortcuts via custom events), `src/hooks/usePersistence.ts` (+ctrlWheelZoom in gatherState)
- **Pattern:** useZoom dispatches/listens to custom DOM events (`zoom-reset`, `zoom-in`, `zoom-out`) so useShortcuts doesn't directly call zoom functions — clean separation
- **Gotcha:** Same as Phase 12 — any new feature flag MUST be added to `usePersistence.ts` gatherState or TS will error
- **Commits:** `e8105aa` (zoom utility + hook + CSS), `7329f9a` (integration into flags + UI)

### Phase 14 (2026-04-03)
- **Created:** `src/lib/diffSearch.ts`, `src/components/DiffSearchBar.tsx`, `src/components/CollapsibleContext.tsx`, `src/components/EnhancedDiffPanel.tsx`
- **Modified:** `src/store/featureFlagStore.ts` (+diffSearch flag), `src/components/FeatureFlagPanel.tsx` (+label), `src/store/diffStore.ts` (+searchQuery/currentMatchIndex), `src/hooks/usePersistence.ts` (+diffSearch in gatherState), `src/components/TerminalPane.tsx` (swapped DiffPanel import to EnhancedDiffPanel)
- **Pattern:** EnhancedDiffPanel checks `diffSearch` flag — when ON renders enhanced panel with search + collapse, when OFF renders original `<DiffPanel />` unchanged
- **Gotcha:** Same gatherState rule — any new flag MUST be added to usePersistence.ts. Context collapse uses MIN_COLLAPSE_LINES=5, keeping first 2 + last 2 context lines visible.
- **Commits:** `61f256c` (search utils + DiffSearchBar + CollapsibleContext), `887fbae` (EnhancedDiffPanel + flag wiring)

### Phase 15 (2026-04-03)
- **Created:** `src/lib/syntaxHighlighter.ts`, `src/hooks/useSyntaxHighlight.ts`
- **Modified:** `src/store/featureFlagStore.ts` (+diffSyntaxHighlight flag), `src/components/FeatureFlagPanel.tsx` (+label), `src/hooks/usePersistence.ts` (+diffSyntaxHighlight in gatherState), `src/components/EnhancedDiffPanel.tsx` (+syntax highlight integration)
- **npm:** Added `shiki` dependency
- **Pattern:** useSyntaxHighlight returns a `Map<string, string>` (content→HTML). EnhancedDiffLineRow checks: searchQuery first (wins), then highlightedHtml, then plain text fallback. Three-tier rendering priority.
- **Gotcha:** Same gatherState rule — any new flag MUST be added to usePersistence.ts. Shiki WASM chunk is ~600KB but only loads when diff panel opens AND flag is ON.
- **Commits:** squash-merged via PR #20

---

## Established PR History (continued from Volume 1)

| Phase | PR | Squash Commit | Method |
|-------|----|---------------|--------|
| 12 | — | — | — |
| 13 | — | — | — |
| 14 | — | — | — |
| 15 | #20 | 3327e1e | squash-merge |
| 16 | — | — | — |
| 17 | — | — | — |
| 18 | — | — | — |
| 19 | — | — | — |
| 20 | — | — | — |
| 21 | — | — | — |
