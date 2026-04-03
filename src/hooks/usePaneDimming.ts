import { useEffect } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { usePaneStore } from '../store/paneStore';

/**
 * Applies CSS opacity dimming to inactive panes.
 * Reads `inactivePaneDimming` flag and `activePaneId` from stores.
 *
 * When enabled: active pane gets `.pane-active` (opacity 1),
 * all others get `.pane-inactive` (opacity 0.6 via CSS custom property).
 * When disabled: all panes get `.pane-active` (full opacity).
 *
 * Call once in PaneContainer — it manages classes on `.pane-wrapper` elements.
 */
export function usePaneDimming() {
  const enabled = useFeatureFlagStore((s) => s.inactivePaneDimming);
  const activePaneId = usePaneStore((s) => s.activePaneId);

  useEffect(() => {
    const wrappers = document.querySelectorAll<HTMLElement>('.pane-wrapper');
    wrappers.forEach((el) => {
      const paneId = el.dataset.paneId;
      if (!enabled) {
        // Flag OFF: all panes full opacity
        el.classList.remove('pane-inactive');
        el.classList.add('pane-active');
      } else if (paneId === activePaneId) {
        el.classList.remove('pane-inactive');
        el.classList.add('pane-active');
      } else {
        el.classList.remove('pane-active');
        el.classList.add('pane-inactive');
      }
    });
  }, [enabled, activePaneId]);
}
