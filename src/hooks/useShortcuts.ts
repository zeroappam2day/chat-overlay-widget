/**
 * React hook that registers default keyboard shortcuts on mount.
 * Phase 8: Keyboard Navigation System.
 *
 * Reads the `keyboardNavigation` feature flag — if OFF, registers nothing.
 * Call once in PaneContainer (top-level layout component).
 */

import { useEffect } from 'react';
import { registerShortcut, initShortcutListener } from '../lib/shortcuts';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { usePaneStore, getAllPaneIds } from '../store/paneStore';
import { usePlanStore } from '../store/planStore';

export function useShortcuts(): void {
  const enabled = useFeatureFlagStore((s) => s.keyboardNavigation);

  useEffect(() => {
    if (!enabled) return;

    const cleanupListener = initShortcutListener();
    const unregisters: Array<() => void> = [];

    // --- Pane navigation ---

    // Alt+Left: focus previous pane
    unregisters.push(
      registerShortcut({
        key: 'ArrowLeft',
        alt: true,
        global: true,
        handler: () => {
          const { layout, activePaneId } = usePaneStore.getState();
          const ids = getAllPaneIds(layout);
          if (ids.length <= 1) return;
          const idx = ids.indexOf(activePaneId);
          const prev = idx <= 0 ? ids.length - 1 : idx - 1;
          usePaneStore.getState().setActivePane(ids[prev]);
        },
      }),
    );

    // Alt+Right: focus next pane
    unregisters.push(
      registerShortcut({
        key: 'ArrowRight',
        alt: true,
        global: true,
        handler: () => {
          const { layout, activePaneId } = usePaneStore.getState();
          const ids = getAllPaneIds(layout);
          if (ids.length <= 1) return;
          const idx = ids.indexOf(activePaneId);
          const next = idx >= ids.length - 1 ? 0 : idx + 1;
          usePaneStore.getState().setActivePane(ids[next]);
        },
      }),
    );

    // Alt+1 through Alt+4: focus pane by index
    for (let i = 1; i <= 4; i++) {
      unregisters.push(
        registerShortcut({
          key: String(i),
          alt: true,
          global: true,
          handler: () => {
            const ids = getAllPaneIds(usePaneStore.getState().layout);
            if (i <= ids.length) {
              usePaneStore.getState().setActivePane(ids[i - 1]);
            }
          },
        }),
      );
    }

    // --- Feature toggles ---

    // Ctrl+Shift+D: request diff (Phase 4)
    unregisters.push(
      registerShortcut({
        key: 'D',
        ctrl: true,
        shift: true,
        handler: () => {
          if (useFeatureFlagStore.getState().diffViewer) {
            document.dispatchEvent(new Event('keyboard-request-diff'));
          }
        },
      }),
    );

    // Ctrl+H: toggle prompt history (Phase 6)
    unregisters.push(
      registerShortcut({
        key: 'h',
        ctrl: true,
        handler: () => {
          if (useFeatureFlagStore.getState().promptHistory) {
            document.dispatchEvent(new Event('toggle-prompt-history'));
          }
        },
      }),
    );

    // Ctrl+B: toggle bookmarks visibility
    unregisters.push(
      registerShortcut({
        key: 'b',
        ctrl: true,
        handler: () => {
          if (useFeatureFlagStore.getState().terminalBookmarks) {
            document.dispatchEvent(new Event('toggle-bookmark-bar'));
          }
        },
      }),
    );

    // Ctrl+P: toggle plan panel (Phase 3)
    unregisters.push(
      registerShortcut({
        key: 'p',
        ctrl: true,
        handler: () => {
          if (useFeatureFlagStore.getState().planWatcher) {
            usePlanStore.getState().toggleVisible();
          }
        },
      }),
    );

    return () => {
      unregisters.forEach((fn) => fn());
      cleanupListener();
    };
  }, [enabled]);
}
