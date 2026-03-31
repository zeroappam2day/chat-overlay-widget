import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'sidecar/src/**/*.test.ts'],
    environmentMatchGlobs: [
      ['src/**', 'jsdom'],
      ['sidecar/src/**', 'node'],
    ],
  },
});
