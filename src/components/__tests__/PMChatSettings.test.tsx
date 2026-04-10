// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PMChatSettings } from '../PMChatSettings';

// Mock the store
const mockSetSetting = vi.fn();
const mockStoreState = {
  model: 'qwen3:0.6b',
  systemPrompt: 'You are a helpful PM assistant.',
  temperature: 0.0,
  endpoint: 'http://127.0.0.1:11434',
  setSetting: mockSetSetting,
  resetSettings: vi.fn(),
};

vi.mock('../../store/pmChatSettingsStore', () => ({
  usePmChatSettingsStore: (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockSetSetting.mockClear();
});

beforeEach(() => {
  mockStoreState.model = 'qwen3:0.6b';
  mockStoreState.systemPrompt = 'You are a helpful PM assistant.';
  mockStoreState.temperature = 0.0;
  mockStoreState.endpoint = 'http://127.0.0.1:11434';
});

describe('PMChatSettings', () => {
  it('does not render settings controls when collapsed (default state)', () => {
    render(<PMChatSettings />);
    expect(screen.queryByLabelText('Temperature')).toBeNull();
    expect(screen.queryByPlaceholderText('System prompt for the PM assistant...')).toBeNull();
  });

  it('clicking the gear button toggles the panel open', async () => {
    // Mock fetch for model loading
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ models: [{ name: 'qwen3:0.6b' }] }),
    });
    render(<PMChatSettings />);
    const gearButton = screen.getByLabelText('PM Chat Settings');
    fireEvent.click(gearButton);
    // After open, controls should be visible
    expect(screen.getByText('Temperature')).toBeTruthy();
    expect(screen.getByPlaceholderText('System prompt for the PM assistant...')).toBeTruthy();
    expect(screen.getByPlaceholderText('http://127.0.0.1:11434')).toBeTruthy();
  });

  it('when open and fetch resolves with models, the select has option elements', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ models: [{ name: 'qwen3:0.6b' }, { name: 'llama3:8b' }] }),
    });
    render(<PMChatSettings />);
    fireEvent.click(screen.getByLabelText('PM Chat Settings'));
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0].textContent).toBe('qwen3:0.6b');
      expect(options[1].textContent).toBe('llama3:8b');
    });
  });

  it('when open and fetch rejects (Ollama offline), select shows "No models found"', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    render(<PMChatSettings />);
    fireEvent.click(screen.getByLabelText('PM Chat Settings'));
    await waitFor(() => {
      const option = screen.getByRole('option');
      expect(option.textContent).toBe('No models found');
    });
  });

  it('changing the temperature slider calls setSetting with a number', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ models: [] }),
    });
    render(<PMChatSettings />);
    fireEvent.click(screen.getByLabelText('PM Chat Settings'));
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(mockSetSetting).toHaveBeenCalledWith('temperature', 0.5);
    // Verify it's a number, not a string
    const callArgs = mockSetSetting.mock.calls[0];
    expect(typeof callArgs[1]).toBe('number');
  });

  it('typing in the system prompt textarea calls setSetting', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ models: [] }),
    });
    render(<PMChatSettings />);
    fireEvent.click(screen.getByLabelText('PM Chat Settings'));
    const textarea = screen.getByPlaceholderText('System prompt for the PM assistant...');
    fireEvent.change(textarea, { target: { value: 'New prompt' } });
    expect(mockSetSetting).toHaveBeenCalledWith('systemPrompt', 'New prompt');
  });

  it('typing in the endpoint input calls setSetting', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ models: [] }),
    });
    render(<PMChatSettings />);
    fireEvent.click(screen.getByLabelText('PM Chat Settings'));
    const input = screen.getByPlaceholderText('http://127.0.0.1:11434');
    fireEvent.change(input, { target: { value: 'http://localhost:1234' } });
    expect(mockSetSetting).toHaveBeenCalledWith('endpoint', 'http://localhost:1234');
  });

  it('changing the model select calls setSetting', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ models: [{ name: 'qwen3:0.6b' }, { name: 'llama3:8b' }] }),
    });
    render(<PMChatSettings />);
    fireEvent.click(screen.getByLabelText('PM Chat Settings'));
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'llama3:8b' } });
    expect(mockSetSetting).toHaveBeenCalledWith('model', 'llama3:8b');
  });
});
