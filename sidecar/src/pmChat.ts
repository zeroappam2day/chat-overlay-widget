import * as http from 'node:http';

const OLLAMA_DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';

// Timeout: 30s to receive first byte (covers model loading + KV cache alloc).
// Once streaming starts, each chunk resets a 60s idle timer.
const OLLAMA_CONNECT_TIMEOUT_MS = 30_000;
const OLLAMA_IDLE_TIMEOUT_MS = 60_000;

// Cap num_ctx to prevent models with huge defaults (e.g. qwen3.5 at 262K)
// from exhausting GPU memory and hanging. 4096 is safe for 0.5–8B models.
const OLLAMA_DEFAULT_NUM_CTX = 4096;

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

const activeRequests = new Map<string, AbortController>();

function isLocalhostEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function streamOllamaChat(
  requestId: string,
  opts: {
    message: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    endpoint?: string;
    history?: Array<{role: 'user' | 'assistant'; content: string}>;
    numCtx?: number;
  },
  callbacks: StreamCallbacks
): void {
  const endpoint = opts.endpoint ?? OLLAMA_DEFAULT_ENDPOINT;
  if (!isLocalhostEndpoint(endpoint)) {
    callbacks.onError('Endpoint must be a localhost URL (127.0.0.1, localhost, or ::1)');
    return;
  }
  const url = new URL(endpoint);
  const hostname = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);

  const numCtx = opts.numCtx ?? OLLAMA_DEFAULT_NUM_CTX;
  const body = JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      ...(opts.history ?? []),
      { role: 'user', content: opts.message },
    ],
    stream: true,
    think: false, // Disable extended thinking (qwen3.5 thinks by default, causing streaming hangs)
    options: { temperature: opts.temperature, num_ctx: numCtx },
    keep_alive: '5m',
  });

  const ac = new AbortController();
  activeRequests.set(requestId, ac);

  let doneCalled = false;
  let firstByteReceived = false;
  let tokenCount = 0;
  const startTime = Date.now();

  // Connection timeout: abort if no response within OLLAMA_CONNECT_TIMEOUT_MS
  const connectTimer = setTimeout(() => {
    if (!firstByteReceived && !doneCalled) {
      const elapsed = Date.now() - startTime;
      console.error(`[sidecar] pm-chat TIMEOUT: no response from Ollama in ${elapsed}ms (requestId=${requestId}, model=${opts.model}, num_ctx=${numCtx})`);
      ac.abort();
      doneCalled = true;
      callbacks.onError(`Ollama did not respond within ${OLLAMA_CONNECT_TIMEOUT_MS / 1000}s. The model may be loading or the context window (num_ctx=${numCtx}) may be too large.`);
      activeRequests.delete(requestId);
    }
  }, OLLAMA_CONNECT_TIMEOUT_MS);

  // Idle timeout: abort if no data chunk received within OLLAMA_IDLE_TIMEOUT_MS
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  function resetIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!doneCalled) {
        const elapsed = Date.now() - startTime;
        console.error(`[sidecar] pm-chat IDLE TIMEOUT: no data from Ollama for ${OLLAMA_IDLE_TIMEOUT_MS / 1000}s (requestId=${requestId}, tokens=${tokenCount}, elapsed=${elapsed}ms)`);
        ac.abort();
        doneCalled = true;
        callbacks.onError(`Ollama stopped sending data after ${tokenCount} tokens. The model may have stalled.`);
        activeRequests.delete(requestId);
      }
    }, OLLAMA_IDLE_TIMEOUT_MS);
  }

  const reqOptions: http.RequestOptions = {
    hostname,
    port,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    signal: ac.signal as any,
  };

  const req = http.request(reqOptions, (res) => {
    clearTimeout(connectTimer);
    firstByteReceived = true;
    const ttfb = Date.now() - startTime;

    if (res.statusCode && res.statusCode >= 400) {
      let errBody = '';
      res.on('data', (chunk: Buffer) => { errBody += chunk.toString('utf8'); });
      res.on('end', () => {
        console.error(`[sidecar] pm-chat Ollama HTTP ${res.statusCode}: ${errBody.substring(0, 200)} (requestId=${requestId})`);
        if (!doneCalled) {
          doneCalled = true;
          callbacks.onError(`Ollama returned HTTP ${res.statusCode}: ${errBody.substring(0, 100)}`);
          activeRequests.delete(requestId);
        }
      });
      return;
    }

    console.log(`[sidecar] pm-chat stream started: requestId=${requestId} ttfb=${ttfb}ms num_ctx=${numCtx}`);
    resetIdleTimer();

    let lineBuffer = '';

    res.on('data', (chunk: Buffer) => {
      resetIdleTimer();
      lineBuffer += chunk.toString('utf8');
      const lines = lineBuffer.split('\n');
      // Keep the last segment (may be incomplete)
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          // Only emit token when message.content is a non-empty string
          // Ignore message.thinking (extended-reasoning models)
          if (!obj.done && obj.message?.content && typeof obj.message.content === 'string' && obj.message.content.length > 0) {
            tokenCount++;
            callbacks.onToken(obj.message.content);
          }
          if (obj.done === true) {
            if (!doneCalled) {
              doneCalled = true;
              if (idleTimer) clearTimeout(idleTimer);
              const totalMs = Date.now() - startTime;
              console.log(`[sidecar] pm-chat complete: requestId=${requestId} tokens=${tokenCount} duration=${totalMs}ms ttfb=${ttfb}ms`);
              callbacks.onDone();
              activeRequests.delete(requestId);
            }
          }
        } catch {
          // Malformed line — skip
        }
      }
    });

    res.on('end', () => {
      if (idleTimer) clearTimeout(idleTimer);
      // Safety net: if done:true line was not received, still call onDone
      if (!doneCalled) {
        doneCalled = true;
        const totalMs = Date.now() - startTime;
        console.log(`[sidecar] pm-chat stream ended (no done flag): requestId=${requestId} tokens=${tokenCount} duration=${totalMs}ms`);
        callbacks.onDone();
        activeRequests.delete(requestId);
      }
    });
  });

  req.on('error', (err: Error) => {
    clearTimeout(connectTimer);
    if (idleTimer) clearTimeout(idleTimer);
    if (err.name === 'AbortError') {
      // Clean cancel (user-initiated or timeout-initiated)
      if (!doneCalled) {
        doneCalled = true;
        callbacks.onDone();
      }
    } else {
      const elapsed = Date.now() - startTime;
      console.error(`[sidecar] pm-chat request error: ${err.message} (requestId=${requestId}, elapsed=${elapsed}ms)`);
      callbacks.onError(err.message);
    }
    activeRequests.delete(requestId);
  });

  req.write(body);
  req.end();
}

export function cancelOllamaChat(requestId: string): void {
  const ac = activeRequests.get(requestId);
  if (ac) {
    ac.abort();
    activeRequests.delete(requestId);
  }
}

export async function checkOllamaHealth(endpoint?: string): Promise<{ ok: boolean; error?: string }> {
  const base = endpoint ?? OLLAMA_DEFAULT_ENDPOINT;
  if (!isLocalhostEndpoint(base)) {
    return { ok: false, error: 'Endpoint must be a localhost URL' };
  }
  const url = new URL(base);
  const hostname = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);

  return new Promise((resolve) => {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => {
      ac.abort();
      resolve({ ok: false, error: `Ollama is not running on ${base}` });
    }, 2000);

    const req = http.get(
      { hostname, port, path: '/api/version', signal: ac.signal as any },
      (_res) => {
        clearTimeout(timeoutId);
        resolve({ ok: true });
      }
    );

    req.on('error', (_err: Error) => {
      clearTimeout(timeoutId);
      resolve({ ok: false, error: `Ollama is not running on ${base}` });
    });
  });
}
