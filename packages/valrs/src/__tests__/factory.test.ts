import { describe, it, expect } from 'vitest';
import {
  createSchema,
  createSchemaWithJsonSchema,
  createSchemaWithSeparateJsonSchemas,
  success,
  failure,
  fail,
  VENDOR,
  VERSION,
} from '../factory';
import { isValidationSuccess, isValidationFailure } from '../types';

describe('factory constants', () => {
  it('exports correct vendor', () => {
    expect(VENDOR).toBe('valrs');
  });

  it('exports correct version', () => {
    expect(VERSION).toBe(1);
  });
});

describe('createSchema', () => {
  it('creates a valid StandardSchemaV1 object', () => {
    const schema = createSchema<string>((value) => {
      if (typeof value !== 'string') {
        return { issues: [{ message: 'Expected string' }] };
      }
      return { value };
    });

    expect(schema['~standard'].version).toBe(1);
    expect(schema['~standard'].vendor).toBe('valrs');
    expect(typeof schema['~standard'].validate).toBe('function');
  });

  it('validation works correctly', () => {
    const PositiveNumber = createSchema<number>((value) => {
      if (typeof value !== 'number') {
        return { issues: [{ message: 'Expected number' }] };
      }
      if (value <= 0) {
        return { issues: [{ message: 'Must be positive' }] };
      }
      return { value };
    });

    expect(PositiveNumber['~standard'].validate(5)).toEqual({ value: 5 });
    expect(PositiveNumber['~standard'].validate(-1)).toEqual({
      issues: [{ message: 'Must be positive' }],
    });
    expect(PositiveNumber['~standard'].validate('hello')).toEqual({
      issues: [{ message: 'Expected number' }],
    });
  });
});

describe('createSchemaWithJsonSchema', () => {
  it('creates a valid StandardJSONSchemaV1 object', () => {
    const schema = createSchemaWithJsonSchema<string>(
      (value) => {
        if (typeof value !== 'string') {
          return { issues: [{ message: 'Expected string' }] };
        }
        return { value };
      },
      () => ({ type: 'string' })
    );

    expect(schema['~standard'].version).toBe(1);
    expect(schema['~standard'].vendor).toBe('valrs');
    expect(typeof schema['~standard'].validate).toBe('function');
    expect(typeof schema['~standard'].jsonSchema.input).toBe('function');
    expect(typeof schema['~standard'].jsonSchema.output).toBe('function');
  });

  it('generates JSON schema correctly', () => {
    const schema = createSchemaWithJsonSchema<string>(
      (value) => ({ value: String(value) }),
      (target) => ({
        type: 'string',
        $schema: target === 'draft-2020-12' ? 'https://json-schema.org/draft/2020-12/schema' : undefined,
      })
    );

    const inputSchema = schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    expect(inputSchema).toEqual({
      type: 'string',
      $schema: 'https://json-schema.org/draft/2020-12/schema',
    });

    const outputSchema = schema['~standard'].jsonSchema.output({ target: 'draft-07' });
    expect(outputSchema).toEqual({
      type: 'string',
      $schema: undefined,
    });
  });
});

describe('createSchemaWithSeparateJsonSchemas', () => {
  it('supports different input and output schemas', () => {
    // Schema that coerces strings to numbers
    const schema = createSchemaWithSeparateJsonSchemas<string, number>(
      (value) => {
        const num = Number(value);
        if (Number.isNaN(num)) {
          return { issues: [{ message: 'Cannot convert to number' }] };
        }
        return { value: num };
      },
      () => ({ type: 'string' }),
      () => ({ type: 'number' })
    );

    const inputSchema = schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
    expect(inputSchema).toEqual({ type: 'string' });

    const outputSchema = schema['~standard'].jsonSchema.output({ target: 'draft-2020-12' });
    expect(outputSchema).toEqual({ type: 'number' });
  });
});

describe('result helpers', () => {
  describe('success', () => {
    it('creates a success result', () => {
      const result = success('hello');
      expect(result).toEqual({ value: 'hello' });
      expect(isValidationSuccess(result)).toBe(true);
    });

    it('preserves the value type', () => {
      const result = success({ name: 'test', count: 42 });
      expect(result.value).toEqual({ name: 'test', count: 42 });
    });
  });

  describe('failure', () => {
    it('creates a failure result', () => {
      const issues = [{ message: 'Error 1' }, { message: 'Error 2' }];
      const result = failure(issues);
      expect(result).toEqual({ issues });
      expect(isValidationFailure(result)).toBe(true);
    });
  });

  describe('fail', () => {
    it('creates a failure with single message', () => {
      const result = fail('Something went wrong');
      expect(result).toEqual({
        issues: [{ message: 'Something went wrong' }],
      });
    });

    it('creates a failure with message and path', () => {
      const result = fail('Invalid value', ['user', 'email']);
      expect(result).toEqual({
        issues: [{ message: 'Invalid value', path: ['user', 'email'] }],
      });
    });

    it('supports complex path segments', () => {
      const result = fail('Invalid', [{ key: 'special' }, 0, 'field']);
      expect(result).toEqual({
        issues: [{ message: 'Invalid', path: [{ key: 'special' }, 0, 'field'] }],
      });
    });
  });
});
