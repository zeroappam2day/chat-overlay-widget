export declare class SessionRecorder {
    private sessionId;
    private buffer;
    private bufferSize;
    private flushTimer;
    private insertChunkStmt;
    private ended;
    constructor(shell: string, cwd: string);
    append(data: string): void;
    private flush;
    end(): void;
    destroy(): void;
    getSessionId(): number;
}
