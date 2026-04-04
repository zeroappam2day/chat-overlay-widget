/**
 * ConsentDialog.tsx — Agent Runtime Phase 6
 *
 * Modal dialog shown when the LLM requests an OS-level action
 * (e.g., mouse click, keyboard input via send_input MCP tool).
 * The user must explicitly approve or deny the action.
 *
 * Features:
 * - 30-second auto-deny timeout with countdown
 * - Enter = Allow, Escape = Deny
 * - Visual alert styling
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface ConsentAction {
  type: string;
  description: string;
  coordinates?: { x: number; y: number };
  target?: string;
}

interface ConsentDialogProps {
  requestId: string;
  action: ConsentAction;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}

const TIMEOUT_SECONDS = 30;

export function ConsentDialog({ requestId, action, onApprove, onDeny }: ConsentDialogProps) {
  const [remaining, setRemaining] = useState(TIMEOUT_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleApprove = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onApprove(requestId);
  }, [requestId, onApprove]);

  const handleDeny = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onDeny(requestId);
  }, [requestId, onDeny]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          handleDeny();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleDeny]);

  // Keyboard: Enter = Allow, Escape = Deny
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApprove();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleDeny();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleApprove, handleDeny]);

  // Focus the dialog on mount for accessibility
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-[420px] max-w-[90vw] bg-[#2d2d2d] border border-[#505050] rounded-lg shadow-2xl outline-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-desc"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#404040] bg-[#3a2020]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span id="consent-title" className="text-sm font-semibold text-[#ff6b6b]">
            Action Consent Required
          </span>
          <span className="ml-auto text-xs text-gray-500">
            {remaining}s
          </span>
        </div>

        {/* Body */}
        <div id="consent-desc" className="px-4 py-3 space-y-2">
          <p className="text-sm text-gray-300 leading-relaxed">
            {action.description}
          </p>

          {/* Details */}
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            <div className="flex gap-2">
              <span className="text-gray-600">Action:</span>
              <span className="text-gray-400 font-mono">{action.type}</span>
            </div>
            {action.coordinates && (
              <div className="flex gap-2">
                <span className="text-gray-600">Coordinates:</span>
                <span className="text-gray-400 font-mono">
                  ({action.coordinates.x}, {action.coordinates.y})
                </span>
              </div>
            )}
            {action.target && (
              <div className="flex gap-2">
                <span className="text-gray-600">Target:</span>
                <span className="text-gray-400">{action.target}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeout progress bar */}
        <div className="mx-4 h-1 bg-[#404040] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#ff6b6b] transition-all duration-1000 ease-linear"
            style={{ width: `${(remaining / TIMEOUT_SECONDS) * 100}%` }}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2 px-4 py-3 justify-end">
          <button
            onClick={handleDeny}
            className="px-4 py-1.5 text-xs font-medium text-gray-300 bg-[#3a3a3a] hover:bg-[#4a4a4a] border border-[#555] rounded transition-colors"
          >
            Deny (Esc)
          </button>
          <button
            onClick={handleApprove}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#2d7d3a] hover:bg-[#3a9d4a] border border-[#3a9d4a] rounded transition-colors"
          >
            Allow (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
