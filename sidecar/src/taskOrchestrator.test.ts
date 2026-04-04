/**
 * taskOrchestrator.test.ts — Unit tests for TaskOrchestrator (EAC-6).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskOrchestrator } from './taskOrchestrator.js';
import type { AgentTask } from './taskOrchestrator.js';

function createOrchestrator(opts?: {
  sessionExists?: boolean;
  writeSucceeds?: boolean;
  maxTasks?: number;
}) {
  const written: string[] = [];
  const sessionExists = opts?.sessionExists ?? true;
  const writeSucceeds = opts?.writeSucceeds ?? true;

  const orchestrator = new TaskOrchestrator({
    getSession: (_paneId: string) => sessionExists ? ({} as any) : undefined,
    writeToSession: (_paneId: string, data: string) => {
      if (!writeSucceeds) return false;
      written.push(data);
      return true;
    },
    maxTasks: opts?.maxTasks,
  });

  return { orchestrator, written };
}

describe('TaskOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits a task and transitions to running', () => {
    const { orchestrator } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'echo hello', paneId: 'pane1',
    });

    expect(result).toHaveProperty('taskId');
    expect(result).toHaveProperty('status', 'pending');

    const taskId = (result as { taskId: string }).taskId;
    const task = orchestrator.getTask(taskId);
    expect(task).toBeDefined();
    expect(task!.status).toBe('running');
    expect(task!.startedAt).toBeDefined();

    orchestrator.destroy();
  });

  it('writes command + Enter to PTY', () => {
    const { orchestrator, written } = createOrchestrator();
    orchestrator.submitTask({
      name: 'test', command: 'echo hello', paneId: 'pane1',
    });

    expect(written).toContain('echo hello\r');
    orchestrator.destroy();
  });

  it('exit pattern match marks task completed', () => {
    const { orchestrator } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'npm build', paneId: 'pane1',
      exitPattern: 'Build succeeded',
    });
    const taskId = (result as { taskId: string }).taskId;

    orchestrator.feedOutput('pane1', 'Compiling...\n');
    expect(orchestrator.getTask(taskId)!.status).toBe('running');

    orchestrator.feedOutput('pane1', 'Build succeeded\n');
    expect(orchestrator.getTask(taskId)!.status).toBe('completed');
    expect(orchestrator.getTask(taskId)!.completedAt).toBeDefined();

    orchestrator.destroy();
  });

  it('fail pattern match marks task failed', () => {
    const { orchestrator } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'npm build', paneId: 'pane1',
      failPattern: 'ERROR',
    });
    const taskId = (result as { taskId: string }).taskId;

    orchestrator.feedOutput('pane1', 'ERROR: something went wrong\n');
    expect(orchestrator.getTask(taskId)!.status).toBe('failed');

    orchestrator.destroy();
  });

  it('PTY exit with code 0 marks task completed', () => {
    const { orchestrator } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'echo hi', paneId: 'pane1',
    });
    const taskId = (result as { taskId: string }).taskId;

    orchestrator.handlePtyExit('pane1', 0);
    expect(orchestrator.getTask(taskId)!.status).toBe('completed');
    expect(orchestrator.getTask(taskId)!.exitCode).toBe(0);

    orchestrator.destroy();
  });

  it('PTY exit with non-zero code marks task failed', () => {
    const { orchestrator } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'exit 1', paneId: 'pane1',
    });
    const taskId = (result as { taskId: string }).taskId;

    orchestrator.handlePtyExit('pane1', 1);
    expect(orchestrator.getTask(taskId)!.status).toBe('failed');
    expect(orchestrator.getTask(taskId)!.exitCode).toBe(1);

    orchestrator.destroy();
  });

  it('timeout marks task as timeout and sends Ctrl+C', () => {
    const { orchestrator, written } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'sleep 999', paneId: 'pane1',
      timeoutMs: 5000,
    });
    const taskId = (result as { taskId: string }).taskId;

    vi.advanceTimersByTime(5001);
    expect(orchestrator.getTask(taskId)!.status).toBe('timeout');
    expect(written).toContain('\x03'); // Ctrl+C

    orchestrator.destroy();
  });

  it('rejects 21st task when max is 20', () => {
    const { orchestrator } = createOrchestrator({ maxTasks: 20 });

    for (let i = 0; i < 20; i++) {
      const r = orchestrator.submitTask({
        name: `task-${i}`, command: `cmd ${i}`, paneId: 'pane1',
      });
      expect(r).toHaveProperty('taskId');
    }

    const overflow = orchestrator.submitTask({
      name: 'overflow', command: 'overflow', paneId: 'pane1',
    });
    expect(overflow).toHaveProperty('error');
    expect((overflow as { error: string }).error).toContain('Max 20');

    orchestrator.destroy();
  });

  it('cancelTask sends Ctrl+C and marks failed', () => {
    const { orchestrator, written } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'long-running', paneId: 'pane1',
    });
    const taskId = (result as { taskId: string }).taskId;

    orchestrator.cancelTask(taskId);
    expect(orchestrator.getTask(taskId)!.status).toBe('failed');
    expect(written).toContain('\x03');

    orchestrator.destroy();
  });

  it('getAllTasks returns all tasks', () => {
    const { orchestrator } = createOrchestrator();
    orchestrator.submitTask({ name: 'a', command: 'a', paneId: 'pane1' });
    orchestrator.submitTask({ name: 'b', command: 'b', paneId: 'pane1' });

    const all = orchestrator.getAllTasks();
    expect(all.length).toBe(2);

    orchestrator.destroy();
  });

  it('getTask returns undefined for unknown id', () => {
    const { orchestrator } = createOrchestrator();
    expect(orchestrator.getTask('nonexistent')).toBeUndefined();
    orchestrator.destroy();
  });

  it('auto-cleans completed tasks after 10 minutes', () => {
    const { orchestrator } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'echo hi', paneId: 'pane1',
    });
    const taskId = (result as { taskId: string }).taskId;

    orchestrator.handlePtyExit('pane1', 0);
    expect(orchestrator.getTask(taskId)).toBeDefined();

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(orchestrator.getTask(taskId)).toBeUndefined();

    orchestrator.destroy();
  });

  it('onTaskStateChange callback fires on transitions', () => {
    const { orchestrator } = createOrchestrator();
    const events: AgentTask[] = [];
    orchestrator.onTaskStateChange = (task) => events.push({ ...task });

    const result = orchestrator.submitTask({
      name: 'test', command: 'echo hi', paneId: 'pane1',
    });
    const taskId = (result as { taskId: string }).taskId;

    // running transition
    expect(events.length).toBe(1);
    expect(events[0].status).toBe('running');

    // complete
    orchestrator.handlePtyExit('pane1', 0);
    expect(events.length).toBe(2);
    expect(events[1].status).toBe('completed');

    orchestrator.destroy();
  });

  it('rejects task when no session exists for paneId', () => {
    const { orchestrator } = createOrchestrator({ sessionExists: false });
    const result = orchestrator.submitTask({
      name: 'test', command: 'echo hi', paneId: 'pane1',
    });
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('No active session');
    orchestrator.destroy();
  });

  it('lastOutput keeps last 500 chars', () => {
    const { orchestrator } = createOrchestrator();
    const result = orchestrator.submitTask({
      name: 'test', command: 'run', paneId: 'pane1',
    });
    const taskId = (result as { taskId: string }).taskId;

    // Feed > 500 chars
    const bigData = 'x'.repeat(600);
    orchestrator.feedOutput('pane1', bigData);
    expect(orchestrator.getTask(taskId)!.lastOutput!.length).toBe(500);

    orchestrator.destroy();
  });
});
