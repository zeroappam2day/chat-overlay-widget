// Client -> Server messages
export type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'spawn'; shell: string; cols?: number; rows?: number }
  | { type: 'kill' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'output'; data: string }
  | { type: 'pty-ready'; pid: number; shell: string }
  | { type: 'pty-exit'; exitCode: number }
  | { type: 'shell-list'; shells: string[] }
  | { type: 'error'; message: string };
