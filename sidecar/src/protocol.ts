// Client -> Server messages
export type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'spawn'; shell: string; cols?: number; rows?: number }
  | { type: 'kill' }
  | { type: 'history-list' }
  | { type: 'history-replay'; sessionId: number }
  | { type: 'save-image'; base64: string };

export interface SessionMeta {
  id: number;
  shell: string;
  cwd: string | null;
  startedAt: number;
  endedAt: number | null;
  isOrphan: boolean;
}

// Server -> Client messages
export type ServerMessage =
  | { type: 'output'; data: string }
  | { type: 'pty-ready'; pid: number; shell: string }
  | { type: 'pty-exit'; exitCode: number }
  | { type: 'shell-list'; shells: string[] }
  | { type: 'error'; message: string }
  | { type: 'session-start'; sessionId: number }
  | { type: 'history-sessions'; sessions: SessionMeta[] }
  | { type: 'history-chunk'; data: string }
  | { type: 'history-end'; sessionId: number }
  | { type: 'save-image-result'; path: string };
