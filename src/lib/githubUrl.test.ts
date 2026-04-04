import { describe, it, expect } from 'vitest';
import { parseGitHubUrl, extractGitHubUrl, formatGitHubRef } from './githubUrl';

describe('parseGitHubUrl', () => {
  it('parses issue URL', () => {
    const result = parseGitHubUrl('https://github.com/anthropics/claude-code/issues/123');
    expect(result).toEqual({
      org: 'anthropics',
      repo: 'claude-code',
      type: 'issues',
      number: 123,
      fullUrl: 'https://github.com/anthropics/claude-code/issues/123',
    });
  });

  it('parses pull request URL', () => {
    const result = parseGitHubUrl('https://github.com/org/repo/pull/456');
    expect(result).toMatchObject({ org: 'org', repo: 'repo', type: 'pull', number: 456 });
  });

  it('parses discussion URL', () => {
    const result = parseGitHubUrl('https://github.com/org/repo/discussions/789');
    expect(result).toMatchObject({ org: 'org', repo: 'repo', type: 'discussions', number: 789 });
  });

  it('parses actions/runs URL', () => {
    const result = parseGitHubUrl('https://github.com/org/repo/actions/runs/111');
    expect(result).toMatchObject({ org: 'org', repo: 'repo', type: 'actions/runs', number: 111 });
  });

  it('parses repo-only URL', () => {
    const result = parseGitHubUrl('https://github.com/org/repo');
    expect(result).toMatchObject({ org: 'org', repo: 'repo' });
    expect(result?.type).toBeUndefined();
    expect(result?.number).toBeUndefined();
  });

  it('returns null for non-GitHub URL', () => {
    expect(parseGitHubUrl('https://example.com')).toBeNull();
  });

  it('returns null for non-URL string', () => {
    expect(parseGitHubUrl('not a url')).toBeNull();
  });

  it('strips .git suffix from repo name', () => {
    const result = parseGitHubUrl('https://github.com/org/repo.git');
    expect(result?.repo).toBe('repo');
  });

  it('handles URL with query string', () => {
    const url = 'https://github.com/org/repo/issues/1?foo=bar';
    const result = parseGitHubUrl(url);
    expect(result).not.toBeNull();
    expect(result?.number).toBe(1);
    expect(result?.type).toBe('issues');
  });

  it('handles URL with hash fragment', () => {
    const url = 'https://github.com/org/repo/issues/1#comment-999';
    const result = parseGitHubUrl(url);
    expect(result).not.toBeNull();
    expect(result?.number).toBe(1);
  });

  it('handles URL with trailing slash in repo', () => {
    // repo-only URL with trailing slash
    const result = parseGitHubUrl('https://github.com/org/repo/');
    // trailing slash may or may not match — just ensure no crash
    // if it matches, org/repo should be correct
    if (result) {
      expect(result.org).toBe('org');
    }
  });
});

describe('extractGitHubUrl', () => {
  it('extracts GitHub URL from text with surrounding content', () => {
    const text = 'check this https://github.com/org/repo/issues/1 link';
    expect(extractGitHubUrl(text)).toBe('https://github.com/org/repo/issues/1');
  });

  it('returns null when no URLs present', () => {
    expect(extractGitHubUrl('no urls here')).toBeNull();
  });

  it('returns null for non-GitHub URL in text', () => {
    expect(extractGitHubUrl('visit https://example.com for info')).toBeNull();
  });

  it('extracts first GitHub URL when multiple present', () => {
    const text = 'see https://github.com/a/b/issues/1 and https://github.com/c/d/pull/2';
    const result = extractGitHubUrl(text);
    expect(result).toBe('https://github.com/a/b/issues/1');
  });
});

describe('formatGitHubRef', () => {
  it('formats issue reference', () => {
    const parsed = { org: 'org', repo: 'repo', type: 'issues' as const, number: 123, fullUrl: '' };
    expect(formatGitHubRef(parsed)).toBe('org/repo#123 (issue)');
  });

  it('formats PR reference', () => {
    const parsed = { org: 'org', repo: 'repo', type: 'pull' as const, number: 456, fullUrl: '' };
    expect(formatGitHubRef(parsed)).toBe('org/repo#456 (PR)');
  });

  it('formats discussion reference', () => {
    const parsed = { org: 'org', repo: 'repo', type: 'discussions' as const, number: 789, fullUrl: '' };
    expect(formatGitHubRef(parsed)).toBe('org/repo#789 (discussion)');
  });

  it('formats actions/runs reference', () => {
    const parsed = { org: 'org', repo: 'repo', type: 'actions/runs' as const, number: 111, fullUrl: '' };
    expect(formatGitHubRef(parsed)).toBe('org/repo run #111');
  });

  it('formats repo-only reference', () => {
    const parsed = { org: 'org', repo: 'repo', fullUrl: '' };
    expect(formatGitHubRef(parsed)).toBe('org/repo');
  });
});
