#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const DISCOVERY_DIR = path.join(
  process.env.APPDATA ?? os.homedir(),
  'chat-overlay-widget'
);
const DISCOVERY_FILE = path.join(DISCOVERY_DIR, 'api.port');

function die(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function readDiscovery() {
  let raw;
  try {
    raw = fs.readFileSync(DISCOVERY_FILE, 'utf-8');
  } catch {
    die('Sidecar not running (discovery file not found)', 1);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    die('Discovery file has invalid JSON', 1);
  }
  if (!data.port || !data.token) {
    die('Discovery file missing port or token', 1);
  }
  return { port: data.port, token: data.token };
}

function httpRequest(method, urlPath, token, port, body = null) {
  return new Promise((resolve) => {
    const headers = { 'Authorization': `Bearer ${token}` };
    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers },
      (res) => {
        let chunks = '';
        res.on('data', (d) => { chunks += d; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(chunks);
          } catch {
            parsed = chunks;
          }
          resolve({ statusCode: res.statusCode, data: parsed });
        });
      }
    );
    const timeout = setTimeout(() => {
      req.destroy();
      die('Sidecar request timed out', 1);
    }, 5000);
    req.on('error', (err) => {
      clearTimeout(timeout);
      if (err.code === 'ECONNREFUSED') {
        die(`Sidecar not reachable on port ${port}`, 1);
      }
      die(`Request failed: ${err.message}`, 1);
    });
    req.on('close', () => clearTimeout(timeout));
    if (body !== null) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const USAGE = `Usage: overlay-capture <command>

Commands:
  list                          List visible windows
  window --title "Window Title" Capture a window screenshot
  help                          Show this help message

Examples:
  node scripts/overlay-capture.cjs list
  node scripts/overlay-capture.cjs window --title "Chrome"
`;

async function main() {
  const command = process.argv[2];

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  const { port, token } = readDiscovery();

  // Pre-flight health check
  const health = await httpRequest('GET', '/health', token, port);
  if (health.statusCode === 401) {
    die('Authentication failed \u2014 app may have restarted. Try again.', 1);
  }
  if (health.statusCode !== 200) {
    die(`Sidecar health check failed (HTTP ${health.statusCode})`, 1);
  }

  if (command === 'list') {
    const res = await httpRequest('GET', '/list-windows', token, port);
    if (res.statusCode !== 200) {
      die(res.data?.error ?? `List failed (HTTP ${res.statusCode})`, 2);
    }
    const windows = Array.isArray(res.data) ? res.data : [res.data];
    for (const w of windows) {
      if (w && w.title) {
        process.stdout.write(`[${w.processName ?? 'unknown'}] ${w.title}\n`);
      }
    }
    process.exit(0);
  }

  if (command === 'window') {
    const titleIdx = process.argv.indexOf('--title');
    if (titleIdx === -1 || !process.argv[titleIdx + 1]) {
      die('Usage: overlay-capture window --title "Window Title"', 2);
    }
    const title = process.argv[titleIdx + 1];

    const res = await httpRequest('POST', '/capture/window', token, port, { title });
    if (res.statusCode === 200 && res.data?.path) {
      process.stdout.write(res.data.path + '\n');
      process.exit(0);
    }
    if (res.statusCode === 401) {
      die('Authentication failed \u2014 restart the app', 1);
    }
    die(res.data?.error ?? `Capture failed (HTTP ${res.statusCode})`, 2);
  }

  die(`Unknown command: ${command}. Run 'overlay-capture help' for usage.`, 2);
}

main();
