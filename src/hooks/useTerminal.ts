import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';

interface UseTerminalOptions {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

interface UseTerminalReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  writeToTerminal: (data: string) => void;
  getTerminalDimensions: () => { cols: number; rows: number };
  searchAddonRef: React.RefObject<SearchAddon | null>;
}

export function useTerminal({ onData, onResize }: UseTerminalOptions): UseTerminalReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

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
      scrollback: 10000,
      allowProposedApi: true,
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

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    term.open(container);

    // Gate first fit on nonzero dimensions (Pitfall 2 from RESEARCH.md)
    if (container.offsetWidth > 0 && container.offsetHeight > 0) {
      fitAddon.fit();
    }

    termRef.current = term;
    fitRef.current = fitAddon;

    // Clipboard handlers via attachCustomKeyEventHandler (D-12, TERM-03, TERM-04)
    // Must be after term.open() so the terminal DOM is available
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Ctrl+F — toggle search overlay (intercept before xterm.js consumes it)
      if (event.type === 'keydown' && event.ctrlKey && !event.shiftKey && !event.altKey && event.code === 'KeyF') {
        // Dispatch a custom event that TerminalPane listens for
        document.dispatchEvent(new CustomEvent('terminal-toggle-search'));
        return false;
      }
      // Ctrl+Alt+C — copy selection (TERM-03)
      if (event.type === 'keydown' && event.ctrlKey && event.altKey && event.code === 'KeyC') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).catch(console.error);
        }
        return false;
      }
      // Ctrl+Shift+V — paste from clipboard into PTY (TERM-04)
      if (event.type === 'keydown' && event.ctrlKey && event.shiftKey && event.code === 'KeyV') {
        navigator.clipboard.readText().then(text => {
          onDataRef.current(text);
        }).catch(console.error);
        return false;
      }
      return true;
    });

    // Right-click paste handler
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        onDataRef.current(text);
      }).catch(console.error);
    };
    container.addEventListener('contextmenu', handleContextMenu);

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
      container.removeEventListener('contextmenu', handleContextMenu);
      dataDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchAddonRef.current = null;
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

  return { containerRef, writeToTerminal, getTerminalDimensions, searchAddonRef };
}
