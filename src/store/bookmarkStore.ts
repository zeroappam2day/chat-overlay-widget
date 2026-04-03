import { create } from 'zustand';

export interface Bookmark {
  id: string;
  label: string;
  command: string;
  createdAt: number;
}

const STORAGE_KEY = 'chat-overlay-bookmarks';

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

/**
 * Label extraction: walk words right-to-left, skip flags (starts with -),
 * strip path separators and file extensions, return first non-empty base.
 * Fallback: first word. Truncate to 20 chars.
 */
function extractLabel(command: string): string {
  const words = command.trim().split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (w.startsWith('-')) continue;
    // Strip path: take last segment
    const base = w.replace(/\\/g, '/').split('/').pop() ?? w;
    // Strip file extension
    const name = base.replace(/\.[a-z0-9]+$/i, '');
    if (name.length > 0) {
      return name.length > 20 ? name.slice(0, 20) + '…' : name;
    }
  }
  // Fallback: first word
  const fallback = words[0] ?? 'bookmark';
  return fallback.length > 20 ? fallback.slice(0, 20) + '…' : fallback;
}

interface BookmarkStore {
  bookmarks: Bookmark[];
  addBookmark: (command: string, label?: string) => void;
  removeBookmark: (id: string) => void;
  reorderBookmarks: (fromIndex: number, toIndex: number) => void;
  updateLabel: (id: string, label: string) => void;
}

export const useBookmarkStore = create<BookmarkStore>((set) => ({
  bookmarks: loadBookmarks(),

  addBookmark: (command, label) =>
    set((state) => {
      // Prevent duplicate commands
      if (state.bookmarks.some((b) => b.command === command)) return state;
      const bookmark: Bookmark = {
        id: crypto.randomUUID(),
        label: label ?? extractLabel(command),
        command,
        createdAt: Date.now(),
      };
      const next = [...state.bookmarks, bookmark];
      saveBookmarks(next);
      return { bookmarks: next };
    }),

  removeBookmark: (id) =>
    set((state) => {
      const next = state.bookmarks.filter((b) => b.id !== id);
      saveBookmarks(next);
      return { bookmarks: next };
    }),

  reorderBookmarks: (fromIndex, toIndex) =>
    set((state) => {
      const next = [...state.bookmarks];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      saveBookmarks(next);
      return { bookmarks: next };
    }),

  updateLabel: (id, label) =>
    set((state) => {
      const next = state.bookmarks.map((b) =>
        b.id === id ? { ...b, label } : b
      );
      saveBookmarks(next);
      return { bookmarks: next };
    }),
}));
