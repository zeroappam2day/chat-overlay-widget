import { useFeatureFlagStore } from '../store/featureFlagStore';

interface TerminalHeaderProps {
  connectionState: string;
  currentShell: string | null;
  shells: string[];
  onShellChange: (shell: string) => void;
  onToggleSidebar: () => void;
  onTogglePicker: () => void;
  onRequestDiff?: () => void;
  onToggleHistory?: () => void;
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
  onTogglePicker,
  onRequestDiff,
  onSplitHorizontal,
  onSplitVertical,
  onClose,
  onToggleHistory,
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
        {/* Window picker button */}
        <button
          onClick={onTogglePicker}
          className="text-gray-400 hover:text-gray-200 px-1"
          title="Window picker"
          aria-label="Open window picker"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>

        {/* Git diff button (Phase 4) — hidden when diffViewer flag is OFF */}
        {useFeatureFlagStore.getState().diffViewer && onRequestDiff && (
          <button
            onClick={onRequestDiff}
            className="text-gray-400 hover:text-gray-200 px-1"
            title="Show git diff"
            aria-label="Show git diff"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h5v1H2V3zm0 3h5v1H2V6zm7-3h5v1H9V3zm0 3h5v1H9V6zM2 9h12v1H2V9zm0 3h12v1H2v-1z" fillOpacity="0.7" />
              <rect x="0" y="2" width="1" height="4" fill="#4ec9b0" />
              <rect x="7" y="2" width="1" height="4" fill="#f14c4c" />
            </svg>
          </button>
        )}

        {/* Prompt history button (Phase 6) — hidden when promptHistory flag is OFF */}
        {useFeatureFlagStore.getState().promptHistory && onToggleHistory && (
          <button
            onClick={onToggleHistory}
            className="text-gray-400 hover:text-gray-200 px-1"
            title="Prompt history (Ctrl+H)"
            aria-label="Toggle prompt history"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.2A5.8 5.8 0 1 1 2.2 8 5.8 5.8 0 0 1 8 2.2zM7.5 4v4.5l3.5 2.1.5-.85L8.5 8V4h-1z" />
            </svg>
          </button>
        )}

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
