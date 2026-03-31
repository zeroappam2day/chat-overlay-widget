"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PTYSession = exports.SCREENSHOT_DIR = void 0;
const pty = __importStar(require("node-pty"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const crypto = __importStar(require("node:crypto"));
const sessionRecorder_js_1 = require("./sessionRecorder.js");
exports.SCREENSHOT_DIR = path.join(os.tmpdir(), 'chat-overlay-screenshots');
function send(ws, msg) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
class PTYSession {
    constructor(ws, shellExe, cols = 80, rows = 24) {
        this.ws = ws;
        this.tempFiles = [];
        this.ptyProcess = pty.spawn(shellExe, [], {
            name: 'xterm-color',
            cols,
            rows,
            cwd: process.env['USERPROFILE'] || 'C:\\',
            env: process.env,
            useConpty: true,
        });
        this.recorder = new sessionRecorder_js_1.SessionRecorder(shellExe, process.env['USERPROFILE'] || 'C:\\');
        this.dataDisposable = this.ptyProcess.onData((data) => {
            send(ws, { type: 'output', data });
            this.recorder.append(data);
        });
        this.exitDisposable = this.ptyProcess.onExit(({ exitCode }) => {
            this.recorder.end();
            send(ws, { type: 'pty-exit', exitCode });
        });
        send(ws, { type: 'pty-ready', pid: this.ptyProcess.pid, shell: shellExe });
    }
    write(data) {
        this.ptyProcess.write(data);
    }
    resize(cols, rows) {
        this.ptyProcess.resize(cols, rows);
    }
    async saveImage(base64) {
        await fs.promises.mkdir(exports.SCREENSHOT_DIR, { recursive: true });
        const filename = `${crypto.randomUUID()}.png`;
        const filePath = path.join(exports.SCREENSHOT_DIR, filename);
        const buffer = Buffer.from(base64, 'base64');
        await fs.promises.writeFile(filePath, buffer);
        this.tempFiles.push(filePath);
        return filePath;
    }
    cleanupTempFiles() {
        for (const f of this.tempFiles) {
            fs.unlink(f, () => { }); // async fire-and-forget
        }
        this.tempFiles = [];
    }
    destroy() {
        this.cleanupTempFiles();
        this.recorder.end();
        this.dataDisposable.dispose();
        this.exitDisposable.dispose();
        try {
            this.ptyProcess.kill();
        }
        catch { /* already dead */ }
    }
    get sessionId() {
        return this.recorder.getSessionId();
    }
}
exports.PTYSession = PTYSession;
