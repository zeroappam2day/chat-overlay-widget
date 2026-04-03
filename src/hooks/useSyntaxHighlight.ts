/**
 * Hook that provides syntax-highlighted HTML for diff file lines.
 * Lazy-loads Shiki, caches results per file path.
 * Returns plain text immediately, replaces with highlighted text when ready.
 */

import { useState, useEffect, useRef } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { detectLanguage, highlightLines } from '../lib/syntaxHighlighter';
import type { FileDiff } from '../lib/diffParser';

/** Map from file path to array of highlighted HTML strings (one per reconstructed line). */
const highlightCache = new Map<string, string[]>();

/**
 * Reconstruct the full "new" file content from diff hunks for highlighting.
 * Uses add + context lines (skips remove lines since those are old file).
 * Returns { lines, lineMap } where lineMap maps reconstructed line index to hunk line index.
 */
function reconstructNewContent(file: FileDiff): string[] {
  const lines: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add' || line.type === 'context') {
        lines.push(line.content);
      }
    }
  }
  return lines;
}

function reconstructOldContent(file: FileDiff): string[] {
  const lines: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'remove' || line.type === 'context') {
        lines.push(line.content);
      }
    }
  }
  return lines;
}

/**
 * Returns a map: lineContent -> highlighted HTML.
 * We highlight both old and new file content, then build a lookup by content.
 */
export function useSyntaxHighlight(
  file: FileDiff,
): Map<string, string> | null {
  const enabled = useFeatureFlagStore((s) => s.diffSyntaxHighlight);
  const [result, setResult] = useState<Map<string, string> | null>(null);
  const filePathRef = useRef(file.path);

  useEffect(() => {
    if (!enabled || file.binary || file.hunks.length === 0) {
      setResult(null);
      return;
    }

    filePathRef.current = file.path;
    const cacheKey = file.path;

    // Check cache
    if (highlightCache.has(cacheKey)) {
      // Rebuild map from cache — but cache stores full file lines,
      // we need content->html mapping
    }

    const lang = detectLanguage(file.path);
    if (lang === 'plaintext') {
      setResult(null);
      return;
    }

    let cancelled = false;

    // Reconstruct both old and new file content
    const newLines = reconstructNewContent(file);
    const oldLines = reconstructOldContent(file);
    const allLines = [...newLines, ...oldLines];
    const allCode = allLines.join('\n');

    highlightLines(allCode, lang).then((htmlLines) => {
      if (cancelled) return;

      const map = new Map<string, string>();
      for (let i = 0; i < allLines.length; i++) {
        const content = allLines[i];
        const html = htmlLines[i] ?? content;
        // Only set if not already mapped (first occurrence wins)
        if (!map.has(content)) {
          map.set(content, html);
        }
      }
      highlightCache.set(cacheKey, htmlLines);
      setResult(map);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, file.path, file.hunks, file.binary]);

  return enabled ? result : null;
}
