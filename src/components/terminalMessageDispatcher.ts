import type { ServerMessage, AgentEvent, Annotation, WindowThumbnail } from '../protocol';
import { formatCaptureBlock } from '../utils/formatCaptureBlock';

export interface DispatchCallbacks {
  write: (data: string) => void;
  setCurrentShell: (shell: string) => void;
  setShells: (shells: string[]) => void;
  setPendingImagePath: (path: string) => void;
  setPickerWindows: (windows: WindowThumbnail[]) => void;
  setPendingInjection: (block: string) => void;
  pushAgentEvent: (event: AgentEvent) => void;
  appendPmChatToken: (requestId: string, token: string) => void;
  finalizePmChatResponse: (requestId: string) => void;
  setPmChatStreaming: (streaming: boolean) => void;
  setPmChatHealth: (ok: boolean, error?: string) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  setWalkthroughStep: (step: any) => void;
  handleFocusEvent: (event: 'show' | 'hide' | 'target-lost') => void;
  setPlanContent: (content: string | null, fileName: string | null) => void;
  setDiffs: (raw: string) => void;
  dispatchAskCodeResponse: (msg: ServerMessage) => void;
  handleModeStatus: (status: { active: boolean; modeId?: string; activatedAt?: number }) => void;
  handleCrashRecovery: () => void;
  handleHistoryMessage: (msg: ServerMessage) => void;
  // Context for pty-exit:
  currentShell: string | null;
  paneId: string;
  shells: string[];
  recordCompleted: () => void;
  completionStatsEnabled: boolean;
  notifyExit: (info: { exitCode: number; shell: string; paneId: string }) => void;
  scheduleRespawn: () => void;
}

/**
 * Resolve a full shell path to a short name from the known shells list.
 * Returns the matching short name, or the original path if no match found.
 */
export function resolveShellName(fullPath: string, shells: string[]): string {
  const match = shells.find(s => fullPath.toLowerCase().endsWith(s.toLowerCase()));
  return match ?? fullPath;
}

/**
 * Pure dispatch function extracted from TerminalPane's handleServerMessage.
 * Routes each ServerMessage type to the appropriate callback.
 */
export function dispatchServerMessage(msg: ServerMessage, cb: DispatchCallbacks): void {
  switch (msg.type) {
    case 'output':
      cb.write(msg.data);
      break;
    case 'pty-ready': {
      const shortName = resolveShellName(msg.shell, cb.shells);
      cb.setCurrentShell(shortName);
      break;
    }
    case 'pty-exit':
      cb.write(`\r\n[Process exited with code ${msg.exitCode}]\r\n`);
      if (cb.completionStatsEnabled && msg.exitCode === 0) {
        cb.recordCompleted();
      }
      cb.notifyExit({
        exitCode: msg.exitCode,
        shell: cb.currentShell ?? 'unknown',
        paneId: cb.paneId,
      });
      cb.scheduleRespawn();
      break;
    case 'shell-list':
      cb.setShells(msg.shells);
      break;
    case 'error':
      cb.write(`\r\n[Error: ${msg.message}]\r\n`);
      break;
    case 'save-image-result':
      cb.setPendingImagePath(msg.path);
      break;
    case 'window-thumbnails':
      cb.setPickerWindows(msg.windows);
      break;
    case 'capture-result-with-metadata': {
      const block = formatCaptureBlock({
        path: msg.path,
        title: msg.title,
        bounds: msg.bounds,
        captureSize: msg.captureSize,
        dpiScale: msg.dpiScale,
        shell: cb.currentShell,
      });
      cb.setPendingInjection(block);
      break;
    }
    case 'agent-event':
      cb.pushAgentEvent(msg.event);
      break;
    case 'pm-chat-token':
      cb.appendPmChatToken(msg.requestId, msg.token);
      break;
    case 'pm-chat-done':
      cb.finalizePmChatResponse(msg.requestId);
      break;
    case 'pm-chat-error':
      cb.setPmChatStreaming(false);
      cb.appendPmChatToken(msg.requestId, `\n[Error: ${msg.error}]`);
      cb.finalizePmChatResponse(msg.requestId);
      break;
    case 'pm-chat-health':
      cb.setPmChatHealth(msg.ok, msg.error);
      break;
    case 'annotation-update':
      cb.setAnnotations(msg.annotations);
      break;
    case 'walkthrough-step':
      cb.setWalkthroughStep(msg.step);
      break;
    case 'overlay-focus':
      cb.handleFocusEvent(msg.event);
      break;
    case 'plan-update':
      cb.setPlanContent(msg.content, msg.fileName);
      break;
    case 'diff-result':
      cb.setDiffs(msg.raw);
      break;
    case 'ask-code-response':
      cb.dispatchAskCodeResponse(msg);
      break;
    case 'mode-status':
      cb.handleModeStatus(msg);
      break;
    case 'mode-crash-recovery':
      cb.handleCrashRecovery();
      break;
    default:
      cb.handleHistoryMessage(msg);
      break;
  }
}
