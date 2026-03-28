"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectShells = detectShells;
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const KNOWN_PATHS = {
    'powershell.exe': [
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe',
    ],
    'cmd.exe': [
        'C:\\Windows\\System32\\cmd.exe',
    ],
    'bash.exe': [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ],
};
function detectShells() {
    const found = [];
    for (const [name, paths] of Object.entries(KNOWN_PATHS)) {
        const hit = paths.find(p => (0, fs_1.existsSync)(p));
        if (hit) {
            found.push({ name, exe: hit });
            continue;
        }
        try {
            const result = (0, child_process_1.execSync)(`where ${name}`, { encoding: 'utf8', timeout: 3000 }).trim().split('\n')[0];
            if (result)
                found.push({ name, exe: result.trim() });
        }
        catch { /* not found on PATH */ }
    }
    // Guarantee PowerShell is always present (D-02: always default)
    if (!found.some(s => s.name === 'powershell.exe')) {
        found.unshift({ name: 'powershell.exe', exe: 'powershell.exe' });
    }
    return found;
}
