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
exports.DISCOVERY_FILE_DIR = void 0;
exports.cleanStaleDiscoveryFile = cleanStaleDiscoveryFile;
exports.writeDiscoveryFile = writeDiscoveryFile;
exports.deleteDiscoveryFile = deleteDiscoveryFile;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
exports.DISCOVERY_FILE_DIR = path.join(process.env['APPDATA'] ?? os.homedir(), 'chat-overlay-widget');
/**
 * Remove any stale discovery file left behind by a force-killed sidecar.
 * Called at startup before writing a fresh one.
 */
function cleanStaleDiscoveryFile() {
    const filePath = path.join(exports.DISCOVERY_FILE_DIR, 'api.port');
    try {
        fs.unlinkSync(filePath);
        console.log(`[sidecar] cleaned stale discovery file: ${filePath}`);
    }
    catch {
        // No stale file — expected on first run
    }
}
/**
 * Atomically write the discovery file containing port and auth token.
 * Writes to a .tmp file first, then renames for atomic replace.
 * Returns the file path for use in cleanup.
 */
function writeDiscoveryFile(port, token) {
    const filePath = path.join(exports.DISCOVERY_FILE_DIR, 'api.port');
    const tmpPath = filePath + '.tmp';
    fs.mkdirSync(exports.DISCOVERY_FILE_DIR, { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify({ port, token }), 'utf-8');
    fs.renameSync(tmpPath, filePath);
    console.log('[sidecar] discovery file written: ' + filePath);
    return filePath;
}
/**
 * Synchronously delete the discovery file.
 * Safe to use in process.on('exit') handlers.
 */
function deleteDiscoveryFile(filePath) {
    try {
        fs.unlinkSync(filePath);
    }
    catch {
        /* already gone — that's fine */
    }
    console.log('[sidecar] discovery file deleted');
}
