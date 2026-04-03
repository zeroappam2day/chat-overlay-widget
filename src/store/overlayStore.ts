import { create } from 'zustand';
import { WebviewWindow } from '@tauri-apps/api/window';
import { useFeatureFlagStore } from './featureFlagStore';

interface OverlayState {
  isVisible: boolean;
  toggleOverlay: () => Promise<void>;
  hideOverlay: () => Promise<void>;
  showOverlay: () => Promise<void>;
}

export const useOverlayStore = create<OverlayState>((_set, get) => ({
  isVisible: false,

  toggleOverlay: async () => {
    if (!useFeatureFlagStore.getState().annotationOverlay) return;
    const overlay = WebviewWindow.getByLabel('annotation-overlay');
    if (overlay) {
      const visible = await overlay.isVisible();
      if (visible) {
        await get().hideOverlay();
      } else {
        await get().showOverlay();
      }
    }
  },

  hideOverlay: async () => {
    const overlay = WebviewWindow.getByLabel('annotation-overlay');
    if (overlay) {
      await overlay.hide();
    }
  },

  showOverlay: async () => {
    const overlay = WebviewWindow.getByLabel('annotation-overlay');
    if (overlay) {
      await overlay.show();
      // Ensure click-through is enabled by default for the "ghost" overlay
      await overlay.setIgnoreCursorEvents(true);
    }
  },
}));
