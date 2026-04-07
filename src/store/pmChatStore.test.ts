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
