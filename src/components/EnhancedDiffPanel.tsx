import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDiffStore } from '../store/diffStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { DiffSearchBar } from './DiffSearchBar';
import { CollapsedRow, collapseContextRuns, type CollapsedEntry } from './CollapsibleContext';
import { renderHighlightedLine, countMatchesInDiff, highlightSearchMatches } from '../lib/diffSearch';
import type { FileDiff, Hunk, DiffLine } from '../lib/diffParser';
import { DiffPanel } from './DiffPanel';

// ── Shared helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  M: 'bg-yellow-600',
  A: 'bg-green-600',
  D: 'bg-red-600',
};

function LineNumber({ num }: { num: number | null }) {
  return (
    <span className="inline-block w-10 text-right pr-2 text-gray-600 select-none text-[11px] shrink-0">
      {num ?? ''}
    </span>
  );
}

// ── Enhanced diff line row ────────────────────────────────────────────────────

interface EnhancedDiffLineRowProps {
  line: DiffLine;
  searchQuery: string;
  currentGlobalIndex: number;
  globalOffset: number;
}

function EnhancedDiffLineRow({ line, searchQuery, currentGlobalIndex, globalOffset }: EnhancedDiffLineRowProps) {
  const bgClass =
    line.type === 'add'
      ? 'bg-[#1e3a1e]'
      : line.type === 'remove'
        ? 'bg-[#3a1e1e]'
        : '';
  const textClass =
    line.type === 'add'
      ? 'text-green-300'
      : line.type === 'remove'
        ? 'text-red-300'
        : 'text-gray-400';
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

  const content = searchQuery
    ? renderHighlightedLine(line.content, searchQuery, [currentGlobalIndex], globalOffset)
    : line.content;

  return (
    <div className={`flex font-mono text-[11px] leading-[18px] ${bgClass}`}>
      <LineNumber num={line.oldLine} />
      <LineNumber num={line.newLine} />
      <span className={`${textClass} whitespace-pre overflow-x-auto flex-1 px-1`}>
        {prefix}{content}
      </span>
    </div>
  );
}

// ── Enhanced hunk view ────────────────────────────────────────────────────────

interface EnhancedHunkViewProps {
  hunk: Hunk;
  searchQuery: string;
  currentGlobalIndex: number;
  globalMatchOffset: number;
}

function EnhancedHunkView({ hunk, searchQuery, currentGlobalIndex, globalMatchOffset }: EnhancedHunkViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const displayItems = useMemo(() => collapseContextRuns(hunk.lines), [hunk.lines]);

  function handleExpand(startIndex: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.add(startIndex);
      return next;
    });
  }

  // Track global match offset as we iterate items
  let localMatchOffset = globalMatchOffset;
  const renderedItems: React.ReactNode[] = [];

  for (let i = 0; i < displayItems.length; i++) {
    const item = displayItems[i];

    if ((item as CollapsedEntry).type === 'collapsed') {
      const collapsed = item as CollapsedEntry;
      if (expandedSections.has(collapsed.startIndex)) {
        // Expanded: render the hidden lines from the original hunk
        const hiddenLines = hunk.lines.slice(
          collapsed.startIndex,
          collapsed.startIndex + collapsed.lineCount,
        );
        for (let j = 0; j < hiddenLines.length; j++) {
          const line = hiddenLines[j];
          const matchCount = searchQuery ? highlightSearchMatches(line.content, searchQuery).length : 0;
          renderedItems.push(
            <EnhancedDiffLineRow
              key={`expanded-${collapsed.startIndex}-${j}`}
              line={line}
              searchQuery={searchQuery}
              currentGlobalIndex={currentGlobalIndex}
              globalOffset={localMatchOffset}
            />,
          );
          localMatchOffset += matchCount;
        }
      } else {
        renderedItems.push(
          <CollapsedRow
            key={`collapsed-${collapsed.startIndex}`}
            lineCount={collapsed.lineCount}
            onExpand={() => handleExpand(collapsed.startIndex)}
          />,
        );
        // Still advance localMatchOffset for the hidden lines
        const hiddenLines = hunk.lines.slice(
          collapsed.startIndex,
          collapsed.startIndex + collapsed.lineCount,
        );
        for (const line of hiddenLines) {
          localMatchOffset += searchQuery ? highlightSearchMatches(line.content, searchQuery).length : 0;
        }
      }
    } else {
      const line = item as DiffLine;
      const matchCount = searchQuery ? highlightSearchMatches(line.content, searchQuery).length : 0;
      renderedItems.push(
        <EnhancedDiffLineRow
          key={i}
          line={line}
          searchQuery={searchQuery}
          currentGlobalIndex={currentGlobalIndex}
          globalOffset={localMatchOffset}
        />,
      );
      localMatchOffset += matchCount;
    }
  }

  return (
    <div className="border-t border-[#333]">
      <div className="text-[10px] text-gray-500 bg-[#252525] px-2 py-0.5 font-mono">
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </div>
      {renderedItems}
    </div>
  );
}

// ── Enhanced file diff view ───────────────────────────────────────────────────

interface EnhancedFileDiffViewProps {
  file: FileDiff;
  fileIndex: number;
  searchQuery: string;
  currentGlobalIndex: number;
  globalMatchOffset: number;
}

