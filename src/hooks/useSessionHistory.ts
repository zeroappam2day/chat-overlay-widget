import { useState, useCallback, useRef } from 'react';
import type { SessionMeta, ServerMessage } from '../protocol';

interface UseSessionHistoryOptions {
  sendMessage: (msg: { type: 'history-list' } | { type: 'history-replay'; sessionId: number }) => void;
}

interface UseSessionHistoryReturn {
  sessions: SessionMeta[];
  replaySessionId: number | null;
  replayChunks: string[];
  replayComplete: boolean;
  fetchSessions: () => void;
  startReplay: (sessionId: number) => void;
  closeReplay: () => void;
  handleHistoryMessage: (msg: ServerMessage) => boolean;
}

export function useSessionHistory({ sendMessage }: UseSessionHistoryOptions): UseSessionHistoryReturn {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [replaySessionId, setReplaySessionId] = useState<number | null>(null);
  const [replayComplete, setReplayComplete] = useState(false);
  // Use ref to accumulate chunks without triggering re-renders on each chunk
  const replayChunksRef = useRef<string[]>([]);
  // Counter state to trigger re-render when new chunks arrive
  const [chunkCount, setChunkCount] = useState(0);

  const fetchSessions = useCallback(() => {
    sendMessage({ type: 'history-list' });
  }, [sendMessage]);

  const startReplay = useCallback((sessionId: number) => {
    replayChunksRef.current = [];
    setChunkCount(0);
    setReplayComplete(false);
    setReplaySessionId(sessionId);
    sendMessage({ type: 'history-replay', sessionId });
  }, [sendMessage]);

  const closeReplay = useCallback(() => {
    setReplaySessionId(null);
    replayChunksRef.current = [];
    setChunkCount(0);
    setReplayComplete(false);
  }, []);

  const handleHistoryMessage = useCallback((msg: ServerMessage): boolean => {
    switch (msg.type) {
      case 'history-sessions':
        setSessions(msg.sessions);
        return true;
      case 'history-chunk':
        replayChunksRef.current = [...replayChunksRef.current, msg.data];
        setChunkCount(c => c + 1);
        return true;
      case 'history-end':
        setReplayComplete(true);
        return true;
      case 'session-start':
        // No UI action needed yet — session tracking is for future use
        return true;
      default:
        return false;
    }
  }, []);

  // Expose chunks as array derived from ref, driven by chunkCount to trigger re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const replayChunks = chunkCount >= 0 ? replayChunksRef.current : [];

  return {
    sessions,
    replaySessionId,
    replayChunks,
    replayComplete,
    fetchSessions,
    startReplay,
    closeReplay,
    handleHistoryMessage,
  };
}
