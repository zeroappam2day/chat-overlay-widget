import Database from 'better-sqlite3';
export interface SessionRow {
    id: number;
    shell: string;
    cwd: string | null;
    started_at: number;
    ended_at: number | null;
    is_orphan: number;
}
export declare function openDb(): void;
export declare function getDb(): Database.Database;
export declare function markOrphans(): void;
export declare function listSessions(): SessionRow[];
export declare function getSessionChunks(sessionId: number): {
    data: Buffer;
}[];
