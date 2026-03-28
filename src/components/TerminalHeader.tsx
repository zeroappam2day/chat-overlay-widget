interface TerminalHeaderProps {
  connectionState: string;
  currentShell: string | null;
  shells: string[];
  onShellChange: (shell: string) => void;
  onToggleSidebar: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onClose: () => void;
  canSplit: boolean;
  canClose: boolean;
}

export function TerminalHeader({
  connectionState,
  currentShell,
  shells,
  onShellChange,
  onToggleSidebar,
  onSplitHorizontal,
  onSplitVertical,
  onClose,
  canSplit,
  canClose,
}: TerminalHeaderProps) {
  return (
    <div className="flex items-center justify-between h-10 px-3 bg-[#2d2d2d] border-b border-[#404040] text-sm text-gray-300 shrink-0">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            connectionState === 'connected' ? 'bg-green-400' :
            connectionState === 'error' ? 'bg-red-400' : 'bg-yellow-400'
          }`}
        />
        <span className="text-xs text-gray-500">
          {currentShell ?? 'No shell'}
        </span>
        {shells.length > 1 && (
          <select
            value={currentShell ?? ''}
            onChange={(e) => onShellChange(e.target.value)}
            className="ml-3 bg-[#3c3c3c] text-gray-300 text-xs border border-[#555] rounded px-2 py-1 outline-none cursor-pointer hover:bg-[#4c4c4c]"
          >
            {shells.map((shell) => (
              <option key={shell} value={shell}>
                {shell}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Split horizontal button (per D-10) */}
        <button
          onClick={onSplitHorizontal}
          disabled={!canSplit}
          className="text-gray-400 hover:text-gray-200 px-1 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Split horizontal"
          aria-label="Split pane horizontally"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <rect x="0" y="1" width="7" height="14" rx="1" fillOpacity="0.6" />
            <rect x="9" y="1" width="7" height="14" rx="1" fillOpacity="0.6" />
          </svg>
        </button>

        {/* Split vertical button (per D-10) */}
        <button
          onClick={onSplitVertical}
          disabled={!canSplit}
          className="text-gray-400 hover:text-gray-200 px-1 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Split vertical"
          aria-label="Split pane vertically"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="0" width="14" height="7" rx="1" fillOpacity="0.6" />
            <rect x="1" y="9" width="14" height="7" rx="1" fillOpacity="0.6" />
          </svg>
        </button>

        {/* Close pane button (per D-11) — hidden when only one pane */}
        {canClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-400 px-1"
            title="Close pane"
            aria-label="Close pane"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        )}

        {/* Sidebar toggle button */}
        <button
          onClick={onToggleSidebar}
          className="text-gray-400 hover:text-gray-200 px-2"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect y="2" width="16" height="2" rx="1" />
            <rect y="7" width="16" height="2" rx="1" />
            <rect y="12" width="16" height="2" rx="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
