/**
 * secretScrubber.ts
 *
 * Best-effort secret redaction module.
 * Exports scrub() and detectSecrets() for use in server.ts (plan 02) and
 * Phase 25 screenshot blurring.
 *
 * D-01: Known-format patterns only (~18 regexes).
 * D-02: Standalone module — no dependencies on server.ts or terminalBuffer.ts.
 * D-03: Redaction replacement is [REDACTED].
 * D-04: Hardcoded patterns only — no config file.
 *
 * WARNING: This is best-effort only. Regex bypass vectors exist (ANSI-split,
 * base64-encoded secrets, line-wrap obfuscation). Do NOT rely on this as a
 * security boundary.
 */

// ---------------------------------------------------------------------------
// Pattern registry
// ---------------------------------------------------------------------------

/**
 * A named secret pattern entry.
 * The `pattern` regex MUST use the `g` flag so matchAll() works correctly.
 */
export interface PatternEntry {
  name: string;
  /** Regex used for scrub() — matches the ENTIRE secret (replacement = [REDACTED]) */
  pattern: RegExp;
  /**
   * Optional: when defined, only this capture group is replaced with [REDACTED].
   * Used for patterns like Bearer tokens where we want to keep the prefix.
   * If not set, the whole match is replaced.
   */
  captureGroup?: number;
}

/**
 * All known secret patterns. Exported for testing and Phase 25 reuse.
 */
