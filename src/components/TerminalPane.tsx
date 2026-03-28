import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSessionHistory } from '../hooks/useSessionHistory';
import { usePaneStore } from '../store/paneStore';
import { TerminalHeader } from './TerminalHeader';
import { SearchOverlay } from './SearchOverlay';
import { ChatInputBar } from './ChatInputBar';
import { HistorySidebar } from './HistorySidebar';
import { HistoryViewer } from './HistoryViewer';
import type { ServerMessage } from '../protocol';

interface TerminalPaneProps {
  paneId: string;
  droppedImagePath?: string | null;
  onDroppedPathConsumed?: () => void;
}

export function TerminalPane({ paneId, droppedImagePath, onDroppedPathConsumed }: TerminalPaneProps) {
  const [shells, setShells] = useState<string[]>([]);
  const [currentShell, setCurrentShell] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('waiting');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Pending image path from clipboard paste (sidecar save-image-result response)
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  const spawnedRef = useRef(false);
  const getDimensionsRef = useRef<() => { cols: number; rows: number }>(() => ({ cols: 80, rows: 24 }));
  const writeRef = useRef<(data: string) => void>(() => { /* noop until terminal mounts */ });
  const sendMessageRef = useRef<(msg: Parameters<ReturnType<typeof useWebSocket>['sendMessage']>[0]) => void>(() => { /* noop until ws connects */ });

  // Pane store bindings
  const setActivePane = usePaneStore(state => state.setActivePane);
  const isActive = usePaneStore(state => state.activePaneId === paneId);
  const splitPane = usePaneStore(state => state.splitPane);
  const closePane = usePaneStore(state => state.closePane);
  const paneCount = usePaneStore(state => state.getPaneCount());

  // Use a ref for isActive so keyboard handlers don't have stale closure issues
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

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
        console.log(`[terminal:${paneId}] PTY ready: pid=${msg.pid}, shell=${msg.shell}`);
        // Match full exe path back to short name from shell-list
        // pty-ready sends full path (e.g. C:\Windows\...\powershell.exe)
        // but dropdown options use short names (e.g. powershell.exe)
        const shortName = shells.find(s => msg.shell.toLowerCase().endsWith(s.toLowerCase())) ?? msg.shell;
        console.log(`[terminal:${paneId}] resolved shell name: ${shortName}`);
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
        console.log(`[terminal:${paneId}] shell-list received:`, msg.shells);
        setShells(msg.shells);
        break;
      case 'error':
        console.error(`[terminal:${paneId}] server error: ${msg.message}`);
        writeRef.current(`\r\n[Error: ${msg.message}]\r\n`);
        break;
      case 'save-image-result':
        // Clipboard paste flow: sidecar saved the temp file, inject its path into input box
        setPendingImagePath(msg.path);
        break;
      default:
        // Delegate history-sessions, history-chunk, history-end, session-start
        handleHistoryMessageRef.current(msg);
        break;
    }
  }, [shells, paneId]);

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
    console.log(`[terminal:${paneId}] auto-spawn check: state=${state}, shells=${shells.length}, spawned=${spawnedRef.current}`);
    if (state === 'connected' && shells.length > 0 && !spawnedRef.current) {
      spawnedRef.current = true;
      // Small delay to ensure xterm.js has measured dimensions
      requestAnimationFrame(() => {
        const dims = getTerminalDimensions();
        console.log(`[terminal:${paneId}] auto-spawning: shell=${shells[0]}, cols=${dims.cols}, rows=${dims.rows}`);
        sendMessage({ type: 'spawn', shell: shells[0], cols: dims.cols, rows: dims.rows });
      });
    }
  }, [state, shells, sendMessage, getTerminalDimensions, paneId]);

  // Intercept Ctrl+F at document level to prevent WebView2 native find-in-page (D-15)
  // Also listen for custom event from xterm.js key handler (when terminal has focus)
  // Also handle Escape to return focus from terminal to input box (D-02)
  // All handlers are gated: only the ACTIVE pane responds (Pitfall 3 from research)
  useEffect(() => {
    // Gated toggle: only active pane responds to terminal-toggle-search custom event
    const gatedToggleSearch = () => {
      if (!isActiveRef.current) return;
      setSearchOpen(prev => !prev);
    };
    document.addEventListener('terminal-toggle-search', gatedToggleSearch);

    const handler = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return; // only active pane responds
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

    // Document-level paste listener for clipboard images (SCRN-02)
    // Catches Ctrl+V when terminal has focus (not textarea) — e.g. Snipping Tool paste
    const handleDocPaste = (e: ClipboardEvent) => {
      if (!isActiveRef.current) return;
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      const files = Array.from(e.clipboardData.files);
      const imageFile = files.find(f => f.type.startsWith('image/'));
      const blob = imageItem?.getAsFile() ?? imageFile ?? null;
      if (!blob) return; // no image — let default paste proceed
      e.preventDefault();
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        if (!base64) return;
        const ext = blob.type.split('/')[1] || 'png';
        sendMessageRef.current({ type: 'save-image', base64, ext });
      };
      reader.readAsDataURL(blob);
    };
    document.addEventListener('paste', handleDocPaste);

    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('terminal-toggle-search', gatedToggleSearch);
      document.removeEventListener('paste', handleDocPaste);
    };
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
    <div
      className={`flex flex-col h-full bg-[#1e1e1e] ${isActive ? 'border-l-2 border-l-[#007acc]' : 'border-l-2 border-l-transparent'}`}
      onClick={() => setActivePane(paneId)}
    >
      {/* Collapsible history sidebar (D-05) */}
      {sidebarOpen && (
        <HistorySidebar
          sessions={sessions}
          onSelect={(id) => startReplay(id)}
          onClose={() => setSidebarOpen(false)}
          onRefresh={fetchSessions}
        />
      )}

      <TerminalHeader
        connectionState={connectionState}
        currentShell={currentShell}
        shells={shells}
        onShellChange={handleShellChange}
        onToggleSidebar={() => setSidebarOpen(s => !s)}
        onSplitHorizontal={() => splitPane(paneId, 'h')}
        onSplitVertical={() => splitPane(paneId, 'v')}
        onClose={() => closePane(paneId)}
        canSplit={paneCount < 4}
        canClose={paneCount > 1}
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
        pendingImagePath={pendingImagePath ?? droppedImagePath}
        onImagePathConsumed={() => { setPendingImagePath(null); onDroppedPathConsumed?.(); }}
        onImagePaste={(b64, ext) => sendMessage({ type: 'save-image', base64: b64, ext })}
      />
    </div>
  );
}
