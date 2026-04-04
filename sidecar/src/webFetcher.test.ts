import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebFetcher, htmlToText } from './webFetcher.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: string, opts?: { status?: number; contentType?: string }) {
  const status = opts?.status ?? 200;
  const contentType = opts?.contentType ?? 'text/html; charset=utf-8';
  const encoder = new TextEncoder();
  const encoded = encoder.encode(body);
  let read = false;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', contentType]]) as unknown as Headers & { get: (k: string) => string | null },
    body: {
      getReader: () => ({
        read: async () => {
          if (!read) {
            read = true;
            return { done: false, value: encoded };
          }
          return { done: true, value: undefined };
        },
        cancel: vi.fn(),
      }),
    },
  };
}

function makeLargeResponse(sizeBytes: number) {
  const chunk = new Uint8Array(sizeBytes);
  chunk.fill(65); // 'A'
  let read = false;
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'text/plain']]) as unknown as Headers & { get: (k: string) => string | null },
    body: {
      getReader: () => ({
        read: async () => {
          if (!read) {
            read = true;
            return { done: false, value: chunk };
          }
          return { done: true, value: undefined };
        },
        cancel: vi.fn(),
      }),
    },
  };
}

describe('WebFetcher', () => {
  let fetcher: WebFetcher;

  beforeEach(() => {
    fetcher = new WebFetcher();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds with HTTPS URL', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse('<body><p>Hello world</p></body>'));
    const result = await fetcher.fetch('https://example.com');
    expect(result.ok).toBe(true);
    expect(result.text).toContain('Hello world');
    expect(result.cached).toBe(false);
  });

  it('rejects HTTP URL', async () => {
    const result = await fetcher.fetch('http://example.com');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Only HTTPS URLs are allowed');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects private IP 127.0.0.1', async () => {
    const result = await fetcher.fetch('https://127.0.0.1/page');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Private/internal IP addresses are not allowed');
  });

  it('rejects private IP 10.0.0.1', async () => {
    const result = await fetcher.fetch('https://10.0.0.1/page');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Private');
  });

  it('rejects private IP 192.168.1.1', async () => {
    const result = await fetcher.fetch('https://192.168.1.1/page');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Private');
  });

  it('rejects private IP 172.16.0.1', async () => {
    const result = await fetcher.fetch('https://172.16.0.1/page');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Private');
  });

  it('rate limits after 10 requests', async () => {
    mockFetch.mockResolvedValue(makeResponse('<body>ok</body>', { contentType: 'text/plain' }));
    // Use unique URLs to avoid cache hits
    for (let i = 0; i < 10; i++) {
      const result = await fetcher.fetch(`https://example.com/page-${i}`);
      expect(result.ok).toBe(true);
    }
    const result = await fetcher.fetch('https://example.com/page-11');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Rate limit');
  });

  it('enforces max 2MB response size', async () => {
    const threeMB = 3 * 1024 * 1024;
    mockFetch.mockResolvedValueOnce(makeLargeResponse(threeMB));
    const result = await fetcher.fetch('https://example.com/big');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('maximum size');
  });

  it('truncates extracted text to 50KB', async () => {
    const longText = 'x'.repeat(60 * 1024);
    mockFetch.mockResolvedValueOnce(makeResponse(`<body>${longText}</body>`));
    const result = await fetcher.fetch('https://example.com/long');
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(50 * 1024);
  });

  it('returns cached result for same URL', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse('<body>Hello</body>'));
    const first = await fetcher.fetch('https://example.com/cached');
    expect(first.cached).toBe(false);
    const second = await fetcher.fetch('https://example.com/cached');
    expect(second.cached).toBe(true);
    expect(second.text).toBe(first.text);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('cache expires after TTL', async () => {
    const shortTtlFetcher = new WebFetcher({ cacheTtlMs: 10 });
    mockFetch.mockResolvedValue(makeResponse('<body>Fresh</body>'));
    await shortTtlFetcher.fetch('https://example.com/ttl');
    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 20));
    const result = await shortTtlFetcher.fetch('https://example.com/ttl');
    expect(result.cached).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('handles timeout', async () => {
    const shortTimeoutFetcher = new WebFetcher({ timeoutMs: 50 });
    mockFetch.mockImplementationOnce(() => new Promise((_, reject) => {
      setTimeout(() => reject(new Error('The operation was aborted')), 10);
    }));
    const result = await shortTimeoutFetcher.fetch('https://example.com/slow');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('handles invalid URL', async () => {
    const result = await fetcher.fetch('not-a-url');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Invalid URL');
  });
});

describe('htmlToText', () => {
  it('removes script and style blocks', () => {
    const html = '<body><script>alert("x")</script><style>.x{}</style><p>Content</p></body>';
    const text = htmlToText(html);
    expect(text).not.toContain('alert');
    expect(text).not.toContain('.x{}');
    expect(text).toContain('Content');
  });

  it('removes nav, header, footer', () => {
    const html = '<body><nav>Menu</nav><main><p>Main content</p></main><footer>Footer</footer></body>';
    const text = htmlToText(html);
    expect(text).not.toContain('Menu');
    expect(text).not.toContain('Footer');
    expect(text).toContain('Main content');
  });

  it('prefers <main> content', () => {
    const html = '<body><div>Sidebar</div><main><p>Important</p></main></body>';
    const text = htmlToText(html);
    expect(text).toContain('Important');
  });

  it('decodes HTML entities', () => {
    const html = '<body>&amp; &lt; &gt; &quot; &nbsp; &#39;</body>';
    const text = htmlToText(html);
    expect(text).toContain('&');
    expect(text).toContain('<');
    expect(text).toContain('>');
    expect(text).toContain('"');
    expect(text).toContain("'");
  });

  it('replaces block elements with newlines', () => {
    const html = '<body><p>Line 1</p><p>Line 2</p></body>';
    const text = htmlToText(html);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 2');
  });
});
