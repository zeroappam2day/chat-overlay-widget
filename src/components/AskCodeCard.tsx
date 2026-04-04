/**
 * Inline card for asking questions about code in the diff viewer (Phase 16).
 * States: input → loading/streaming → complete | error
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { detectLanguage } from '../lib/syntaxHighlighter';

interface AskCodeCardProps {
  requestId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  selectedText: string;
  onDismiss: () => void;
  sendMessage: (msg: object) => void;
}

type CardState = 'input' | 'loading' | 'complete' | 'error';

export function AskCodeCard({
  requestId,
  filePath,
  startLine,
  endLine,
  selectedText,
  onDismiss,
  sendMessage,
}: AskCodeCardProps) {
  const [state, setState] = useState<CardState>('input');
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [errorText, setErrorText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-scroll response as it streams
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  // Listen for ask-code-response messages via custom event
  useEffect(() => {
    function handleResponse(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail.requestId !== requestId) return;

      switch (detail.messageType) {
        case 'chunk':
          setResponse(prev => prev + (detail.text ?? ''));
          setState('loading');
          break;
        case 'done':
          setState('complete');
          break;
        case 'error':
          setErrorText(detail.text ?? 'Unknown error');
          setState('error');
          break;
      }
    }
    document.addEventListener('ask-code-response', handleResponse);
    return () => document.removeEventListener('ask-code-response', handleResponse);
  }, [requestId]);

  const handleSubmit = useCallback(() => {
    if (!question.trim()) return;
    const lang = detectLanguage(filePath);
    const prompt = `In file ${filePath}, lines ${startLine}-${endLine}:\n\n\`\`\`${lang}\n${selectedText}\n\`\`\`\n\n${question.trim()}`;

    sendMessage({ type: 'ask-code', requestId, prompt });
    setState('loading');
    setResponse('');
    setErrorText('');
  }, [question, filePath, startLine, endLine, selectedText, requestId, sendMessage]);

  const handleCancel = useCallback(() => {
    sendMessage({ type: 'cancel-ask-code', requestId });
    onDismiss();
  }, [requestId, sendMessage, onDismiss]);

  const handleRetry = useCallback(() => {
    setState('input');
    setResponse('');
    setErrorText('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
    }
  }, [handleSubmit, onDismiss]);

  const lineRange = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;

  return (
    <div className="mx-2 my-1 border border-[#404040] rounded bg-[#1a1a2e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#252540] border-b border-[#404040]">
        <span className="text-[10px] text-gray-400 truncate">
          Ask about <span className="text-blue-400 font-mono">{filePath.split('/').pop()}</span> {lineRange}
        </span>
        <button
          onClick={onDismiss}
          className="text-gray-600 hover:text-gray-300 transition-colors ml-1"
          title="Close"
          aria-label="Close ask card"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
          </svg>
        </button>
      </div>

      {/* Input state */}
      {state === 'input' && (
        <div className="p-2">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What would you like to know about this code?"
            className="w-full h-16 bg-[#0f0f1e] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 resize-none outline-none focus:border-[#007acc] placeholder-gray-600"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-gray-600">Ctrl+Enter to submit, Escape to close</span>
            <div className="flex gap-1">
              <button
                onClick={onDismiss}
                className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!question.trim()}
                className="px-2 py-0.5 text-[10px] bg-[#007acc] hover:bg-[#1a8ad4] text-white rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Ask Claude
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading / streaming state */}
      {state === 'loading' && (
        <div className="p-2">
          <div
            ref={responseRef}
            className="max-h-[200px] overflow-y-auto text-xs text-gray-300 whitespace-pre-wrap font-mono bg-[#0f0f1e] rounded p-2 border border-[#333]"
          >
            {response || (
              <span className="text-gray-600 animate-pulse">Waiting for response...</span>
            )}
          </div>
          <div className="flex justify-end mt-1">
            <button
              onClick={handleCancel}
              className="px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Complete state */}
      {state === 'complete' && (
        <div className="p-2">
          <div
            ref={responseRef}
            className="max-h-[300px] overflow-y-auto text-xs text-gray-300 whitespace-pre-wrap font-mono bg-[#0f0f1e] rounded p-2 border border-[#333]"
          >
            {response || <span className="text-gray-500 italic">No response received.</span>}
          </div>
          <div className="flex justify-end mt-1">
            <button
              onClick={onDismiss}
              className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="p-2">
          <div className="text-xs text-red-400 bg-red-900/20 rounded p-2 border border-red-900/30">
            {errorText}
          </div>
          <div className="flex justify-end gap-1 mt-1">
            <button
              onClick={handleRetry}
              className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={onDismiss}
              className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
