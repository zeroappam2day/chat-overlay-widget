import { useState, useRef, useCallback } from 'react';

interface ChatInputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInputBar({ onSend, disabled }: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-expand: reset height to auto, then set to scrollHeight, capped at 4 lines (~6rem)
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px'; // 96px ~ 4 lines at 14px font
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        // MUST use \r not \n — ConPTY expects carriage return for command execution
        onSend(value + '\r');
        setValue('');
        // Reset textarea height after clearing
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        // Preserve focus on input box after send (D-03)
        textareaRef.current?.focus();
      }
    }
    // Shift+Enter: do nothing special — default textarea behavior inserts newline
  }, [value, onSend]);

  return (
    <div className="shrink-0 px-3 py-2 bg-[#2d2d2d] border-t border-[#404040]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={disabled}
        className="chat-input-textarea w-full bg-[#1e1e1e] text-gray-200 text-sm resize-none outline-none rounded px-3 py-2 overflow-y-auto border border-[#404040] focus:border-[#007acc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ maxHeight: '6rem' }}
        placeholder="Type a command... (Enter to send, Shift+Enter for newline)"
        autoFocus
      />
    </div>
  );
}