export const SECRET_PATTERNS: PatternEntry[] = [
  // AWS access key ID: AKIA followed by 16 uppercase alphanumeric chars
  { name: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },

  // GitHub tokens (30+ alphanum chars after prefix — real tokens are 36, but accept shorter in tests)
  { name: 'github-pat',   pattern: /\bghp_[A-Za-z0-9]{30,}\b/g },
  { name: 'github-oauth', pattern: /\bgho_[A-Za-z0-9]{30,}\b/g },
  { name: 'github-app',   pattern: /\bghs_[A-Za-z0-9]{30,}\b/g },

  // Anthropic key: sk-ant- followed by 20+ chars (must come BEFORE openai-legacy)
  { name: 'anthropic-key', pattern: /\bsk-ant-[a-zA-Z0-9_\-]{20,}\b/g },

  // OpenAI project key: sk-proj- followed by 20+ chars
  { name: 'openai-key', pattern: /\bsk-proj-[a-zA-Z0-9]{20,}\b/g },

  // OpenAI legacy key: sk- NOT followed by ant- or proj-, 32+ chars
  // Negative lookahead prevents matching Anthropic and OpenAI project keys
  { name: 'openai-legacy', pattern: /\bsk-(?!ant-)(?!proj-)(?!_)[a-zA-Z0-9]{32,}\b/g },

  // Bearer token in Authorization header — only replace the token part after "Bearer "
  // We match "Bearer <token>" and use a capture group for the token
  { name: 'bearer-token', pattern: /\bBearer ([A-Za-z0-9_\-\.]{20,})/g, captureGroup: 1 },

  // Generic JWT: three base64url segments separated by dots
  // First two start with eyJ (base64 of {"...), third is the signature
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g,
  },

  // Database connection strings
  { name: 'postgres-url', pattern: /\bpostgresql:\/\/[^\s'"<>]+/g },
  { name: 'mysql-url',    pattern: /\bmysql:\/\/[^\s'"<>]+/g },
  { name: 'mongodb-url',  pattern: /\bmongodb(?:\+srv)?:\/\/[^\s'"<>]+/g },
  { name: 'redis-url',    pattern: /\bredis:\/\/[^\s'"<>]+/g },

  // .env KEY=value — match only the value part (8+ non-whitespace chars)
  // ^ anchored, so this only matches at the start of a line
  { name: 'env-value', pattern: /(?<=^[A-Z_][A-Z0-9_]{1,49}=)[^\s]{8,}/gm, captureGroup: undefined },

  // Slack token: xox{b,p,r,a,s}- followed by 10+ alphanumeric/dash chars
  { name: 'slack-token', pattern: /\bxox[bpras]-[0-9a-zA-Z\-]{10,}/g },

  // Stripe keys: sk_live_ or sk_test_ followed by 20+ chars
  { name: 'stripe-key', pattern: /\bsk_(live|test)_[a-zA-Z0-9]{20,}\b/g },

  // npm token: npm_ followed by 20+ alphanum chars
  { name: 'npm-token', pattern: /\bnpm_[a-zA-Z0-9]{20,}\b/g },

  // PEM private key block header (RSA, EC, DSA, OPENSSH, or plain PRIVATE KEY)
  {
    name: 'private-key-block',
    pattern: /-----BEGIN\s+(?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
];

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * A single detected secret location in a multi-line text.
 */
export interface SecretMatch {
  /** Zero-based line number within the input text. */
  line: number;
  /** Start index of the secret within that line. */
  startIndex: number;
  /** End index (exclusive) of the secret within that line. */
  endIndex: number;
  /** Name of the pattern that matched (e.g., 'aws-access-key'). */
  patternName: string;
}

// ---------------------------------------------------------------------------
// Helper: reset all pattern lastIndex values so they can be reused safely
// ---------------------------------------------------------------------------
function resetPatterns(): void {
  for (const p of SECRET_PATTERNS) {
    p.pattern.lastIndex = 0;
  }
}

// ---------------------------------------------------------------------------
// scrub()
// ---------------------------------------------------------------------------

/**
 * Replace all detected secrets in `text` with `[REDACTED]`.
 *
 * Each SECRET_PATTERNS entry is applied in order. Patterns with a
 * `captureGroup` setting only redact that capture group (e.g., the token
 * part of a Bearer header), preserving the surrounding text.
 *
 * @param text - Any string (terminal output, log line, etc.)
 * @returns The input with all matched secrets replaced by [REDACTED].
 */
export function scrub(text: string): string {
  if (!text) return text;

  let result = text;

  for (const entry of SECRET_PATTERNS) {
    entry.pattern.lastIndex = 0;

    if (entry.captureGroup !== undefined && entry.captureGroup > 0) {
      // Replace only the capture group, preserving the surrounding match text
      result = result.replace(entry.pattern, (match, ...groups) => {
        // groups[0] = first capture group, groups[1] = second, etc.
        const capIdx = entry.captureGroup! - 1;
        const captured = groups[capIdx] as string;
        if (captured) {
          return match.replace(captured, '[REDACTED]');
        }
        return match;
      });
    } else {
      // Replace the entire match
      result = result.replace(entry.pattern, '[REDACTED]');
    }

    // Reset lastIndex after each replace pass (defensive)
    entry.pattern.lastIndex = 0;
  }

  return result;
}

// ---------------------------------------------------------------------------
// detectSecrets()
// ---------------------------------------------------------------------------

/**
 * Scan `text` for all secret patterns and return their locations.
 *
 * Splits by newline and scans each line independently so line numbers are
 * accurate. Results are sorted by line number then by startIndex.
 *
 * @param text - Multi-line or single-line string to scan.
 * @returns Array of SecretMatch objects, sorted by line then startIndex.
 */
export function detectSecrets(text: string): SecretMatch[] {
  if (!text) return [];

  const matches: SecretMatch[] = [];
  const lines = text.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (const entry of SECRET_PATTERNS) {
      entry.pattern.lastIndex = 0;

      // Use matchAll for safe iteration (handles g flag reset automatically)
      const re = new RegExp(
        entry.pattern.source,
        entry.pattern.flags.includes('m') ? 'gm' : 'g'
      );

      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const fullMatch = m[0];
        let startIndex = m.index;
        let endIndex = m.index + fullMatch.length;

        // If this pattern uses a capture group, report the group's position
        if (entry.captureGroup !== undefined && entry.captureGroup > 0) {
          const cap = m[entry.captureGroup];
          if (cap) {
            // Find the capture group offset within the full match
            const capStart = fullMatch.indexOf(cap);
            if (capStart >= 0) {
              startIndex = m.index + capStart;
              endIndex = startIndex + cap.length;
            }
          }
        }

        matches.push({
          line: lineIdx,
          startIndex,
          endIndex,
          patternName: entry.name,
        });
      }

      entry.pattern.lastIndex = 0;
    }
  }

  // Sort by line then by startIndex
  matches.sort((a, b) => a.line - b.line || a.startIndex - b.startIndex);

  // Deduplicate overlapping matches (keep the first/longer match)
  const deduped: SecretMatch[] = [];
  for (const m of matches) {
    const last = deduped[deduped.length - 1];
    if (last && last.line === m.line && m.startIndex < last.endIndex) {
      // Overlapping on the same line — skip the later one
      continue;
    }
    deduped.push(m);
  }

  return deduped;
}
