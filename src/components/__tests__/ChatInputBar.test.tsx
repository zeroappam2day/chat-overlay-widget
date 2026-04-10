// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInputBar } from '../ChatInputBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ChatInputBar', () => {
  it('renders textarea with default placeholder', () => {
    render(<ChatInputBar onSend={vi.fn()} />);
    expect(
      screen.getByPlaceholderText('Type a command... (Enter to send, Shift+Enter for newline)'),
    ).toBeInTheDocument();
  });

  it('Enter sends value with \\r appended and clears textarea', async () => {
    const mockSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar onSend={mockSend} />);
    const textarea = screen.getByPlaceholderText('Type a command... (Enter to send, Shift+Enter for newline)');
    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');
    expect(mockSend).toHaveBeenCalledWith('hello\r');
    expect(textarea).toHaveValue('');
  });

  it('Shift+Enter does NOT send', async () => {
    const mockSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar onSend={mockSend} />);
    const textarea = screen.getByPlaceholderText('Type a command... (Enter to send, Shift+Enter for newline)');
    await user.type(textarea, 'line1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('disabled state disables textarea', () => {
    render(<ChatInputBar onSend={vi.fn()} disabled={true} />);
    const textarea = screen.getByPlaceholderText('Type a command... (Enter to send, Shift+Enter for newline)');
    expect(textarea).toBeDisabled();
  });

  it('pendingInjection appends to textarea and calls onInjectionConsumed', () => {
    const onConsumed = vi.fn();
    render(
      <ChatInputBar
        onSend={vi.fn()}
        pendingInjection="injected text"
        onInjectionConsumed={onConsumed}
      />,
    );
    const textarea = screen.getByPlaceholderText('Type a command... (Enter to send, Shift+Enter for newline)');
    expect(textarea).toHaveValue('injected text');
    expect(onConsumed).toHaveBeenCalled();
  });

  it('empty input does not send on Enter', async () => {
    const mockSend = vi.fn();
    const user = userEvent.setup();
    render(<ChatInputBar onSend={mockSend} />);
    const textarea = screen.getByPlaceholderText('Type a command... (Enter to send, Shift+Enter for newline)');
    await user.click(textarea);
    await user.keyboard('{Enter}');
    expect(mockSend).not.toHaveBeenCalled();
  });
});
