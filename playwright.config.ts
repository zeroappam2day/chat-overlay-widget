/**
 * Playwright configuration.
 *
 * Projects:
 * - 'chromium' (default): Standalone Chromium for mock-Tauri tests (e2e/uat-*.spec.ts)
 * - 'webview2-cdp': Connects to running Tauri app via CDP on port 9222
 *   Prerequisites: set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
 *   and optionally WEBVIEW2_USER_DATA_FOLDER=<temp-dir> before launching the app (D-03)
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'webview2-cdp',
      use: {
        // Connect to running Tauri app's WebView2 via CDP (D-01, D-02)
        connectOptions: {
          wsEndpoint: 'http://localhost:9222',
        },
      },
    },
  ],
});
