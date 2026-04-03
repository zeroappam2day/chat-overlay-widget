import React from 'react';
import type { FileDiff } from './diffParser';

export type SearchMatch = { start: number; end: number };

export const SEARCH_HIGHLIGHT_BG = 'rgba(255, 200, 50, 0.35)';
export const CURRENT_MATCH_BG = 'rgba(100, 160, 255, 0.35)';

/** Escape special regex characters in a query string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find all case-insensitive occurrences of `query` in `text`.
 * Returns an array of { start, end } indices.
 * Returns empty array if query is empty.
 */
export function highlightSearchMatches(text: string, query: string): SearchMatch[] {
  if (!query) return [];
  const regex = new RegExp(escapeRegex(query), 'gi');
  const matches: SearchMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
  }
  return matches;
}

/**
 * Render `content` with search matches highlighted as <mark> elements.
 * `matchIndices` is the list of global match indices that are the "current" match.
 * `globalOffset` is how many matches came before this line across all previous lines.
 */
export function renderHighlightedLine(
  content: string,
  query: string,
  matchIndices: number[],
  globalOffset: number,
): React.ReactNode {
  if (!query) return content;
  const matches = highlightSearchMatches(content, query);
  if (matches.length === 0) return content;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, localIdx) => {
    const globalIdx = globalOffset + localIdx;
    const isCurrent = matchIndices.includes(globalIdx);
    const bg = isCurrent ? CURRENT_MATCH_BG : SEARCH_HIGHLIGHT_BG;

    if (match.start > lastIndex) {
      parts.push(content.slice(lastIndex, match.start));
    }
    parts.push(
      React.createElement(
        'mark',
        {
          key: globalIdx,
          style: { backgroundColor: bg, color: 'inherit', borderRadius: '2px' },
        },
        content.slice(match.start, match.end),
      ),
    );
    lastIndex = match.end;
  });

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

/**
 * Count the total number of query matches across all diff lines.
 * Returns 0 if query is empty.
 */
export function countMatchesInDiff(diffs: FileDiff[], query: string): number {
  if (!query) return 0;
  let count = 0;
  for (const file of diffs) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        count += highlightSearchMatches(line.content, query).length;
      }
    }
  }
  return count;
}

export interface MatchPosition {
  fileIndex: number;
  hunkIndex: number;
  lineIndex: number;
  matchIndexInLine: number;
}

/**
 * Return an ordered list of every match position for next/prev navigation.
 */
export function getMatchPositions(diffs: FileDiff[], query: string): MatchPosition[] {
  if (!query) return [];
  const positions: MatchPosition[] = [];
  diffs.forEach((file, fileIndex) => {
    file.hunks.forEach((hunk, hunkIndex) => {
      hunk.lines.forEach((line, lineIndex) => {
        const matches = highlightSearchMatches(line.content, query);
        matches.forEach((_, matchIndexInLine) => {
          positions.push({ fileIndex, hunkIndex, lineIndex, matchIndexInLine });
        });
      });
    });
  });
  return positions;
}
