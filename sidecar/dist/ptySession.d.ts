import type WebSocket from 'ws';
export declare const SCREENSHOT_DIR: string;
export declare class PTYSession {
    private ws;
    private ptyProcess;
    private dataDisposable;
    private exitDisposable;
    private recorder;
    private tempFiles;
    constructor(ws: WebSocket, shellExe: string, cols?: number, rows?: number);
    write(data: string): void;
    resize(cols: number, rows: number): void;
    saveImage(base64: string, ext: string): Promise<string>;
    private cleanupTempFiles;
    destroy(): void;
    get sessionId(): number;
}
