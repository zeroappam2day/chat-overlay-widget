// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { resolveShellName, dispatchServerMessage, type DispatchCallbacks } from './terminalMessageDispatcher';

function makeCallbacks(overrides?: Partial<DispatchCallbacks>): DispatchCallbacks {
  return {
    write: vi.fn(),
    setCurrentShell: vi.fn(),
    setShells: vi.fn(),
    setPendingImagePath: vi.fn(),
    setPickerWindows: vi.fn(),
    setPendingInjection: vi.fn(),
    pushAgentEvent: vi.fn(),
    appendPmChatToken: vi.fn(),
    finalizePmChatResponse: vi.fn(),
    setPmChatStreaming: vi.fn(),
    setPmChatHealth: vi.fn(),
    setAnnotations: vi.fn(),
    setWalkthroughStep: vi.fn(),
    handleFocusEvent: vi.fn(),
    setPlanContent: vi.fn(),
    setDiffs: vi.fn(),
    dispatchAskCodeResponse: vi.fn(),
    handleModeStatus: vi.fn(),
    handleCrashRecovery: vi.fn(),
    handleHistoryMessage: vi.fn(),
    currentShell: null,
    paneId: 'test-pane',
    shells: ['powershell.exe', 'cmd.exe'],
    recordCompleted: vi.fn(),
    completionStatsEnabled: false,
    notifyExit: vi.fn(),
    scheduleRespawn: vi.fn(),
    ...overrides,
  };
}

describe('resolveShellName', () => {
  it('resolves full Windows path to short name', () => {
    expect(resolveShellName('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', ['powershell.exe', 'cmd.exe']))
      .toBe('powershell.exe');
  });

  it('resolves cmd.exe from full path', () => {
    expect(resolveShellName('C:\\Windows\\System32\\cmd.exe', ['powershell.exe', 'cmd.exe']))
      .toBe('cmd.exe');
  });

  it('returns original path when no match in shells list', () => {
    expect(resolveShellName('/usr/bin/bash', ['powershell.exe']))
      .toBe('/usr/bin/bash');
  });

  it('returns short name when already short', () => {
    expect(resolveShellName('powershell.exe', ['powershell.exe']))
      .toBe('powershell.exe');
  });
});

