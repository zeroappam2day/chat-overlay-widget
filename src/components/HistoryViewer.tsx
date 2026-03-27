import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface HistoryViewerProps {
  chunks: string[];
  complete: boolean;
  sessionMeta: { startedAt: number; shell: string } | null;
  onClose: () => void;
}

export function HistoryViewer({ chunks, complete, sessionMeta, onClose }: HistoryViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenCountRef = useRef(0);

  // Mount terminal on first render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: false,
      scrollback: 50000,
      disableStdin: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#ffffff' },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    writtenCountRef.current = 0;

    // ResizeObserver for auto-fit when container resizes
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try { fitAddonRef.current?.fit(); } catch { /* ignore */ }
      }, 150);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Write new chunks incrementally as they arrive
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    for (let i = writtenCountRef.current; i < chunks.length; i++) {
      term.write(chunks[i]);
    }
    writtenCountRef.current = chunks.length;
  }, [chunks.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Replay header (D-16) */}
      <div className="flex items-center h-10 px-3 bg-[#1a3a5c] border-b border-[#2a5a8c] text-sm text-blue-200 shrink-0">
        <span>
          Viewing: {sessionMeta ? new Date(sessionMeta.startedAt).toLocaleString() : 'Session'}
          {' '}({sessionMeta?.shell ?? 'unknown'})
        </span>
        {!complete && <span className="ml-2 text-xs text-blue-400">Loading...</span>}
        <button
          onClick={onClose}
          className="ml-auto text-blue-300 hover:text-white px-2 text-lg"
          title="Close replay"
        >
          X
        </button>
      </div>
      {/* Replay terminal */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
