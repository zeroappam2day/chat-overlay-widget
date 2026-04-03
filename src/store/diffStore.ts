import { create } from 'zustand';
import type { FileDiff } from '../lib/diffParser';

interface DiffStore {
  diffs: FileDiff[];
  rawDiff: string | null;
  visible: boolean;
  setDiffs: (diffs: FileDiff[], raw: string) => void;
  toggleVisible: () => void;
  setVisible: (v: boolean) => void;
  clear: () => void;
}

export const useDiffStore = create<DiffStore>((set) => ({
  diffs: [],
  rawDiff: null,
  visible: false,

  setDiffs: (diffs, raw) => set({ diffs, rawDiff: raw, visible: true }),

  toggleVisible: () => set((s) => ({ visible: !s.visible })),

  setVisible: (v) => set({ visible: v }),

  clear: () => set({ diffs: [], rawDiff: null, visible: false }),
}));
