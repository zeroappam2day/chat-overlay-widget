import { describe, it, expect, beforeEach } from 'vitest';
import { usePmChatStore } from './pmChatStore';

beforeEach(() => {
  usePmChatStore.setState({
    messages: [],
    streaming: false,
    health: 'unknown',
    healthError: null,
    wsSend: null,
  });
});

describe('pmChatStore', () => {
  it('has correct initial state', () => {
    const state = usePmChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.streaming).toBe(false);
    expect(state.health).toBe('unknown');
    expect(state.healthError).toBeNull();
  });

  it('addUserMessage adds a user message', () => {
    usePmChatStore.getState().addUserMessage('hello');
    const { messages } = usePmChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: 'user', content: 'hello' });
  });

  it('appendToken creates new assistant message when none exists', () => {
    usePmChatStore.getState().appendToken('r1', 'Hello');
    const { messages } = usePmChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: 'assistant', content: 'Hello', requestId: 'r1' });
  });

  it('appendToken appends to existing assistant message with matching requestId', () => {
    usePmChatStore.getState().appendToken('r1', 'Hel');
    usePmChatStore.getState().appendToken('r1', 'lo');
    const { messages } = usePmChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
  });

  it('appendToken creates new assistant message if last message is user message', () => {
    usePmChatStore.getState().addUserMessage('hi');
    usePmChatStore.getState().appendToken('r1', 'response');
    const { messages } = usePmChatStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: 'assistant', content: 'response', requestId: 'r1' });
  });

  it('finalizeResponse sets streaming to false', () => {
    usePmChatStore.setState({ streaming: true });
    usePmChatStore.getState().finalizeResponse('r1');
    expect(usePmChatStore.getState().streaming).toBe(false);
  });

  it('setHealth(true) sets health to ok and healthError to null', () => {
    usePmChatStore.getState().setHealth(true);
    const { health, healthError } = usePmChatStore.getState();
    expect(health).toBe('ok');
    expect(healthError).toBeNull();
  });

  it('setHealth(false, message) sets health to error and healthError', () => {
    usePmChatStore.getState().setHealth(false, 'Ollama is not running');
    const { health, healthError } = usePmChatStore.getState();
    expect(health).toBe('error');
    expect(healthError).toBe('Ollama is not running');
  });

  it('setStreaming(true) sets streaming to true', () => {
    usePmChatStore.getState().setStreaming(true);
    expect(usePmChatStore.getState().streaming).toBe(true);
  });
});

describe('pmChatStore — FIFO cap (MAX_MESSAGES = 40)', () => {
  it('Test 1: 39 existing messages + 1 new → total 40 (no eviction)', () => {
    const existing = Array.from({ length: 39 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message-${i}`,
    }));
    usePmChatStore.setState({ messages: existing });

    usePmChatStore.getState().addUserMessage('new-message');

    const { messages } = usePmChatStore.getState();
    expect(messages.length).toBe(40);
    expect(messages[39].content).toBe('new-message');
    expect(messages[39].role).toBe('user');
  });

  it('Test 2: 40 existing messages + 1 new → total stays 40 (oldest evicted)', () => {
    const existing = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message-${i}`,
    }));
    usePmChatStore.setState({ messages: existing });

    usePmChatStore.getState().addUserMessage('new-message-41');

    const { messages } = usePmChatStore.getState();
    expect(messages.length).toBe(40);
    expect(messages[0].content).toBe('message-1');
    expect(messages[39].content).toBe('new-message-41');
  });

  it('Test 3: 42 existing messages + 1 new → total capped to 40', () => {
    const existing = Array.from({ length: 42 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message-${i}`,
    }));
    usePmChatStore.setState({ messages: existing });

    usePmChatStore.getState().addUserMessage('capped-message');

    const { messages } = usePmChatStore.getState();
    expect(messages.length).toBe(40);
    expect(messages[39].content).toBe('capped-message');
  });

  it('Test 4: FIFO eviction removes from front regardless of role', () => {
    const existing = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: `msg-${i}`,
    }));
    usePmChatStore.setState({ messages: existing });

    usePmChatStore.getState().addUserMessage('evict-front');

    const { messages } = usePmChatStore.getState();
    expect(messages.length).toBe(40);
    expect(messages[0].content).toBe('msg-1');
    expect(messages[0].role).toBe('user');
    expect(messages[39].content).toBe('evict-front');
  });

  it('appendToken still works after cap applies', () => {
    const existing = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg-${i}`,
    }));
    usePmChatStore.setState({ messages: existing });

    usePmChatStore.getState().addUserMessage('after-cap');
    expect(usePmChatStore.getState().messages.length).toBe(40);

    usePmChatStore.getState().appendToken('req-123', 'hello');
    const { messages } = usePmChatStore.getState();
    expect(messages.length).toBe(41);
    expect(messages[40].role).toBe('assistant');
    expect(messages[40].content).toBe('hello');
    expect(messages[40].requestId).toBe('req-123');
  });
});
