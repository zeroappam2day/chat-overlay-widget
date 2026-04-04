/**
 * GitHub URL parsing utilities.
 * Adapted from parallel-code/src/lib/github-url.ts
 *
 * Types:
 *   ParsedGitHubUrl = {
 *     org: string;
 *     repo: string;
 *     type?: 'issues' | 'pull' | 'discussions' | 'actions/runs';
 *     number?: number;
 *     fullUrl: string;
 *   }
 *
 * Functions:
 *
 * parseGitHubUrl(url: string): ParsedGitHubUrl | null
 *   Parses GitHub URLs into structured data.
 *   Handles:
 *     https://github.com/org/repo
 *     https://github.com/org/repo/issues/123
 *     https://github.com/org/repo/pull/456
 *     https://github.com/org/repo/discussions/789
 *     https://github.com/org/repo/actions/runs/123
 *   Returns null for non-GitHub or malformed URLs.
 *
 * extractGitHubUrl(text: string): string | null
 *   Extracts the first GitHub URL from arbitrary text.
 *   Regex: /https?:\/\/(?:www\.)?github\.com\/[^\s)>\]"']+/i
 *
 * formatGitHubRef(parsed: ParsedGitHubUrl): string
 *   Returns a compact reference string:
 *     "org/repo#123 (issue)" or "org/repo#456 (PR)" or "org/repo"
 */

export interface ParsedGitHubUrl {
  org: string;
  repo: string;
  type?: 'issues' | 'pull' | 'discussions' | 'actions/runs';
  number?: number;
  fullUrl: string;
}

const GITHUB_URL_RE = /https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\/(?:(issues|pull|discussions)\/(\d+)|actions\/runs\/(\d+)))?(?:[#?][^\s]*)?$/;

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  const m = url.trim().match(GITHUB_URL_RE);
  if (!m) return null;
  const [, org, repo, type, num, runNum] = m;
  return {
    org,
    repo: repo.replace(/\.git$/, ''),
    type: runNum ? 'actions/runs' : (type as ParsedGitHubUrl['type']),
    number: num ? parseInt(num, 10) : runNum ? parseInt(runNum, 10) : undefined,
    fullUrl: url.trim(),
  };
}

const EXTRACT_RE = /https?:\/\/(?:www\.)?github\.com\/[^\s)>\]"']+/i;

export function extractGitHubUrl(text: string): string | null {
  const m = text.match(EXTRACT_RE);
  return m ? m[0] : null;
}

export function formatGitHubRef(parsed: ParsedGitHubUrl): string {
  const base = `${parsed.org}/${parsed.repo}`;
  if (parsed.type === 'issues' && parsed.number) return `${base}#${parsed.number} (issue)`;
  if (parsed.type === 'pull' && parsed.number) return `${base}#${parsed.number} (PR)`;
  if (parsed.type === 'discussions' && parsed.number) return `${base}#${parsed.number} (discussion)`;
  if (parsed.type === 'actions/runs' && parsed.number) return `${base} run #${parsed.number}`;
  return base;
}