describe('dispatchServerMessage', () => {
  it('output → calls write with data', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'output', data: 'hello' }, cb);
    expect(cb.write).toHaveBeenCalledWith('hello');
  });

  it('pty-ready → resolves shell name and calls setCurrentShell', () => {
    const cb = makeCallbacks({ shells: ['powershell.exe'] });
    dispatchServerMessage({ type: 'pty-ready', pid: 1234, shell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' }, cb);
    expect(cb.setCurrentShell).toHaveBeenCalledWith('powershell.exe');
  });

  it('pty-exit → writes exit message and calls notifyExit and scheduleRespawn', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'pty-exit', exitCode: 0 }, cb);
    expect(cb.write).toHaveBeenCalledWith(expect.stringContaining('exited with code 0'));
    expect(cb.notifyExit).toHaveBeenCalledWith({ exitCode: 0, shell: 'unknown', paneId: 'test-pane' });
    expect(cb.scheduleRespawn).toHaveBeenCalled();
  });

  it('pty-exit with completionStats enabled and exitCode 0 → calls recordCompleted', () => {
    const cb = makeCallbacks({ completionStatsEnabled: true });
    dispatchServerMessage({ type: 'pty-exit', exitCode: 0 }, cb);
    expect(cb.recordCompleted).toHaveBeenCalled();
  });

  it('pty-exit with non-zero exitCode → does NOT call recordCompleted', () => {
    const cb = makeCallbacks({ completionStatsEnabled: true });
    dispatchServerMessage({ type: 'pty-exit', exitCode: 1 }, cb);
    expect(cb.recordCompleted).not.toHaveBeenCalled();
  });

  it('shell-list → calls setShells', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'shell-list', shells: ['bash', 'zsh'] }, cb);
    expect(cb.setShells).toHaveBeenCalledWith(['bash', 'zsh']);
  });

  it('error → calls write with error message', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'error', message: 'fail' }, cb);
    expect(cb.write).toHaveBeenCalledWith(expect.stringContaining('fail'));
  });

  it('save-image-result → calls setPendingImagePath', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'save-image-result', path: '/tmp/img.png' }, cb);
    expect(cb.setPendingImagePath).toHaveBeenCalledWith('/tmp/img.png');
  });

  it('agent-event → calls pushAgentEvent', () => {
    const cb = makeCallbacks();
    const event = { tool: 'test', type: 'info', timestamp: '', sessionId: '', payload: {} };
    dispatchServerMessage({ type: 'agent-event', event } as any, cb);
    expect(cb.pushAgentEvent).toHaveBeenCalledWith(event);
  });

  it('pm-chat-token → calls appendPmChatToken', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'pm-chat-token', requestId: 'r1', token: 'hi' }, cb);
    expect(cb.appendPmChatToken).toHaveBeenCalledWith('r1', 'hi');
  });

  it('pm-chat-done → calls finalizePmChatResponse', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'pm-chat-done', requestId: 'r1' }, cb);
    expect(cb.finalizePmChatResponse).toHaveBeenCalledWith('r1');
  });

  it('pm-chat-error → sets streaming false, appends error token, finalizes', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'pm-chat-error', requestId: 'r1', error: 'err' }, cb);
    expect(cb.setPmChatStreaming).toHaveBeenCalledWith(false);
    expect(cb.appendPmChatToken).toHaveBeenCalledWith('r1', expect.stringContaining('err'));
    expect(cb.finalizePmChatResponse).toHaveBeenCalledWith('r1');
  });

  it('pm-chat-health → calls setPmChatHealth', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'pm-chat-health', ok: true }, cb);
    expect(cb.setPmChatHealth).toHaveBeenCalledWith(true, undefined);
  });

  it('annotation-update → calls setAnnotations', () => {
    const cb = makeCallbacks();
    const annotations = [{ id: '1', type: 'box' as const, x: 0, y: 0 }];
    dispatchServerMessage({ type: 'annotation-update', annotations }, cb);
    expect(cb.setAnnotations).toHaveBeenCalledWith(annotations);
  });

  it('plan-update → calls setPlanContent', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'plan-update', fileName: 'plan.md', content: '# Plan', mtime: 123 }, cb);
    expect(cb.setPlanContent).toHaveBeenCalledWith('# Plan', 'plan.md');
  });

  it('diff-result → calls setDiffs with raw', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'diff-result', raw: 'diff --git', cwd: '/tmp' }, cb);
    expect(cb.setDiffs).toHaveBeenCalledWith('diff --git');
  });

  it('mode-status → calls handleModeStatus', () => {
    const cb = makeCallbacks();
    const msg = { type: 'mode-status' as const, active: true, modeId: 'walkMeThrough' };
    dispatchServerMessage(msg, cb);
    expect(cb.handleModeStatus).toHaveBeenCalledWith(msg);
  });

  it('mode-crash-recovery → calls handleCrashRecovery', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'mode-crash-recovery', previousMode: 'x', flagsRestored: true }, cb);
    expect(cb.handleCrashRecovery).toHaveBeenCalled();
  });

  it('unknown type → calls handleHistoryMessage', () => {
    const cb = makeCallbacks();
    const msg = { type: 'history-sessions', sessions: [] } as any;
    dispatchServerMessage(msg, cb);
    expect(cb.handleHistoryMessage).toHaveBeenCalledWith(msg);
  });

  it('overlay-focus show → calls handleFocusEvent with "show"', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'overlay-focus', event: 'show' }, cb);
    expect(cb.handleFocusEvent).toHaveBeenCalledWith('show');
  });

  it('overlay-focus hide → calls handleFocusEvent with "hide"', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'overlay-focus', event: 'hide' }, cb);
    expect(cb.handleFocusEvent).toHaveBeenCalledWith('hide');
  });

  it('overlay-focus target-lost → calls handleFocusEvent with "target-lost"', () => {
    const cb = makeCallbacks();
    dispatchServerMessage({ type: 'overlay-focus', event: 'target-lost' }, cb);
    expect(cb.handleFocusEvent).toHaveBeenCalledWith('target-lost');
  });
});
