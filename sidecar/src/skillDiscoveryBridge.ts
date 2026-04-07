/**
 * Skill Discovery Bridge — queries Postgres skills_index for matching skills.
 * Uses full-text search on the tsv column (NOT vector search) to avoid
 * sentence-transformers dependency in Node.js.
 *
 * Graceful degradation: returns empty array if Postgres is unreachable.
 * Does NOT crash the sidecar on connection errors.
 */

import { Pool } from 'pg';

export interface SkillMatch {
  skillName: string;
  description: string;
  usecases: string[];
  taxonomy: { l1: string; l2: string; l3: string };
  score: number;
  instructionsSummary: string;
}

class SkillDiscoveryBridge {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'global_db',
      user: 'postgres',
      password: 'postgres123',
      max: 3,
      idleTimeoutMillis: 30000,
    });

    // Suppress unhandled pool errors (e.g. connection refused on startup)
    this.pool.on('error', (err) => {
      console.error('[skillDiscovery] pool background error:', err.message);
    });
  }

  async discoverSkills(query: string, windowTitle?: string): Promise<SkillMatch[]> {
    try {
      // Build combined query — prepend window title for context-aware matching
      const combinedQuery = windowTitle ? `${windowTitle} ${query}` : query;

      // Full-text search on tsv column
      const sql = `SELECT skill_name, description, usecases, l1, l2, l3,
        ts_rank(tsv, plainto_tsquery('english', $1)) AS score
        FROM skills_index
        WHERE tsv @@ plainto_tsquery('english', $1)
        ORDER BY score DESC LIMIT 10`;

      const result = await this.pool.query(sql, [combinedQuery]);

      // For top 5, fetch full instructions for enrichment
      const matches: SkillMatch[] = [];
      for (const row of result.rows.slice(0, 5)) {
        let instructionsSummary = '';
        try {
          const enrichment = await this.pool.query(
            'SELECT content FROM skills WHERE skill_name = $1',
            [row.skill_name]
          );
          instructionsSummary = enrichment.rows[0]?.content?.substring(0, 500) || '';
        } catch (enrichErr) {
          console.error(`[skillDiscovery] enrichment query failed for ${row.skill_name}:`, (enrichErr as Error).message);
        }
        matches.push({
          skillName: row.skill_name,
          description: row.description,
          usecases: row.usecases || [],
          taxonomy: { l1: row.l1, l2: row.l2, l3: row.l3 },
          score: row.score,
          instructionsSummary,
        });
      }

      // Add remaining results (6-10) without enrichment
      for (const row of result.rows.slice(5)) {
        matches.push({
          skillName: row.skill_name,
          description: row.description,
          usecases: row.usecases || [],
          taxonomy: { l1: row.l1, l2: row.l2, l3: row.l3 },
          score: row.score,
          instructionsSummary: '',
        });
      }

      return matches;
    } catch (err) {
      console.error('[skillDiscovery] query failed:', (err as Error).message);
      return [];
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.pool.end();
    } catch {
      // Ignore — pool may already be closed
    }
  }
}

export const skillDiscoveryBridge = new SkillDiscoveryBridge();
