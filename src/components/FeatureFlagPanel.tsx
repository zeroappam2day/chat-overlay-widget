import { useState, useRef, useEffect } from 'react';
import { useFeatureFlagStore, type FeatureFlags } from '../store/featureFlagStore';
import { PlanPanel } from './PlanPanel';
import { ThemeSelector } from './ThemeSelector';
import { CompletionBadge } from './CompletionBadge';
import { useFocusTrap } from '../hooks/useFocusTrap';

const FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  outputBatching: 'Output Batching',
  autoTrust: 'Auto Trust',
  planWatcher: 'Plan Watcher',
  diffViewer: 'Diff Viewer',
  terminalBookmarks: 'Terminal Bookmarks',
  promptHistory: 'Prompt History',
  exitNotifications: 'Exit Notifications',
  keyboardNavigation: 'Keyboard Navigation',
  inactivePaneDimming: 'Inactive Pane Dimming',
  enhancedPersistence: 'Enhanced Persistence',
  annotationOverlay: 'Annotation Overlay',
  themePresets: 'Theme Presets',
  ctrlWheelZoom: 'Ctrl+Wheel Zoom',
  diffSearch: 'Diff Search',
  diffSyntaxHighlight: 'Diff Syntax Highlighting',
  askAboutCode: 'Ask About Code',
  completionStats: 'Completion Stats',
  focusTrap: 'Focus Trap',
  githubUrlDetection: 'GitHub URL Detection',
  inlineEditing: 'Inline Editing',
  errorBoundaries: 'Error Boundaries',
  guidedWalkthrough: 'Guided Walkthrough Panel',
  terminalWriteMcp: 'Terminal Write (MCP)',
  conditionalAdvance: 'Conditional Walkthrough Advance',
  clipboardAccess: 'Clipboard Access',
};

const FLAG_KEYS = Object.keys(FLAG_LABELS) as (keyof FeatureFlags)[];

export function FeatureFlagPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const store = useFeatureFlagStore();
  const focusTrapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <CompletionBadge />
      <PlanPanel />
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-1.5 py-0.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
        title="Feature flags"
        aria-label="Feature flags"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a1.5 1.5 0 0 0-1.5 1.5c0 .33.11.64.3.89L6.12 3.5A5.49 5.49 0 0 0 2.5 7.86l1.12.68c.17-.28.46-.54.88-.54s.71.26.88.54l1.12-.68A3.49 3.49 0 0 1 8 4.5a3.49 3.49 0 0 1 1.5 3.36l1.12.68c.17-.28.46-.54.88-.54s.71.26.88.54l1.12-.68A5.49 5.49 0 0 0 9.88 3.5L9.2 2.39c.19-.25.3-.56.3-.89A1.5 1.5 0 0 0 8 0zM5.5 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8 12a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
        </svg>
      </button>

      {open && (
        <div ref={focusTrapRef} className="absolute right-0 top-full mt-1 w-64 max-h-80 overflow-y-auto bg-[#2d2d2d] border border-[#404040] rounded shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#404040]">
            <span className="text-xs font-medium text-gray-300">Feature Flags</span>
            <button
              onClick={() => store.resetAll()}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Reset All
            </button>
          </div>
          <div className="py-1">
            {FLAG_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-[#333] cursor-pointer"
                onClick={() => store.setFlag(key, !store[key])}
              >
                <span className="text-xs text-gray-400">{FLAG_LABELS[key]}</span>
                <div
                  className="relative w-7 h-4 rounded-full transition-colors duration-150"
                  style={{ backgroundColor: store[key] ? '#007acc' : '#555' }}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-150"
                    style={{ transform: store[key] ? 'translateX(14px)' : 'translateX(2px)' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <ThemeSelector />
        </div>
      )}
    </div>
  );
}
