import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { WorkflowRecorder } from './workflowRecorder.js';

let storageDir: string;
let recorder: WorkflowRecorder;

beforeEach(() => {
  storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-test-'));
  recorder = new WorkflowRecorder({ storageDir });
});

afterEach(() => {
  fs.rmSync(storageDir, { recursive: true, force: true });
});

describe('WorkflowRecorder', () => {
  it('start recording → add steps → stop → workflow saved', () => {
    const id = recorder.startRecording('Test WF', 'A test workflow');
    expect(typeof id).toBe('string');
    expect(recorder.isRecording).toBe(true);

    recorder.addStep({ tool: 'read_terminal_output', params: { lines: 50 }, description: 'Read terminal' });
    recorder.addStep({ tool: 'write_terminal', params: { text: 'hello' }, description: 'Write to terminal', delayAfterMs: 1000 });

    const workflow = recorder.stopRecording();
    expect(workflow.workflowId).toBe(id);
    expect(workflow.name).toBe('Test WF');
    expect(workflow.steps).toHaveLength(2);
    expect(workflow.steps[0].stepIndex).toBe(0);
    expect(workflow.steps[1].stepIndex).toBe(1);
    expect(workflow.steps[1].delayAfterMs).toBe(1000);
    expect(recorder.isRecording).toBe(false);

    // Verify file exists on disk
    const filePath = path.join(storageDir, `${id}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('listWorkflows returns saved entries', () => {
    recorder.startRecording('WF1', 'First');
    recorder.addStep({ tool: 'tool1', params: {}, description: 'step1' });
    recorder.stopRecording();

    recorder.startRecording('WF2', 'Second');
    recorder.addStep({ tool: 'tool2', params: {}, description: 'step2' });
    recorder.addStep({ tool: 'tool3', params: {}, description: 'step3' });
    recorder.stopRecording();

    const list = recorder.listWorkflows();
    expect(list).toHaveLength(2);
    const names = list.map(w => w.name);
    expect(names).toContain('WF1');
    expect(names).toContain('WF2');
    const wf2 = list.find(w => w.name === 'WF2')!;
    expect(wf2.stepCount).toBe(2);
  });

  it('getWorkflow returns workflow by ID', () => {
    recorder.startRecording('Get Test', 'Get test desc');
    recorder.addStep({ tool: 'tool1', params: { a: 1 }, description: 'do thing' });
    const saved = recorder.stopRecording();

    const fetched = recorder.getWorkflow(saved.workflowId);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Get Test');
    expect(fetched!.steps).toHaveLength(1);
  });

  it('getWorkflow returns null for nonexistent ID', () => {
    expect(recorder.getWorkflow('nonexistent-id')).toBeNull();
  });

  it('deleteWorkflow removes file', () => {
    recorder.startRecording('Delete Me', 'Will be deleted');
    recorder.addStep({ tool: 'tool1', params: {}, description: 's1' });
    const wf = recorder.stopRecording();

    expect(recorder.deleteWorkflow(wf.workflowId)).toBe(true);
    expect(recorder.getWorkflow(wf.workflowId)).toBeNull();
    expect(recorder.listWorkflows()).toHaveLength(0);
  });

  it('deleteWorkflow returns false for nonexistent ID', () => {
    expect(recorder.deleteWorkflow('no-such-id')).toBe(false);
  });

  it('max 100 workflows enforced', () => {
    for (let i = 0; i < 100; i++) {
      recorder.startRecording(`WF-${i}`, `desc-${i}`);
      recorder.addStep({ tool: 't', params: {}, description: 's' });
      recorder.stopRecording();
    }
    expect(() => recorder.startRecording('WF-101', 'overflow')).toThrow(/Maximum of 100/);
  });

  it('max 200 steps enforced', () => {
    recorder.startRecording('Big WF', 'Many steps');
    for (let i = 0; i < 200; i++) {
      recorder.addStep({ tool: 't', params: {}, description: `s${i}` });
    }
    expect(() => recorder.addStep({ tool: 't', params: {}, description: 'overflow' })).toThrow(/Maximum of 200/);
  });

  it('replay yields steps sequentially', async () => {
    recorder.startRecording('Replay Test', 'For replay');
    recorder.addStep({ tool: 'tool1', params: {}, description: 's1', delayAfterMs: 0 });
    recorder.addStep({ tool: 'tool2', params: {}, description: 's2', delayAfterMs: 0 });
    const wf = recorder.stopRecording();

    const yields: Array<{ step: { tool: string }; status: string }> = [];
    for await (const y of recorder.replayWorkflow(wf.workflowId)) {
      yields.push({ step: { tool: y.step.tool }, status: y.status });
    }
    // Each step yields pending, executing, completed = 6 total for 2 steps
    expect(yields).toHaveLength(6);
    expect(yields[0].status).toBe('pending');
    expect(yields[1].status).toBe('executing');
    expect(yields[2].status).toBe('completed');
    expect(yields[3].step.tool).toBe('tool2');
  });

  it('replay dryRun mode skips executing', async () => {
    recorder.startRecording('DryRun', 'Dry run test');
    recorder.addStep({ tool: 'tool1', params: {}, description: 's1', delayAfterMs: 0 });
    recorder.addStep({ tool: 'tool2', params: {}, description: 's2', delayAfterMs: 0 });
    const wf = recorder.stopRecording();

    const statuses: string[] = [];
    for await (const y of recorder.replayWorkflow(wf.workflowId, { dryRun: true })) {
      statuses.push(y.status);
    }
    // dryRun: pending, completed per step = 4 total
    expect(statuses).toEqual(['pending', 'completed', 'pending', 'completed']);
  });

  it('replay startFromStep skips earlier steps', async () => {
    recorder.startRecording('Skip Test', 'Starts from step 2');
    recorder.addStep({ tool: 'tool1', params: {}, description: 's1', delayAfterMs: 0 });
    recorder.addStep({ tool: 'tool2', params: {}, description: 's2', delayAfterMs: 0 });
    recorder.addStep({ tool: 'tool3', params: {}, description: 's3', delayAfterMs: 0 });
    const wf = recorder.stopRecording();

    const tools: string[] = [];
    for await (const y of recorder.replayWorkflow(wf.workflowId, { startFromStep: 1, dryRun: true })) {
      if (y.status === 'pending') tools.push(y.step.tool);
    }
    expect(tools).toEqual(['tool2', 'tool3']);
  });

  it('workflow persists across instances', () => {
    recorder.startRecording('Persist Test', 'Survives new instance');
    recorder.addStep({ tool: 'persist-tool', params: { x: 42 }, description: 'persistent step' });
    const wf = recorder.stopRecording();

    // Create a new recorder instance pointing at same directory
    const recorder2 = new WorkflowRecorder({ storageDir });
    const loaded = recorder2.getWorkflow(wf.workflowId);
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Persist Test');
    expect(loaded!.steps[0].tool).toBe('persist-tool');
  });

  it('replay throws for nonexistent workflow', async () => {
    const gen = recorder.replayWorkflow('no-such-id');
    await expect(gen.next()).rejects.toThrow(/not found/);
  });

  it('cannot add step when not recording', () => {
    expect(() => recorder.addStep({ tool: 't', params: {}, description: 's' })).toThrow(/Not currently recording/);
  });

  it('cannot start recording while already recording', () => {
    recorder.startRecording('First', 'desc');
    expect(() => recorder.startRecording('Second', 'desc')).toThrow(/Already recording/);
  });
});
