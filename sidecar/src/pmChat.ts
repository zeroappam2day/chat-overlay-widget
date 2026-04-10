import * as http from 'node:http';

const OLLAMA_DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';

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
  opts: { message: string; model: string; temperature: number; systemPrompt: string; endpoint?: string },
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

  const body = JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.message },
    ],
    stream: true,
    options: { temperature: opts.temperature },
  });

  const ac = new AbortController();
  activeRequests.set(requestId, ac);

  let doneCalled = false;

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
    let lineBuffer = '';

    res.on('data', (chunk: Buffer) => {
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
            callbacks.onToken(obj.message.content);
          }
          if (obj.done === true) {
            if (!doneCalled) {
              doneCalled = true;
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
      // Safety net: if done:true line was not received, still call onDone
      if (!doneCalled) {
        doneCalled = true;
        callbacks.onDone();
        activeRequests.delete(requestId);
      }
    });
  });

  req.on('error', (err: Error) => {
    if (err.name === 'AbortError') {
      // Clean cancel
      if (!doneCalled) {
        doneCalled = true;
        callbacks.onDone();
      }
    } else {
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
