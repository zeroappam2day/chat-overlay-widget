import type WebSocket from 'ws';
import { TerminalBuffer } from './terminalBuffer.js';
export declare const SCREENSHOT_DIR: string;
export declare class PTYSession {
    private ws;
    private paneId?;
    private ptyProcess;
    private dataDisposable;
    private bufferDisposable;
    private exitDisposable;
    private recorder;
    private tempFiles;
    readonly terminalBuffer: TerminalBuffer;
    constructor(ws: WebSocket, shellExe: string, cols?: number, rows?: number, paneId?: string | undefined);
    write(data: string): void;
    resize(cols: number, rows: number): void;
    saveImage(base64: string): Promise<string>;
    private cleanupTempFiles;
    destroy(): void;
    get sessionId(): number;
}
