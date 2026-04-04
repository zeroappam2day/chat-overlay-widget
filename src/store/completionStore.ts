import { create } from 'zustand';

const STORAGE_KEY = 'chat-overlay-completion-stats';

interface CompletionStats {
  totalCompleted: number;
  todayDate: string;   // 'YYYY-MM-DD'
  todayCount: number;
}

function loadStats(): CompletionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { totalCompleted: 0, todayDate: '', todayCount: 0 };
  } catch {
    return { totalCompleted: 0, todayDate: '', todayCount: 0 };
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CompletionStore extends CompletionStats {
  recordCompleted: () => void;
  getTodayCount: () => number;
}

export const useCompletionStore = create<CompletionStore>((set, get) => {
  const initial = loadStats();
  return {
    ...initial,

    recordCompleted: () =>
      set((state) => {
        const today = todayStr();
        const isToday = state.todayDate === today;
        const next = {
          totalCompleted: state.totalCompleted + 1,
          todayDate: today,
          todayCount: isToday ? state.todayCount + 1 : 1,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      }),

    getTodayCount: () => {
      const state = get();
      return state.todayDate === todayStr() ? state.todayCount : 0;
    },
  };
});
