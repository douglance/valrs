import { describe, it, expect, beforeEach } from 'vitest';
import {
  compileSchema,
  compileSchemaToCode,
  CompiledRegistry,
  type JsonSchema,
} from '../compiler';

describe('compileSchema', () => {
  describe('type validation', () => {
    it('validates string type', () => {
      const validate = compileSchema({ type: 'string' });
      expect(validate('hello')).toBe(true);
      expect(validate('')).toBe(true);
      expect(validate(123)).toBe(false);
      expect(validate(null)).toBe(false);
      expect(validate(undefined)).toBe(false);
    });

    it('validates number type', () => {
      const validate = compileSchema({ type: 'number' });
      expect(validate(123)).toBe(true);
      expect(validate(0)).toBe(true);
      expect(validate(-45.6)).toBe(true);
      expect(validate('123')).toBe(false);
      expect(validate(NaN)).toBe(false);
    });

    it('validates integer type', () => {
      const validate = compileSchema({ type: 'integer' });
      expect(validate(123)).toBe(true);
      expect(validate(0)).toBe(true);
      expect(validate(-45)).toBe(true);
      expect(validate(45.6)).toBe(false);
      expect(validate('123')).toBe(false);
    });

    it('validates boolean type', () => {
      const validate = compileSchema({ type: 'boolean' });
      expect(validate(true)).toBe(true);
      expect(validate(false)).toBe(true);
      expect(validate(1)).toBe(false);
      expect(validate('true')).toBe(false);
    });

    it('validates null type', () => {
      const validate = compileSchema({ type: 'null' });
      expect(validate(null)).toBe(true);
      expect(validate(undefined)).toBe(false);
      expect(validate(0)).toBe(false);
    });

    it('validates object type', () => {
      const validate = compileSchema({ type: 'object' });
      expect(validate({})).toBe(true);
      expect(validate({ a: 1 })).toBe(true);
      expect(validate(null)).toBe(false);
      expect(validate([])).toBe(false);
      expect(validate('object')).toBe(false);
    });

    it('validates array type', () => {
      const validate = compileSchema({ type: 'array' });
      expect(validate([])).toBe(true);
      expect(validate([1, 2, 3])).toBe(true);
      expect(validate({})).toBe(false);
      expect(validate('array')).toBe(false);
    });
  });

  describe('string constraints', () => {
    it('validates minLength', () => {
      const validate = compileSchema({ type: 'string', minLength: 3 });
      expect(validate('abc')).toBe(true);
      expect(validate('abcd')).toBe(true);
      expect(validate('ab')).toBe(false);
      expect(validate('')).toBe(false);
    });

    it('validates maxLength', () => {
      const validate = compileSchema({ type: 'string', maxLength: 5 });
      expect(validate('abc')).toBe(true);
      expect(validate('abcde')).toBe(true);
      expect(validate('abcdef')).toBe(false);
    });

    it('validates minLength and maxLength together', () => {
      const validate = compileSchema({ type: 'string', minLength: 2, maxLength: 5 });
      expect(validate('ab')).toBe(true);
      expect(validate('abcde')).toBe(true);
      expect(validate('a')).toBe(false);
      expect(validate('abcdef')).toBe(false);
    });

    it('validates pattern', () => {
      const validate = compileSchema({ type: 'string', pattern: '^[a-z]+$' });
      expect(validate('abc')).toBe(true);
      expect(validate('ABC')).toBe(false);
      expect(validate('abc123')).toBe(false);
    });
  });

  describe('number constraints', () => {
    it('validates minimum', () => {
      const validate = compileSchema({ type: 'number', minimum: 0 });
      expect(validate(0)).toBe(true);
      expect(validate(100)).toBe(true);
      expect(validate(-1)).toBe(false);
    });

    it('validates maximum', () => {
      const validate = compileSchema({ type: 'number', maximum: 100 });
      expect(validate(100)).toBe(true);
      expect(validate(50)).toBe(true);
      expect(validate(101)).toBe(false);
    });

    it('validates exclusiveMinimum', () => {
      const validate = compileSchema({ type: 'number', exclusiveMinimum: 0 });
      expect(validate(1)).toBe(true);
      expect(validate(0)).toBe(false);
      expect(validate(-1)).toBe(false);
    });

    it('validates exclusiveMaximum', () => {
      const validate = compileSchema({ type: 'number', exclusiveMaximum: 100 });
      expect(validate(99)).toBe(true);
      expect(validate(100)).toBe(false);
      expect(validate(101)).toBe(false);
    });

    it('validates multipleOf', () => {
      const validate = compileSchema({ type: 'integer', multipleOf: 5 });
      expect(validate(0)).toBe(true);
      expect(validate(5)).toBe(true);
      expect(validate(15)).toBe(true);
      expect(validate(7)).toBe(false);
    });
  });

  describe('array constraints', () => {
    it('validates minItems', () => {
      const validate = compileSchema({ type: 'array', minItems: 2 });
      expect(validate([1, 2])).toBe(true);
      expect(validate([1, 2, 3])).toBe(true);
      expect(validate([1])).toBe(false);
      expect(validate([])).toBe(false);
    });

    it('validates maxItems', () => {
      const validate = compileSchema({ type: 'array', maxItems: 3 });
      expect(validate([])).toBe(true);
      expect(validate([1, 2, 3])).toBe(true);
      expect(validate([1, 2, 3, 4])).toBe(false);
    });

    it('validates items schema', () => {
      const validate = compileSchema({
        type: 'array',
        items: { type: 'string' },
      });
      expect(validate([])).toBe(true);
      expect(validate(['a', 'b', 'c'])).toBe(true);
      expect(validate(['a', 1, 'c'])).toBe(false);
      expect(validate([1, 2, 3])).toBe(false);
    });

    it('validates uniqueItems', () => {
      const validate = compileSchema({ type: 'array', uniqueItems: true });
      expect(validate([1, 2, 3])).toBe(true);
      expect(validate(['a', 'b', 'c'])).toBe(true);
      expect(validate([1, 2, 1])).toBe(false);
      expect(validate(['a', 'b', 'a'])).toBe(false);
    });
  });

  describe('object constraints', () => {
    it('validates required properties', () => {
      const validate = compileSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      });
      expect(validate({ name: 'John', age: 30 })).toBe(true);
      expect(validate({ name: 'John' })).toBe(false);
      expect(validate({ age: 30 })).toBe(false);
      expect(validate({})).toBe(false);
    });

    it('validates optional properties', () => {
      const validate = compileSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      });
      expect(validate({ name: 'John' })).toBe(true);
      expect(validate({ name: 'John', age: 30 })).toBe(true);
      expect(validate({ name: 'John', age: 'thirty' })).toBe(false);
    });

    it('validates nested objects', () => {
      const validate = compileSchema({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      });
      expect(validate({ user: { name: 'John' } })).toBe(true);
      expect(validate({ user: {} })).toBe(false);
      expect(validate({ user: { name: 123 } })).toBe(false);
      expect(validate({})).toBe(false);
    });

    it('validates additionalProperties: false', () => {
      const validate = compileSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      });
      expect(validate({ name: 'John' })).toBe(true);
      expect(validate({ name: 'John', extra: 'field' })).toBe(false);
    });

    it('validates additionalProperties with schema', () => {
      const validate = compileSchema({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: { type: 'number' },
      });
      expect(validate({ name: 'John' })).toBe(true);
      expect(validate({ name: 'John', age: 30 })).toBe(true);
      expect(validate({ name: 'John', extra: 'string' })).toBe(false);
    });
  });

  describe('enum and const', () => {
    it('validates enum', () => {
      const validate = compileSchema({ enum: ['red', 'green', 'blue'] });
      expect(validate('red')).toBe(true);
      expect(validate('green')).toBe(true);
      expect(validate('yellow')).toBe(false);
    });

    it('validates const', () => {
      const validate = compileSchema({ const: 'fixed' });
      expect(validate('fixed')).toBe(true);
      expect(validate('other')).toBe(false);
    });
  });

  describe('composition keywords', () => {
    it('validates allOf', () => {
      const validate = compileSchema({
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
        ],
      });
      expect(validate({ a: 'hello', b: 123 })).toBe(true);
      expect(validate({ a: 'hello' })).toBe(false);
      expect(validate({ b: 123 })).toBe(false);
    });

    it('validates anyOf', () => {
      const validate = compileSchema({
        anyOf: [{ type: 'string' }, { type: 'number' }],
      });
      expect(validate('hello')).toBe(true);
      expect(validate(123)).toBe(true);
      expect(validate(true)).toBe(false);
    });

    it('validates oneOf', () => {
      const validate = compileSchema({
        oneOf: [
          { type: 'number', minimum: 0 },
          { type: 'number', maximum: 10 },
        ],
      });
      // Only one should match: >10 matches first only, <0 matches second only
      expect(validate(15)).toBe(true); // matches only minimum: 0
      expect(validate(-5)).toBe(true); // matches only maximum: 10
      expect(validate(5)).toBe(false); // matches both
    });

    it('validates not', () => {
      const validate = compileSchema({
        not: { type: 'string' },
      });
      expect(validate(123)).toBe(true);
      expect(validate(true)).toBe(true);
      expect(validate('hello')).toBe(false);
    });
  });

  describe('empty schema', () => {
    it('accepts any value for empty schema', () => {
      const validate = compileSchema({});
      expect(validate('string')).toBe(true);
      expect(validate(123)).toBe(true);
      expect(validate(null)).toBe(true);
      expect(validate({})).toBe(true);
      expect(validate([])).toBe(true);
    });
  });
});

