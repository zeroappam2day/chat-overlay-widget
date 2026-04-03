/**
 * Lazy-loaded Shiki syntax highlighter.
 * Adapted from parallel-code/src/lib/shiki-highlighter.ts
 *
 * Singleton pattern: getHighlighter() returns a cached Shiki instance.
 * First call imports shiki dynamically (code-split).
 */

import type { Highlighter } from 'shiki';

// ── Language detection ───────────────────────────────────────────────────────

const EXT_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.r': 'r',
  '.sql': 'sql',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.ps1': 'powershell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.json': 'json',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.md': 'markdown',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.makefile': 'makefile',
  '.lua': 'lua',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

const BASENAME_MAP: Record<string, string> = {
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Rakefile: 'ruby',
  Gemfile: 'ruby',
};

export function detectLanguage(filePath: string): string {
  // Check basename overrides first
  const basename = filePath.split('/').pop() ?? filePath;
  if (BASENAME_MAP[basename]) return BASENAME_MAP[basename];

  // Check extension
  const dotIdx = basename.lastIndexOf('.');
  if (dotIdx >= 0) {
    const ext = basename.slice(dotIdx).toLowerCase();
    if (EXT_MAP[ext]) return EXT_MAP[ext];
  }

  return 'plaintext';
}

// ── Singleton highlighter ────────────────────────────────────────────────────

let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((shiki) =>
      shiki.createHighlighter({
        themes: ['github-dark'],
        langs: [
          'typescript', 'javascript', 'python', 'rust', 'go', 'java',
          'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin', 'scala',
          'r', 'sql', 'bash', 'powershell', 'yaml', 'json', 'toml', 'xml',
          'html', 'css', 'scss', 'less', 'markdown', 'graphql', 'dockerfile',
          'makefile', 'lua', 'vue', 'svelte',
        ],
      }),
    );
  }
  return highlighterPromise;
}

// ── Highlight lines ──────────────────────────────────────────────────────────

/**
 * Returns an array of HTML strings, one per line.
 * Falls back to plain text if language grammar fails to load.
 */
export async function highlightLines(
  code: string,
  lang: string,
): Promise<string[]> {
  try {
    const highlighter = await getHighlighter();
    const html = highlighter.codeToHtml(code, {
      lang: lang === 'plaintext' ? 'text' : lang,
      theme: 'github-dark',
    });
    // Shiki wraps output in <pre><code>...lines...</code></pre>
    // Extract inner HTML and split by lines
    const codeContent = html
      .replace(/^<pre[^>]*><code[^>]*>/, '')
      .replace(/<\/code><\/pre>$/, '');
    return codeContent.split('\n');
  } catch {
    // Fallback: escape HTML entities and return plain lines
    return code.split('\n').map((line) =>
      line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;'),
    );
  }
}
