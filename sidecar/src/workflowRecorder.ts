/**
 * EAC-9: Workflow Recording & Replay
 * Records and replays sequences of MCP tool calls as JSON workflow files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface WorkflowStep {
  stepIndex: number;
  tool: string;
  params: Record<string, unknown>;
  description: string;
  delayAfterMs?: number;
  verification?: {
    strategy: 'terminal-match' | 'pixel-sample' | 'manual';
    config: Record<string, unknown>;
  };
}

export interface Workflow {
  workflowId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
  metadata: {
    targetApp?: string;
    estimatedDurationSec?: number;
    requiredFlags: string[];
  };
}

export interface WorkflowSummary {
  workflowId: string;
  name: string;
  description: string;
  stepCount: number;
  createdAt: string;
}

export interface ReplayYield {
  step: WorkflowStep;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  error?: string;
}

const MAX_WORKFLOWS = 100;
const MAX_STEPS = 200;
const DEFAULT_DELAY_MS = 500;

export class WorkflowRecorder {
  private storageDir: string;
  private recording: boolean = false;
  private currentWorkflowId: string | null = null;
  private currentName: string = '';
  private currentDescription: string = '';
  private currentSteps: Omit<WorkflowStep, 'stepIndex'>[] = [];

  constructor(opts: { storageDir: string }) {
    this.storageDir = opts.storageDir;
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get activeWorkflowId(): string | null {
    return this.currentWorkflowId;
  }

  get stepCount(): number {
    return this.currentSteps.length;
  }

  startRecording(name: string, description: string): string {
    if (this.recording) {
      throw new Error('Already recording. Stop the current recording first.');
    }
    // Enforce max workflows
    const existing = this.listWorkflows();
    if (existing.length >= MAX_WORKFLOWS) {
      throw new Error(`Maximum of ${MAX_WORKFLOWS} workflows reached. Delete some before recording new ones.`);
    }
    this.currentWorkflowId = crypto.randomUUID();
    this.currentName = name;
    this.currentDescription = description;
    this.currentSteps = [];
    this.recording = true;
    return this.currentWorkflowId;
  }

  addStep(step: Omit<WorkflowStep, 'stepIndex'>): void {
    if (!this.recording) {
      throw new Error('Not currently recording. Call startRecording first.');
    }
    if (this.currentSteps.length >= MAX_STEPS) {
      throw new Error(`Maximum of ${MAX_STEPS} steps per workflow reached.`);
    }
    this.currentSteps.push(step);
  }

  stopRecording(): Workflow {
    if (!this.recording || !this.currentWorkflowId) {
      throw new Error('Not currently recording.');
    }
    const now = new Date().toISOString();
    const workflow: Workflow = {
      workflowId: this.currentWorkflowId,
      name: this.currentName,
      description: this.currentDescription,
      createdAt: now,
      updatedAt: now,
      steps: this.currentSteps.map((s, i) => ({
        ...s,
        stepIndex: i,
        delayAfterMs: s.delayAfterMs ?? DEFAULT_DELAY_MS,
      })),
      metadata: {
        requiredFlags: ['workflowRecording'],
        estimatedDurationSec: this.currentSteps.reduce(
          (acc, s) => acc + ((s.delayAfterMs ?? DEFAULT_DELAY_MS) / 1000),
          0
        ),
      },
    };
    this.saveWorkflow(workflow);
    this.recording = false;
    this.currentWorkflowId = null;
    this.currentSteps = [];
    return workflow;
  }

  listWorkflows(): WorkflowSummary[] {
    if (!fs.existsSync(this.storageDir)) return [];
    const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
    const summaries: WorkflowSummary[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(this.storageDir, file), 'utf-8');
        const wf = JSON.parse(raw) as Workflow;
        summaries.push({
          workflowId: wf.workflowId,
          name: wf.name,
          description: wf.description,
          stepCount: wf.steps.length,
          createdAt: wf.createdAt,
        });
      } catch {
        // Skip corrupt files
      }
    }
    return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getWorkflow(workflowId: string): Workflow | null {
    const filePath = path.join(this.storageDir, `${workflowId}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as Workflow;
    } catch {
      return null;
    }
  }

  deleteWorkflow(workflowId: string): boolean {
    const filePath = path.join(this.storageDir, `${workflowId}.json`);
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  }

  async *replayWorkflow(
    workflowId: string,
    opts?: {
      startFromStep?: number;
      dryRun?: boolean;
      pauseBeforeEach?: boolean;
    }
  ): AsyncGenerator<ReplayYield> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found.`);
    }
    const startFrom = opts?.startFromStep ?? 0;
    const dryRun = opts?.dryRun ?? false;

    for (const step of workflow.steps) {
      if (step.stepIndex < startFrom) continue;

      // Yield pending status
      yield { step, status: 'pending' };

      if (dryRun) {
        yield { step, status: 'completed' };
        continue;
      }

      // Yield executing status
      yield { step, status: 'executing' };

      try {
        // Wait the specified delay
        const delay = step.delayAfterMs ?? DEFAULT_DELAY_MS;
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        yield { step, status: 'completed' };
      } catch (err) {
        yield {
          step,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  private saveWorkflow(workflow: Workflow): void {
    const filePath = path.join(this.storageDir, `${workflow.workflowId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
  }
}
