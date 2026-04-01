import { describe, it, expect } from 'vitest';
import { scrub, detectSecrets } from './secretScrubber.js';

// ---------------------------------------------------------------------------
// Pattern family tests — each provides a sample secret and expects [REDACTED]
// ---------------------------------------------------------------------------

describe('scrub() — pattern families', () => {
  it('redacts AWS access key (AKIA...)', () => {
    expect(scrub('key=AKIAIOSFODNN7EXAMPLE')).toBe('key=[REDACTED]');
  });

  it('redacts GitHub PAT (ghp_)', () => {
    expect(scrub('token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01')).toBe('token: [REDACTED]');
  });

  it('redacts GitHub OAuth token (gho_)', () => {
    expect(scrub('gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01')).toBe('[REDACTED]');
  });

  it('redacts GitHub App token (ghs_)', () => {
    expect(scrub('ghs_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01')).toBe('[REDACTED]');
  });

  it('redacts Anthropic API key (sk-ant-)', () => {
    expect(scrub('sk-ant-api03-abcdefghijklmnop')).toBe('[REDACTED]');
  });

  it('redacts OpenAI project key (sk-proj-)', () => {
    expect(scrub('sk-proj-abcdefghijklmnop1234567890')).toBe('[REDACTED]');
  });

  it('redacts OpenAI legacy key (sk- without ant- or proj-)', () => {
    expect(scrub('sk-abcdefghijklmnopqrstuv1234567890abcdefghijklmnop')).toBe('[REDACTED]');
  });

  it('does NOT redact Anthropic key as openai-legacy (no false positive)', () => {
    const result = scrub('sk-ant-api03-abcdefghijklmnop');
    // Should be [REDACTED] via anthropic-key — but must not double-redact
    expect(result).toBe('[REDACTED]');
  });

  it('redacts Bearer token in Authorization header', () => {
    expect(scrub('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.xxx.yyy')).toBe(
      'Authorization: Bearer [REDACTED]'
    );
  });

  it('redacts generic JWT (three-part base64url)', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(scrub(jwt)).toBe('[REDACTED]');
  });

  it('redacts PostgreSQL connection string', () => {
    expect(scrub('postgresql://user:password@host:5432/db')).toBe('[REDACTED]');
  });

  it('redacts MySQL connection string', () => {
    expect(scrub('mysql://user:password@host:3306/db')).toBe('[REDACTED]');
  });

  it('redacts MongoDB connection string (mongodb+srv)', () => {
    expect(scrub('mongodb+srv://user:password@cluster.example.com/db')).toBe('[REDACTED]');
  });

  it('redacts Redis URL with password', () => {
    expect(scrub('redis://:secretpassword@host:6379/0')).toBe('[REDACTED]');
  });

  it('redacts .env KEY=value assignments (value 8+ chars)', () => {
    expect(scrub('SECRET_KEY=abcdef123456')).toBe('SECRET_KEY=[REDACTED]');
  });

  it('does NOT redact short .env values (fewer than 8 chars)', () => {
    expect(scrub('PORT=3000')).toBe('PORT=3000');
    expect(scrub('LOG=debug')).toBe('LOG=debug');
  });

  it('redacts Slack bot token (xoxb-)', () => {
    expect(
      scrub('xoxb-1234567890-1234567890123-abcdefghijklmnopqrstuvwx')
    ).toBe('[REDACTED]');
  });

  it('redacts Stripe live key (sk_live_)', () => {
    expect(scrub('sk_live_abcdefghijklmnopqrstuvwx1234567890')).toBe('[REDACTED]');
  });

  it('redacts Stripe test key (sk_test_)', () => {
    expect(scrub('sk_test_abcdefghijklmnopqrstuvwx1234567890')).toBe('[REDACTED]');
  });

  it('redacts npm token (npm_)', () => {
    expect(scrub('npm_abcdefghijklmnopqrstuvwxyz123456')).toBe('[REDACTED]');
  });

  it('redacts PEM private key block header', () => {
    expect(scrub('-----BEGIN RSA PRIVATE KEY-----')).toBe('[REDACTED]');
  });

  it('redacts EC private key block header', () => {
    expect(scrub('-----BEGIN EC PRIVATE KEY-----')).toBe('[REDACTED]');
  });

  it('redacts generic PRIVATE KEY block header (no algorithm prefix)', () => {
    expect(scrub('-----BEGIN PRIVATE KEY-----')).toBe('[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe('scrub() — edge cases', () => {
  it('replaces multiple secrets on the same line', () => {
    const input = 'AKIAIOSFODNN7EXAMPLE and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01';
    const result = scrub(input);
    expect(result).toBe('[REDACTED] and [REDACTED]');
  });

  it('returns non-secret text unchanged', () => {
    expect(scrub('Hello world, just normal text')).toBe(
      'Hello world, just normal text'
    );
  });

  it('returns empty string unchanged', () => {
    expect(scrub('')).toBe('');
  });

  it('does NOT redact sk-short (below minimum length for openai-legacy)', () => {
    expect(scrub('sk-short')).toBe('sk-short');
  });

  it('handles text with newlines — redacts on multiple lines independently', () => {
    const input = 'line1 AKIAIOSFODNN7EXAMPLE\nline2 normal\nline3 ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01';
    const result = scrub(input);
    expect(result).toBe('line1 [REDACTED]\nline2 normal\nline3 [REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// detectSecrets() tests
// ---------------------------------------------------------------------------

describe('detectSecrets()', () => {
  it('returns empty array when no secrets present', () => {
    expect(detectSecrets('Hello world, just normal text')).toEqual([]);
  });

  it('returns a SecretMatch with correct patternName for AWS access key', () => {
    const matches = detectSecrets('key=AKIAIOSFODNN7EXAMPLE');
    expect(matches).toHaveLength(1);
    expect(matches[0].patternName).toBe('aws-access-key');
    expect(matches[0].line).toBe(0);
  });

  it('returns correct startIndex and endIndex for the matched secret', () => {
    const text = 'prefix AKIAIOSFODNN7EXAMPLE suffix';
    const matches = detectSecrets(text);
    expect(matches).toHaveLength(1);
    const m = matches[0];
    expect(text.slice(m.startIndex, m.endIndex)).toBe('AKIAIOSFODNN7EXAMPLE');
  });

  it('detects secrets across different lines with correct line numbers', () => {
    const input = [
      'normal line',
      'AKIAIOSFODNN7EXAMPLE here',
      'another normal line',
      'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01 end',
    ].join('\n');
    const matches = detectSecrets(input);
    expect(matches).toHaveLength(2);
    expect(matches[0].line).toBe(1);
    expect(matches[0].patternName).toBe('aws-access-key');
    expect(matches[1].line).toBe(3);
    expect(matches[1].patternName).toBe('github-pat');
  });

  it('detects multiple secrets on the same line', () => {
    const input = 'AKIAIOSFODNN7EXAMPLE and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01';
    const matches = detectSecrets(input);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const names = matches.map(m => m.patternName);
    expect(names).toContain('aws-access-key');
    expect(names).toContain('github-pat');
  });

  it('results are sorted by line then startIndex', () => {
    const input = [
      'AKIAIOSFODNN7EXAMPLE and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01',
      'npm_abcdefghijklmnopqrstuvwxyz123456',
    ].join('\n');
    const matches = detectSecrets(input);
    for (let i = 1; i < matches.length; i++) {
      const prev = matches[i - 1];
      const curr = matches[i];
      const ordered =
        curr.line > prev.line ||
        (curr.line === prev.line && curr.startIndex >= prev.startIndex);
      expect(ordered).toBe(true);
    }
  });

  it('SecretMatch objects have all required fields', () => {
    const matches = detectSecrets('AKIAIOSFODNN7EXAMPLE');
    expect(matches).toHaveLength(1);
    const m = matches[0];
    expect(typeof m.line).toBe('number');
    expect(typeof m.startIndex).toBe('number');
    expect(typeof m.endIndex).toBe('number');
    expect(typeof m.patternName).toBe('string');
  });
});
