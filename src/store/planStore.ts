import { create } from 'zustand';

interface PlanStore {
  content: string | null;
  fileName: string | null;
  visible: boolean;
  setContent: (content: string | null, fileName: string | null) => void;
  toggleVisible: () => void;
  setVisible: (v: boolean) => void;
}

export const usePlanStore = create<PlanStore>((set) => ({
  content: null,
  fileName: null,
  visible: false,
  setContent: (content, fileName) => set({ content, fileName }),
  toggleVisible: () => set((s) => ({ visible: !s.visible })),
  setVisible: (v) => set({ visible: v }),
}));
