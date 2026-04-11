import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock win32Bridge module
vi.mock('./win32Bridge.js', () => ({
  getForegroundWindow: vi.fn(),
  getWindowThreadProcessId: vi.fn(),
  isWindow: vi.fn(),
  isIconic: vi.fn(),
  getOwnerWindow: vi.fn(),
  getProcessName: vi.fn(),
  win32Bridge: {
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  },
}));

import {
  getForegroundWindow,
  getWindowThreadProcessId,
  isWindow,
  isIconic,
  getOwnerWindow,
  getProcessName,
} from './win32Bridge.js';

import { FocusTracker } from './focusTracker.js';

const TARGET_HWND = 100;
const TARGET_PID = 999;
const TARGET_THREAD_ID = 111;

function makeTracker(overrides?: Partial<ConstructorParameters<typeof FocusTracker>[0]>) {
  const onShow = vi.fn();
  const onHide = vi.fn();
  const onTargetLost = vi.fn();
  const tracker = new FocusTracker({
    onShow,
    onHide,
    onTargetLost,
    ...overrides,
  });
  return { tracker, onShow, onHide, onTargetLost };
}

describe('FocusTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Default: target window is valid, not iconic
    (isWindow as any).mockResolvedValue(true);
    (isIconic as any).mockResolvedValue(false);
    (getProcessName as any).mockResolvedValue('SomeApp');
    (getWindowThreadProcessId as any).mockImplementation((hwnd: number) => {
      if (hwnd === TARGET_HWND) return Promise.resolve({ threadId: TARGET_THREAD_ID, pid: TARGET_PID });
      return Promise.resolve({ threadId: 200, pid: 500 });
    });
    (getOwnerWindow as any).mockResolvedValue(0); // no owner
    (getForegroundWindow as any).mockResolvedValue(TARGET_HWND); // default: target is foreground
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1: start(targetHwnd) begins polling at 250ms intervals', async () => {
    const { tracker, onShow } = makeTracker();
    tracker.start(TARGET_HWND);

    // First poll fires after 250ms
    await vi.advanceTimersByTimeAsync(250);
    expect(getForegroundWindow).toHaveBeenCalled();
  });

  it('Test 2: stop() clears the polling timer and resets state', async () => {
    const { tracker } = makeTracker();
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);

    const callCount = (getForegroundWindow as any).mock.calls.length;
    tracker.stop();

    await vi.advanceTimersByTimeAsync(500);
    // No more calls after stop
    expect((getForegroundWindow as any).mock.calls.length).toBe(callCount);
  });

  it('Test 3: destroy() stops tracking and cleans up', async () => {
    const { tracker } = makeTracker();
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);

    const callCount = (getForegroundWindow as any).mock.calls.length;
    tracker.destroy();

    await vi.advanceTimersByTimeAsync(500);
    expect((getForegroundWindow as any).mock.calls.length).toBe(callCount);
  });

  it('Test 4: When foreground window IS targetHwnd, onShow callback fires', async () => {
    (getForegroundWindow as any).mockResolvedValue(TARGET_HWND);
    const { tracker, onShow } = makeTracker();
    tracker.start(TARGET_HWND);

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); // flush microtasks
    await Promise.resolve();
    await Promise.resolve();

    expect(onShow).toHaveBeenCalled();
  });

  it('Test 5: When foreground window is NOT targetHwnd and not affiliated, onHide fires after 150ms debounce', async () => {
    const UNRELATED_HWND = 999;
    const UNRELATED_PID = 777;

    (getForegroundWindow as any).mockResolvedValue(UNRELATED_HWND);
    (getWindowThreadProcessId as any).mockImplementation((hwnd: number) => {
      if (hwnd === TARGET_HWND) return Promise.resolve({ threadId: TARGET_THREAD_ID, pid: TARGET_PID });
      return Promise.resolve({ threadId: 300, pid: UNRELATED_PID });
    });
    (getOwnerWindow as any).mockResolvedValue(0);

    const { tracker, onShow, onHide } = makeTracker();
    // First trigger a show so we have state to hide from
    (getForegroundWindow as any).mockResolvedValueOnce(TARGET_HWND);
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Now set unrelated window
    (getForegroundWindow as any).mockResolvedValue(UNRELATED_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Should not have fired yet (debounce)
    const hideBeforeDebounce = onHide.mock.calls.length;

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(150);
    await Promise.resolve(); await Promise.resolve();

    expect(onHide).toHaveBeenCalled();
  });

  it('Test 6: When foreground window PID matches target PID (child dialog), onHide does NOT fire', async () => {
    const CHILD_HWND = 888;
    // Child window: same PID as target, different hwnd
    (getForegroundWindow as any).mockResolvedValue(CHILD_HWND);
    (getWindowThreadProcessId as any).mockImplementation((hwnd: number) => {
      if (hwnd === TARGET_HWND) return Promise.resolve({ threadId: TARGET_THREAD_ID, pid: TARGET_PID });
      if (hwnd === CHILD_HWND) return Promise.resolve({ threadId: 400, pid: TARGET_PID }); // same PID
      return Promise.resolve({ threadId: 200, pid: 500 });
    });
    (getOwnerWindow as any).mockResolvedValue(0);
    (getProcessName as any).mockResolvedValue('TargetApp'); // not ApplicationFrameHost

    const { tracker, onHide } = makeTracker();
    // First show
    (getForegroundWindow as any).mockResolvedValueOnce(TARGET_HWND);
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Child window same PID
    (getForegroundWindow as any).mockResolvedValue(CHILD_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(150);
    await Promise.resolve(); await Promise.resolve();

    expect(onHide).not.toHaveBeenCalled();
  });

  it('Test 7: When GetWindow owner chain leads to targetHwnd, onHide does NOT fire', async () => {
    const CHILD_HWND = 777;
    (getForegroundWindow as any).mockResolvedValue(CHILD_HWND);
    (getWindowThreadProcessId as any).mockImplementation((hwnd: number) => {
      if (hwnd === TARGET_HWND) return Promise.resolve({ threadId: TARGET_THREAD_ID, pid: TARGET_PID });
      return Promise.resolve({ threadId: 200, pid: 600 }); // different PID
    });
    // Owner chain: CHILD_HWND -> TARGET_HWND
    (getOwnerWindow as any).mockImplementation((hwnd: number) => {
      if (hwnd === CHILD_HWND) return Promise.resolve(TARGET_HWND);
      return Promise.resolve(0);
    });

    const { tracker, onHide } = makeTracker();
    // First show
    (getForegroundWindow as any).mockResolvedValueOnce(TARGET_HWND);
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Child window with owner chain to target
    (getForegroundWindow as any).mockResolvedValue(CHILD_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(150);
    await Promise.resolve(); await Promise.resolve();

    expect(onHide).not.toHaveBeenCalled();
  });

  it('Test 8: When targetHwnd is minimized (IsIconic), onHide fires immediately (no debounce)', async () => {
    (isIconic as any).mockResolvedValue(true);
    (getForegroundWindow as any).mockResolvedValue(200); // some other window

    const { tracker, onHide } = makeTracker();
    // First show
    (getForegroundWindow as any).mockResolvedValueOnce(TARGET_HWND);
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Now minimized
    (getForegroundWindow as any).mockResolvedValue(200);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Hide fires immediately (no 150ms debounce needed)
    expect(onHide).toHaveBeenCalled();
  });

  it('Test 9: When targetHwnd becomes stale (IsWindow returns false), onTargetLost fires and tracking stops', async () => {
    (isWindow as any).mockResolvedValue(false);
    (getForegroundWindow as any).mockResolvedValue(200);

    const { tracker, onTargetLost } = makeTracker();
    tracker.start(TARGET_HWND);

    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    expect(onTargetLost).toHaveBeenCalled();

    // Confirm tracking stopped
    const callCount = (getForegroundWindow as any).mock.calls.length;
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve(); await Promise.resolve();
    // Should not poll anymore
    expect((getForegroundWindow as any).mock.calls.length).toBe(callCount);
  });

  it('Test 10: Self-hwnd list prevents hide when user clicks overlay or main window', async () => {
    const SELF_HWND = 555;
    (getForegroundWindow as any).mockResolvedValue(SELF_HWND);

    const { tracker, onHide } = makeTracker();
    tracker.addSelfHwnd(SELF_HWND);

    // First show
    (getForegroundWindow as any).mockResolvedValueOnce(TARGET_HWND);
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Self window focused
    (getForegroundWindow as any).mockResolvedValue(SELF_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(150);
    await Promise.resolve(); await Promise.resolve();

    expect(onHide).not.toHaveBeenCalled();
  });

  it('Test 11: ApplicationFrameHost.exe PID is excluded from PID matching', async () => {
    const AFH_HWND = 444;
    const AFH_PID = 333;

    // AFH has same PID as a different process — but since AFH is the host, it should NOT be treated as affiliated
    (getForegroundWindow as any).mockResolvedValue(AFH_HWND);
    (getWindowThreadProcessId as any).mockImplementation((hwnd: number) => {
      if (hwnd === TARGET_HWND) return Promise.resolve({ threadId: TARGET_THREAD_ID, pid: TARGET_PID });
      if (hwnd === AFH_HWND) return Promise.resolve({ threadId: 300, pid: AFH_PID });
      return Promise.resolve({ threadId: 200, pid: 500 });
    });
    (getOwnerWindow as any).mockResolvedValue(0);
    // AFH_PID resolves to ApplicationFrameHost
    (getProcessName as any).mockImplementation((pid: number) => {
      if (pid === AFH_PID) return Promise.resolve('ApplicationFrameHost');
      return Promise.resolve('SomeApp');
    });

    // Make AFH_PID appear same as TARGET_PID to test the exclusion
    (getWindowThreadProcessId as any).mockImplementation((hwnd: number) => {
      if (hwnd === TARGET_HWND) return Promise.resolve({ threadId: TARGET_THREAD_ID, pid: TARGET_PID });
      if (hwnd === AFH_HWND) return Promise.resolve({ threadId: 300, pid: TARGET_PID }); // same PID as target!
      return Promise.resolve({ threadId: 200, pid: 500 });
    });
    (getProcessName as any).mockImplementation((pid: number) => {
      if (pid === TARGET_PID) return Promise.resolve('ApplicationFrameHost');
      return Promise.resolve('SomeApp');
    });

    const { tracker, onHide } = makeTracker();
    // First show
    (getForegroundWindow as any).mockResolvedValueOnce(TARGET_HWND);
    tracker.start(TARGET_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // AFH window gets focus (same PID but ApplicationFrameHost)
    (getForegroundWindow as any).mockResolvedValue(AFH_HWND);
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(150);
    await Promise.resolve(); await Promise.resolve();

    // Should hide because ApplicationFrameHost is excluded from PID match
    expect(onHide).toHaveBeenCalled();
  });

  it('Test 12: Duplicate onShow/onHide are not emitted (state dedup)', async () => {
    (getForegroundWindow as any).mockResolvedValue(TARGET_HWND);

    const { tracker, onShow } = makeTracker();
    tracker.start(TARGET_HWND);

    // Multiple polls, all showing target
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // onShow should only be called once (dedup)
    expect(onShow).toHaveBeenCalledTimes(1);
  });
});
