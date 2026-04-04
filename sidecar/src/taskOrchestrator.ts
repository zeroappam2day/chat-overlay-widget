/**
 * TaskOrchestrator — Named task management across PTY sessions (EAC-6).
 *
 * Submits shell commands to PTY sessions, tracks lifecycle
 * (pending -> running -> completed/failed/timeout), detects completion
 * via regex patterns on PTY output, and auto-cleans finished tasks.
 */

import * as crypto from 'node:crypto';
import type { PTYSession } from './ptySession.js';
import type { BatchedPTYSession } from './batchedPtySession.js';
import type WebSocket from 'ws';

export interface AgentTask {
  taskId: string;
  name: string;
  paneId: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  exitPattern?: string;
  failPattern?: string;
  timeoutMs?: number;
  lastOutput?: string;
  exitCode?: number;
}

export interface TaskSubmitOpts {
  name: string;
  command: string;
  paneId: string;
  exitPattern?: string;
  failPattern?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const MAX_LAST_OUTPUT = 500;
const AUTO_CLEAN_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TASKS = 20;

export class TaskOrchestrator {
  private tasks = new Map<string, AgentTask>();
  private timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private cleanTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private maxTasks: number;

  /** Called on every status transition */
  onTaskStateChange: ((task: AgentTask) => void) | undefined;

  /**
   * Externally-provided functions to interact with PTY sessions.
   * - getSession: resolve a paneId to a PTY session (or undefined)
   * - writeToSession: write text to a PTY session by paneId
   */
  private getSession: (paneId: string) => (PTYSession | BatchedPTYSession | undefined);
  private writeToSession: (paneId: string, data: string) => boolean;

  constructor(opts: {
    getSession: (paneId: string) => (PTYSession | BatchedPTYSession | undefined);
    writeToSession: (paneId: string, data: string) => boolean;
    maxTasks?: number;
  }) {
    this.getSession = opts.getSession;
    this.writeToSession = opts.writeToSession;
    this.maxTasks = opts.maxTasks ?? MAX_TASKS;
  }

  submitTask(opts: TaskSubmitOpts): { taskId: string; status: 'pending' } | { error: string } {
    // Enforce max tasks (count non-terminal tasks)
    const activeTasks = [...this.tasks.values()].filter(
      t => t.status === 'pending' || t.status === 'running'
    );
    if (activeTasks.length >= this.maxTasks) {
      return { error: `Max ${this.maxTasks} concurrent tasks reached` };
    }

    const session = this.getSession(opts.paneId);
    if (!session) {
      return { error: `No active session for paneId: ${opts.paneId}` };
    }

    const taskId = crypto.randomUUID();
    const task: AgentTask = {
      taskId,
      name: opts.name,
      paneId: opts.paneId,
      command: opts.command,
      status: 'pending',
      createdAt: Date.now(),
      exitPattern: opts.exitPattern,
      failPattern: opts.failPattern,
      timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    this.tasks.set(taskId, task);

    // Write command to PTY (with Enter)
    const written = this.writeToSession(opts.paneId, opts.command + '\r');
    if (!written) {
      task.status = 'failed';
      task.completedAt = Date.now();
      this.emitChange(task);
      this.scheduleClean(taskId);
      return { error: 'Failed to write command to PTY' };
    }

    // Transition to running
    task.status = 'running';
    task.startedAt = Date.now();
    this.emitChange(task);

    // Set timeout
    const timeoutMs = task.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      if (task.status === 'running') {
        task.status = 'timeout';
        task.completedAt = Date.now();
        // Send Ctrl+C
        this.writeToSession(opts.paneId, '\x03');
        this.emitChange(task);
        this.scheduleClean(taskId);
      }
    }, timeoutMs);
    this.timeoutTimers.set(taskId, timer);

    return { taskId, status: 'pending' };
  }

  /** Feed PTY output for pattern matching on running tasks for a given paneId */
  feedOutput(paneId: string, data: string): void {
    for (const task of this.tasks.values()) {
      if (task.paneId !== paneId || task.status !== 'running') continue;

      // Append to lastOutput (keep last 500 chars)
      task.lastOutput = ((task.lastOutput ?? '') + data).slice(-MAX_LAST_OUTPUT);

      // Check fail pattern first (takes priority)
      if (task.failPattern) {
        try {
          if (new RegExp(task.failPattern).test(task.lastOutput)) {
            this.completeTask(task.taskId, 'failed');
            continue;
          }
        } catch { /* invalid regex — skip */ }
      }

      // Check exit pattern
      if (task.exitPattern) {
        try {
          if (new RegExp(task.exitPattern).test(task.lastOutput)) {
            this.completeTask(task.taskId, 'completed');
            continue;
          }
        } catch { /* invalid regex — skip */ }
      }
    }
  }

  /** Notify that a PTY session exited (handles tasks tracking that pane) */
  handlePtyExit(paneId: string, exitCode: number): void {
    for (const task of this.tasks.values()) {
      if (task.paneId !== paneId || task.status !== 'running') continue;
      task.exitCode = exitCode;
      this.completeTask(task.taskId, exitCode === 0 ? 'completed' : 'failed');
    }
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): AgentTask[] {
    return [...this.tasks.values()];
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (task.status !== 'running' && task.status !== 'pending') return;

    // Send Ctrl+C to the PTY
    this.writeToSession(task.paneId, '\x03');
    this.completeTask(taskId, 'failed');
  }

  /** Clean up all timers */
  destroy(): void {
    for (const timer of this.timeoutTimers.values()) clearTimeout(timer);
    for (const timer of this.cleanTimers.values()) clearTimeout(timer);
    this.timeoutTimers.clear();
    this.cleanTimers.clear();
  }

  private completeTask(taskId: string, status: 'completed' | 'failed'): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (task.status !== 'running' && task.status !== 'pending') return;

    task.status = status;
    task.completedAt = Date.now();

    // Clear timeout timer
    const timer = this.timeoutTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(taskId);
    }

    this.emitChange(task);
    this.scheduleClean(taskId);
  }

  private scheduleClean(taskId: string): void {
    const timer = setTimeout(() => {
      this.tasks.delete(taskId);
      this.cleanTimers.delete(taskId);
    }, AUTO_CLEAN_MS);
    this.cleanTimers.set(taskId, timer);
  }

  private emitChange(task: AgentTask): void {
    this.onTaskStateChange?.(task);
  }
}
