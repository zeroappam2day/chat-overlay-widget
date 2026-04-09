import { create } from 'zustand';

const STORAGE_KEY = 'chat-overlay-pm-chat-settings';

export interface PMChatSettingsState {
  model: string;
  systemPrompt: string;
  temperature: number;
  endpoint: string;
}

interface PMChatSettingsStore extends PMChatSettingsState {
  setSetting: <K extends keyof PMChatSettingsState>(key: K, value: PMChatSettingsState[K]) => void;
  resetSettings: () => void;
}

export const DEFAULT_SETTINGS: PMChatSettingsState = {
  model: 'qwen3:0.6b',
  systemPrompt: 'You are a helpful PM assistant. Summarize technical context in plain, non-technical language suitable for a CEO.',
  temperature: 0.0,
  endpoint: 'http://127.0.0.1:11434',
};

function loadSettings(): Partial<PMChatSettingsState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PMChatSettingsState>) : {};
  } catch {
    return {};
  }
}

export const usePmChatSettingsStore = create<PMChatSettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  ...loadSettings(),
  setSetting: (key, value) =>
    set((s) => {
      const next = { ...s, [key]: value };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          model: next.model,
          systemPrompt: next.systemPrompt,
          temperature: next.temperature,
          endpoint: next.endpoint,
        })
      );
      return { [key]: value };
    }),
  resetSettings: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    set(DEFAULT_SETTINGS);
  },
}));
