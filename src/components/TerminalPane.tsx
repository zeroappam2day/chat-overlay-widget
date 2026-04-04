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
import { WindowPicker } from './WindowPicker';
import type { ServerMessage, WindowThumbnail } from '../protocol';
import { formatCaptureBlock } from '../utils/formatCaptureBlock';
import { useAgentEventStore } from '../store/agentEventStore';
import { useFlagSync } from '../hooks/useFlagSync';
import { usePlanStore } from '../store/planStore';
import { useDiffStore } from '../store/diffStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';
import { parseUnifiedDiff } from '../lib/diffParser';
import { EnhancedDiffPanel as DiffPanel } from './EnhancedDiffPanel';
import { BookmarkBar } from './BookmarkBar';
import { PromptHistoryPanel } from './PromptHistoryPanel';
import { usePromptHistoryStore } from '../store/promptHistoryStore';
import { ExitNotifier } from '../lib/exitNotifier';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerWindows, setPickerWindows] = useState<WindowThumbnail[]>([]);
  // Pending image path from clipboard paste (sidecar save-image-result response)
  const [pendingImagePath, setPendingImagePath] = useState<string | null>(null);
  // Pending capture block from window selection (sidecar capture-result-with-metadata response)
  const [pendingInjection, setPendingInjection] = useState<string | null>(null);
  const [inputBarHeight, setInputBarHeight] = useState(144); // INBAR-01: ~144px default
  const [lastSentCommand, setLastSentCommand] = useState('');
  const [bookmarkBarVisible, setBookmarkBarVisible] = useState(true); // Phase 8: toggled via Ctrl+B
  const handleRequestDiffRef = useRef<(() => void) | null>(null); // Phase 8: ref for keyboard shortcut
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(144);
  const spawnedRef = useRef(false);
  const getDimensionsRef = useRef<() => { cols: number; rows: number }>(() => ({ cols: 80, rows: 24 }));
  const writeRef = useRef<(data: string) => void>(() => { /* noop until terminal mounts */ });
  const sendMessageRef = useRef<(msg: Parameters<ReturnType<typeof useWebSocket>['sendMessage']>[0]) => void>(() => { /* noop until ws connects */ });

  // Exit notifier (Phase 7) — persists across renders, cleaned up on unmount
  const exitNotifierRef = useRef<ExitNotifier>(new ExitNotifier(useFeatureFlagStore.getState().exitNotifications));

  // Sync exitNotifier enabled state with feature flag
  useEffect(() => {
    const unsub = useFeatureFlagStore.subscribe((state) => {
      exitNotifierRef.current.enabled = state.exitNotifications;
    });
    return () => unsub();
  }, []);

  // Cleanup notifier on unmount
  useEffect(() => {
    const notifier = exitNotifierRef.current;
    return () => notifier.destroy();
  }, []);

  // Pane store bindings
  const setActivePane = usePaneStore(state => state.setActivePane);
  const isActive = usePaneStore(state => state.activePaneId === paneId);
  const splitPane = usePaneStore(state => state.splitPane);
  const closePane = usePaneStore(state => state.closePane);
  const paneCount = usePaneStore(state => state.getPaneCount());

  // Use a ref for isActive so keyboard handlers don't have stale closure issues
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // Ref for pickerOpen to avoid stale closure in keyboard handler (D-12 pattern)
  const pickerOpenRef = useRef(false);
  useEffect(() => { pickerOpenRef.current = pickerOpen; }, [pickerOpen]);

  // Ref for currentShell to avoid stale closure in handleServerMessage (D-12 pattern)
  const currentShellRef = useRef<string | null>(null);
  useEffect(() => { currentShellRef.current = currentShell; }, [currentShell]);

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
        // Desktop notification (Phase 7) — fires only when window not focused and flag ON
        exitNotifierRef.current.notify({
          exitCode: msg.exitCode,
          shell: currentShellRef.current ?? 'unknown',
          paneId,
        });
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
      case 'window-thumbnails':
        setPickerWindows(msg.windows);
        break;
      case 'capture-result-with-metadata': {
        const block = formatCaptureBlock({
          path: msg.path,
          title: msg.title,
          bounds: msg.bounds,
          captureSize: msg.captureSize,
          dpiScale: msg.dpiScale,
          shell: currentShellRef.current,
        });
        setPendingInjection(block);
        break;
      }
      case 'agent-event':
        useAgentEventStore.getState().pushEvent(msg.event);
        break;
      case 'plan-update':
        usePlanStore.getState().setContent(msg.content, msg.fileName);
        break;
      case 'diff-result': {
        const parsed = parseUnifiedDiff(msg.raw);
        useDiffStore.getState().setDiffs(parsed, msg.raw);
        break;
      }
      case 'ask-code-response': {
        // Forward to AskCodeCard via custom event (Phase 16)
        document.dispatchEvent(new CustomEvent('ask-code-response', { detail: msg }));
        break;
      }
      default:
        // Delegate history-sessions, history-chunk, history-end, session-start
        handleHistoryMessageRef.current(msg);
        break;
    }
  }, [shells, paneId]);

  const { state, sendMessage } = useWebSocket({ onMessage: handleServerMessage });
  sendMessageRef.current = sendMessage;

  // Sync feature flags to sidecar (Phase 1: output batching)
  useFlagSync(sendMessage, state === 'connected');

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

    // Phase 8: keyboard shortcut events (dispatched by useShortcuts)
    const gatedRequestDiff = () => {
      if (!isActiveRef.current) return;
      handleRequestDiffRef.current?.();
    };
    document.addEventListener('keyboard-request-diff', gatedRequestDiff);

    const gatedToggleBookmarks = () => {
      if (!isActiveRef.current) return;
      setBookmarkBarVisible(prev => !prev);
    };
    document.addEventListener('toggle-bookmark-bar', gatedToggleBookmarks);

    const handler = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return; // only active pane responds
      if (pickerOpenRef.current) return; // picker handles its own keys via stopPropagation (D-12)
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

    // Phase 16: Forward ask-code-send events from DiffPanel to WebSocket
    const handleAskCodeSend = (e: Event) => {
      if (!isActiveRef.current) return;
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail === 'object' && detail.type) {
        sendMessageRef.current(detail);
      }
    };
    document.addEventListener('ask-code-send', handleAskCodeSend);

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
        sendMessageRef.current({ type: 'save-image', base64 });
      };
      reader.readAsDataURL(blob);
    };
    document.addEventListener('paste', handleDocPaste);

    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('terminal-toggle-search', gatedToggleSearch);
      document.removeEventListener('keyboard-request-diff', gatedRequestDiff);
      document.removeEventListener('toggle-bookmark-bar', gatedToggleBookmarks);
      document.removeEventListener('paste', handleDocPaste);
      document.removeEventListener('ask-code-send', handleAskCodeSend);
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
    // Track last sent command for bookmark bar (Phase 5)
    const clean = text.replace(/\r$/, '').trim();
    if (clean) {
      setLastSentCommand(clean);
      // Record in prompt history (Phase 6) — gated by feature flag
      if (useFeatureFlagStore.getState().promptHistory) {
        usePromptHistoryStore.getState().addEntry(clean, paneId);
      }
    }
  }, [sendMessage]);

  const handleShellChange = useCallback((newShell: string) => {
    if (newShell && newShell !== currentShell) {
      spawnedRef.current = true;
      const dims = getTerminalDimensions();
      sendMessage({ type: 'spawn', shell: newShell, cols: dims.cols, rows: dims.rows });
    }
  }, [currentShell, sendMessage, getTerminalDimensions]);

  const handleOpenPicker = useCallback(() => {
    setPickerOpen(true);
    sendMessage({ type: 'list-windows-with-thumbnails' });
  }, [sendMessage]);

  // Close picker BEFORE sending WS message so UI does not freeze during sidecar spawnSync capture
  const handleWindowSelect = useCallback((window: WindowThumbnail) => {
    setPickerOpen(false);
    sendMessage({
      type: 'capture-window-with-metadata',
      hwnd: window.hwnd,
      pid: window.pid,
      title: window.title,
    });
  }, [sendMessage]);

  const handleRequestDiff = useCallback(() => {
    const diffFlag = useFeatureFlagStore.getState().diffViewer;
    if (!diffFlag) return;
    sendMessage({ type: 'request-diff' });
  }, [sendMessage]);
  handleRequestDiffRef.current = handleRequestDiff; // Phase 8: sync ref for keyboard shortcut

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = inputBarHeight;
    e.preventDefault(); // prevent text selection during drag
  }, [inputBarHeight]);

  // Input bar drag resize — document-level listeners for mouseup-outside-window safety (Pitfall 1)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = dragStartYRef.current - e.clientY; // dragging up = taller input bar
      const newHeight = Math.max(80, dragStartHeightRef.current + delta); // 80px min floor
      setInputBarHeight(newHeight);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // stable — uses refs only, no deps needed (Pitfall 2)

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
        onTogglePicker={handleOpenPicker}
        onRequestDiff={handleRequestDiff}
        onToggleHistory={() => document.dispatchEvent(new Event('toggle-prompt-history'))}
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
      <div className={`relative flex-1 min-h-[60px] ${replaySessionId !== null ? 'hidden' : ''}`}>
        {searchOpen && (
          <SearchOverlay
            searchAddon={searchAddonRef.current}
            onClose={() => setSearchOpen(false)}
          />
        )}
        {pickerOpen && (
          <WindowPicker
            windows={pickerWindows}
            onClose={() => setPickerOpen(false)}
            onRefresh={() => sendMessage({ type: 'list-windows-with-thumbnails' })}
            onSelect={handleWindowSelect}
          />
        )}
        {/* Terminal mount point — must have explicit height for xterm.js FitAddon */}
        <div ref={containerRef} className="h-full" />
      </div>

      {/* Input bar drag handle — INBAR-02 (per D-09) */}
      <div
        className="shrink-0 h-1 bg-[#404040] hover:bg-[#007acc] transition-colors cursor-row-resize"
        onMouseDown={handleDragStart}
      />

      {/* Bookmark bar (Phase 5) — rendered above input, gated by terminalBookmarks flag + Phase 8 toggle */}
      {bookmarkBarVisible && <BookmarkBar onSendCommand={handleSendInput} currentInput={lastSentCommand} />}

      <ChatInputBar
        onSend={handleSendInput}
        disabled={connectionState !== 'connected' || replaySessionId !== null}
        pendingImagePath={pendingImagePath ?? droppedImagePath}
        onImagePathConsumed={() => { setPendingImagePath(null); onDroppedPathConsumed?.(); }}
        onImagePaste={(b64) => sendMessage({ type: 'save-image', base64: b64 })}
        currentShell={currentShell}
        height={inputBarHeight}
        pendingInjection={pendingInjection}
        onInjectionConsumed={() => setPendingInjection(null)}
      />

      {/* Diff panel (Phase 4) — portal-rendered, gated by diffViewer flag */}
      <DiffPanel />

      {/* Prompt history panel (Phase 6) — portal-rendered, gated by promptHistory flag */}
      <PromptHistoryPanel onInsertCommand={handleSendInput} />
    </div>
  );
}
