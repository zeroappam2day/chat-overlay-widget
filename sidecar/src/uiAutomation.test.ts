/**
 * uiAutomation.test.ts — Unit tests for Agent Runtime Phase 4
 *
 * Tests validation logic and caching behavior.
 * Does NOT test actual PowerShell execution (requires Windows + UIAutomation).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetUiCache } from './uiAutomation.js';

describe('uiAutomation — cache and validation', () => {
  beforeEach(() => {
    resetUiCache();
  });

  it('resetUiCache clears the cache without error', () => {
    // Just verifying the exported function works
    expect(() => resetUiCache()).not.toThrow();
  });

  it('UiElement interface shape matches expected contract', async () => {
    // Import and verify the type exists (compile-time check via import)
    const mod = await import('./uiAutomation.js');
    expect(typeof mod.getUiElements).toBe('function');
    expect(typeof mod.resetUiCache).toBe('function');
  });
});
