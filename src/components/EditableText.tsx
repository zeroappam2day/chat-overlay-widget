import { useState, useRef, useEffect } from 'react';
import { useFeatureFlagStore } from '../store/featureFlagStore';

interface EditableTextProps {
  value: string;
  onCommit: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function EditableText({
  value,
  onCommit,
  placeholder = '',
  className = '',
  maxLength = 100,
  disabled = false,
}: EditableTextProps) {
  const enabled = useFeatureFlagStore((s) => s.inlineEditing);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  const handleCommit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    }
    setEditing(false);
    setDraft(value);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (!enabled || disabled) {
    return (
      <span className={className} title={value}>
        {value || placeholder}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCommit();
          if (e.key === 'Escape') handleCancel();
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        maxLength={maxLength}
        className={`bg-transparent border border-[#555] rounded px-1 outline-none ${className}`}
        style={{ width: `${Math.max(draft.length, 3)}ch` }}
      />
    );
  }

  return (
    <span
      className={`cursor-text hover:underline hover:decoration-dotted ${className}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      title="Double-click to edit"
    >
      {value || placeholder}
    </span>
  );
}
