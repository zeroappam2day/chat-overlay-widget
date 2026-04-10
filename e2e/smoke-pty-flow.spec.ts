/**
 * Smoke: Core PTY Flow (TEST-01, TEST-03)
 *
 * E2E test validating the app's heart: PTY bridge.
 * Uses protocol-level WebSocket interception (D-10) for deterministic
 * verification instead of brittle canvas OCR.
 *
 * Prerequisites:
 * - Vite dev server on localhost:1420
 * - Sidecar running (port from api.port discovery file)
 *
 * Run: npx playwright test e2e/smoke-pty-flow.spec.ts --project=chromium
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Read sidecar port from discovery file
function getSidecarPort(): { port: number; token: string } {
  const discoveryPath = path.join(
    process.env.APPDATA || '',
    'chat-overlay-widget',
    'api.port'
  );
  const raw = fs.readFileSync(discoveryPath, 'utf-8');
  return JSON.parse(raw);
}

// Mock Tauri APIs so the frontend can connect to sidecar without Tauri runtime
async function mockTauriAndConnect(page: Page, sidecarPort: number) {
  await page.addInitScript((port) => {
    (window as any).__TAURI_IPC__ = (message: any) => {
      const { cmd, callback, error } = message;
      const resolve = (result: any) => {
        const fn = (window as any)[`_${callback}`];
        if (fn) fn(result);
      };

      if (cmd === 'get_sidecar_port') {
        setTimeout(() => resolve(port), 10);
      } else if (cmd === 'plugin:event|listen') {
        setTimeout(() => resolve(0), 10);
      } else if (cmd === 'plugin:event|unlisten') {
        setTimeout(() => resolve(null), 10);
      } else if (cmd === 'plugin:window|manage') {
        setTimeout(() => resolve(null), 10);
      } else {
        setTimeout(() => resolve(null), 10);
      }
    };

    (window as any).__TAURI_METADATA__ = { __currentWindow: { label: 'main' } };
  }, sidecarPort);
}

test.describe('Smoke: Core PTY Flow', () => {
  let sidecarPort: number;

  test.beforeAll(() => {
    const discovery = getSidecarPort();
    sidecarPort = discovery.port;
    console.log(`Sidecar port: ${sidecarPort}`);
  });

  test('TEST-01: CDP connection reads visible DOM element', async ({ page }) => {
    await mockTauriAndConnect(page, sidecarPort);
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(1000);

    // Verify page rendered React components (not an empty shell)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    const html = await page.content();
    expect(html).toContain('</div>');

    // Check for meaningful rendered content
    const hasContent = await page.evaluate(() => {
      return document.querySelectorAll('[class]').length > 5;
    });
    expect(hasContent).toBe(true);
  });

  test('TEST-03: PTY flow — spawn, send command, verify output', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await mockTauriAndConnect(page, sidecarPort);

    // Inject WebSocket message interceptor BEFORE page loads (D-10)
    await page.addInitScript(() => {
      (window as any).__testState = {
        wsConnected: false,
        ptyReady: false,
        outputBuffer: '',
        shellList: [] as string[],
        messages: [] as any[],
      };

      const OrigWebSocket = window.WebSocket;
      (window as any).WebSocket = function(url: string, protocols?: string | string[]) {
        const ws = new OrigWebSocket(url, protocols);
        const state = (window as any).__testState;

        ws.addEventListener('open', () => {
          state.wsConnected = true;
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data);
            state.messages.push(msg);

            if (msg.type === 'pty-ready') {
              state.ptyReady = true;
            }
            if (msg.type === 'output') {
              state.outputBuffer += msg.data;
            }
            if (msg.type === 'shell-list') {
              state.shellList = msg.shells;
            }
          } catch {}
        });

        return ws;
      } as any;
      Object.assign((window as any).WebSocket, OrigWebSocket);
    });

    await page.goto('http://localhost:1420');

    // Step 1: Wait for WebSocket connection (D-15)
    await page.waitForFunction(
      () => (window as any).__testState?.wsConnected === true,
      { timeout: 5000 }
    );

    // Step 2: Wait for pty-ready (ConPTY + PowerShell init 200-800ms per D-15)
    await page.waitForFunction(
      () => (window as any).__testState?.ptyReady === true,
      { timeout: 10000 }
    );

    // Step 3: Clear output buffer after PTY startup noise
    await page.evaluate(() => {
      (window as any).__testState.outputBuffer = '';
    });

    // Step 4: Send command via ChatInputBar (D-10)
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        nativeInputValueSetter?.call(textarea, 'echo __PLAYWRIGHT_SMOKE__');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        textarea.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
        }));
      }
    });

    // Step 5: Accumulate output — ConPTY echoes input AND output (D-12)
    await page.waitForFunction(
      () => (window as any).__testState?.outputBuffer?.includes('__PLAYWRIGHT_SMOKE__'),
      { timeout: 10000 }
    );

    const outputBuffer = await page.evaluate(
      () => (window as any).__testState?.outputBuffer
    );
    expect(outputBuffer).toContain('__PLAYWRIGHT_SMOKE__');

    const messageCount = await page.evaluate(
      () => (window as any).__testState?.messages?.length
    );
    console.log(`Smoke test complete: ${messageCount} WS messages captured`);
    console.log(`Output buffer length: ${outputBuffer?.length}`);
  });
});
