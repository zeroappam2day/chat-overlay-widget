import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface UseTerminalOptions {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

interface UseTerminalReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  writeToTerminal: (data: string) => void;
  getTerminalDimensions: () => { cols: number; rows: number };
}

export function useTerminal({ onData, onResize }: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  // Store callbacks in refs to avoid re-running effect on callback identity change
  const onDataRef = useRef(onData);
  const onResizeRef = useRef(onResize);
  onDataRef.current = onData;
  onResizeRef.current = onResize;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Gate first fit on nonzero dimensions (Pitfall 2 from RESEARCH.md)
    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      fitAddon.fit();
    }

    termRef.current = term;
    fitRef.current = fitAddon;

    // Forward keystrokes to caller (which sends to PTY via WebSocket)
    const dataDisposable = term.onData((data: string) => {
      onDataRef.current(data);
    });

    // Forward resize events to caller (which sends resize to PTY via WebSocket)
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      onResizeRef.current(cols, rows);
    });

    // ResizeObserver with 150ms debounce (Pitfall 4 from RESEARCH.md — avoid ConPTY thrash)
    let resizeTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          fitAddon.fit();
        }
      }, 150);
    });
    observer.observe(container);

    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const writeToTerminal = useCallback((data: string) => {
    termRef.current?.write(data);
  }, []);

  const getTerminalDimensions = useCallback((): { cols: number; rows: number } => {
    const term = termRef.current;
    if (term) return { cols: term.cols, rows: term.rows };
    return { cols: 80, rows: 24 };
  }, []);

  return { containerRef, writeToTerminal, getTerminalDimensions };
}
