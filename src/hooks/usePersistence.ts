import { useEffect, useRef } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { usePaneStore } from '../store/paneStore';
import { useBookmarkStore } from '../store/bookmarkStore';
import { usePromptHistoryStore } from '../store/promptHistoryStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import type { PersistedState, WindowState } from '../lib/persistence';
import { loadState, debouncedSave, flushSave } from '../lib/persistence';

function gatherState(windowState: WindowState | null): PersistedState {
  const pane = usePaneStore.getState();
  const bookmarks = useBookmarkStore.getState().bookmarks;
  const history = usePromptHistoryStore.getState();
  const flags = useFeatureFlagStore.getState();

  return {
    version: 1,
    layout: pane.layout,
    activePaneId: pane.activePaneId,
    bookmarks,
    notes: history.notes,
    promptHistory: history.entries,
    featureFlags: {
      outputBatching: flags.outputBatching,
      autoTrust: flags.autoTrust,
      planWatcher: flags.planWatcher,
      diffViewer: flags.diffViewer,
      terminalBookmarks: flags.terminalBookmarks,
      promptHistory: flags.promptHistory,
      exitNotifications: flags.exitNotifications,
      keyboardNavigation: flags.keyboardNavigation,
      inactivePaneDimming: flags.inactivePaneDimming,
      enhancedPersistence: flags.enhancedPersistence,
      annotationOverlay: flags.annotationOverlay,
      themePresets: flags.themePresets,
      ctrlWheelZoom: flags.ctrlWheelZoom,
      diffSearch: flags.diffSearch,
      diffSyntaxHighlight: flags.diffSyntaxHighlight,
      askAboutCode: flags.askAboutCode,
      completionStats: flags.completionStats,
      focusTrap: flags.focusTrap,
    },
    windowState,
  };
}

async function getWindowState(): Promise<WindowState | null> {
  try {
    const factor = await appWindow.scaleFactor();
    const size = await appWindow.innerSize();
    const pos = await appWindow.outerPosition();
    const maximized = await appWindow.isMaximized();
    return {
      width: Math.round(size.width / factor),
      height: Math.round(size.height / factor),
      x: pos.x,
      y: pos.y,
      maximized,
    };
  } catch {
    return null;
  }
}

async function restoreWindowState(ws: WindowState): Promise<void> {
  try {
    if (ws.maximized) {
      await appWindow.maximize();
    } else {
      await appWindow.setSize({ type: 'Logical', width: ws.width, height: ws.height });
      await appWindow.setPosition({ type: 'Logical', x: ws.x, y: ws.y });
    }
  } catch {
    // Window restore failure is non-fatal
  }
}

export function usePersistence() {
  const enabled = useFeatureFlagStore((s) => s.enhancedPersistence);
  const windowStateRef = useRef<WindowState | null>(null);
  const restoredRef = useRef(false);

  // Restore state on mount (once)
  useEffect(() => {
    if (!enabled || restoredRef.current) return;
    restoredRef.current = true;

    loadState().then((state) => {
      if (!state) return;

      // Restore layout
      usePaneStore.setState({
        layout: state.layout,
        activePaneId: state.activePaneId,
      });

      // Restore bookmarks (replace localStorage-loaded defaults)
      useBookmarkStore.setState({ bookmarks: state.bookmarks });

      // Restore prompt history + notes
      usePromptHistoryStore.setState({
        entries: state.promptHistory,
        notes: state.notes,
      });

      // Restore feature flags
      const { setFlag } = useFeatureFlagStore.getState();
      const ff = state.featureFlags;
      (Object.keys(ff) as (keyof typeof ff)[]).forEach((key) => {
        setFlag(key, ff[key]);
      });

      // Restore window geometry
      if (state.windowState) {
        restoreWindowState(state.windowState);
      }
    }).catch(() => {});
  }, [enabled]);

  // Subscribe to store changes and autosave
  useEffect(() => {
    if (!enabled) return;

    const unsubs = [
      usePaneStore.subscribe(() => {
        getWindowState().then((ws) => {
          windowStateRef.current = ws;
          debouncedSave(gatherState(ws));
        });
      }),
      useBookmarkStore.subscribe(() => {
        debouncedSave(gatherState(windowStateRef.current));
      }),
      usePromptHistoryStore.subscribe(() => {
        debouncedSave(gatherState(windowStateRef.current));
      }),
      useFeatureFlagStore.subscribe(() => {
        debouncedSave(gatherState(windowStateRef.current));
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [enabled]);

  // Flush on unmount / window close
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      getWindowState().then((ws) => {
        flushSave(gatherState(ws));
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Flush on React unmount
      getWindowState().then((ws) => {
        flushSave(gatherState(ws));
      });
    };
  }, [enabled]);
}
