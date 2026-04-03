import { create } from 'zustand';
import type { FileDiff } from '../lib/diffParser';

interface DiffStore {
  diffs: FileDiff[];
  rawDiff: string | null;
  visible: boolean;
  searchQuery: string;
  currentMatchIndex: number;
  setDiffs: (diffs: FileDiff[], raw: string) => void;
  toggleVisible: () => void;
  setVisible: (v: boolean) => void;
  clear: () => void;
  setSearchQuery: (query: string) => void;
  setCurrentMatchIndex: (index: number) => void;
}

export const useDiffStore = create<DiffStore>((set) => ({
  diffs: [],
  rawDiff: null,
  visible: false,
  searchQuery: '',
  currentMatchIndex: 0,

  setDiffs: (diffs, raw) => set({ diffs, rawDiff: raw, visible: true }),

  toggleVisible: () => set((s) => ({ visible: !s.visible })),

  setVisible: (v) => set({ visible: v }),

  clear: () => set({ diffs: [], rawDiff: null, visible: false, searchQuery: '', currentMatchIndex: 0 }),

  setSearchQuery: (query) => set({ searchQuery: query, currentMatchIndex: 0 }),

  setCurrentMatchIndex: (index) => set({ currentMatchIndex: index }),
}));
