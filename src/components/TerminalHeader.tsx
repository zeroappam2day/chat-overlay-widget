import { useFeatureFlagStore } from '../store/featureFlagStore';
import { Tooltip } from './Tooltip';

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
    <div className="flex items-center justify-between h-8 px-3 bg-[#0d1117]/80 backdrop-blur border-b border-[#30363d]/50 text-xs shrink-0">
      <div className="flex items-center gap-2">
        {/* Connection status dot with glow */}
        <Tooltip text={connectionState === 'connected' ? 'Connected' : connectionState === 'error' ? 'Connection error' : 'Connecting...'}>
          <div className="relative">
            <div
              className={`h-2 w-2 rounded-full ${
                connectionState === 'connected' ? 'bg-[#3fb950]' :
                connectionState === 'error' ? 'bg-[#f85149]' : 'bg-[#d29922]'
              }`}
            />
            {connectionState === 'connected' && (
              <div className="absolute inset-0 h-2 w-2 rounded-full bg-[#3fb950] animate-ping opacity-40" />
            )}
          </div>
        </Tooltip>
        <span className="text-[11px] text-[#8b949e] font-mono">
          {currentShell ?? 'No shell'}
        </span>
        {shells.length > 1 && (
          <select
            value={currentShell ?? ''}
            onChange={(e) => onShellChange(e.target.value)}
            className="bg-[#21262d] text-[#e6edf3] text-[11px] border border-[#30363d] rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-[#58a6ff]/50 transition-colors"
          >
            {shells.map((shell) => (
              <option key={shell} value={shell}>
                {shell}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {/* Window picker */}
        <Tooltip text="Window picker">
          <button
            onClick={onTogglePicker}
            className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-all"
            aria-label="Open window picker"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </button>
        </Tooltip>

        {/* Git diff */}
        {useFeatureFlagStore.getState().diffViewer && onRequestDiff && (
          <Tooltip text="Show git diff (Ctrl+Shift+D)">
            <button
              onClick={onRequestDiff}
              className="p-1.5 rounded text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-all"
              aria-label="Show git diff"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 3h5v1H2V3zm0 3h5v1H2V6zm7-3h5v1H9V3zm0 3h5v1H9V6zM2 9h12v1H2V9zm0 3h12v1H2v-1z" fillOpacity="0.7" />
                <rect x="0" y="2" width="1" height="4" fill="#3fb950" />
                <rect x="7" y="2" width="1" height="4" fill="#f85149" />
              </svg>
            </button>
          </Tooltip>
        )}

        {/* Prompt history */}
        {useFeatureFlagStore.getState().promptHistory && onToggleHistory && (
          <Tooltip text="Prompt history (Ctrl+H)">
            <button
              onClick={onToggleHistory}
              className="p-1.5 rounded text-[#8b949e] hover:text-[#d2a8ff] hover:bg-[#d2a8ff]/10 transition-all"
              aria-label="Toggle prompt history"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.2A5.8 5.8 0 1 1 2.2 8 5.8 5.8 0 0 1 8 2.2zM7.5 4v4.5l3.5 2.1.5-.85L8.5 8V4h-1z" />
              </svg>
            </button>
          </Tooltip>
        )}

        <div className="w-px h-3 bg-[#30363d] mx-0.5" />

        {/* Split horizontal */}
        <Tooltip text="Split horizontal (Ctrl+Shift+H)">
          <button
            onClick={onSplitHorizontal}
            disabled={!canSplit}
            className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-all disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#8b949e]"
            aria-label="Split pane horizontally"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <rect x="0" y="1" width="7" height="14" rx="1" fillOpacity="0.6" />
              <rect x="9" y="1" width="7" height="14" rx="1" fillOpacity="0.6" />
            </svg>
          </button>
        </Tooltip>

        {/* Split vertical */}
        <Tooltip text="Split vertical (Ctrl+Shift+V)">
          <button
            onClick={onSplitVertical}
            disabled={!canSplit}
            className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-all disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#8b949e]"
            aria-label="Split pane vertically"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="0" width="14" height="7" rx="1" fillOpacity="0.6" />
              <rect x="1" y="9" width="14" height="7" rx="1" fillOpacity="0.6" />
            </svg>
          </button>
        </Tooltip>

        {/* Close pane */}
        {canClose && (
          <Tooltip text="Close pane (Ctrl+Shift+W)">
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-all"
              aria-label="Close pane"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
          </Tooltip>
        )}

        <div className="w-px h-3 bg-[#30363d] mx-0.5" />

        {/* Sidebar toggle */}
        <Tooltip text="Session history">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-all"
            aria-label="Toggle session history"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect y="2" width="16" height="2" rx="1" />
              <rect y="7" width="16" height="2" rx="1" />
              <rect y="12" width="16" height="2" rx="1" />
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
