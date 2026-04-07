import { useState, useRef, useCallback, useEffect } from 'react';
import { quotePathForShell } from '../utils/shellQuote';

interface ChatInputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  onImagePaste?: (base64: string) => void;
  pendingImagePath?: string | null;
  onImagePathConsumed?: () => void;
  currentShell?: string | null;
  height?: number;
  pendingInjection?: string | null;
  onInjectionConsumed?: () => void;
}

export function ChatInputBar({ onSend, disabled, onImagePaste, pendingImagePath, onImagePathConsumed, currentShell, height, pendingInjection, onInjectionConsumed }: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value + '\r');
        setValue('');
        textareaRef.current?.focus();
      }
    }
  }, [value, onSend]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!onImagePaste) return;
    const items = Array.from(e.clipboardData.items);
    const files = Array.from(e.clipboardData.files);
    console.log('[paste] items:', items.map(i => ({ kind: i.kind, type: i.type })));
    console.log('[paste] files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    console.log('[paste] types:', e.clipboardData.types);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    const imageFile = files.find(f => f.type.startsWith('image/'));
    const blob = imageItem?.getAsFile() ?? imageFile ?? null;
    if (!blob) {
      console.log('[paste] no image found in clipboard data');
      return;
    }
    console.log('[paste] image blob found:', blob.type, blob.size, 'bytes');
    e.preventDefault();
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) {
        console.log('[paste] FileReader produced no base64');
        return;
      }
      console.log('[paste] sending save-image, base64 length:', base64.length);
      onImagePaste(base64);
    };
    reader.readAsDataURL(blob);
  }, [onImagePaste]);

  useEffect(() => {
    if (pendingImagePath) {
      setValue(prev => {
        const prefix = prev.trim() ? prev.trim() + ' ' : '';
        return prefix + quotePathForShell(pendingImagePath, currentShell ?? null);
      });
      onImagePathConsumed?.();
      textareaRef.current?.focus();
    }
  }, [pendingImagePath, onImagePathConsumed, currentShell]);

  useEffect(() => {
    if (pendingInjection) {
      setValue(prev => {
        const prefix = prev.trim() ? prev.trim() + '\n' : '';
        return prefix + pendingInjection;
      });
      onInjectionConsumed?.();
      textareaRef.current?.focus();
    }
  }, [pendingInjection, onInjectionConsumed]);

  return (
    <div
      className="shrink-0 px-3 py-2 bg-[#0d1117] border-t border-[#30363d] flex flex-col"
      style={{ height: height ?? 144 }}
    >
      {/* Focus glow wrapper */}
      <div className="relative group flex-1 flex flex-col">
        {/* Glow underlay */}
        <div className="absolute -inset-px bg-gradient-to-r from-[#58a6ff]/0 via-[#58a6ff]/20 to-[#d2a8ff]/0 rounded-lg blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          className="chat-input-textarea relative w-full flex-1 bg-[#161b22] text-[#e6edf3] text-sm resize-none outline-none rounded-lg px-3 py-2 overflow-y-auto border border-[#30363d] focus:border-[#58a6ff]/60 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed placeholder-[#484f58]"
          placeholder="Type a command... (Enter to send, Shift+Enter for newline)"
          autoFocus
        />
      </div>
    </div>
  );
}
