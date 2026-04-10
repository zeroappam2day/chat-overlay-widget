import { useFocusTrap } from '../hooks/useFocusTrap';
import { SHORTCUT_GROUPS } from '../lib/shortcutData';

interface ShortcutHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelpOverlay({ isOpen, onClose }: ShortcutHelpOverlayProps) {
  const containerRef = useFocusTrap(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="relative bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#e6edf3] text-base font-semibold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1 text-[#8b949e] hover:text-[#f85149] rounded hover:bg-[#f85149]/10 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Shortcut groups */}
        {SHORTCUT_GROUPS.map((group, groupIndex) => (
          <div key={group.title}>
            <h3
              className={`text-[#8b949e] text-xs uppercase tracking-wider font-semibold mb-2 ${
                groupIndex === 0 ? 'mt-0' : 'mt-4'
              }`}
            >
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.shortcuts.map((entry, entryIndex) => (
                <div key={`${groupIndex}-${entryIndex}`} className="flex items-center justify-between py-0.5">
                  <span className="text-[#e6edf3] text-sm">{entry.label}</span>
                  <kbd className="bg-[#21262d] border border-[#30363d] rounded px-2 py-0.5 text-xs text-[#8b949e] font-mono">
                    {entry.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer hint */}
        <p className="mt-5 text-[#484f58] text-xs text-center">
          Press <kbd className="bg-[#21262d] border border-[#30363d] rounded px-1.5 py-0.5 text-xs font-mono">Ctrl + /</kbd> to toggle
        </p>
      </div>
    </div>
  );
}
