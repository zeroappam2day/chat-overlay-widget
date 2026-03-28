import { useState, useRef, useCallback, useEffect } from 'react';

interface ChatInputBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  onImagePaste?: (base64: string, ext: string) => void;
  pendingImagePath?: string | null;
  onImagePathConsumed?: () => void;
}

export function ChatInputBar({ onSend, disabled, onImagePaste, pendingImagePath, onImagePathConsumed }: ChatInputBarProps) {
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

  // Handle clipboard paste for images (SCRN-02)
  // Checks both clipboardData.items (standard) and clipboardData.files (WebView2 fallback)
  // to support Windows Snipping Tool, PrtScn, and browser copy-image
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!onImagePaste) return;

    // Strategy 1: Check DataTransferItemList for image items
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    // Strategy 2: Check FileList (WebView2 may expose snipping tool images here)
    const files = Array.from(e.clipboardData.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));

    const blob = imageItem?.getAsFile() ?? imageFile ?? null;
    if (!blob) return; // no image found — let normal text paste proceed

    e.preventDefault(); // block default paste behavior for images

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) return;
      const ext = blob.type.split('/')[1] || 'png';
      onImagePaste(base64, ext);
    };
    reader.readAsDataURL(blob);
  }, [onImagePaste]);

  // Inject pending image path into the input box when it changes (SCRN-01, SCRN-02)
  useEffect(() => {
    if (pendingImagePath) {
      setValue(prev => {
        const prefix = prev.trim() ? prev.trim() + ' ' : '';
        return prefix + pendingImagePath;
      });
      onImagePathConsumed?.();
      textareaRef.current?.focus();
    }
  }, [pendingImagePath, onImagePathConsumed]);

  return (
    <div className="shrink-0 px-3 py-2 bg-[#2d2d2d] border-t border-[#404040]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
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
