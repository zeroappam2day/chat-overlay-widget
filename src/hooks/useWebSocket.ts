import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import type { ClientMessage, ServerMessage } from '../protocol';

type ConnectionState = 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface UseWebSocketOptions {
  onMessage: (msg: ServerMessage) => void;
}

interface UseWebSocketReturn {
  state: ConnectionState;
  sendMessage: (msg: ClientMessage) => void;
}

async function connectWithRetry(port: number, maxRetries = 10): Promise<WebSocket> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('connection failed'));
      });
      return ws;
    } catch {
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }
  throw new Error('Sidecar not reachable after max retries');
}

export function useWebSocket({ onMessage }: UseWebSocketOptions): UseWebSocketReturn {
  const [state, setState] = useState<ConnectionState>('waiting');
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const sendMessage = useCallback((msg: ClientMessage) => {
    console.log('[ws] sending:', msg.type, JSON.stringify(msg).substring(0, 200));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('[ws] send failed — socket not open, readyState:', wsRef.current?.readyState);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let portRef: number | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectingInProgress = false;

    async function connect(port: number, isReconnect = false) {
      if (connectingInProgress) return;
      connectingInProgress = true;
      portRef = port;
      setState(isReconnect ? 'reconnecting' : 'connecting');
      try {
        const ws = await connectWithRetry(port);
        if (cancelled) { ws.close(); return; }
        wsRef.current = ws;
        setState('connected');

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as ServerMessage;
            console.log('[ws] received:', msg.type, JSON.stringify(msg).substring(0, 200));
            onMessageRef.current(msg);
          } catch {
            console.error('[ws] failed to parse message:', e.data);
          }
        };

        ws.onclose = () => {
          if (!cancelled && portRef) {
            console.log('[ws] connection lost — reconnecting in 2s');
            setState('reconnecting');
            reconnectTimer = setTimeout(() => {
              if (!cancelled && portRef) connect(portRef, true);
            }, 2000);
          }
        };
      } catch {
        if (!cancelled) setState('error');
      } finally {
        connectingInProgress = false;
      }
    }

    invoke<number | null>('get_sidecar_port').then((port) => {
      if (port && !cancelled) connect(port);
    });

    const unlisten = listen<number>('sidecar-port', (event) => {
      if (!cancelled) connect(event.payload);
    });

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      unlisten.then(fn => fn());
    };
  }, []);

  return { state, sendMessage };
}
