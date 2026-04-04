import { create } from 'zustand';
import { emit } from '@tauri-apps/api/event';
import { useFeatureFlagStore } from './featureFlagStore';
import type { Annotation } from '../protocol';

interface AnnotationBridgeState {
  annotations: Annotation[];
  /** Called by TerminalPane when a WebSocket 'annotation-update' message arrives. */
  setAnnotations: (annotations: Annotation[]) => void;
}

export const useAnnotationBridgeStore = create<AnnotationBridgeState>((set) => ({
  annotations: [],
  setAnnotations: (annotations) => {
    // Gate: only process if feature flag is on
    if (!useFeatureFlagStore.getState().annotationOverlay) return;
    set({ annotations });
    // Emit to the overlay window via Tauri's cross-window IPC
    emit('update-annotations', annotations).catch((err) => {
      console.warn('[annotation-bridge] Failed to emit to overlay:', err);
    });
  },
}));