function EnhancedFileDiffView({
  file,
  searchQuery,
  currentGlobalIndex,
  globalMatchOffset,
}: EnhancedFileDiffViewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const addCount = file.hunks.reduce((n, h) => n + h.lines.filter((l) => l.type === 'add').length, 0);
  const removeCount = file.hunks.reduce((n, h) => n + h.lines.filter((l) => l.type === 'remove').length, 0);

  let hunkOffset = globalMatchOffset;

  return (
    <div className="border border-[#333] rounded mb-2 overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-[#252525] hover:bg-[#2a2a2a] transition-colors text-left"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`text-gray-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        >
          <path d="M3 1l4 4-4 4z" />
        </svg>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold text-white ${STATUS_COLORS[file.status]}`}>
          {file.status}
        </span>
        <span className="text-xs text-gray-300 truncate flex-1 font-mono" title={file.path}>
          {file.path}
        </span>
        {!file.binary && (
          <span className="text-[10px] text-gray-500 shrink-0">
            {addCount > 0 && <span className="text-green-400">+{addCount}</span>}
            {addCount > 0 && removeCount > 0 && ' '}
            {removeCount > 0 && <span className="text-red-400">-{removeCount}</span>}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="max-h-[400px] overflow-y-auto">
          {file.binary ? (
            <div className="text-xs text-gray-500 italic px-3 py-2">[Binary file]</div>
          ) : file.hunks.length === 0 ? (
            <div className="text-xs text-gray-500 italic px-3 py-2">[No changes]</div>
          ) : (
            file.hunks.map((hunk, i) => {
              const node = (
                <EnhancedHunkView
                  key={i}
                  hunk={hunk}
                  searchQuery={searchQuery}
                  currentGlobalIndex={currentGlobalIndex}
                  globalMatchOffset={hunkOffset}
                />
              );
              // Advance offset by match count in this hunk
              hunkOffset += hunk.lines.reduce(
                (n, l) => n + (searchQuery ? highlightSearchMatches(l.content, searchQuery).length : 0),
                0,
              );
              return node;
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Inner panel (search + collapse active) ────────────────────────────────────

function EnhancedDiffPanelInner() {
  const { diffs, toggleVisible, searchQuery, currentMatchIndex, setSearchQuery, setCurrentMatchIndex } =
    useDiffStore();
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const matchCount = useMemo(() => countMatchesInDiff(diffs, searchQuery), [diffs, searchQuery]);

  const handleNext = useCallback(() => {
    if (matchCount > 0) setCurrentMatchIndex((currentMatchIndex + 1) % matchCount);
  }, [matchCount, currentMatchIndex, setCurrentMatchIndex]);

  const handlePrev = useCallback(() => {
    if (matchCount > 0) setCurrentMatchIndex((currentMatchIndex - 1 + matchCount) % matchCount);
  }, [matchCount, currentMatchIndex, setCurrentMatchIndex]);

  const handleClose = useCallback(() => {
    setSearchQuery('');
    setSearchBarOpen(false);
  }, [setSearchQuery]);

  // Ctrl+F on the panel div
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setSearchBarOpen((prev) => !prev);
      }
    }
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalAdd = diffs.reduce(
    (n, f) => n + f.hunks.reduce((h, hk) => h + hk.lines.filter((l) => l.type === 'add').length, 0),
    0,
  );
  const totalRemove = diffs.reduce(
    (n, f) => n + f.hunks.reduce((h, hk) => h + hk.lines.filter((l) => l.type === 'remove').length, 0),
    0,
  );

  // Accumulate per-file match offsets
  let fileOffset = 0;

  const panel = (
    <div
      ref={panelRef}
      tabIndex={0}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 420,
        height: '100vh',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
      }}
      className="bg-[#1e1e1e] border-l border-[#404040] shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#404040] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#007acc" className="shrink-0">
            <path d="M5.5 3.5h5v1h-5zM5.5 6h5v1h-5zM5.5 8.5h5v1h-5zM5.5 11h3v1h-3z" />
            <path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm0 1v12h10V2H3z" />
          </svg>
          <span className="text-xs text-gray-300 font-medium">
            Diff — {diffs.length} file{diffs.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-gray-500">
            <span className="text-green-400">+{totalAdd}</span>{' '}
            <span className="text-red-400">-{totalRemove}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {/* Search toggle button */}
          <button
            onClick={() => setSearchBarOpen((v) => !v)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Search in diff (Ctrl+F)"
            aria-label="Toggle search"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.406a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
            </svg>
          </button>
          {/* Close button */}
          <button
            onClick={toggleVisible}
            className="text-gray-600 hover:text-gray-300 transition-colors"
            title="Close diff panel"
            aria-label="Close diff panel"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchBarOpen && (
        <DiffSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          matchCount={matchCount}
          currentMatch={currentMatchIndex}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={handleClose}
        />
      )}

      {/* Scrollable file list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {diffs.map((file, i) => {
          const node = (
            <EnhancedFileDiffView
              key={`${file.path}-${i}`}
              file={file}
              fileIndex={i}
              searchQuery={searchQuery}
              currentGlobalIndex={currentMatchIndex}
              globalMatchOffset={fileOffset}
            />
          );
          fileOffset += file.hunks.reduce(
            (n, hk) =>
              n +
              hk.lines.reduce(
                (ln, l) => ln + (searchQuery ? highlightSearchMatches(l.content, searchQuery).length : 0),
                0,
              ),
            0,
          );
          return node;
        })}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

// ── Public export — gates between enhanced and original ──────────────────────

export function EnhancedDiffPanel() {
  const diffViewer = useFeatureFlagStore((s) => s.diffViewer);
  const diffSearch = useFeatureFlagStore((s) => s.diffSearch);
  const { visible, diffs } = useDiffStore();

  if (!diffViewer) return null;
  if (!visible || diffs.length === 0) return null;

  if (!diffSearch) return <DiffPanel />;
  return <EnhancedDiffPanelInner />;
}
