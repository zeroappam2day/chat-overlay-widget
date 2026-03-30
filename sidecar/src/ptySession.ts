import * as pty from 'node-pty';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type WebSocket from 'ws';
import type { ServerMessage } from './protocol.js';
import { SessionRecorder } from './sessionRecorder.js';

export const SCREENSHOT_DIR = path.join(os.tmpdir(), 'chat-overlay-screenshots');

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export class PTYSession {
  private ptyProcess: pty.IPty;
  private dataDisposable: pty.IDisposable;
  private exitDisposable: pty.IDisposable;
  private recorder: SessionRecorder;
  private tempFiles: string[] = [];

  constructor(
    private ws: WebSocket,
    shellExe: string,
    cols: number = 80,
    rows: number = 24
  ) {
    this.ptyProcess = pty.spawn(shellExe, [], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: process.env['USERPROFILE'] || 'C:\\',
      env: process.env as Record<string, string>,
      useConpty: true,
    });

    this.recorder = new SessionRecorder(shellExe, process.env['USERPROFILE'] || 'C:\\');

    this.dataDisposable = this.ptyProcess.onData((data: string) => {
      send(ws, { type: 'output', data });
      this.recorder.append(data);
    });

    this.exitDisposable = this.ptyProcess.onExit(({ exitCode }) => {
      this.recorder.end();
      send(ws, { type: 'pty-exit', exitCode });
    });

    send(ws, { type: 'pty-ready', pid: this.ptyProcess.pid, shell: shellExe });
  }

  write(data: string): void {
    this.ptyProcess.write(data);
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess.resize(cols, rows);
  }

  async saveImage(base64: string): Promise<string> {
    await fs.promises.mkdir(SCREENSHOT_DIR, { recursive: true });
    const filename = `${crypto.randomUUID()}.png`;
    const filePath = path.join(SCREENSHOT_DIR, filename);
    const buffer = Buffer.from(base64, 'base64');
    await fs.promises.writeFile(filePath, buffer);
    this.tempFiles.push(filePath);
    return filePath;
  }

  private cleanupTempFiles(): void {
    for (const f of this.tempFiles) {
      fs.unlink(f, () => {}); // async fire-and-forget
    }
    this.tempFiles = [];
  }

  destroy(): void {
    this.cleanupTempFiles();
    this.recorder.end();
    this.dataDisposable.dispose();
    this.exitDisposable.dispose();
    try { this.ptyProcess.kill(); } catch { /* already dead */ }
  }

  get sessionId(): number {
    return this.recorder.getSessionId();
  }
}
