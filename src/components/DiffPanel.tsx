import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDiffStore } from '../store/diffStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import type { FileDiff, Hunk, DiffLine } from '../lib/diffParser';

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

function DiffLineRow({ line }: { line: DiffLine }) {
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

  return (
    <div className={`flex font-mono text-[11px] leading-[18px] ${bgClass}`}>
      <LineNumber num={line.oldLine} />
      <LineNumber num={line.newLine} />
      <span className={`${textClass} whitespace-pre overflow-x-auto flex-1 px-1`}>
        {prefix}{line.content}
      </span>
    </div>
  );
}

function HunkView({ hunk }: { hunk: Hunk }) {
  return (
    <div className="border-t border-[#333]">
      <div className="text-[10px] text-gray-500 bg-[#252525] px-2 py-0.5 font-mono">
        @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
      </div>
      {hunk.lines.map((line, i) => (
        <DiffLineRow key={i} line={line} />
      ))}
    </div>
  );
}

function FileDiffView({ file }: { file: FileDiff }) {
  const [collapsed, setCollapsed] = useState(false);
  const addCount = file.hunks.reduce((n, h) => n + h.lines.filter(l => l.type === 'add').length, 0);
  const removeCount = file.hunks.reduce((n, h) => n + h.lines.filter(l => l.type === 'remove').length, 0);

  return (
    <div className="border border-[#333] rounded mb-2 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
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
            file.hunks.map((hunk, i) => <HunkView key={i} hunk={hunk} />)
          )}
        </div>
      )}
    </div>
  );
}

export function DiffPanel() {
  const diffViewer = useFeatureFlagStore((s) => s.diffViewer);
  const { diffs, visible, toggleVisible } = useDiffStore();

  if (!diffViewer) return null;
  if (!visible || diffs.length === 0) return null;

  const totalAdd = diffs.reduce(
    (n, f) => n + f.hunks.reduce((h, hk) => h + hk.lines.filter(l => l.type === 'add').length, 0),
    0,
  );
  const totalRemove = diffs.reduce(
    (n, f) => n + f.hunks.reduce((h, hk) => h + hk.lines.filter(l => l.type === 'remove').length, 0),
    0,
  );

  const panel = (
    <div
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
        <button
          onClick={toggleVisible}
          className="text-gray-600 hover:text-gray-300 transition-colors ml-2 shrink-0"
          title="Close diff panel"
          aria-label="Close diff panel"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
          </svg>
        </button>
      </div>

      {/* Scrollable file list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {diffs.map((file, i) => (
          <FileDiffView key={`${file.path}-${i}`} file={file} />
        ))}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
