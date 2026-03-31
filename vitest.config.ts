import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'sidecar/src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    environmentMatchGlobs: [
      ['src/**', 'jsdom'],
      ['sidecar/src/**', 'node'],
    ],
  },
});
