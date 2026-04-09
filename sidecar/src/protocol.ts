import type { AgentEvent } from './agentEvent.js';
import type { Annotation, AnnotationPayload } from './annotationStore.js';

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
  | { type: 'capture-window-with-metadata'; hwnd: number; pid: number; title: string }
  | { type: 'set-flags'; flags: Record<string, boolean> }
  | { type: 'plan-read'; cwd?: string }
  | { type: 'request-diff'; cwd?: string }
  | { type: 'ask-code'; requestId: string; prompt: string; cwd?: string }
  | { type: 'cancel-ask-code'; requestId: string }
  | { type: 'annotations'; payload: AnnotationPayload }
  | { type: 'consent-plan-response'; planId: string; approved: boolean }
  | { type: 'consent-trust-response'; trustId: string; approved: boolean }
  | { type: 'mode-activate'; modeId: 'walkMeThrough' | 'workWithMe' }
  | { type: 'mode-deactivate' }
  | { type: 'cancel-pending-action'; actionId: string }
  | { type: 'pm-chat'; requestId: string; message: string; model: string; temperature: number; systemPrompt: string; endpoint?: string }
  | { type: 'pm-chat-cancel'; requestId: string }
  | { type: 'pm-chat-health-check' };

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
  | { type: 'capture-result-with-metadata'; path: string; title: string; hwnd: number; pid: number; bounds: { x: number; y: number; w: number; h: number }; captureSize: { w: number; h: number }; dpiScale: number }
  | { type: 'agent-event'; event: AgentEvent }
  | { type: 'auto-trust-event'; action: 'accepted' | 'blocked'; pattern: string; timestamp: string }
  | { type: 'plan-update'; fileName: string | null; content: string | null; mtime: number }
  | { type: 'diff-result'; raw: string; cwd: string; error?: string }
  | { type: 'ask-code-response'; requestId: string; messageType: 'chunk' | 'error' | 'done'; text?: string; exitCode?: number }
  | { type: 'annotation-update'; annotations: Annotation[] }
  | { type: 'walkthrough-step'; step: { stepId: string; title: string; instruction: string; currentStep: number; totalSteps: number } | null }
  | { type: 'consent-plan-request'; planId: string; description: string; actions: Array<{ type: string; description: string }>; targetWindow?: string }
  | { type: 'consent-trust-request'; trustId: string; targetTitle: string; durationSec: number; allowedActions: string[] }
  | { type: 'consent-trust-active'; trustId: string; expiresAt: number }
  | { type: 'consent-trust-expired'; trustId: string }
  | { type: 'task-state-change'; task: { taskId: string; name: string; status: string; paneId: string; lastOutput?: string } }
  | { type: 'workflow-recording-status'; recording: boolean; workflowId?: string; stepCount?: number }
  | { type: 'workflow-replay-progress'; workflowId: string; step: number; totalSteps: number; status: string; error?: string }
  | { type: 'mode-status'; active: boolean; modeId?: string; activatedAt?: number }
  | { type: 'mode-crash-recovery'; previousMode: string; flagsRestored: boolean }
  | { type: 'action-announced'; actionId: string; description: string; delayMs: number }
  | { type: 'action-cancelled'; actionId: string }
  | { type: 'pm-chat-token'; requestId: string; token: string }
  | { type: 'pm-chat-done'; requestId: string }
  | { type: 'pm-chat-error'; requestId: string; error: string }
  | { type: 'pm-chat-health'; ok: boolean; error?: string };
