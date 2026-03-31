// Copied from sidecar/src/protocol.ts — keep in sync manually.
// Source of truth: sidecar/src/protocol.ts (D-12)

// Client -> Server messages
export type ClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'spawn'; shell: string; cols?: number; rows?: number }
  | { type: 'kill' }
  | { type: 'history-list' }
  | { type: 'history-replay'; sessionId: number }
  | { type: 'save-image'; base64: string }
  | { type: 'list-windows-with-thumbnails' }
  | { type: 'capture-window-with-metadata'; hwnd: number; pid: number; title: string };

export interface SessionMeta {
  id: number;
  shell: string;
  cwd: string | null;
  startedAt: number;
  endedAt: number | null;
  isOrphan: boolean;
}

/** A single window's thumbnail result from batch capture. */
export interface WindowThumbnail {
  title: string;
  processName: string;
  /** Window handle as decimal integer via ToInt64(). Always <= 0xFFFFFFFF on x64. */
  hwnd: number;
  /** Process ID of the window's owning process. */
  pid: number;
  /** Base64-encoded PNG thumbnail (240x180). Absent if capture failed for this window. */
  thumbnail?: string;
  /** Error description if thumbnail capture failed for this window. */
  error?: string;
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
  | { type: 'save-image-result'; path: string }
  | { type: 'window-thumbnails'; windows: WindowThumbnail[] }
  | { type: 'capture-result-with-metadata'; path: string; title: string; hwnd: number; pid: number; bounds: { x: number; y: number; w: number; h: number }; captureSize: { w: number; h: number }; dpiScale: number };
