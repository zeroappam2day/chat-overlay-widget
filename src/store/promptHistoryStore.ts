import { create } from 'zustand';

export interface PromptEntry {
  text: string;
  timestamp: number;
  paneId: string;
}

const STORAGE_KEY = 'chat-overlay-prompt-history';
const NOTES_KEY = 'chat-overlay-prompt-notes';
const MAX_ENTRIES = 200;

function loadEntries(): PromptEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadNotes(): string {
  try {
    return localStorage.getItem(NOTES_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistEntries(entries: PromptEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function persistNotes(notes: string) {
  localStorage.setItem(NOTES_KEY, notes);
}

interface PromptHistoryStore {
  entries: PromptEntry[];
  notes: string;
  addEntry: (text: string, paneId: string) => void;
  clearEntries: () => void;
  setNotes: (notes: string) => void;
  getRecent: (n?: number) => PromptEntry[];
}

export const usePromptHistoryStore = create<PromptHistoryStore>((set, get) => ({
  entries: loadEntries(),
  notes: loadNotes(),

  addEntry: (text, paneId) =>
    set((state) => {
      const entry: PromptEntry = { text, timestamp: Date.now(), paneId };
      // Deduplicate: skip if identical to the most recent entry
      if (state.entries.length > 0 && state.entries[0].text === text) {
        return state;
      }
      const next = [entry, ...state.entries].slice(0, MAX_ENTRIES);
      persistEntries(next);
      return { entries: next };
    }),

  clearEntries: () =>
    set(() => {
      localStorage.removeItem(STORAGE_KEY);
      return { entries: [] };
    }),

  setNotes: (notes) =>
    set(() => {
      persistNotes(notes);
      return { notes };
    }),

  getRecent: (n = 20) => get().entries.slice(0, n),
}));
