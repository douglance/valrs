import { describe, it, expect, beforeEach } from 'vitest';
import { resetWasmState } from '../wasm';
import {
  StringSchema,
  NumberSchema,
  BooleanSchema,
  Int32Schema,
  Uint32Schema,
} from '../primitives';
import { isValidationSuccess, isValidationFailure } from '../types';

/**
 * These tests run without WASM initialization, testing the fallback behavior.
 * When WASM is not available, primitives use pure JavaScript validation.
 */
describe('Primitive schemas (fallback mode)', () => {
  beforeEach(() => {
    // Reset WASM state to ensure we test fallback behavior
    resetWasmState();
  });

  describe('StringSchema', () => {
    it('validates strings', () => {
      const result = StringSchema['~standard'].validate('hello');
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.value).toBe('hello');
      }
    });

    it('validates empty strings', () => {
      const result = StringSchema['~standard'].validate('');
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.value).toBe('');
      }
    });

    it('rejects numbers', () => {
      const result = StringSchema['~standard'].validate(123);
      expect(isValidationFailure(result)).toBe(true);
      if (isValidationFailure(result)) {
        expect(result.issues[0]?.message).toBe('Expected string');
      }
    });

    it('rejects null', () => {
      const result = StringSchema['~standard'].validate(null);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects undefined', () => {
      const result = StringSchema['~standard'].validate(undefined);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects objects', () => {
      const result = StringSchema['~standard'].validate({});
      expect(isValidationFailure(result)).toBe(true);
    });

    it('generates JSON schema', () => {
      const schema = StringSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      expect(schema).toEqual({ type: 'string' });
    });

    it('has correct ~standard properties', () => {
      expect(StringSchema['~standard'].version).toBe(1);
      expect(StringSchema['~standard'].vendor).toBe('standard-schema-rs');
    });
  });

  describe('NumberSchema', () => {
    it('validates integers', () => {
      const result = NumberSchema['~standard'].validate(42);
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('validates floats', () => {
      const result = NumberSchema['~standard'].validate(3.14);
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.value).toBe(3.14);
      }
    });

    it('validates negative numbers', () => {
      const result = NumberSchema['~standard'].validate(-100);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('validates zero', () => {
      const result = NumberSchema['~standard'].validate(0);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('rejects NaN', () => {
      const result = NumberSchema['~standard'].validate(NaN);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects strings', () => {
      const result = NumberSchema['~standard'].validate('42');
      expect(isValidationFailure(result)).toBe(true);
    });

    it('generates JSON schema', () => {
      const schema = NumberSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      expect(schema).toEqual({ type: 'number' });
    });
  });

  describe('BooleanSchema', () => {
    it('validates true', () => {
      const result = BooleanSchema['~standard'].validate(true);
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.value).toBe(true);
      }
    });

    it('validates false', () => {
      const result = BooleanSchema['~standard'].validate(false);
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.value).toBe(false);
      }
    });

    it('rejects truthy values', () => {
      const result = BooleanSchema['~standard'].validate(1);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects falsy values', () => {
      const result = BooleanSchema['~standard'].validate(0);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects strings', () => {
      const result = BooleanSchema['~standard'].validate('true');
      expect(isValidationFailure(result)).toBe(true);
    });

    it('generates JSON schema', () => {
      const schema = BooleanSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      expect(schema).toEqual({ type: 'boolean' });
    });
  });

  describe('Int32Schema', () => {
    it('validates integers', () => {
      const result = Int32Schema['~standard'].validate(42);
      expect(isValidationSuccess(result)).toBe(true);
      if (isValidationSuccess(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('validates negative integers', () => {
      const result = Int32Schema['~standard'].validate(-100);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('validates max i32', () => {
      const result = Int32Schema['~standard'].validate(2147483647);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('validates min i32', () => {
      const result = Int32Schema['~standard'].validate(-2147483648);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('rejects floats', () => {
      const result = Int32Schema['~standard'].validate(3.14);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects values above max i32', () => {
      const result = Int32Schema['~standard'].validate(2147483648);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects values below min i32', () => {
      const result = Int32Schema['~standard'].validate(-2147483649);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('generates JSON schema with bounds', () => {
      const schema = Int32Schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      expect(schema).toEqual({
        type: 'integer',
        minimum: -2147483648,
        maximum: 2147483647,
      });
    });
  });

  describe('Uint32Schema', () => {
    it('validates positive integers', () => {
      const result = Uint32Schema['~standard'].validate(42);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('validates zero', () => {
      const result = Uint32Schema['~standard'].validate(0);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('validates max u32', () => {
      const result = Uint32Schema['~standard'].validate(4294967295);
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('rejects negative integers', () => {
      const result = Uint32Schema['~standard'].validate(-1);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('rejects values above max u32', () => {
      const result = Uint32Schema['~standard'].validate(4294967296);
      expect(isValidationFailure(result)).toBe(true);
    });

    it('generates JSON schema with bounds', () => {
      const schema = Uint32Schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      expect(schema).toEqual({
        type: 'integer',
        minimum: 0,
        maximum: 4294967295,
      });
    });
  });
});
