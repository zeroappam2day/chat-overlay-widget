---
phase: "quick"
plan: "260404-6no"
subsystem: "frontend"
tags: ["github", "url-detection", "feature-flag", "badge", "parser"]
dependency_graph:
  requires: ["Phase 0 (featureFlagStore)", "Phase 5 (BookmarkBar area in TerminalPane)"]
  provides: ["githubUrl.ts parser", "GitHubUrlBadge component", "githubUrlDetection feature flag"]
  affects: ["TerminalPane", "FeatureFlagPanel", "usePersistence"]
tech_stack:
  added: []
  patterns: ["feature-flag gating", "useMemo for URL parsing", "clipboard API"]
key_files:
  created:
    - src/lib/githubUrl.ts
    - src/lib/githubUrl.test.ts
    - src/components/GitHubUrlBadge.tsx
  modified:
    - src/store/featureFlagStore.ts
    - src/components/FeatureFlagPanel.tsx
    - src/hooks/usePersistence.ts
    - src/components/TerminalPane.tsx
decisions:
  - "Badge rendered above BookmarkBar (not above ChatInputBar) — follows existing DOM order in TerminalPane"
  - "Copied state resets on text change via useEffect to avoid stale 'Copied!' display"
  - "extractGitHubUrl uses greedy [^\\s)>\\]\"']+ — stops at whitespace/brackets, handles inline URLs in prose"
metrics:
  duration: "118s"
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_created: 3
  files_modified: 4
---

# Phase quick Plan 260404-6no: GitHub URL Detection Summary

GitHub URL detection that parses GitHub issue/PR/discussion/run URLs pasted into the terminal input and displays a copyable formatted reference badge (e.g. `org/repo#123 (issue)`) gated by the `githubUrlDetection` feature flag.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create githubUrl.ts parser + unit tests | aef2fae | src/lib/githubUrl.ts, src/lib/githubUrl.test.ts |
| 2 | GitHubUrlBadge + feature flag wiring + TerminalPane integration | 69d6ab8 | src/components/GitHubUrlBadge.tsx, src/store/featureFlagStore.ts, src/components/FeatureFlagPanel.tsx, src/hooks/usePersistence.ts, src/components/TerminalPane.tsx |

## What Was Built

### `src/lib/githubUrl.ts`
Parser utilities using the exact code from PARALLEL_FEATURES_PLAN_V2.md Phase 19 spec:
- `ParsedGitHubUrl` interface with `org`, `repo`, `type`, `number`, `fullUrl`
- `parseGitHubUrl(url)` — GITHUB_URL_RE regex handles issues/pull/discussions/actions/runs and repo-only URLs; strips `.git` suffix
- `extractGitHubUrl(text)` — EXTRACT_RE extracts first GitHub URL from arbitrary text
- `formatGitHubRef(parsed)` — compact reference strings: `org/repo#123 (issue)`, `org/repo#456 (PR)`, `org/repo#789 (discussion)`, `org/repo run #111`, `org/repo`

### `src/lib/githubUrl.test.ts`
20 unit tests covering:
- All URL types (issues, pull, discussions, actions/runs, repo-only)
- Edge cases: `.git` suffix stripping, query strings, hash fragments, trailing slash
- `extractGitHubUrl` with surrounding prose, multiple URLs, non-GitHub URLs
- All `formatGitHubRef` output formats

### `src/components/GitHubUrlBadge.tsx`
- Props: `{ text: string }`
- Uses `useMemo` to extract and parse GitHub URL from `text`
- Returns null when `githubUrlDetection` flag is OFF or no URL found
- Pill badge: 20px height, `#1a3a5c` background, `#58a6ff` text
- Click copies `formatGitHubRef(parsed)` to clipboard via `navigator.clipboard.writeText`
- `copied` state shows "Copied!" for 1.5s; resets via `useEffect` on text change

### Feature flag wiring (4 integration points)
All follow the established pattern from Phases 12–18:
1. `featureFlagStore.ts` — `githubUrlDetection: boolean` in interface, defaults (`true`), and `setFlag` serialization
2. `FeatureFlagPanel.tsx` — `githubUrlDetection: 'GitHub URL Detection'` in `FLAG_LABELS`
3. `usePersistence.ts` — `githubUrlDetection: flags.githubUrlDetection` in `gatherState` (prevents TS error)
4. `TerminalPane.tsx` — `<GitHubUrlBadge text={lastSentCommand} />` rendered above BookmarkBar

## Verification

- `npx vitest run src/lib/githubUrl.test.ts` — 20/20 tests pass
- `npx tsc --noEmit` — zero TypeScript errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — badge is fully wired. `lastSentCommand` in TerminalPane is the actual last sent command string, not a placeholder.

## Self-Check: PASSED

- FOUND: src/lib/githubUrl.ts
- FOUND: src/lib/githubUrl.test.ts
- FOUND: src/components/GitHubUrlBadge.tsx
- FOUND: commit aef2fae (Task 1)
- FOUND: commit 69d6ab8 (Task 2)
