import { create } from 'zustand';

export interface FeatureFlags {
  outputBatching: boolean;       // Phase 1
  autoTrust: boolean;            // Phase 2
  planWatcher: boolean;          // Phase 3
  diffViewer: boolean;           // Phase 4
  terminalBookmarks: boolean;    // Phase 5
  promptHistory: boolean;        // Phase 6
  exitNotifications: boolean;    // Phase 7
  keyboardNavigation: boolean;   // Phase 8
  inactivePaneDimming: boolean;  // Phase 9
  enhancedPersistence: boolean;  // Phase 10
  annotationOverlay: boolean;    // Phase 11
  themePresets: boolean;         // Phase 12
  ctrlWheelZoom: boolean;        // Phase 13
  diffSearch: boolean;           // Phase 14
  diffSyntaxHighlight: boolean;  // Phase 15
  askAboutCode: boolean;         // Phase 16
  completionStats: boolean;      // Phase 17
  focusTrap: boolean;            // Phase 18
  githubUrlDetection: boolean;   // Phase 19
  inlineEditing: boolean;        // Phase 20
  errorBoundaries: boolean;      // Phase 21
  guidedWalkthrough: boolean;    // Phase 6 (Annotation) — Guided walkthrough panel
  terminalWriteMcp: boolean;     // Agent Runtime Phase 1 — Terminal write MCP tool
  conditionalAdvance: boolean;   // Agent Runtime Phase 2 — Conditional walkthrough advancement
  multiPty: boolean;             // Agent Runtime Phase 3 — Multi-PTY pane multiplexing
  uiAccessibility: boolean;      // Agent Runtime Phase 4 — UI Accessibility Tree Discovery
  osInputSimulation: boolean;    // Agent Runtime Phase 5 — OS-Level Input Simulation
  consentGate: boolean;           // Agent Runtime Phase 6 — Consent Gate & Action Verification
}

const STORAGE_KEY = 'chat-overlay-feature-flags';

function loadFlags(): Partial<FeatureFlags> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const defaults: FeatureFlags = {
  outputBatching: true,
  autoTrust: false,           // OFF by default — safety-critical
  planWatcher: true,
  diffViewer: true,
  terminalBookmarks: true,
  promptHistory: true,
  exitNotifications: true,
  keyboardNavigation: true,
  inactivePaneDimming: false, // OFF by default — visual preference
  enhancedPersistence: true,
  annotationOverlay: false,  // OFF by default — feature incomplete
  themePresets: true,
  ctrlWheelZoom: true,
  diffSearch: true,
  diffSyntaxHighlight: true,
  askAboutCode: true,
  completionStats: true,
  focusTrap: true,
  githubUrlDetection: true,
  inlineEditing: true,
  errorBoundaries: true,
  guidedWalkthrough: false,  // OFF by default
  terminalWriteMcp: false,   // OFF by default — agent runtime
  conditionalAdvance: false, // OFF by default — agent runtime
  multiPty: false,           // OFF by default — agent runtime
  uiAccessibility: false,    // OFF by default — agent runtime
  osInputSimulation: false,  // OFF by default — agent runtime
  consentGate: false,         // OFF by default — agent runtime
};

interface FeatureFlagStore extends FeatureFlags {
  setFlag: (key: keyof FeatureFlags, value: boolean) => void;
  resetAll: () => void;
}

export const useFeatureFlagStore = create<FeatureFlagStore>((set) => ({
  ...defaults,
  ...loadFlags(),

  setFlag: (key, value) =>
    set((state) => {
      const next = { ...state, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        outputBatching: next.outputBatching,
        autoTrust: next.autoTrust,
        planWatcher: next.planWatcher,
        diffViewer: next.diffViewer,
        terminalBookmarks: next.terminalBookmarks,
        promptHistory: next.promptHistory,
        exitNotifications: next.exitNotifications,
        keyboardNavigation: next.keyboardNavigation,
        inactivePaneDimming: next.inactivePaneDimming,
        enhancedPersistence: next.enhancedPersistence,
        annotationOverlay: next.annotationOverlay,
        themePresets: next.themePresets,
        ctrlWheelZoom: next.ctrlWheelZoom,
        diffSearch: next.diffSearch,
        diffSyntaxHighlight: next.diffSyntaxHighlight,
        askAboutCode: next.askAboutCode,
        completionStats: next.completionStats,
        focusTrap: next.focusTrap,
        githubUrlDetection: next.githubUrlDetection,
        inlineEditing: next.inlineEditing,
        errorBoundaries: next.errorBoundaries,
        guidedWalkthrough: next.guidedWalkthrough,
        terminalWriteMcp: next.terminalWriteMcp,
        conditionalAdvance: next.conditionalAdvance,
        multiPty: next.multiPty,
        uiAccessibility: next.uiAccessibility,
        osInputSimulation: next.osInputSimulation,
        consentGate: next.consentGate,
      }));
      return { [key]: value };
    }),

  resetAll: () =>
    set(() => {
      localStorage.removeItem(STORAGE_KEY);
      return { ...defaults };
    }),
}));
