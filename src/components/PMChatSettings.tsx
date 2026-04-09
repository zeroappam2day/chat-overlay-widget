import { useState, useEffect } from 'react';
import { usePmChatSettingsStore } from '../store/pmChatSettingsStore';

export function PMChatSettings() {
  const model = usePmChatSettingsStore((s) => s.model);
  const systemPrompt = usePmChatSettingsStore((s) => s.systemPrompt);
  const temperature = usePmChatSettingsStore((s) => s.temperature);
  const endpoint = usePmChatSettingsStore((s) => s.endpoint);
  const setSetting = usePmChatSettingsStore((s) => s.setSetting);

  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setModelsLoading(true);
    fetch(`${endpoint}/api/tags`)
      .then((r) => r.json())
      .then((d) => setModels((d.models ?? []).map((m: { name: string }) => m.name)))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [open, endpoint]);

  return (
    <div className="border-b border-[#30363d]/50">
      {/* Header row with gear icon */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] text-[#8b949e] font-medium uppercase tracking-wide">PM Chat</span>
        <button
          onClick={() => setOpen((v) => !v)}
          title="PM Chat Settings"
          className={`p-1 rounded transition-colors ${open ? 'text-[#58a6ff] bg-[#58a6ff]/10' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'}`}
          aria-label="PM Chat Settings"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a4 4 0 100 8A4 4 0 008 4zm0 1a3 3 0 110 6A3 3 0 018 5z"/>
            <path fillRule="evenodd" d="M8 0a.75.75 0 01.75.75v1.5a5.25 5.25 0 013.65 1.513l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06A5.25 5.25 0 0114.75 8.25h1.5a.75.75 0 010 1.5h-1.5a5.25 5.25 0 01-1.513 3.65l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06A5.25 5.25 0 018.75 15.75v-1.5a.75.75 0 01-1.5 0v1.5a5.25 5.25 0 01-3.65-1.513l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06A5.25 5.25 0 011.25 9.75H-.25a.75.75 0 010-1.5h1.5a5.25 5.25 0 011.513-3.65L1.703 3.54a.75.75 0 111.06-1.06l1.06 1.06A5.25 5.25 0 017.25 2.25V.75A.75.75 0 018 0z"/>
          </svg>
        </button>
      </div>

      {/* Collapsible settings panel */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          {/* Model dropdown */}
          <div>
            <label className="block text-[10px] text-[#8b949e] mb-1">Model</label>
            <select
              value={model}
              onChange={(e) => setSetting('model', e.target.value)}
              disabled={modelsLoading}
              className="w-full bg-[#0d1117] text-[#e6edf3] text-xs px-2 py-1.5 rounded border border-[#30363d] focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
            >
              {models.length === 0 ? (
                <option value={model}>{modelsLoading ? 'Loading...' : 'No models found'}</option>
              ) : (
                models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))
              )}
            </select>
          </div>

          {/* Endpoint URL */}
          <div>
            <label className="block text-[10px] text-[#8b949e] mb-1">Ollama Endpoint</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setSetting('endpoint', e.target.value)}
              className="w-full bg-[#0d1117] text-[#e6edf3] text-xs px-2 py-1.5 rounded border border-[#30363d] focus:border-[#58a6ff] focus:outline-none font-mono"
              placeholder="http://127.0.0.1:11434"
            />
          </div>

          {/* Temperature slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-[#8b949e]">Temperature</label>
              <span className="text-[10px] text-[#8b949e] tabular-nums">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setSetting('temperature', parseFloat(e.target.value))}
              className="w-full accent-[#58a6ff]"
            />
          </div>

          {/* System prompt textarea */}
          <div>
            <label className="block text-[10px] text-[#8b949e] mb-1">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSetting('systemPrompt', e.target.value)}
              rows={3}
              className="w-full bg-[#0d1117] text-[#e6edf3] text-xs px-2 py-1.5 rounded border border-[#30363d] focus:border-[#58a6ff] focus:outline-none resize-none leading-relaxed"
              placeholder="System prompt for the PM assistant..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
