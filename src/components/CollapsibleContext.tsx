import type { DiffLine } from '../lib/diffParser';

export const MIN_COLLAPSE_LINES = 5;

export type CollapsedEntry = { type: 'collapsed'; lineCount: number; startIndex: number };
export type CollapseResult = DiffLine | CollapsedEntry;

/**
 * Scan lines for consecutive context runs longer than MIN_COLLAPSE_LINES.
 * For such runs, keep the first 2 and last 2 visible; replace the middle with
 * a single CollapsedEntry. Short runs and non-context lines pass through unchanged.
 */
export function collapseContextRuns(lines: DiffLine[]): CollapseResult[] {
  const result: CollapseResult[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].type !== 'context') {
      result.push(lines[i]);
      i++;
      continue;
    }

    // Collect the full run of context lines
    const runStart = i;
    while (i < lines.length && lines[i].type === 'context') {
      i++;
    }
    const runEnd = i; // exclusive
    const runLength = runEnd - runStart;

    if (runLength <= MIN_COLLAPSE_LINES) {
      // Short run — pass through as-is
      for (let j = runStart; j < runEnd; j++) {
        result.push(lines[j]);
      }
    } else {
      // Long run — keep first 2, collapse middle, keep last 2
      result.push(lines[runStart]);
      result.push(lines[runStart + 1]);
      const middleCount = runLength - 4;
      result.push({ type: 'collapsed', lineCount: middleCount, startIndex: runStart + 2 });
      result.push(lines[runEnd - 2]);
      result.push(lines[runEnd - 1]);
    }
  }

  return result;
}

interface CollapsedRowProps {
  lineCount: number;
  onExpand: () => void;
}

export function CollapsedRow({ lineCount, onExpand }: CollapsedRowProps) {
  return (
    <div
      onClick={onExpand}
      className="border-y border-dashed border-[#333] text-center py-1 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-[#252525] cursor-pointer font-mono"
    >
      ... {lineCount} lines hidden ...
    </div>
  );
}
