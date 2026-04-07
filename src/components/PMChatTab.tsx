import { useState, useRef, useEffect } from 'react';
import { usePmChatStore } from '../store/pmChatStore';

export function PMChatTab() {
  const messages = usePmChatStore((s) => s.messages);
  const streaming = usePmChatStore((s) => s.streaming);
  const health = usePmChatStore((s) => s.health);
  const healthError = usePmChatStore((s) => s.healthError);
  const wsSend = usePmChatStore((s) => s.wsSend);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // On mount (or when wsSend becomes available), send health check
  useEffect(() => {
    if (wsSend) {
      wsSend({ type: 'pm-chat-health-check' });
    }
  }, [wsSend]);

  // Auto-scroll on new messages (guarded: JSDOM does not implement scrollIntoView)
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || streaming || !wsSend) return;
    const requestId = crypto.randomUUID();
    usePmChatStore.getState().addUserMessage(input.trim());
    usePmChatStore.getState().setStreaming(true);
    wsSend({
      type: 'pm-chat',
      requestId,
      message: input.trim(),
      model: 'qwen3:0.6b',
      temperature: 0.0,
      systemPrompt: 'You are a helpful PM assistant. Summarize technical context in plain, non-technical language suitable for a CEO.',
    });
    setInput('');
  };

  // Health error state
  if (health === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="text-[#f85149] text-sm font-semibold mb-2">Ollama Not Available</div>
        <div className="text-[#8b949e] text-xs leading-relaxed">
          {healthError || 'Cannot connect to Ollama.'}
        </div>
        <div className="text-[#8b949e] text-xs mt-3 leading-relaxed">
          Make sure Ollama is running:<br/>
          <code className="text-[#58a6ff] bg-[#0d1117] px-1.5 py-0.5 rounded text-[10px]">ollama serve</code>
        </div>
        <button
          onClick={() => wsSend?.({ type: 'pm-chat-health-check' })}
          className="mt-4 px-3 py-1.5 text-xs bg-[#21262d] text-[#e6edf3] rounded border border-[#30363d] hover:bg-[#30363d] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state while health unknown
  if (health === 'unknown') {
    return (
      <div className="flex items-center justify-center h-full text-[#8b949e] text-sm">
        Checking Ollama...
      </div>
    );
  }

  // Chat UI
  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-[#484f58] text-xs text-center mt-8">
            Send a message to start chatting with your PM assistant
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#1f6feb] text-white'
                : 'bg-[#21262d] text-[#e6edf3] border border-[#30363d]/50'
            }`}>
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-3 bg-[#58a6ff] ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <div className="px-3 py-2 border-t border-[#30363d]/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={streaming ? 'Waiting for response...' : 'Ask your PM assistant...'}
            disabled={streaming}
            className="flex-1 bg-[#0d1117] text-[#e6edf3] text-xs px-3 py-2 rounded border border-[#30363d] focus:border-[#58a6ff] focus:outline-none placeholder-[#484f58] disabled:opacity-50"
          />
          <button
            onClick={streaming ? () => {
              // Cancel: find the last assistant message's requestId
              const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
              if (lastAssistant?.requestId && wsSend) {
                wsSend({ type: 'pm-chat-cancel', requestId: lastAssistant.requestId });
              }
            } : handleSend}
            disabled={!streaming && (!input.trim() || !wsSend)}
            className={`px-3 py-2 text-xs rounded transition-colors ${
              streaming
                ? 'bg-[#f85149]/20 text-[#f85149] hover:bg-[#f85149]/30 border border-[#f85149]/50'
                : 'bg-[#238636] text-white hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {streaming ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
