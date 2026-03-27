import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSessionHistory } from '../hooks/useSessionHistory';
import { TerminalHeader } from './TerminalHeader';
import { SearchOverlay } from './SearchOverlay';
import { ChatInputBar } from './ChatInputBar';
import { HistorySidebar } from './HistorySidebar';
import { HistoryViewer } from './HistoryViewer';
import type { ServerMessage } from '../protocol';

export function TerminalPane() {
  const [shells, setShells] = useState<string[]>([]);
  const [currentShell, setCurrentShell] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('waiting');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const spawnedRef = useRef(false);
  const getDimensionsRef = useRef<() => { cols: number; rows: number }>(() => ({ cols: 80, rows: 24 }));
  const writeRef = useRef<(data: string) => void>(() => { /* noop until terminal mounts */ });
  const sendMessageRef = useRef<(msg: Parameters<ReturnType<typeof useWebSocket>['sendMessage']>[0]) => void>(() => { /* noop until ws connects */ });

  // handleHistoryMessage is initialized after useSessionHistory below.
  // Use a ref so handleServerMessage's useCallback can call it without
  // re-creating the callback on every render.
  const handleHistoryMessageRef = useRef<(msg: ServerMessage) => boolean>(() => false);

  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'output':
        writeRef.current(msg.data);
        break;
      case 'pty-ready': {
        console.log(`[terminal] PTY ready: pid=${msg.pid}, shell=${msg.shell}`);
        // Match full exe path back to short name from shell-list
        // pty-ready sends full path (e.g. C:\Windows\...\powershell.exe)
        // but dropdown options use short names (e.g. powershell.exe)
        const shortName = shells.find(s => msg.shell.toLowerCase().endsWith(s.toLowerCase())) ?? msg.shell;
        console.log(`[terminal] resolved shell name: ${shortName}`);
        setCurrentShell(shortName);
        break;
      }
      case 'pty-exit':
        writeRef.current(`\r\n[Process exited with code ${msg.exitCode}]\r\n`);
        // Auto-respawn after 1 second (D-07) — reset spawnedRef so the effect can re-trigger
        spawnedRef.current = false;
        setTimeout(() => {
          if (shells.length > 0) {
            const dims = getDimensionsRef.current();
            sendMessageRef.current({ type: 'spawn', shell: shells[0], cols: dims.cols, rows: dims.rows });
          }
        }, 1000);
        break;
      case 'shell-list':
        console.log('[terminal] shell-list received:', msg.shells);
        setShells(msg.shells);
        break;
      case 'error':
        console.error(`[terminal] server error: ${msg.message}`);
        writeRef.current(`\r\n[Error: ${msg.message}]\r\n`);
        break;
      default:
        // Delegate history-sessions, history-chunk, history-end, session-start
        handleHistoryMessageRef.current(msg);
        break;
    }
  }, [shells]);

  const { state, sendMessage } = useWebSocket({ onMessage: handleServerMessage });
  sendMessageRef.current = sendMessage;

  const {
    sessions,
    replaySessionId,
    replayChunks,
    replayComplete,
    fetchSessions,
    startReplay,
    closeReplay,
    handleHistoryMessage,
  } = useSessionHistory({ sendMessage });

  // Keep ref in sync so handleServerMessage can call it without stale closure
  handleHistoryMessageRef.current = handleHistoryMessage;

  const handleTerminalData = useCallback((data: string) => {
    sendMessage({ type: 'input', data });
  }, [sendMessage]);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    sendMessage({ type: 'resize', cols, rows });
  }, [sendMessage]);

  const { containerRef, writeToTerminal, getTerminalDimensions, searchAddonRef } = useTerminal({
    onData: handleTerminalData,
    onResize: handleTerminalResize,
  });

  writeRef.current = writeToTerminal;
  getDimensionsRef.current = getTerminalDimensions;

  // Update connection state for status display
  useEffect(() => {
    setConnectionState(state);
  }, [state]);

  // Auto-spawn default shell when connected and shells are available
  useEffect(() => {
    console.log(`[terminal] auto-spawn check: state=${state}, shells=${shells.length}, spawned=${spawnedRef.current}`);
    if (state === 'connected' && shells.length > 0 && !spawnedRef.current) {
      spawnedRef.current = true;
      // Small delay to ensure xterm.js has measured dimensions
      requestAnimationFrame(() => {
        const dims = getTerminalDimensions();
        console.log(`[terminal] auto-spawning: shell=${shells[0]}, cols=${dims.cols}, rows=${dims.rows}`);
        sendMessage({ type: 'spawn', shell: shells[0], cols: dims.cols, rows: dims.rows });
      });
    }
  }, [state, shells, sendMessage, getTerminalDimensions]);

  // Intercept Ctrl+F at document level to prevent WebView2 native find-in-page (D-15)
  // Also handle Escape to return focus from terminal to input box (D-02)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
      // Escape returns focus to input box when search is not open (D-02)
      if (e.code === 'Escape' && !searchOpen) {
        const input = document.querySelector<HTMLTextAreaElement>('.chat-input-textarea');
        input?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen]);

  // Fetch sessions when the sidebar is opened
  useEffect(() => {
    if (sidebarOpen) {
      fetchSessions();
    }
  }, [sidebarOpen, fetchSessions]);

  // Route input box text to PTY as real keystrokes (shadow typing, D-04)
  const handleSendInput = useCallback((text: string) => {
    sendMessage({ type: 'input', data: text });
  }, [sendMessage]);

  const handleShellChange = useCallback((newShell: string) => {
    if (newShell && newShell !== currentShell) {
      spawnedRef.current = true;
      sendMessage({ type: 'kill' });
      const dims = getTerminalDimensions();
      sendMessage({ type: 'spawn', shell: newShell, cols: dims.cols, rows: dims.rows });
    }
  }, [currentShell, sendMessage, getTerminalDimensions]);

  // Find session metadata for HistoryViewer header
  const replayMeta = replaySessionId !== null
    ? sessions.find(s => s.id === replaySessionId) ?? null
    : null;

  return (
    <div className="flex h-screen bg-[#1e1e1e]">
      {/* Collapsible history sidebar (D-05) */}
      {sidebarOpen && (
        <HistorySidebar
          sessions={sessions}
          onSelect={(id) => startReplay(id)}
          onClose={() => setSidebarOpen(false)}
          onRefresh={fetchSessions}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <TerminalHeader
          connectionState={connectionState}
          currentShell={currentShell}
          shells={shells}
          onShellChange={handleShellChange}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
        />

        {/* Replay viewer — only mounted when a session is selected (D-07) */}
        {replaySessionId !== null && (
          <HistoryViewer
            chunks={replayChunks}
            complete={replayComplete}
            sessionMeta={replayMeta ? { startedAt: replayMeta.startedAt, shell: replayMeta.shell } : null}
            onClose={closeReplay}
          />
        )}

        {/* Live terminal area — hidden via CSS (NOT unmounted) during replay.
            xterm.js Terminal is bound to its container DOM element via term.open(container).
            Unmounting the container severs the binding; CSS 'hidden' keeps the element in DOM
            so the Terminal reference stays valid. ResizeObserver refits automatically when
            the container transitions from hidden to visible (150ms debounce). */}
        <div className={`relative flex-1 min-h-0 ${replaySessionId !== null ? 'hidden' : ''}`}>
          {searchOpen && (
            <SearchOverlay
              searchAddon={searchAddonRef.current}
              onClose={() => setSearchOpen(false)}
            />
          )}
          {/* Terminal mount point — must have explicit height for xterm.js FitAddon */}
          <div ref={containerRef} className="h-full" />
        </div>

        <ChatInputBar
          onSend={handleSendInput}
          disabled={connectionState !== 'connected' || replaySessionId !== null}
        />
      </div>
    </div>
  );
}
