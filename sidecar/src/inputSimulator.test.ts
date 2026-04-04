/**
 * inputSimulator.test.ts — Unit tests for Agent Runtime Phase 5
 *
 * Tests validation logic in inputSimulator functions.
 * Does NOT test actual PowerShell execution (requires Windows + SendInput).
 * Focuses on input validation and error handling that can be tested in isolation.
 */
import { describe, it, expect } from 'vitest';
import { simulateType, simulateKeyCombo } from './inputSimulator.js';

describe('inputSimulator — validation logic', () => {
  describe('simulateType', () => {
    it('rejects text exceeding 10000 characters', () => {
      const result = simulateType('x'.repeat(10001));
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/10000/);
    });
  });

  describe('simulateKeyCombo', () => {
    it('rejects empty keys array', () => {
      const result = simulateKeyCombo([]);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/empty/);
    });

    it('rejects keys array exceeding 10 keys', () => {
      const keys = Array.from({ length: 11 }, (_, i) => 'a');
      const result = simulateKeyCombo(keys);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/exceeds 10/);
    });

    it('rejects unknown key names', () => {
      const result = simulateKeyCombo(['ctrl', 'unknownkey']);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Unknown key.*unknownkey/i);
    });

    it('provides list of supported keys in error message', () => {
      const result = simulateKeyCombo(['badkey']);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/Supported:/);
      expect(result.error).toMatch(/ctrl/);
      expect(result.error).toMatch(/alt/);
    });
  });
});
