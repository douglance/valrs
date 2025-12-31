import { describe, it, expect, beforeEach } from 'vitest';
import { init, getWasm, isInitialized, resetWasmState } from '../wasm';

describe('WASM module management', () => {
  beforeEach(() => {
    resetWasmState();
  });

  describe('isInitialized', () => {
    it('returns false before initialization', () => {
      expect(isInitialized()).toBe(false);
    });
  });

  describe('getWasm', () => {
    it('throws when not initialized', () => {
      expect(() => getWasm()).toThrow(
        'WASM module not initialized. Call init() and await its completion before using schemas.'
      );
    });
  });

  describe('init', () => {
    it('handles missing WASM module gracefully', async () => {
      // In test environment, the WASM module is not available
      // This tests that init() throws an appropriate error
      await expect(init()).rejects.toThrow('Failed to initialize WASM module');
    });
  });

  describe('resetWasmState', () => {
    it('resets the initialized state', () => {
      // Since we cannot initialize without WASM, we just verify reset works
      resetWasmState();
      expect(isInitialized()).toBe(false);
    });
  });
});
