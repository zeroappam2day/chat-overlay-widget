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
      }));
      return { [key]: value };
    }),

  resetAll: () =>
    set(() => {
      localStorage.removeItem(STORAGE_KEY);
      return { ...defaults };
    }),
}));
