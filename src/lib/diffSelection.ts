/**
 * Extract structured selection from diff viewer (Phase 16).
 * Walks DOM nodes to find data attributes set on diff line rows.
 */

export interface DiffSelection {
  filePath: string;
  startLine: number;
  endLine: number;
  selectedText: string;
}

/**
 * Read the current window selection and extract diff context.
 * Returns null if selection is empty, spans multiple files, or only includes removed lines.
 */
export function getDiffSelection(): DiffSelection | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;

  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer instanceof HTMLElement
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  if (!container) return null;

  // Find all diff line rows within the selection range
  // Lines are marked with data-diff-line-num and data-diff-file-path
  const allLineEls = container.closest('[data-diff-panel]')
    ?.querySelectorAll<HTMLElement>('[data-diff-line-num]');
  if (!allLineEls || allLineEls.length === 0) return null;

  const selectedLines: { el: HTMLElement; lineNum: number; filePath: string; type: string }[] = [];

  for (const el of allLineEls) {
    if (!sel.containsNode(el, true)) continue;
    const lineNum = parseInt(el.dataset.diffLineNum ?? '', 10);
    const filePath = el.dataset.diffFilePath ?? '';
    const lineType = el.dataset.diffLineType ?? 'context';
    if (isNaN(lineNum) || !filePath) continue;
    selectedLines.push({ el, lineNum, filePath, type: lineType });
  }

  if (selectedLines.length === 0) return null;

  // Must be from a single file
  const filePaths = new Set(selectedLines.map(l => l.filePath));
  if (filePaths.size !== 1) return null;

  // Filter out 'remove' lines — can't ask about deleted code
  const relevantLines = selectedLines.filter(l => l.type !== 'remove');
  if (relevantLines.length === 0) return null;

  const filePath = relevantLines[0].filePath;
  const lineNums = relevantLines.map(l => l.lineNum);
  const startLine = Math.min(...lineNums);
  const endLine = Math.max(...lineNums);

  // Get the selected text content
  const selectedText = sel.toString().trim();
  if (!selectedText) return null;

  return { filePath, startLine, endLine, selectedText };
}
