import * as pty from 'node-pty';
import type WebSocket from 'ws';
import type { ServerMessage } from './protocol.js';

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export class PTYSession {
  private ptyProcess: pty.IPty;
  private dataDisposable: pty.IDisposable;
  private exitDisposable: pty.IDisposable;

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

    this.dataDisposable = this.ptyProcess.onData((data: string) => {
      send(ws, { type: 'output', data });
    });

    this.exitDisposable = this.ptyProcess.onExit(({ exitCode }) => {
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

  destroy(): void {
    this.dataDisposable.dispose();
    this.exitDisposable.dispose();
    try { this.ptyProcess.kill(); } catch { /* already dead */ }
  }
}
