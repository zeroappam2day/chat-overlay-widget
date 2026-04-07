import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import { EventEmitter } from 'node:events';

// Mock node:http before importing the module under test
vi.mock('node:http');

import { streamOllamaChat, cancelOllamaChat, checkOllamaHealth } from './pmChat.js';

// ---------------------------------------------------------------------------
// Helpers: mock http.request and http.get
// ---------------------------------------------------------------------------

function makeMockReq() {
  const req = new EventEmitter() as any;
  req.write = vi.fn();
  req.end = vi.fn();
  req.abort = vi.fn();
  return req;
}

function makeMockRes() {
  const res = new EventEmitter() as any;
  res.statusCode = 200;
  return res;
}

// ---------------------------------------------------------------------------
// streamOllamaChat tests
// ---------------------------------------------------------------------------

describe('streamOllamaChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a single NDJSON line and calls onToken with the content', async () => {
    const mockRes = makeMockRes();
    const mockReq = makeMockReq();

    vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
      // Simulate async response
      setTimeout(() => callback(mockRes), 0);
      return mockReq;
    });

    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamOllamaChat('req-1', { message: 'hello', model: 'qwen3', temperature: 0, systemPrompt: 'You are helpful' }, { onToken, onDone, onError });

    await new Promise(r => setTimeout(r, 10));

    const line = JSON.stringify({ model: 'qwen3', message: { role: 'assistant', content: 'Hello' }, done: false });
    mockRes.emit('data', Buffer.from(line + '\n'));
    mockRes.emit('end');

    await new Promise(r => setTimeout(r, 10));

    expect(onToken).toHaveBeenCalledWith('Hello');
    expect(onToken).toHaveBeenCalledTimes(1);
  });

  it('calls onDone when a done:true NDJSON line is received', async () => {
    const mockRes = makeMockRes();
    const mockReq = makeMockReq();

    vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
      setTimeout(() => callback(mockRes), 0);
      return mockReq;
    });

    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamOllamaChat('req-2', { message: 'hello', model: 'qwen3', temperature: 0, systemPrompt: 'You are helpful' }, { onToken, onDone, onError });

    await new Promise(r => setTimeout(r, 10));

    const doneLineObj = { model: 'qwen3', message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop' };
    mockRes.emit('data', Buffer.from(JSON.stringify(doneLineObj) + '\n'));

    await new Promise(r => setTimeout(r, 10));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onToken).not.toHaveBeenCalled();
  });

  it('handles two NDJSON objects in a single chunk', async () => {
    const mockRes = makeMockRes();
    const mockReq = makeMockReq();

    vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
      setTimeout(() => callback(mockRes), 0);
      return mockReq;
    });

    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamOllamaChat('req-3', { message: 'hello', model: 'qwen3', temperature: 0, systemPrompt: 'You are helpful' }, { onToken, onDone, onError });

    await new Promise(r => setTimeout(r, 10));

    const line1 = JSON.stringify({ model: 'qwen3', message: { role: 'assistant', content: 'Hello' }, done: false });
    const line2 = JSON.stringify({ model: 'qwen3', message: { role: 'assistant', content: ' World' }, done: false });
    mockRes.emit('data', Buffer.from(line1 + '\n' + line2 + '\n'));
    mockRes.emit('end');

    await new Promise(r => setTimeout(r, 10));

    expect(onToken).toHaveBeenCalledTimes(2);
    expect(onToken).toHaveBeenNthCalledWith(1, 'Hello');
    expect(onToken).toHaveBeenNthCalledWith(2, ' World');
  });

  it('handles a partial NDJSON line split across two data events (lineBuffer accumulation)', async () => {
    const mockRes = makeMockRes();
    const mockReq = makeMockReq();

    vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
      setTimeout(() => callback(mockRes), 0);
      return mockReq;
    });

    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamOllamaChat('req-4', { message: 'hello', model: 'qwen3', temperature: 0, systemPrompt: 'You are helpful' }, { onToken, onDone, onError });

    await new Promise(r => setTimeout(r, 10));

    // Split the JSON line across two data events
    const fullLine = JSON.stringify({ model: 'qwen3', message: { role: 'assistant', content: 'Hi there' }, done: false });
    const half1 = fullLine.slice(0, 20);
    const half2 = fullLine.slice(20) + '\n';

    mockRes.emit('data', Buffer.from(half1));
    // onToken should NOT have been called yet — partial line
    expect(onToken).not.toHaveBeenCalled();

    mockRes.emit('data', Buffer.from(half2));
    mockRes.emit('end');

    await new Promise(r => setTimeout(r, 10));

    expect(onToken).toHaveBeenCalledWith('Hi there');
    expect(onToken).toHaveBeenCalledTimes(1);
  });

  it('ignores thinking tokens (message.content empty, message.thinking present) — onToken NOT called', async () => {
    const mockRes = makeMockRes();
    const mockReq = makeMockReq();

    vi.mocked(http.request).mockImplementation((_opts: any, callback: any) => {
      setTimeout(() => callback(mockRes), 0);
      return mockReq;
    });

    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamOllamaChat('req-5', { message: 'hello', model: 'qwen3', temperature: 0, systemPrompt: 'You are helpful' }, { onToken, onDone, onError });

    await new Promise(r => setTimeout(r, 10));

    // Thinking token: content is empty, thinking is present
    const thinkingLine = JSON.stringify({ model: 'qwen3', message: { role: 'assistant', content: '', thinking: 'some internal thought' }, done: false });
    mockRes.emit('data', Buffer.from(thinkingLine + '\n'));
    mockRes.emit('end');

    await new Promise(r => setTimeout(r, 10));

    expect(onToken).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// checkOllamaHealth tests
// ---------------------------------------------------------------------------

describe('checkOllamaHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns { ok: true } when http.get succeeds', async () => {
    const mockRes = makeMockRes();
    const mockGet = new EventEmitter() as any;
    mockGet.end = vi.fn();

    vi.mocked(http.get).mockImplementation((_opts: any, callback: any) => {
      setTimeout(() => callback(mockRes), 0);
      return mockGet;
    });

    const result = await checkOllamaHealth('http://127.0.0.1:11434');

    expect(result).toEqual({ ok: true });
  });

  it('returns { ok: false, error } when http.get fires error event (ECONNREFUSED)', async () => {
    const mockGet = new EventEmitter() as any;
    mockGet.end = vi.fn();

    vi.mocked(http.get).mockImplementation((_opts: any, _callback: any) => {
      setTimeout(() => {
        const err = new Error('connect ECONNREFUSED 127.0.0.1:11434');
        (err as any).code = 'ECONNREFUSED';
        mockGet.emit('error', err);
      }, 0);
      return mockGet;
    });

    const result = await checkOllamaHealth('http://127.0.0.1:11434');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Ollama is not running');
  });
});

// ---------------------------------------------------------------------------
// cancelOllamaChat tests
// ---------------------------------------------------------------------------

describe('cancelOllamaChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts the in-flight request via AbortController and calls onDone', async () => {
    let capturedSignal: AbortSignal | undefined;
    const mockRes = makeMockRes();
    const mockReq = makeMockReq();

    vi.mocked(http.request).mockImplementation((opts: any, callback: any) => {
      capturedSignal = opts.signal;
      // Don't call callback immediately — simulate in-flight request
      return mockReq;
    });

    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    streamOllamaChat('req-cancel', { message: 'hello', model: 'qwen3', temperature: 0, systemPrompt: 'You are helpful' }, { onToken, onDone, onError });

    // Simulate abort — the request should have an AbortController
    cancelOllamaChat('req-cancel');

    // The AbortError on req.error should result in onDone being called
    const abortErr = new Error('AbortError');
    abortErr.name = 'AbortError';
    mockReq.emit('error', abortErr);

    await new Promise(r => setTimeout(r, 10));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
