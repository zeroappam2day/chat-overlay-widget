import { create } from 'zustand';
import type { ClientMessage } from '../protocol';
import { useFeatureFlagStore } from './featureFlagStore';
import type { FeatureFlags } from './featureFlagStore';

interface ModeState {
  activeMode: null | 'walkMeThrough' | 'workWithMe';
  activatedAt: number | null;
  flagSnapshot: Record<string, boolean> | null;
}

interface ModeStore extends ModeState {
  _sendMessage: ((msg: ClientMessage) => void) | null;
  setSendMessage: (fn: ((msg: ClientMessage) => void) | null) => void;
  activate: (mode: 'walkMeThrough' | 'workWithMe') => void;
  deactivate: () => void;
  handleModeStatus: (status: { active: boolean; modeId?: string; activatedAt?: number }) => void;
  handleCrashRecovery: () => void;
}

export const useModeStore = create<ModeStore>((set, get) => ({
  activeMode: null,
  activatedAt: null,
  flagSnapshot: null,
  _sendMessage: null,

  setSendMessage: (fn) => set({ _sendMessage: fn }),

  activate: (mode) => {
    const { _sendMessage, activeMode } = get();
    if (activeMode !== null) {
      console.warn(`[modeStore] cannot activate ${mode} — ${activeMode} already active`);
      return;
    }
    if (!_sendMessage) {
      console.warn('[modeStore] cannot activate — no WebSocket connection');
      return;
    }

    // 1. Snapshot current frontend flags
    const flagState = useFeatureFlagStore.getState();
    const flagKeys = Object.keys(flagState).filter(
      (k) => typeof (flagState as unknown as Record<string, unknown>)[k] === 'boolean'
    ) as Array<keyof FeatureFlags>;
    const snapshot: Record<string, boolean> = {};
    for (const key of flagKeys) {
      snapshot[key] = flagState[key];
    }

    // 2. Save snapshot and optimistically set mode
    set({ activeMode: mode, activatedAt: Date.now(), flagSnapshot: snapshot });

    // 3. Send to sidecar — sidecar is authoritative for flag changes
    _sendMessage({ type: 'mode-activate', modeId: mode });
  },

  deactivate: () => {
    const { _sendMessage, activeMode, flagSnapshot } = get();
    if (activeMode === null) {
      console.warn('[modeStore] no active mode to deactivate');
      return;
    }
    if (!_sendMessage) {
      console.warn('[modeStore] cannot deactivate — no WebSocket connection');
      return;
    }

    // 1. Send deactivation to sidecar
    _sendMessage({ type: 'mode-deactivate' });

    // 2. Restore frontend flag snapshot if available
    if (flagSnapshot) {
      useFeatureFlagStore.getState().restoreSnapshot();
    }

    // 3. Reset local state
    set({ activeMode: null, activatedAt: null, flagSnapshot: null });
  },

  handleModeStatus: (status) => {
    if (status.active) {
      set({
        activeMode: (status.modeId as 'walkMeThrough' | 'workWithMe') ?? null,
        activatedAt: status.activatedAt ?? null,
      });
    } else {
      // Sidecar says no mode active — if we thought one was, reset
      const { activeMode, flagSnapshot } = get();
      if (activeMode !== null) {
        if (flagSnapshot) {
          useFeatureFlagStore.getState().restoreSnapshot();
        }
        set({ activeMode: null, activatedAt: null, flagSnapshot: null });
      }
    }
  },

  handleCrashRecovery: () => {
    // Sidecar already restored flags from crash marker — just reset local state
    set({ activeMode: null, activatedAt: null, flagSnapshot: null });
  },
}));
