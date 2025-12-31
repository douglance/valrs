import { describe, it, expect } from 'vitest';
import {
  isValidationSuccess,
  isValidationFailure,
  type ValidationResult,
  type ValidationIssue,
  type StandardSchemaV1,
} from '../types';

describe('ValidationResult type guards', () => {
  describe('isValidationSuccess', () => {
    it('returns true for success results', () => {
      const result: ValidationResult<string> = { value: 'hello' };
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('returns false for failure results', () => {
      const result: ValidationResult<string> = {
        issues: [{ message: 'error' }],
      };
      expect(isValidationSuccess(result)).toBe(false);
    });

    it('narrows type correctly on success', () => {
      const result: ValidationResult<number> = { value: 42 };
      if (isValidationSuccess(result)) {
        // TypeScript should allow accessing value
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });
  });

  describe('isValidationFailure', () => {
    it('returns true for failure results', () => {
      const result: ValidationResult<string> = {
        issues: [{ message: 'error' }],
      };
      expect(isValidationFailure(result)).toBe(true);
    });

    it('returns false for success results', () => {
      const result: ValidationResult<string> = { value: 'hello' };
      expect(isValidationFailure(result)).toBe(false);
    });

    it('narrows type correctly on failure', () => {
      const issues: ValidationIssue[] = [{ message: 'test error' }];
      const result: ValidationResult<number> = { issues };
      if (isValidationFailure(result)) {
        // TypeScript should allow accessing issues
        expect(result.issues).toEqual(issues);
      }
    });
  });
});

describe('ValidationIssue', () => {
  it('supports message only', () => {
    const issue: ValidationIssue = { message: 'Invalid value' };
    expect(issue.message).toBe('Invalid value');
    expect(issue.path).toBeUndefined();
  });

  it('supports string path segments', () => {
    const issue: ValidationIssue = {
      message: 'Invalid',
      path: ['user', 'name'],
    };
    expect(issue.path).toEqual(['user', 'name']);
  });

  it('supports numeric path segments', () => {
    const issue: ValidationIssue = {
      message: 'Invalid',
      path: ['items', 0, 'value'],
    };
    expect(issue.path).toEqual(['items', 0, 'value']);
  });

  it('supports object path segments', () => {
    const issue: ValidationIssue = {
      message: 'Invalid',
      path: [{ key: 'special-key' }, { key: 0 }],
    };
    expect(issue.path).toEqual([{ key: 'special-key' }, { key: 0 }]);
  });
});

describe('StandardSchemaV1 structure', () => {
  it('validates correct schema structure', () => {
    const schema: StandardSchemaV1<string, string> = {
      '~standard': {
        version: 1,
        vendor: 'test-vendor',
        validate: (value: unknown) => {
          if (typeof value !== 'string') {
            return { issues: [{ message: 'Expected string' }] };
          }
          return { value };
        },
      },
    };

    expect(schema['~standard'].version).toBe(1);
    expect(schema['~standard'].vendor).toBe('test-vendor');
    expect(typeof schema['~standard'].validate).toBe('function');
  });

  it('validate function returns correct success result', () => {
    const schema: StandardSchemaV1<string, string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => {
          if (typeof value !== 'string') {
            return { issues: [{ message: 'Expected string' }] };
          }
          return { value };
        },
      },
    };

    const result = schema['~standard'].validate('hello');
    expect(result).toEqual({ value: 'hello' });
  });

  it('validate function returns correct failure result', () => {
    const schema: StandardSchemaV1<string, string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => {
          if (typeof value !== 'string') {
            return { issues: [{ message: 'Expected string' }] };
          }
          return { value };
        },
      },
    };

    const result = schema['~standard'].validate(123);
    expect(result).toEqual({ issues: [{ message: 'Expected string' }] });
  });
});
