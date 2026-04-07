import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFeatureFlagStore, type FeatureFlags } from '../store/featureFlagStore';
import { PlanPanel } from './PlanPanel';
import { ThemeSelector } from './ThemeSelector';
import { CompletionBadge } from './CompletionBadge';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Tooltip } from './Tooltip';

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
  webFetchTool: 'Web Fetch Tool',
  batchConsent: 'Batch Consent',
  windowFocusManager: 'Window Focus Manager',
  clipboardAccess: 'Clipboard Access',
  agentTaskOrchestrator: 'Agent Task Orchestrator',
  screenshotVerification: 'Screenshot Verification',
  enhancedAccessibility: 'Enhanced Accessibility',
  workflowRecording: 'Workflow Recording',
  externalWindowCapture: 'External Window Capture',
  skillDiscovery: 'Skill Discovery',
  multiPty: 'Multi-PTY Panes',
  consentGate: 'Consent Gate',
};

const FLAG_CATEGORIES: { label: string; keys: (keyof FeatureFlags)[] }[] = [
  {
    label: 'Core',
    keys: ['outputBatching', 'autoTrust', 'planWatcher', 'exitNotifications', 'enhancedPersistence', 'errorBoundaries'],
  },
  {
    label: 'Terminal & Input',
    keys: ['terminalBookmarks', 'promptHistory', 'multiPty', 'keyboardNavigation', 'focusTrap', 'ctrlWheelZoom', 'inactivePaneDimming'],
  },
  {
    label: 'Diff & Code',
    keys: ['diffViewer', 'diffSearch', 'diffSyntaxHighlight', 'askAboutCode', 'inlineEditing', 'githubUrlDetection'],
  },
  {
    label: 'Agent & Automation',
    keys: ['agentTaskOrchestrator', 'guidedWalkthrough', 'conditionalAdvance', 'skillDiscovery', 'workflowRecording', 'batchConsent', 'consentGate'],
  },
  {
    label: 'Window & Capture',
    keys: ['annotationOverlay', 'externalWindowCapture', 'windowFocusManager', 'screenshotVerification', 'clipboardAccess'],
  },
  {
    label: 'Appearance',
    keys: ['themePresets', 'completionStats', 'enhancedAccessibility', 'terminalWriteMcp', 'webFetchTool'],
  },
];

export function FeatureFlagPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const store = useFeatureFlagStore();
  const focusTrapRef = useFocusTrap(open);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const panel = open ? createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999] animate-fade-in"
        onClick={() => setOpen(false)}
      />
      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-[320px] glass-panel border-l border-[#30363d]/80 z-[1000] flex flex-col shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.6)] animate-slide-in-right"
      >
        <div ref={focusTrapRef} className="flex flex-col h-full">
          {/* Frosted header */}
          <div className="h-12 px-4 border-b border-[#30363d]/50 bg-white/[0.02] backdrop-blur-md flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="#8b949e">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z" fillOpacity="0.4" />
              </svg>
              <span className="text-xs font-semibold text-[#e6edf3] tracking-wide">Settings</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-[#8b949e] hover:text-white transition-colors rounded hover:bg-[#21262d]"
              aria-label="Close settings"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          {/* Flag list - categorized */}
          <div className="flex-1 overflow-y-auto py-2">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[10px] font-semibold text-[#8b949e] uppercase tracking-wider">Feature Flags</span>
              <button
                onClick={() => store.resetAll()}
                className="text-[10px] text-[#8b949e] hover:text-[#f85149] transition-colors"
              >
                Reset All
              </button>
            </div>
            {FLAG_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[9px] font-bold text-[#58a6ff]/70 uppercase tracking-widest">{cat.label}</span>
                </div>
                {cat.keys.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-4 py-1.5 hover:bg-white/[0.03] cursor-pointer transition-colors"
                    onClick={() => store.setFlag(key, !store[key])}
                  >
                    <span className="text-[11px] text-[#e6edf3]/80">{FLAG_LABELS[key]}</span>
                    <div
                      className="relative w-8 h-[18px] rounded-full transition-colors duration-200"
                      style={{ backgroundColor: store[key] ? '#58a6ff' : '#30363d' }}
                    >
                      <div
                        className="absolute top-[3px] w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm"
                        style={{ transform: store[key] ? 'translateX(16px)' : 'translateX(3px)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <ThemeSelector />
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <>
      <CompletionBadge />
      <PlanPanel />
      <Tooltip text="Settings & Feature Flags">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`p-1.5 rounded transition-all ${
            open
              ? 'text-[#58a6ff] bg-[#58a6ff]/10'
              : 'text-[#8b949e] hover:text-white hover:bg-[#21262d]'
          }`}
          aria-label="Feature flags"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z" fillOpacity="0.4" />
          </svg>
        </button>
      </Tooltip>
      {panel}
    </>
  );
}
