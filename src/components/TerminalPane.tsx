import { useCallback, useEffect, useRef, useState } from 'react';
import { useTerminal } from '../hooks/useTerminal';
import { useWebSocket } from '../hooks/useWebSocket';
import type { ServerMessage } from '../protocol';

export function TerminalPane() {
  const [shells, setShells] = useState<string[]>([]);
  const [currentShell, setCurrentShell] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>('waiting');
  const spawnedRef = useRef(false);
  const getDimensionsRef = useRef<() => { cols: number; rows: number }>(() => ({ cols: 80, rows: 24 }));
  const writeRef = useRef<(data: string) => void>(() => { /* noop until terminal mounts */ });
  const sendMessageRef = useRef<(msg: Parameters<ReturnType<typeof useWebSocket>['sendMessage']>[0]) => void>(() => { /* noop until ws connects */ });

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
    }
  }, [shells]);

  const { state, sendMessage } = useWebSocket({ onMessage: handleServerMessage });
  sendMessageRef.current = sendMessage;

  const handleTerminalData = useCallback((data: string) => {
    sendMessage({ type: 'input', data });
  }, [sendMessage]);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    sendMessage({ type: 'resize', cols, rows });
  }, [sendMessage]);

  const { containerRef, writeToTerminal, getTerminalDimensions } = useTerminal({
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

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e]">
      {/* Terminal header bar */}
      <div className="flex items-center h-10 px-3 bg-[#2d2d2d] border-b border-[#404040] text-sm text-gray-300 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-400' :
              connectionState === 'error' ? 'bg-red-400' : 'bg-yellow-400'
            }`}
          />
          <span className="text-xs text-gray-500">
            {currentShell ?? 'No shell'}
          </span>
          {shells.length > 1 && (
            <select
              value={currentShell ?? ''}
              onChange={(e) => {
                const newShell = e.target.value;
                if (newShell && newShell !== currentShell) {
                  spawnedRef.current = true;
                  sendMessage({ type: 'kill' });
                  const dims = getTerminalDimensions();
                  sendMessage({ type: 'spawn', shell: newShell, cols: dims.cols, rows: dims.rows });
                }
              }}
              className="ml-3 bg-[#3c3c3c] text-gray-300 text-xs border border-[#555] rounded px-2 py-1 outline-none cursor-pointer hover:bg-[#4c4c4c]"
            >
              {shells.map((shell) => (
                <option key={shell} value={shell}>
                  {shell}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Terminal container — must have explicit height for xterm.js FitAddon */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