describe('compileSchemaToCode', () => {
  it('returns JavaScript code as string', () => {
    const code = compileSchemaToCode({ type: 'string' });
    expect(code).toContain('return');
    expect(code).toContain("typeof data === 'string'");
  });

  it('generates code for complex schemas', () => {
    const code = compileSchemaToCode({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
      },
      required: ['name'],
    });
    expect(code).toContain('typeof data === \'object\'');
    expect(code).toContain('data["name"]');
    expect(code).toContain('.length >= 1');
  });
});

describe('CompiledRegistry', () => {
  let registry: CompiledRegistry;

  beforeEach(() => {
    registry = new CompiledRegistry();
  });

  describe('register and validate', () => {
    it('registers and validates schemas', () => {
      registry.register('User', {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer', minimum: 0 },
        },
        required: ['name', 'age'],
      });

      expect(registry.validate('User', { name: 'John', age: 30 })).toBe(true);
      expect(registry.validate('User', { name: 'John', age: -1 })).toBe(false);
      expect(registry.validate('User', { name: 'John' })).toBe(false);
    });

    it('throws for unknown schema', () => {
      expect(() => registry.validate('Unknown', {})).toThrow("Schema 'Unknown' not found in registry");
    });
  });

  describe('getSchema', () => {
    it('returns registered schema', () => {
      const schema: JsonSchema = { type: 'string' };
      registry.register('String', schema);
      expect(registry.getSchema('String')).toEqual(schema);
    });

    it('returns undefined for unknown schema', () => {
      expect(registry.getSchema('Unknown')).toBeUndefined();
    });
  });

  describe('getValidator', () => {
    it('returns compiled validator function', () => {
      registry.register('String', { type: 'string' });
      const validator = registry.getValidator('String');
      expect(typeof validator).toBe('function');
      expect(validator?.('hello')).toBe(true);
      expect(validator?.(123)).toBe(false);
    });

    it('returns undefined for unknown schema', () => {
      expect(registry.getValidator('Unknown')).toBeUndefined();
    });
  });

  describe('getGeneratedCode', () => {
    it('returns generated JavaScript code', () => {
      registry.register('String', { type: 'string' });
      const code = registry.getGeneratedCode('String');
      expect(code).toContain("typeof data === 'string'");
    });

    it('returns undefined for unknown schema', () => {
      expect(registry.getGeneratedCode('Unknown')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('returns true for registered schemas', () => {
      registry.register('String', { type: 'string' });
      expect(registry.has('String')).toBe(true);
    });

    it('returns false for unknown schemas', () => {
      expect(registry.has('Unknown')).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes registered schema', () => {
      registry.register('String', { type: 'string' });
      expect(registry.delete('String')).toBe(true);
      expect(registry.has('String')).toBe(false);
    });

    it('returns false for unknown schema', () => {
      expect(registry.delete('Unknown')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all schemas', () => {
      registry.register('String', { type: 'string' });
      registry.register('Number', { type: 'number' });
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.has('String')).toBe(false);
      expect(registry.has('Number')).toBe(false);
    });
  });

  describe('names', () => {
    it('returns array of registered schema names', () => {
      registry.register('String', { type: 'string' });
      registry.register('Number', { type: 'number' });
      expect(registry.names).toContain('String');
      expect(registry.names).toContain('Number');
      expect(registry.names.length).toBe(2);
    });
  });

  describe('size', () => {
    it('returns number of registered schemas', () => {
      expect(registry.size).toBe(0);
      registry.register('String', { type: 'string' });
      expect(registry.size).toBe(1);
      registry.register('Number', { type: 'number' });
      expect(registry.size).toBe(2);
    });
  });
});

describe('real-world schema', () => {
  it('validates complex user schema like benchmark', () => {
    const userSchema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 100 },
        email: { type: 'string' },
        age: { type: 'integer', minimum: 0, maximum: 150 },
        isActive: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zip: { type: 'string' },
          },
          required: ['street', 'city', 'zip'],
        },
      },
      required: ['name', 'email', 'age', 'isActive', 'tags'],
    };

    const validate = compileSchema(userSchema);

    // Valid simple user
    expect(
      validate({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
        tags: ['developer'],
      })
    ).toBe(true);

    // Valid user with address
    expect(
      validate({
        name: 'Jane Smith',
        email: 'jane@example.com',
        age: 28,
        isActive: true,
        tags: ['designer'],
        address: {
          street: '123 Main St',
          city: 'NYC',
          zip: '10001',
        },
      })
    ).toBe(true);

    // Invalid - wrong type for name
    expect(
      validate({
        name: 12345,
        email: 'test@example.com',
        age: 25,
        isActive: true,
        tags: ['test'],
      })
    ).toBe(false);

    // Invalid - age out of range
    expect(
      validate({
        name: 'Test User',
        email: 'test@example.com',
        age: -5,
        isActive: true,
        tags: ['test'],
      })
    ).toBe(false);

    // Invalid - nested object error (zip is number instead of string)
    expect(
      validate({
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
        isActive: true,
        tags: ['test'],
        address: {
          street: '123 Main St',
          city: 'NYC',
          zip: 12345,
        },
      })
    ).toBe(false);
  });
});
