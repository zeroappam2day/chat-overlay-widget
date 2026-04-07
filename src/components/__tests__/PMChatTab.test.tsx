// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { PMChatTab } from '../PMChatTab';
import { usePmChatStore } from '../../store/pmChatStore';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  usePmChatStore.setState({
    messages: [],
    streaming: false,
    health: 'unknown',
    healthError: null,
    wsSend: null,
  });
});

describe('PMChatTab', () => {
  it('renders loading state when health is unknown', () => {
    render(<PMChatTab />);
    expect(screen.getByText('Checking Ollama...')).toBeInTheDocument();
  });

  it('renders error state when health is error', () => {
    usePmChatStore.setState({ health: 'error', healthError: 'Ollama is not running' });
    render(<PMChatTab />);
    expect(screen.getByText('Ollama Not Available')).toBeInTheDocument();
    expect(screen.getByText('ollama serve')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders chat input when health is ok', () => {
    usePmChatStore.setState({ health: 'ok', wsSend: () => {} });
    render(<PMChatTab />);
    expect(screen.getByPlaceholderText('Ask your PM assistant...')).toBeInTheDocument();
  });

  it('renders user and assistant messages', () => {
    usePmChatStore.setState({
      health: 'ok',
      wsSend: () => {},
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there', requestId: 'r1' },
      ],
    });
    render(<PMChatTab />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });
});
