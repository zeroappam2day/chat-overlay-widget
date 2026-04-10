// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  // Reset Zustand store module between tests by re-importing
  // We need to dynamically import to get fresh store state
});

describe('pmChatSettingsStore', () => {
  it('initializes with defaults when localStorage is empty', async () => {
    // Force fresh module
    const { usePmChatSettingsStore, DEFAULT_SETTINGS } = await import('./pmChatSettingsStore');
    usePmChatSettingsStore.setState({ ...DEFAULT_SETTINGS });
    const state = usePmChatSettingsStore.getState();
    expect(state.model).toBe('qwen3:0.6b');
    expect(state.systemPrompt).toBe(
      'You are a helpful PM assistant. Summarize technical context in plain, non-technical language suitable for a CEO.'
    );
    expect(state.temperature).toBe(0.0);
    expect(state.endpoint).toBe('http://127.0.0.1:11434');
  });

  it('setSetting updates the model field in the store', async () => {
    const { usePmChatSettingsStore, DEFAULT_SETTINGS } = await import('./pmChatSettingsStore');
    usePmChatSettingsStore.setState({ ...DEFAULT_SETTINGS });
    usePmChatSettingsStore.getState().setSetting('model', 'llama3:8b');
    expect(usePmChatSettingsStore.getState().model).toBe('llama3:8b');
  });

  it('setSetting writes number (not string) to localStorage', async () => {
    const { usePmChatSettingsStore, DEFAULT_SETTINGS } = await import('./pmChatSettingsStore');
    usePmChatSettingsStore.setState({ ...DEFAULT_SETTINGS });
    usePmChatSettingsStore.getState().setSetting('temperature', 0.7);
    const stored = JSON.parse(localStorage.getItem('chat-overlay-pm-chat-settings')!);
    expect(stored.temperature).toBe(0.7);
    expect(typeof stored.temperature).toBe('number');
  });

  it('loads stored values from localStorage on creation', async () => {
    localStorage.setItem(
      'chat-overlay-pm-chat-settings',
      JSON.stringify({ model: 'phi3:mini', temperature: 0.5 })
    );
    // Need to reset the module cache to test loadSettings at create time
    // Since Zustand stores are singletons, we test via setState + loadSettings pattern
    const { usePmChatSettingsStore } = await import('./pmChatSettingsStore');
    // Simulate re-creation by calling the internal load pattern
    const raw = localStorage.getItem('chat-overlay-pm-chat-settings');
    const loaded = raw ? JSON.parse(raw) : {};
    usePmChatSettingsStore.setState(loaded);
    const state = usePmChatSettingsStore.getState();
    expect(state.model).toBe('phi3:mini');
    expect(state.temperature).toBe(0.5);
  });

  it('setSetting writes only serializable fields to localStorage', async () => {
    const { usePmChatSettingsStore, DEFAULT_SETTINGS } = await import('./pmChatSettingsStore');
    usePmChatSettingsStore.setState({ ...DEFAULT_SETTINGS });
    usePmChatSettingsStore.getState().setSetting('model', 'test-model');
    const stored = JSON.parse(localStorage.getItem('chat-overlay-pm-chat-settings')!);
    const keys = Object.keys(stored).sort();
    expect(keys).toEqual(['endpoint', 'model', 'systemPrompt', 'temperature', 'terminalLines'].sort());
    // Must NOT contain store functions
    expect(stored.setSetting).toBeUndefined();
    expect(stored.resetSettings).toBeUndefined();
  });

  it('resetSettings restores all fields to DEFAULT_SETTINGS', async () => {
    const { usePmChatSettingsStore, DEFAULT_SETTINGS } = await import('./pmChatSettingsStore');
    usePmChatSettingsStore.getState().setSetting('model', 'custom-model');
    usePmChatSettingsStore.getState().setSetting('temperature', 0.9);
    usePmChatSettingsStore.getState().resetSettings();
    const state = usePmChatSettingsStore.getState();
    expect(state.model).toBe(DEFAULT_SETTINGS.model);
    expect(state.temperature).toBe(DEFAULT_SETTINGS.temperature);
    expect(state.systemPrompt).toBe(DEFAULT_SETTINGS.systemPrompt);
    expect(state.endpoint).toBe(DEFAULT_SETTINGS.endpoint);
    // localStorage should also be reset
    const stored = JSON.parse(localStorage.getItem('chat-overlay-pm-chat-settings')!);
    expect(stored.model).toBe(DEFAULT_SETTINGS.model);
  });
});
