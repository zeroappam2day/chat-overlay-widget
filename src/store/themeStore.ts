import { create } from 'zustand';
import { type ThemeId, applyTheme, clearTheme } from '../lib/themes';

const STORAGE_KEY = 'chat-overlay-theme';

function loadTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && ['default', 'classic', 'midnight', 'ember'].includes(raw)
      ? (raw as ThemeId)
      : 'default';
  } catch {
    return 'default';
  }
}

interface ThemeStore {
  activeTheme: ThemeId;
  setTheme: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  activeTheme: loadTheme(),
  setTheme: (id) => {
    localStorage.setItem(STORAGE_KEY, id);
    applyTheme(id);
    set({ activeTheme: id });
  },
}));

// Export clearTheme for use in ThemeSelector when flag is turned off
export { clearTheme };
