/**
 * WebFetcher — fetch web pages and extract readable text.
 * Uses Node.js built-in fetch() (Node 18+). No new dependencies.
 * HTTPS only, rate-limited, cached, SSRF-protected.
 */

export interface WebFetchResult {
  ok: boolean;
  url: string;
  statusCode: number;
  contentType: string;
  text: string;
  truncated: boolean;
  cached: boolean;
  error?: string;
}

interface CacheEntry {
  result: WebFetchResult;
  expiresAt: number;
}

interface WebFetcherOpts {
  maxResponseSizeBytes?: number;
  timeoutMs?: number;
  maxCacheEntries?: number;
  cacheTtlMs?: number;
}

const DEFAULT_MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_CACHE_ENTRIES = 50;
const DEFAULT_CACHE_TTL_MS = 300_000; // 5 minutes
const MAX_TEXT_LENGTH = 50 * 1024; // 50KB
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;
const USER_AGENT = 'ChatOverlayWidget/0.1 (documentation-fetch)';

// Private/internal IP patterns (SSRF protection)
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd/i,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some(p => p.test(hostname));
}

function errorResult(url: string, error: string, statusCode = 0, contentType = ''): WebFetchResult {
  return { ok: false, url, statusCode, contentType, text: '', truncated: false, cached: false, error };
}

/** Strip HTML to readable text (regex-based, no dependencies). */
export function htmlToText(html: string): string {
  let text = html;

  // Try to extract <main>, <article>, or <body> content
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  text = mainMatch?.[1] ?? articleMatch?.[1] ?? bodyMatch?.[1] ?? text;

  // Remove script, style, nav, header, footer blocks
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Replace block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/?(p|div|li|h[1-6]|tr|blockquote|pre|section)[^>]*>/gi, '\n');

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&#x27;/g, "'");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}

export class WebFetcher {
  private maxResponseSizeBytes: number;
  private timeoutMs: number;
  private maxCacheEntries: number;
  private cacheTtlMs: number;
  private cache = new Map<string, CacheEntry>();
  private requestTimestamps: number[] = [];

  constructor(opts?: WebFetcherOpts) {
    this.maxResponseSizeBytes = opts?.maxResponseSizeBytes ?? DEFAULT_MAX_RESPONSE_SIZE;
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxCacheEntries = opts?.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES;
    this.cacheTtlMs = opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  async fetch(url: string, opts?: { extractText?: boolean }): Promise<WebFetchResult> {
    const extractText = opts?.extractText ?? true;

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return errorResult(url, 'Invalid URL');
    }

    if (parsed.protocol !== 'https:') {
      return errorResult(url, 'Only HTTPS URLs are allowed');
    }

    if (isPrivateHost(parsed.hostname)) {
      return errorResult(url, 'Private/internal IP addresses are not allowed');
    }

    // Check cache
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.result, cached: true };
    }

    // Rate limit
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => t > now - RATE_LIMIT_WINDOW_MS);
    if (this.requestTimestamps.length >= RATE_LIMIT_MAX) {
      return errorResult(url, 'Rate limit exceeded (max 10 requests per minute)');
    }
    this.requestTimestamps.push(now);

    // Fetch
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });

      clearTimeout(timer);

      const contentType = response.headers.get('content-type') ?? '';

      // Read body with size limit
      const reader = response.body?.getReader();
      if (!reader) {
        return errorResult(url, 'No response body', response.status, contentType);
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalSize += value.length;
        if (totalSize > this.maxResponseSizeBytes) {
          reader.cancel();
          return errorResult(url, `Response exceeds maximum size of ${this.maxResponseSizeBytes} bytes`, response.status, contentType);
        }
        chunks.push(value);
      }

      const rawBuffer = Buffer.concat(chunks);
      let text = rawBuffer.toString('utf-8');

      let truncated = false;
      if (extractText && contentType.includes('html')) {
        text = htmlToText(text);
      }

      if (text.length > MAX_TEXT_LENGTH) {
        text = text.slice(0, MAX_TEXT_LENGTH);
        truncated = true;
      }

      const result: WebFetchResult = {
        ok: response.ok,
        url,
        statusCode: response.status,
        contentType,
        text,
        truncated,
        cached: false,
      };

      // Cache the result
      if (response.ok) {
        if (this.cache.size >= this.maxCacheEntries) {
          // Evict oldest entry
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(url, { result, expiresAt: Date.now() + this.cacheTtlMs });
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message.includes('abort');
      return errorResult(url, isTimeout ? 'Request timed out' : message);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
