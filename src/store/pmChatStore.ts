import { create } from 'zustand';

export interface PMChatMessage {
  role: 'user' | 'assistant';
  content: string;
  requestId?: string;
}

interface PMChatStore {
  messages: PMChatMessage[];
  streaming: boolean;
  health: 'unknown' | 'ok' | 'error';
  healthError: string | null;
  wsSend: ((msg: unknown) => void) | null;
  addUserMessage: (content: string) => void;
  appendToken: (requestId: string, token: string) => void;
  finalizeResponse: (requestId: string) => void;
  setHealth: (ok: boolean, error?: string) => void;
  setStreaming: (v: boolean) => void;
  setWsSend: (fn: ((msg: unknown) => void) | null) => void;
  clearMessages: () => void;
}

export const usePmChatStore = create<PMChatStore>((set) => ({
  messages: [],
  streaming: false,
  health: 'unknown',
  healthError: null,
  wsSend: null,
  addUserMessage: (content) => set((s) => ({
    messages: [...s.messages, { role: 'user', content }],
  })),
  appendToken: (requestId, token) => set((s) => {
    const msgs = [...s.messages];
    const lastIdx = msgs.length - 1;
    if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant' && msgs[lastIdx].requestId === requestId) {
      msgs[lastIdx] = { ...msgs[lastIdx], content: msgs[lastIdx].content + token };
    } else {
      msgs.push({ role: 'assistant', content: token, requestId });
    }
    return { messages: msgs };
  }),
  finalizeResponse: (_requestId) => set({ streaming: false }),
  setHealth: (ok, error) => set({
    health: ok ? 'ok' : 'error',
    healthError: ok ? null : (error ?? 'Ollama is not running'),
  }),
  setStreaming: (v) => set({ streaming: v }),
  setWsSend: (fn) => set({ wsSend: fn }),
  clearMessages: () => set({ messages: [] }),
}));
