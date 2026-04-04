/**
 * walkthroughWatcher.test.ts — Unit tests for Agent Runtime Phase 2
 *
 * Tests WalkthroughWatcher class:
 * - Pattern matching on terminal output
 * - Three-phase timing (detection delay, settle, cooldown)
 * - ANSI stripping
 * - Tail buffer capping at 4KB
 * - Disable/destroy cleanup
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalkthroughWatcher } from './walkthroughWatcher.js';

describe('WalkthroughWatcher', () => {
  let watcher: WalkthroughWatcher;
  let onAdvance: ReturnType<typeof vi.fn>;
  let onEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onAdvance = vi.fn();
    onEvent = vi.fn();
    watcher = new WalkthroughWatcher({ onAdvance, onEvent, enabled: true });
  });

  afterEach(() => {
    watcher.destroy();
    vi.useRealTimers();
  });

  it('does not fire onAdvance when disabled', () => {
    watcher.enabled = false;
    watcher.setPattern(/success/);
    watcher.feed('success');
    vi.advanceTimersByTime(200);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('does not fire onAdvance when no pattern is set', () => {
    watcher.feed('anything');
    vi.advanceTimersByTime(200);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('fires onAdvance after detection delay when pattern matches', () => {
    watcher.setPattern(/done/);
    watcher.feed('task done');
    expect(onAdvance).not.toHaveBeenCalled(); // not yet — 50ms delay
    vi.advanceTimersByTime(50);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('does not fire onAdvance when pattern does not match', () => {
    watcher.setPattern(/done/);
    watcher.feed('still running');
    vi.advanceTimersByTime(200);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('strips ANSI escape codes before matching', () => {
    watcher.setPattern(/success/);
    watcher.feed('\x1b[32msuccess\x1b[0m');
    vi.advanceTimersByTime(50);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('caps tail buffer at 4096 bytes', () => {
    watcher.setPattern(/needle/);
    // Fill buffer with 5KB of data
    watcher.feed('x'.repeat(5000));
    // Now feed the needle — the old data should be trimmed
    watcher.feed('needle');
    vi.advanceTimersByTime(50);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('emits pattern-set and pattern-cleared events', () => {
    watcher.setPattern(/test/);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'pattern-set',
      pattern: 'test',
    }));

    watcher.setPattern(null);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'pattern-cleared',
      pattern: null,
    }));
  });

  it('emits advanced event on successful match', () => {
    watcher.setPattern(/ok/);
    watcher.feed('ok');
    vi.advanceTimersByTime(50);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'advanced',
    }));
  });

  it('respects cooldown — no double-advance within 3s', () => {
    watcher.setPattern(/ready/);
    watcher.feed('ready');
    vi.advanceTimersByTime(50); // first advance
    expect(onAdvance).toHaveBeenCalledTimes(1);

    // Feed again immediately — should be blocked by cooldown
    watcher.feed('ready again');
    vi.advanceTimersByTime(50);
    expect(onAdvance).toHaveBeenCalledTimes(1); // still 1

    // After cooldown (3s)
    vi.advanceTimersByTime(3000);
    watcher.feed('ready');
    vi.advanceTimersByTime(50);
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });

  it('destroy clears timers and state', () => {
    watcher.setPattern(/test/);
    watcher.feed('test');
    // Timer is pending but not yet fired
    watcher.destroy();
    vi.advanceTimersByTime(200);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('setPattern resets tail buffer and timers', () => {
    watcher.setPattern(/first/);
    watcher.feed('first');
    // Before the 50ms fires, change pattern
    watcher.setPattern(/second/);
    vi.advanceTimersByTime(50);
    expect(onAdvance).not.toHaveBeenCalled(); // first match cleared
  });
});
