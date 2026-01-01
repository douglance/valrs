/**
 * Tests for the Zod-compatible v API.
 */

import { describe, it, expect } from 'vitest';
import {
  v,
  ValError,
  ValSchema,
  ValString,
  ValNumber,
  ValBoolean,
  ValObject,
  ValLiteral,
  ValArray,
  ValTuple,
  ValUnion,
  ValIntersection,
  ValRecord,
  ValMap,
  ValSet,
  ValLiteralValue,
  ValEnum,
  ValNativeEnum,
  ValTransformed,
  ValRefined,
  ValSuperRefined,
  ValPiped,
  ValPreprocessed,
  string,
  number,
  boolean,
  bigint,
  date,
  any,
  unknown,
  never,
  object,
  array,
  tuple,
  union,
  discriminatedUnion,
  intersection,
  record,
  map,
  set,
  literal,
  nativeEnum,
  preprocess,
  coerce,
  isSafeParseSuccess,
  isSafeParseError,
  type Infer,
} from '../index';

describe('v namespace', () => {
  describe('v.string()', () => {
    it('parses valid strings', () => {
      const schema = v.string();
      expect(schema.parse('hello')).toBe('hello');
      expect(schema.parse('')).toBe('');
    });

    it('throws ValError for invalid input', () => {
      const schema = v.string();
      expect(() => schema.parse(123)).toThrow(ValError);
      expect(() => schema.parse(null)).toThrow(ValError);
      expect(() => schema.parse(undefined)).toThrow(ValError);
    });

    it('safeParse returns success for valid input', () => {
      const schema = v.string();
      const result = schema.safeParse('hello');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('hello');
      }
    });

    it('safeParse returns error for invalid input', () => {
      const schema = v.string();
      const result = schema.safeParse(123);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValError);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('returns ValString instance', () => {
      expect(v.string()).toBeInstanceOf(ValString);
    });
  });

  describe('v.number()', () => {
    it('parses valid numbers', () => {
      const schema = v.number();
      expect(schema.parse(42)).toBe(42);
      expect(schema.parse(3.14)).toBe(3.14);
      expect(schema.parse(-100)).toBe(-100);
      expect(schema.parse(0)).toBe(0);
    });

    it('throws ValError for invalid input', () => {
      const schema = v.number();
      expect(() => schema.parse('42')).toThrow(ValError);
      expect(() => schema.parse(null)).toThrow(ValError);
      expect(() => schema.parse(NaN)).toThrow(ValError);
    });

    it('returns ValNumber instance', () => {
      expect(v.number()).toBeInstanceOf(ValNumber);
    });
  });

  describe('v.boolean()', () => {
    it('parses valid booleans', () => {
      const schema = v.boolean();
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(false)).toBe(false);
    });

    it('throws ValError for invalid input', () => {
      const schema = v.boolean();
      expect(() => schema.parse('true')).toThrow(ValError);
      expect(() => schema.parse(1)).toThrow(ValError);
      expect(() => schema.parse(0)).toThrow(ValError);
    });

    it('returns ValBoolean instance', () => {
      expect(v.boolean()).toBeInstanceOf(ValBoolean);
    });
  });

  describe('v.bigint()', () => {
    it('parses valid bigints', () => {
      const schema = v.bigint();
      expect(schema.parse(123n)).toBe(123n);
      expect(schema.parse(0n)).toBe(0n);
      expect(schema.parse(-456n)).toBe(-456n);
    });

    it('throws ValError for invalid input', () => {
      const schema = v.bigint();
      expect(() => schema.parse(123)).toThrow(ValError);
      expect(() => schema.parse('123')).toThrow(ValError);
    });
  });

  describe('v.date()', () => {
    it('parses valid dates', () => {
      const schema = v.date();
      const date = new Date('2024-01-01');
      expect(schema.parse(date)).toBe(date);
    });

    it('throws ValError for invalid dates', () => {
      const schema = v.date();
      expect(() => schema.parse(new Date('invalid'))).toThrow(ValError);
      expect(() => schema.parse('2024-01-01')).toThrow(ValError);
      expect(() => schema.parse(1704067200000)).toThrow(ValError);
    });
  });

  describe('v.undefined()', () => {
    it('parses undefined', () => {
      const schema = v.undefined();
      expect(schema.parse(undefined)).toBe(undefined);
    });

    it('throws ValError for defined values', () => {
      const schema = v.undefined();
      expect(() => schema.parse(null)).toThrow(ValError);
      expect(() => schema.parse('')).toThrow(ValError);
      expect(() => schema.parse(0)).toThrow(ValError);
    });

    it('isOptional returns true', () => {
      expect(v.undefined().isOptional()).toBe(true);
    });
  });

  describe('v.null()', () => {
    it('parses null', () => {
      const schema = v.null();
      expect(schema.parse(null)).toBe(null);
    });

    it('throws ValError for non-null values', () => {
      const schema = v.null();
      expect(() => schema.parse(undefined)).toThrow(ValError);
      expect(() => schema.parse('')).toThrow(ValError);
    });

    it('isNullable returns true', () => {
      expect(v.null().isNullable()).toBe(true);
    });
  });

  describe('v.void()', () => {
    it('parses undefined (void)', () => {
      const schema = v.void();
      expect(schema.parse(undefined)).toBe(undefined);
    });

    it('throws ValError for non-void values', () => {
      const schema = v.void();
      expect(() => schema.parse(null)).toThrow(ValError);
    });
  });

  describe('v.any()', () => {
    it('parses any value', () => {
      const schema = v.any();
      expect(schema.parse('string')).toBe('string');
      expect(schema.parse(123)).toBe(123);
      expect(schema.parse(null)).toBe(null);
      expect(schema.parse(undefined)).toBe(undefined);
      expect(schema.parse({ key: 'value' })).toEqual({ key: 'value' });
    });
  });

  describe('v.unknown()', () => {
    it('parses any value as unknown', () => {
      const schema = v.unknown();
      expect(schema.parse('string')).toBe('string');
      expect(schema.parse(123)).toBe(123);
      expect(schema.parse(null)).toBe(null);
    });
  });

  describe('v.never()', () => {
    it('always throws ValError', () => {
      const schema = v.never();
      expect(() => schema.parse('anything')).toThrow(ValError);
      expect(() => schema.parse(null)).toThrow(ValError);
      expect(() => schema.parse(undefined)).toThrow(ValError);
    });
  });
});

describe('type inference', () => {
  it('infers correct types', () => {
    const stringSchema = v.string();
    const numberSchema = v.number();

    // These are compile-time checks
    type StringType = Infer<typeof stringSchema>;
    type NumberType = Infer<typeof numberSchema>;

    // Runtime verification that types work as expected
    const strResult: StringType = stringSchema.parse('hello');
    const numResult: NumberType = numberSchema.parse(42);

    expect(strResult).toBe('hello');
    expect(numResult).toBe(42);
  });
});

describe('ValError', () => {
  it('has correct structure', () => {
    const schema = v.string();
    try {
      schema.parse(123);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValError);
      if (error instanceof ValError) {
        expect(error.name).toBe('ValError');
        expect(error.issues).toBeInstanceOf(Array);
        expect(error.issues.length).toBeGreaterThan(0);
        expect(error.issues[0]).toHaveProperty('code');
        expect(error.issues[0]).toHaveProperty('path');
        expect(error.issues[0]).toHaveProperty('message');
      }
    }
  });

  it('flatten() returns structured errors', () => {
    const schema = v.string();
    const result = schema.safeParse(123);
    if (!result.success) {
      const flattened = result.error.flatten();
      expect(flattened).toHaveProperty('formErrors');
      expect(flattened).toHaveProperty('fieldErrors');
      expect(Array.isArray(flattened.formErrors)).toBe(true);
    }
  });
});

describe('Standard Schema compliance', () => {
  it('ValSchema has ~standard property', () => {
    const schema = v.string();
    expect(schema).toHaveProperty('~standard');
    expect(schema['~standard']).toHaveProperty('version', 1);
    expect(schema['~standard']).toHaveProperty('vendor', 'valrs');
    expect(schema['~standard']).toHaveProperty('validate');
    expect(schema['~standard']).toHaveProperty('jsonSchema');
  });

  it('~standard.validate returns correct format', () => {
    const schema = v.string();
    const success = schema['~standard'].validate('hello');
    expect(success).toHaveProperty('value', 'hello');

    const failure = schema['~standard'].validate(123);
    expect(failure).toHaveProperty('issues');
  });

  it('generates JSON Schema', () => {
    const schema = v.string();
    const jsonSchema = schema.toJsonSchema();
    expect(jsonSchema).toHaveProperty('type', 'string');
  });
});

describe('type guards', () => {
  it('isSafeParseSuccess correctly identifies success', () => {
    const schema = v.string();
    const successResult = schema.safeParse('hello');
    const errorResult = schema.safeParse(123);

    expect(isSafeParseSuccess(successResult)).toBe(true);
    expect(isSafeParseSuccess(errorResult)).toBe(false);
  });

  it('isSafeParseError correctly identifies errors', () => {
    const schema = v.string();
    const successResult = schema.safeParse('hello');
    const errorResult = schema.safeParse(123);

    expect(isSafeParseError(successResult)).toBe(false);
    expect(isSafeParseError(errorResult)).toBe(true);
  });
});

describe('integer schemas', () => {
  it('v.int32() validates 32-bit integers', () => {
    const schema = v.int32();
    expect(schema.parse(42)).toBe(42);
    expect(schema.parse(-2147483648)).toBe(-2147483648);
    expect(schema.parse(2147483647)).toBe(2147483647);
  });

  it('v.uint32() validates 32-bit unsigned integers', () => {
    const schema = v.uint32();
    expect(schema.parse(0)).toBe(0);
    expect(schema.parse(4294967295)).toBe(4294967295);
  });

  it('v.int64() validates 64-bit integers', () => {
    const schema = v.int64();
    expect(schema.parse(42)).toBe(42);
  });

  it('v.uint64() validates 64-bit unsigned integers', () => {
    const schema = v.uint64();
    expect(schema.parse(0)).toBe(0);
  });

  it('v.float32() validates 32-bit floats', () => {
    const schema = v.float32();
    expect(schema.parse(3.14)).toBe(3.14);
  });

  it('v.float64() validates 64-bit floats', () => {
    const schema = v.float64();
    expect(schema.parse(3.14159265359)).toBe(3.14159265359);
  });
});

describe('v.wrap()', () => {
  it('wraps existing Standard Schema', async () => {
    // Import the original StringSchema using dynamic import for ESM compatibility
    const { StringSchema } = await import('../primitives');

    const wrapped = v.wrap(StringSchema);
    expect(wrapped).toBeInstanceOf(ValSchema);
    expect(wrapped.parse('hello')).toBe('hello');
    expect(() => wrapped.parse(123)).toThrow(ValError);
  });
});

describe('direct function exports', () => {
  it('exports builder functions directly', () => {
    expect(string()).toBeInstanceOf(ValString);
    expect(number()).toBeInstanceOf(ValNumber);
    expect(boolean()).toBeInstanceOf(ValBoolean);
  });
});

// ============================================================================
// Phase 2: String Validation Methods
// ============================================================================

describe('ValString validation methods', () => {
  describe('length validation', () => {
    describe('.min()', () => {
      it('validates minimum length', () => {
        const schema = v.string().min(3);
        expect(schema.parse('abc')).toBe('abc');
        expect(schema.parse('abcd')).toBe('abcd');
        expect(() => schema.parse('ab')).toThrow(ValError);
        expect(() => schema.parse('')).toThrow(ValError);
      });

      it('supports custom error message', () => {
        const schema = v.string().min(3, 'Too short!');
        const result = schema.safeParse('ab');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Too short!');
        }
      });
    });

    describe('.max()', () => {
      it('validates maximum length', () => {
        const schema = v.string().max(5);
        expect(schema.parse('abc')).toBe('abc');
        expect(schema.parse('abcde')).toBe('abcde');
        expect(() => schema.parse('abcdef')).toThrow(ValError);
      });

      it('supports custom error message', () => {
        const schema = v.string().max(5, 'Too long!');
        const result = schema.safeParse('abcdef');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Too long!');
        }
      });
    });

    describe('.length()', () => {
      it('validates exact length', () => {
        const schema = v.string().length(5);
        expect(schema.parse('abcde')).toBe('abcde');
        expect(() => schema.parse('abcd')).toThrow(ValError);
        expect(() => schema.parse('abcdef')).toThrow(ValError);
      });
    });
  });

  describe('format validation', () => {
    describe('.email()', () => {
      it('validates email format', () => {
        const schema = v.string().email();
        expect(schema.parse('test@example.com')).toBe('test@example.com');
        expect(schema.parse('user.name+tag@domain.co.uk')).toBe('user.name+tag@domain.co.uk');
        expect(() => schema.parse('invalid')).toThrow(ValError);
        expect(() => schema.parse('missing@tld')).toThrow(ValError);
        expect(() => schema.parse('@nodomain.com')).toThrow(ValError);
      });
    });

    describe('.url()', () => {
      it('validates URL format', () => {
        const schema = v.string().url();
        expect(schema.parse('https://example.com')).toBe('https://example.com');
        expect(schema.parse('http://localhost:3000/path')).toBe('http://localhost:3000/path');
        expect(schema.parse('ftp://files.example.com')).toBe('ftp://files.example.com');
        expect(() => schema.parse('not-a-url')).toThrow(ValError);
        expect(() => schema.parse('example.com')).toThrow(ValError);
      });
    });

    describe('.uuid()', () => {
      it('validates UUID format', () => {
        const schema = v.string().uuid();
        expect(schema.parse('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(schema.parse('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(() => schema.parse('not-a-uuid')).toThrow(ValError);
        expect(() => schema.parse('123e4567-e89b-12d3-a456-42661417400')).toThrow(ValError);
      });
    });

    describe('.cuid()', () => {
      it('validates CUID format', () => {
        const schema = v.string().cuid();
        expect(schema.parse('cjld2cjxh0000qzrmn831i7rn')).toBe('cjld2cjxh0000qzrmn831i7rn');
        expect(() => schema.parse('not-a-cuid')).toThrow(ValError);
        expect(() => schema.parse('ajld2cjxh0000qzrmn831i7rn')).toThrow(ValError);
      });
    });

    describe('.cuid2()', () => {
      it('validates CUID2 format', () => {
        const schema = v.string().cuid2();
        expect(schema.parse('tz4a98xxat96iws9zmbrgj3a')).toBe('tz4a98xxat96iws9zmbrgj3a');
        expect(() => schema.parse('not-a-cuid2')).toThrow(ValError);
        expect(() => schema.parse('1z4a98xxat96iws9zmbrgj3a')).toThrow(ValError);
      });
    });

    describe('.ulid()', () => {
      it('validates ULID format', () => {
        const schema = v.string().ulid();
        expect(schema.parse('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV');
        expect(() => schema.parse('not-a-ulid')).toThrow(ValError);
        expect(() => schema.parse('01ARZ3NDEKTSV4RRFFQ69G5FA')).toThrow(ValError);
      });
    });

    describe('.datetime()', () => {
      it('validates ISO 8601 datetime format', () => {
        const schema = v.string().datetime();
        expect(schema.parse('2024-01-15')).toBe('2024-01-15');
        expect(schema.parse('2024-01-15T10:30:00')).toBe('2024-01-15T10:30:00');
        expect(schema.parse('2024-01-15T10:30:00Z')).toBe('2024-01-15T10:30:00Z');
        expect(schema.parse('2024-01-15T10:30:00.123Z')).toBe('2024-01-15T10:30:00.123Z');
        expect(schema.parse('2024-01-15T10:30:00+05:30')).toBe('2024-01-15T10:30:00+05:30');
        expect(() => schema.parse('not-a-datetime')).toThrow(ValError);
        expect(() => schema.parse('15-01-2024')).toThrow(ValError);
      });
    });

    describe('.ip()', () => {
      it('validates IPv4 addresses', () => {
        const schema = v.string().ip();
        expect(schema.parse('192.168.1.1')).toBe('192.168.1.1');
        expect(schema.parse('0.0.0.0')).toBe('0.0.0.0');
        expect(schema.parse('255.255.255.255')).toBe('255.255.255.255');
        expect(() => schema.parse('256.0.0.0')).toThrow(ValError);
        expect(() => schema.parse('192.168.1')).toThrow(ValError);
      });

      it('validates IPv6 addresses', () => {
        const schema = v.string().ip();
        expect(schema.parse('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        expect(schema.parse('::1')).toBe('::1');
      });
    });

    describe('.regex()', () => {
      it('validates against regex pattern', () => {
        const schema = v.string().regex(/^[a-z]+$/);
        expect(schema.parse('hello')).toBe('hello');
        expect(() => schema.parse('Hello')).toThrow(ValError);
        expect(() => schema.parse('hello123')).toThrow(ValError);
      });

      it('supports custom error message', () => {
        const schema = v.string().regex(/^[a-z]+$/, 'Must be lowercase letters only');
        const result = schema.safeParse('Hello');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Must be lowercase letters only');
        }
      });
    });
  });

  describe('content validation', () => {
    describe('.includes()', () => {
      it('validates string includes substring', () => {
        const schema = v.string().includes('needle');
        expect(schema.parse('finding the needle in haystack')).toBe('finding the needle in haystack');
        expect(() => schema.parse('no match here')).toThrow(ValError);
      });
    });

    describe('.startsWith()', () => {
      it('validates string starts with prefix', () => {
        const schema = v.string().startsWith('hello');
        expect(schema.parse('hello world')).toBe('hello world');
        expect(() => schema.parse('world hello')).toThrow(ValError);
      });
    });

    describe('.endsWith()', () => {
      it('validates string ends with suffix', () => {
        const schema = v.string().endsWith('.txt');
        expect(schema.parse('document.txt')).toBe('document.txt');
        expect(() => schema.parse('document.pdf')).toThrow(ValError);
      });
    });
  });

  describe('transforms', () => {
    describe('.trim()', () => {
      it('trims whitespace from both ends', () => {
        const schema = v.string().trim();
        expect(schema.parse('  hello  ')).toBe('hello');
        expect(schema.parse('\n\thello\t\n')).toBe('hello');
        expect(schema.parse('hello')).toBe('hello');
      });

      it('applies trim before validation', () => {
        const schema = v.string().trim().min(5);
        expect(schema.parse('  hello  ')).toBe('hello');
        expect(() => schema.parse('  hi  ')).toThrow(ValError);
      });
    });

    describe('.toLowerCase()', () => {
      it('converts to lowercase', () => {
        const schema = v.string().toLowerCase();
        expect(schema.parse('HELLO')).toBe('hello');
        expect(schema.parse('Hello World')).toBe('hello world');
      });
    });

    describe('.toUpperCase()', () => {
      it('converts to uppercase', () => {
        const schema = v.string().toUpperCase();
        expect(schema.parse('hello')).toBe('HELLO');
        expect(schema.parse('Hello World')).toBe('HELLO WORLD');
      });
    });

    it('chains transforms correctly', () => {
      const schema = v.string().trim().toLowerCase();
      expect(schema.parse('  HELLO WORLD  ')).toBe('hello world');
    });
  });

  describe('chaining', () => {
    it('chains multiple validators', () => {
      const schema = v.string().min(5).max(15).email();
      expect(schema.parse('a@b.co')).toBe('a@b.co');
      expect(() => schema.parse('a@b')).toThrow(ValError); // too short (3 chars, min is 5)
      expect(() => schema.parse('verylongemail@example.com')).toThrow(ValError); // too long
      expect(() => schema.parse('notanemail')).toThrow(ValError); // not email
    });

    it('immutability - each method returns new instance', () => {
      const base = v.string();
      const withMin = base.min(5);
      const withMax = base.max(10);

      expect(base.parse('hi')).toBe('hi');
      expect(() => withMin.parse('hi')).toThrow(ValError);
      expect(withMax.parse('hi')).toBe('hi');
    });
  });
});

// ============================================================================
// Phase 2: Number Validation Methods
// ============================================================================

// ============================================================================
// Phase 3: Optional/Nullable/Default/Catch Methods
// ============================================================================

describe('Optional/Nullable wrapper methods', () => {
  describe('.optional()', () => {
    it('accepts undefined values', () => {
      const schema = v.string().optional();
      expect(schema.parse(undefined)).toBe(undefined);
      expect(schema.parse('hello')).toBe('hello');
    });

    it('rejects null values', () => {
      const schema = v.string().optional();
      expect(() => schema.parse(null)).toThrow(ValError);
    });

    it('isOptional returns true', () => {
      expect(v.string().optional().isOptional()).toBe(true);
    });

    it('works with number schema', () => {
      const schema = v.number().optional();
      expect(schema.parse(undefined)).toBe(undefined);
      expect(schema.parse(42)).toBe(42);
    });
  });

  describe('.nullable()', () => {
    it('accepts null values', () => {
      const schema = v.string().nullable();
      expect(schema.parse(null)).toBe(null);
      expect(schema.parse('hello')).toBe('hello');
    });

    it('rejects undefined values', () => {
      const schema = v.string().nullable();
      expect(() => schema.parse(undefined)).toThrow(ValError);
    });

    it('isNullable returns true', () => {
      expect(v.string().nullable().isNullable()).toBe(true);
    });
  });

  describe('.nullish()', () => {
    it('accepts both null and undefined', () => {
      const schema = v.string().nullish();
      expect(schema.parse(null)).toBe(null);
      expect(schema.parse(undefined)).toBe(undefined);
      expect(schema.parse('hello')).toBe('hello');
    });

    it('isOptional and isNullable return true', () => {
      const schema = v.string().nullish();
      expect(schema.isOptional()).toBe(true);
      expect(schema.isNullable()).toBe(true);
    });
  });

  describe('.default()', () => {
    it('provides default value when undefined', () => {
      const schema = v.string().default('fallback');
      expect(schema.parse(undefined)).toBe('fallback');
      expect(schema.parse('hello')).toBe('hello');
    });

    it('supports function default', () => {
      let counter = 0;
      const schema = v.string().default(() => `count-${++counter}`);
      expect(schema.parse(undefined)).toBe('count-1');
      expect(schema.parse(undefined)).toBe('count-2');
      expect(schema.parse('hello')).toBe('hello');
    });

    it('still validates non-undefined values', () => {
      const schema = v.number().default(0);
      expect(() => schema.parse('not a number')).toThrow(ValError);
    });
  });

  describe('.catch()', () => {
    it('provides fallback value on parse error', () => {
      const schema = v.number().catch(0);
      expect(schema.parse('not a number')).toBe(0);
      expect(schema.parse(42)).toBe(42);
    });

    it('supports function fallback', () => {
      const schema = v.number().catch(() => -1);
      expect(schema.parse('invalid')).toBe(-1);
    });

    it('catches undefined if inner schema does not accept it', () => {
      const schema = v.string().catch('default');
      expect(schema.parse(undefined)).toBe('default');
    });
  });
});

// ============================================================================
// Phase 3: Object Schema
// ============================================================================

describe('v.object()', () => {
  describe('basic parsing', () => {
    it('parses valid objects', () => {
      const schema = v.object({
        name: v.string(),
        age: v.number(),
      });
      const result = schema.parse({ name: 'Alice', age: 30 });
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('throws ValError for non-objects', () => {
      const schema = v.object({ name: v.string() });
      expect(() => schema.parse('not an object')).toThrow(ValError);
      expect(() => schema.parse(null)).toThrow(ValError);
      expect(() => schema.parse(undefined)).toThrow(ValError);
      expect(() => schema.parse([])).toThrow(ValError);
    });

    it('throws ValError for missing required properties', () => {
      const schema = v.object({
        name: v.string(),
        age: v.number(),
      });
      expect(() => schema.parse({ name: 'Alice' })).toThrow(ValError);
    });

    it('validates each property with its schema', () => {
      const schema = v.object({
        name: v.string().min(3),
        age: v.number().int().positive(),
      });
      expect(() => schema.parse({ name: 'Al', age: 30 })).toThrow(ValError);
      expect(() => schema.parse({ name: 'Alice', age: -5 })).toThrow(ValError);
    });

    it('collects all errors in a single parse', () => {
      const schema = v.object({
        name: v.string(),
        age: v.number(),
      });
      const result = schema.safeParse({ name: 123, age: 'thirty' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('strips unknown keys by default', () => {
      const schema = v.object({ name: v.string() });
      const result = schema.parse({ name: 'Alice', extra: 'ignored' });
      expect(result).toEqual({ name: 'Alice' });
      expect('extra' in result).toBe(false);
    });
  });

  describe('.shape property', () => {
    it('exposes the shape definition', () => {
      const nameSchema = v.string();
      const ageSchema = v.number();
      const schema = v.object({ name: nameSchema, age: ageSchema });

      expect(schema.shape.name).toBe(nameSchema);
      expect(schema.shape.age).toBe(ageSchema);
    });
  });

  describe('optional properties', () => {
    it('handles optional properties', () => {
      const schema = v.object({
        name: v.string(),
        email: v.string().email().optional(),
      });

      const withEmail = schema.parse({ name: 'Alice', email: 'alice@example.com' });
      expect(withEmail).toEqual({ name: 'Alice', email: 'alice@example.com' });

      const withoutEmail = schema.parse({ name: 'Bob' });
      expect(withoutEmail).toEqual({ name: 'Bob' });
      expect('email' in withoutEmail).toBe(false);
    });

    it('allows explicit undefined for optional properties', () => {
      const schema = v.object({
        name: v.string(),
        email: v.string().optional(),
      });
      const result = schema.parse({ name: 'Alice', email: undefined });
      expect(result.email).toBe(undefined);
    });
  });

  describe('.extend()', () => {
    it('adds new properties to the schema', () => {
      const User = v.object({ name: v.string() });
      const Admin = User.extend({ role: v.string() });

      const result = Admin.parse({ name: 'Alice', role: 'admin' });
      expect(result).toEqual({ name: 'Alice', role: 'admin' });
    });

    it('overrides existing properties with same name', () => {
      const Base = v.object({ value: v.number() });
      const Extended = Base.extend({ value: v.string() });

      expect(Extended.parse({ value: 'hello' })).toEqual({ value: 'hello' });
      expect(() => Extended.parse({ value: 123 })).toThrow(ValError);
    });
  });

  describe('.merge()', () => {
    it('merges two object schemas', () => {
      const A = v.object({ a: v.string() });
      const B = v.object({ b: v.number() });
      const Merged = A.merge(B);

      expect(Merged.parse({ a: 'hello', b: 42 })).toEqual({ a: 'hello', b: 42 });
    });

    it('later schema properties override earlier ones', () => {
      const A = v.object({ shared: v.number() });
      const B = v.object({ shared: v.string() });
      const Merged = A.merge(B);

      expect(Merged.parse({ shared: 'hello' })).toEqual({ shared: 'hello' });
    });
  });

  describe('.pick()', () => {
    it('creates schema with only picked keys', () => {
      const User = v.object({
        name: v.string(),
        age: v.number(),
        email: v.string(),
      });
      const NameOnly = User.pick({ name: true });

      expect(NameOnly.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
      expect(() => NameOnly.parse({ name: 'Alice', age: 30 })).not.toThrow();
    });

    it('rejects if picked property is missing', () => {
      const User = v.object({ name: v.string(), age: v.number() });
      const NameOnly = User.pick({ name: true });

      expect(() => NameOnly.parse({})).toThrow(ValError);
    });
  });

  describe('.omit()', () => {
    it('creates schema without omitted keys', () => {
      const User = v.object({
        name: v.string(),
        age: v.number(),
        password: v.string(),
      });
      const SafeUser = User.omit({ password: true });

      expect(SafeUser.parse({ name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 });
    });

    it('still requires non-omitted properties', () => {
      const User = v.object({ name: v.string(), age: v.number() });
      const NameOnly = User.omit({ age: true });

      expect(() => NameOnly.parse({})).toThrow(ValError);
    });
  });

  describe('.partial()', () => {
    it('makes all properties optional', () => {
      const User = v.object({
        name: v.string(),
        age: v.number(),
      });
      const PartialUser = User.partial();

      expect(PartialUser.parse({})).toEqual({});
      expect(PartialUser.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
      expect(PartialUser.parse({ age: 30 })).toEqual({ age: 30 });
    });

    it('still validates provided properties', () => {
      const User = v.object({ name: v.string() });
      const PartialUser = User.partial();

      expect(() => PartialUser.parse({ name: 123 })).toThrow(ValError);
    });
  });

  describe('.deepPartial()', () => {
    it('makes nested object properties optional', () => {
      const User = v.object({
        name: v.string(),
        address: v.object({
          city: v.string(),
          zip: v.string(),
        }),
      });
      const DeepPartialUser = User.deepPartial();

      expect(DeepPartialUser.parse({})).toEqual({});
      expect(DeepPartialUser.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
      expect(DeepPartialUser.parse({ address: {} })).toEqual({ address: {} });
      expect(DeepPartialUser.parse({ address: { city: 'NYC' } })).toEqual({ address: { city: 'NYC' } });
    });
  });

  describe('.required()', () => {
    it('makes all properties required', () => {
      const PartialUser = v.object({
        name: v.string().optional(),
        age: v.number().optional(),
      });
      const User = PartialUser.required();

      expect(() => User.parse({})).toThrow(ValError);
      expect(() => User.parse({ name: 'Alice' })).toThrow(ValError);
      expect(User.parse({ name: 'Alice', age: 30 })).toEqual({ name: 'Alice', age: 30 });
    });

    it('rejects undefined values', () => {
      const Schema = v.object({ value: v.string().optional() }).required();
      expect(() => Schema.parse({ value: undefined })).toThrow(ValError);
    });
  });

  describe('.passthrough()', () => {
    it('preserves unknown keys', () => {
      const schema = v.object({ name: v.string() }).passthrough();
      const result = schema.parse({ name: 'Alice', extra: 'value', count: 42 });

      expect(result).toEqual({ name: 'Alice', extra: 'value', count: 42 });
    });
  });

  describe('.strict()', () => {
    it('rejects unknown keys', () => {
      const schema = v.object({ name: v.string() }).strict();

      expect(schema.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });
      expect(() => schema.parse({ name: 'Alice', extra: 'value' })).toThrow(ValError);
    });

    it('error includes the unrecognized key', () => {
      const schema = v.object({ name: v.string() }).strict();
      const result = schema.safeParse({ name: 'Alice', unknown: 'key' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('unknown');
      }
    });
  });

  describe('.strip()', () => {
    it('removes unknown keys (default behavior)', () => {
      const schema = v.object({ name: v.string() }).strip();
      const result = schema.parse({ name: 'Alice', extra: 'ignored' });

      expect(result).toEqual({ name: 'Alice' });
      expect('extra' in result).toBe(false);
    });
  });

  describe('.catchall()', () => {
    it('validates unknown keys with provided schema', () => {
      const schema = v.object({ id: v.string() }).catchall(v.number());

      const result = schema.parse({ id: 'abc', count: 42, score: 100 });
      expect(result).toEqual({ id: 'abc', count: 42, score: 100 });
    });

    it('rejects unknown keys that fail catchall validation', () => {
      const schema = v.object({ id: v.string() }).catchall(v.number());

      expect(() => schema.parse({ id: 'abc', invalid: 'string' })).toThrow(ValError);
    });
  });

  describe('.keyof()', () => {
    it('creates schema for object keys', () => {
      const User = v.object({ name: v.string(), age: v.number() });
      const UserKey = User.keyof();

      expect(UserKey.parse('name')).toBe('name');
      expect(UserKey.parse('age')).toBe('age');
      expect(() => UserKey.parse('email')).toThrow(ValError);
    });

    it('rejects non-string values', () => {
      const Schema = v.object({ a: v.string() });
      const Key = Schema.keyof();

      expect(() => Key.parse(123)).toThrow(ValError);
    });
  });

  describe('type inference', () => {
    it('infers correct types', () => {
      const User = v.object({
        name: v.string(),
        age: v.number().int().positive(),
        email: v.string().email().optional(),
      });

      type User = Infer<typeof User>;

      // Runtime verification
      const user: User = User.parse({ name: 'Alice', age: 30 });
      expect(user.name).toBe('Alice');
      expect(user.age).toBe(30);
      expect(user.email).toBeUndefined();
    });
  });

  describe('JSON Schema generation', () => {
    it('generates object JSON Schema', () => {
      const schema = v.object({
        name: v.string(),
        age: v.number(),
      });
      const jsonSchema = schema.toJsonSchema();

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toHaveProperty('name');
      expect(jsonSchema.properties).toHaveProperty('age');
      expect(jsonSchema.required).toEqual(['name', 'age']);
    });

    it('marks optional properties correctly', () => {
      const schema = v.object({
        name: v.string(),
        email: v.string().optional(),
      });
      const jsonSchema = schema.toJsonSchema();

      expect(jsonSchema.required).toEqual(['name']);
    });

    it('includes additionalProperties:false for strict mode', () => {
      const schema = v.object({ name: v.string() }).strict();
      const jsonSchema = schema.toJsonSchema();

      expect(jsonSchema.additionalProperties).toBe(false);
    });
  });

  describe('nested objects', () => {
    it('validates nested objects', () => {
      const Address = v.object({
        street: v.string(),
        city: v.string(),
        zip: v.string().regex(/^\d{5}$/),
      });

      const User = v.object({
        name: v.string(),
        address: Address,
      });

      expect(User.parse({
        name: 'Alice',
        address: { street: '123 Main St', city: 'NYC', zip: '10001' },
      })).toEqual({
        name: 'Alice',
        address: { street: '123 Main St', city: 'NYC', zip: '10001' },
      });
    });

    it('reports nested errors with correct path', () => {
      const User = v.object({
        address: v.object({
          zip: v.string().min(5),
        }),
      });

      const result = User.safeParse({ address: { zip: '123' } });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['address', 'zip']);
      }
    });
  });

  describe('immutability', () => {
    it('methods return new schema instances', () => {
      const base = v.object({ name: v.string() });
      const extended = base.extend({ age: v.number() });
      const partial = base.partial();
      const strict = base.strict();

      // Base should still require only name
      expect(base.parse({ name: 'Alice' })).toEqual({ name: 'Alice' });

      // Extended should require both
      expect(() => extended.parse({ name: 'Alice' })).toThrow(ValError);

      // Partial should accept empty
      expect(partial.parse({})).toEqual({});

      // Strict should reject unknown keys
      expect(() => strict.parse({ name: 'Alice', extra: true })).toThrow(ValError);
    });
  });
});

describe('ValNumber validation methods', () => {
  describe('comparison validation', () => {
    describe('.gt()', () => {
      it('validates greater than', () => {
        const schema = v.number().gt(5);
        expect(schema.parse(6)).toBe(6);
        expect(schema.parse(10)).toBe(10);
        expect(() => schema.parse(5)).toThrow(ValError);
        expect(() => schema.parse(4)).toThrow(ValError);
      });

      it('supports custom error message', () => {
        const schema = v.number().gt(5, 'Must be more than 5');
        const result = schema.safeParse(5);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Must be more than 5');
        }
      });
    });

    describe('.gte()', () => {
      it('validates greater than or equal', () => {
        const schema = v.number().gte(5);
        expect(schema.parse(5)).toBe(5);
        expect(schema.parse(6)).toBe(6);
        expect(() => schema.parse(4)).toThrow(ValError);
      });
    });

    describe('.min() (alias for gte)', () => {
      it('validates minimum value', () => {
        const schema = v.number().min(0);
        expect(schema.parse(0)).toBe(0);
        expect(schema.parse(100)).toBe(100);
        expect(() => schema.parse(-1)).toThrow(ValError);
      });
    });

    describe('.lt()', () => {
      it('validates less than', () => {
        const schema = v.number().lt(10);
        expect(schema.parse(9)).toBe(9);
        expect(schema.parse(0)).toBe(0);
        expect(() => schema.parse(10)).toThrow(ValError);
        expect(() => schema.parse(11)).toThrow(ValError);
      });
    });

    describe('.lte()', () => {
      it('validates less than or equal', () => {
        const schema = v.number().lte(10);
        expect(schema.parse(10)).toBe(10);
        expect(schema.parse(9)).toBe(9);
        expect(() => schema.parse(11)).toThrow(ValError);
      });
    });

    describe('.max() (alias for lte)', () => {
      it('validates maximum value', () => {
        const schema = v.number().max(100);
        expect(schema.parse(100)).toBe(100);
        expect(schema.parse(0)).toBe(0);
        expect(() => schema.parse(101)).toThrow(ValError);
      });
    });
  });

  describe('integer and sign validation', () => {
    describe('.int()', () => {
      it('validates integer', () => {
        const schema = v.number().int();
        expect(schema.parse(5)).toBe(5);
        expect(schema.parse(-10)).toBe(-10);
        expect(schema.parse(0)).toBe(0);
        expect(() => schema.parse(3.14)).toThrow(ValError);
        expect(() => schema.parse(5.5)).toThrow(ValError);
      });
    });

    describe('.positive()', () => {
      it('validates positive numbers (> 0)', () => {
        const schema = v.number().positive();
        expect(schema.parse(1)).toBe(1);
        expect(schema.parse(100)).toBe(100);
        expect(schema.parse(0.001)).toBe(0.001);
        expect(() => schema.parse(0)).toThrow(ValError);
        expect(() => schema.parse(-1)).toThrow(ValError);
      });
    });

    describe('.nonnegative()', () => {
      it('validates non-negative numbers (>= 0)', () => {
        const schema = v.number().nonnegative();
        expect(schema.parse(0)).toBe(0);
        expect(schema.parse(1)).toBe(1);
        expect(schema.parse(100)).toBe(100);
        expect(() => schema.parse(-1)).toThrow(ValError);
        expect(() => schema.parse(-0.001)).toThrow(ValError);
      });
    });

    describe('.negative()', () => {
      it('validates negative numbers (< 0)', () => {
        const schema = v.number().negative();
        expect(schema.parse(-1)).toBe(-1);
        expect(schema.parse(-100)).toBe(-100);
        expect(schema.parse(-0.001)).toBe(-0.001);
        expect(() => schema.parse(0)).toThrow(ValError);
        expect(() => schema.parse(1)).toThrow(ValError);
      });
    });

    describe('.nonpositive()', () => {
      it('validates non-positive numbers (<= 0)', () => {
        const schema = v.number().nonpositive();
        expect(schema.parse(0)).toBe(0);
        expect(schema.parse(-1)).toBe(-1);
        expect(schema.parse(-100)).toBe(-100);
        expect(() => schema.parse(1)).toThrow(ValError);
        expect(() => schema.parse(0.001)).toThrow(ValError);
      });
    });
  });

  describe('other validation', () => {
    describe('.multipleOf()', () => {
      it('validates multiple of value', () => {
        const schema = v.number().multipleOf(5);
        expect(schema.parse(0)).toBe(0);
        expect(schema.parse(5)).toBe(5);
        expect(schema.parse(10)).toBe(10);
        expect(schema.parse(-15)).toBe(-15);
        expect(() => schema.parse(7)).toThrow(ValError);
        expect(() => schema.parse(3)).toThrow(ValError);
      });
    });

    describe('.step() (alias for multipleOf)', () => {
      it('validates step value', () => {
        const schema = v.number().step(0.5);
        expect(schema.parse(1)).toBe(1);
        expect(schema.parse(1.5)).toBe(1.5);
        expect(schema.parse(2)).toBe(2);
        expect(() => schema.parse(1.3)).toThrow(ValError);
      });
    });

    describe('.finite()', () => {
      it('validates finite numbers', () => {
        const schema = v.number().finite();
        expect(schema.parse(100)).toBe(100);
        expect(schema.parse(-100)).toBe(-100);
        expect(schema.parse(0)).toBe(0);
        // Note: Infinity and -Infinity are rejected by base number schema as NaN-like
        // so we can't easily test those here
      });
    });

    describe('.safe()', () => {
      it('validates safe integers', () => {
        const schema = v.number().safe();
        expect(schema.parse(0)).toBe(0);
        expect(schema.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
        expect(schema.parse(Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
        expect(() => schema.parse(Number.MAX_SAFE_INTEGER + 1)).toThrow(ValError);
        expect(() => schema.parse(3.14)).toThrow(ValError);
      });
    });
  });

  describe('chaining', () => {
    it('chains multiple validators', () => {
      const schema = v.number().int().positive().lte(100);
      expect(schema.parse(1)).toBe(1);
      expect(schema.parse(50)).toBe(50);
      expect(schema.parse(100)).toBe(100);
      expect(() => schema.parse(0)).toThrow(ValError); // not positive
      expect(() => schema.parse(3.5)).toThrow(ValError); // not int
      expect(() => schema.parse(101)).toThrow(ValError); // too big
    });

    it('immutability - each method returns new instance', () => {
      const base = v.number();
      const withPositive = base.positive();
      const withNegative = base.negative();

      expect(base.parse(-5)).toBe(-5);
      expect(() => withPositive.parse(-5)).toThrow(ValError);
      expect(withNegative.parse(-5)).toBe(-5);
    });

    it('creates complex number schemas', () => {
      // Age schema: positive integer between 0 and 150
      const ageSchema = v.number().int().nonnegative().lte(150);
      expect(ageSchema.parse(25)).toBe(25);
      expect(ageSchema.parse(0)).toBe(0);
      expect(ageSchema.parse(150)).toBe(150);
      expect(() => ageSchema.parse(-1)).toThrow(ValError);
      expect(() => ageSchema.parse(151)).toThrow(ValError);
      expect(() => ageSchema.parse(25.5)).toThrow(ValError);

      // Rating schema: non-negative integer
      const ratingSchema = v.number().int().nonnegative().lte(5);
      expect(ratingSchema.parse(5)).toBe(5);
      expect(ratingSchema.parse(0)).toBe(0);
      expect(() => ratingSchema.parse(-1)).toThrow(ValError);
      expect(() => ratingSchema.parse(6)).toThrow(ValError);
    });
  });
});

// ============================================================================
// Phase 4: Arrays, Tuples, Unions, and Related Types
// ============================================================================

describe('Phase 4: Arrays, Tuples, Unions', () => {
  describe('v.array()', () => {
    describe('basic parsing', () => {
      it('parses valid arrays', () => {
        const schema = v.array(v.string());
        expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
        expect(schema.parse([])).toEqual([]);
      });

      it('throws ValError for non-arrays', () => {
        const schema = v.array(v.string());
        expect(() => schema.parse('not an array')).toThrow(ValError);
        expect(() => schema.parse(null)).toThrow(ValError);
        expect(() => schema.parse(undefined)).toThrow(ValError);
        expect(() => schema.parse({})).toThrow(ValError);
      });

      it('validates each element', () => {
        const schema = v.array(v.number());
        expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3]);
        expect(() => schema.parse([1, 'two', 3])).toThrow(ValError);
      });

      it('reports errors with element paths', () => {
        const schema = v.array(v.string());
        const result = schema.safeParse([1, 2, 3]);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.path).toEqual([0]);
        }
      });
    });

    describe('.min()', () => {
      it('validates minimum length', () => {
        const schema = v.array(v.string()).min(2);
        expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
        expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
        expect(() => schema.parse(['a'])).toThrow(ValError);
        expect(() => schema.parse([])).toThrow(ValError);
      });

      it('supports custom error message', () => {
        const schema = v.array(v.string()).min(2, 'Need more items');
        const result = schema.safeParse(['a']);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Need more items');
        }
      });
    });

    describe('.max()', () => {
      it('validates maximum length', () => {
        const schema = v.array(v.string()).max(2);
        expect(schema.parse(['a'])).toEqual(['a']);
        expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
        expect(() => schema.parse(['a', 'b', 'c'])).toThrow(ValError);
      });
    });

    describe('.length()', () => {
      it('validates exact length', () => {
        const schema = v.array(v.string()).length(3);
        expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
        expect(() => schema.parse(['a', 'b'])).toThrow(ValError);
        expect(() => schema.parse(['a', 'b', 'c', 'd'])).toThrow(ValError);
      });
    });

    describe('.nonempty()', () => {
      it('requires at least one element', () => {
        const schema = v.array(v.string()).nonempty();
        expect(schema.parse(['a'])).toEqual(['a']);
        expect(() => schema.parse([])).toThrow(ValError);
      });

      it('supports custom error message', () => {
        const schema = v.array(v.string()).nonempty('Cannot be empty');
        const result = schema.safeParse([]);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Cannot be empty');
        }
      });
    });

    describe('alternate syntax', () => {
      it('.array() on schema creates array schema', () => {
        const schema = v.string().array();
        expect(schema.parse(['a', 'b'])).toEqual(['a', 'b']);
        expect(() => schema.parse([1, 2])).toThrow(ValError);
      });
    });

    describe('type inference', () => {
      it('infers correct types', () => {
        const schema = v.array(v.string());
        type Arr = Infer<typeof schema>;
        const result: Arr = schema.parse(['a', 'b']);
        expect(result).toEqual(['a', 'b']);
      });
    });
  });

  describe('v.tuple()', () => {
    describe('basic parsing', () => {
      it('parses valid tuples', () => {
        const schema = v.tuple([v.string(), v.number()]);
        expect(schema.parse(['hello', 42])).toEqual(['hello', 42]);
      });

      it('throws for wrong length', () => {
        const schema = v.tuple([v.string(), v.number()]);
        expect(() => schema.parse(['hello'])).toThrow(ValError);
        expect(() => schema.parse(['hello', 42, 'extra'])).toThrow(ValError);
      });

      it('validates each element type', () => {
        const schema = v.tuple([v.string(), v.number()]);
        expect(() => schema.parse([123, 'wrong'])).toThrow(ValError);
      });

      it('throws for non-array input', () => {
        const schema = v.tuple([v.string()]);
        expect(() => schema.parse('not array')).toThrow(ValError);
      });
    });

    describe('.rest()', () => {
      it('allows extra elements of rest type', () => {
        const schema = v.tuple([v.string()]).rest(v.number());
        expect(schema.parse(['hello'])).toEqual(['hello']);
        expect(schema.parse(['hello', 1])).toEqual(['hello', 1]);
        expect(schema.parse(['hello', 1, 2, 3])).toEqual(['hello', 1, 2, 3]);
      });

      it('validates rest elements', () => {
        const schema = v.tuple([v.string()]).rest(v.number());
        expect(() => schema.parse(['hello', 'not a number'])).toThrow(ValError);
      });

      it('still requires fixed elements', () => {
        const schema = v.tuple([v.string(), v.boolean()]).rest(v.number());
        expect(() => schema.parse(['hello'])).toThrow(ValError);
        expect(schema.parse(['hello', true])).toEqual(['hello', true]);
        expect(schema.parse(['hello', true, 1, 2])).toEqual(['hello', true, 1, 2]);
      });
    });

    describe('type inference', () => {
      it('infers correct tuple types', () => {
        const schema = v.tuple([v.string(), v.number()]);
        type Tuple = Infer<typeof schema>;
        const result: Tuple = schema.parse(['hello', 42]);
        expect(result[0]).toBe('hello');
        expect(result[1]).toBe(42);
      });
    });
  });

  describe('v.union()', () => {
    describe('basic parsing', () => {
      it('accepts any variant', () => {
        const schema = v.union([v.string(), v.number()]);
        expect(schema.parse('hello')).toBe('hello');
        expect(schema.parse(42)).toBe(42);
      });

      it('throws when no variant matches', () => {
        const schema = v.union([v.string(), v.number()]);
        expect(() => schema.parse(true)).toThrow(ValError);
        expect(() => schema.parse(null)).toThrow(ValError);
      });

      it('works with object variants', () => {
        const schema = v.union([
          v.object({ type: v.literal('a'), value: v.string() }),
          v.object({ type: v.literal('b'), value: v.number() }),
        ]);
        expect(schema.parse({ type: 'a', value: 'hello' })).toEqual({ type: 'a', value: 'hello' });
        expect(schema.parse({ type: 'b', value: 42 })).toEqual({ type: 'b', value: 42 });
      });
    });

    describe('.or() method', () => {
      it('creates union via method chain', () => {
        const schema = v.string().or(v.number());
        expect(schema.parse('hello')).toBe('hello');
        expect(schema.parse(42)).toBe(42);
        expect(() => schema.parse(true)).toThrow(ValError);
      });
    });

    describe('type inference', () => {
      it('infers union types', () => {
        const schema = v.union([v.string(), v.number()]);
        type U = Infer<typeof schema>;
        const s: U = schema.parse('hello');
        const n: U = schema.parse(42);
        expect(s).toBe('hello');
        expect(n).toBe(42);
      });
    });
  });

  describe('v.discriminatedUnion()', () => {
    describe('basic parsing', () => {
      const schema = v.discriminatedUnion('type', [
        v.object({ type: v.literal('a'), value: v.string() }),
        v.object({ type: v.literal('b'), count: v.number() }),
      ]);

      it('matches correct variant by discriminator', () => {
        expect(schema.parse({ type: 'a', value: 'hello' })).toEqual({ type: 'a', value: 'hello' });
        expect(schema.parse({ type: 'b', count: 42 })).toEqual({ type: 'b', count: 42 });
      });

      it('throws for missing discriminator', () => {
        expect(() => schema.parse({ value: 'hello' })).toThrow(ValError);
      });

      it('throws for invalid discriminator value', () => {
        const result = schema.safeParse({ type: 'c', value: 'hello' });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Invalid discriminator');
        }
      });

      it('validates the matched variant', () => {
        expect(() => schema.parse({ type: 'a', value: 123 })).toThrow(ValError);
        expect(() => schema.parse({ type: 'b', count: 'not a number' })).toThrow(ValError);
      });

      it('throws for non-object input', () => {
        expect(() => schema.parse('not an object')).toThrow(ValError);
        expect(() => schema.parse(null)).toThrow(ValError);
        expect(() => schema.parse([])).toThrow(ValError);
      });
    });
  });

  describe('v.intersection()', () => {
    describe('basic parsing', () => {
      it('combines object schemas', () => {
        const A = v.object({ a: v.string() });
        const B = v.object({ b: v.number() });
        const AB = v.intersection(A, B);

        expect(AB.parse({ a: 'hello', b: 42 })).toEqual({ a: 'hello', b: 42 });
      });

      it('fails if either schema fails', () => {
        const A = v.object({ a: v.string() });
        const B = v.object({ b: v.number() });
        const AB = v.intersection(A, B);

        expect(() => AB.parse({ a: 'hello' })).toThrow(ValError);
        expect(() => AB.parse({ b: 42 })).toThrow(ValError);
      });
    });

    describe('.and() method', () => {
      it('creates intersection via method chain', () => {
        const A = v.object({ a: v.string() });
        const B = v.object({ b: v.number() });
        const AB = A.and(B);

        expect(AB.parse({ a: 'hello', b: 42 })).toEqual({ a: 'hello', b: 42 });
      });
    });
  });

  describe('v.record()', () => {
    describe('basic parsing', () => {
      it('validates record values', () => {
        const schema = v.record(v.number());
        expect(schema.parse({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
        expect(schema.parse({})).toEqual({});
      });

      it('throws for invalid values', () => {
        const schema = v.record(v.number());
        expect(() => schema.parse({ a: 'not a number' })).toThrow(ValError);
      });

      it('throws for non-object input', () => {
        const schema = v.record(v.string());
        expect(() => schema.parse('not an object')).toThrow(ValError);
        expect(() => schema.parse(null)).toThrow(ValError);
        expect(() => schema.parse([])).toThrow(ValError);
      });
    });

    describe('with key schema', () => {
      it('validates keys with custom schema', () => {
        const schema = v.record(v.string().min(2), v.number());
        expect(schema.parse({ ab: 1, cd: 2 })).toEqual({ ab: 1, cd: 2 });
        // Note: keys are validated but error handling differs
      });
    });

    describe('type inference', () => {
      it('infers record types', () => {
        const schema = v.record(v.number());
        type R = Infer<typeof schema>;
        const result: R = schema.parse({ count: 42 });
        expect(result['count']).toBe(42);
      });
    });
  });

  describe('v.map()', () => {
    describe('basic parsing', () => {
      it('validates Map objects', () => {
        const schema = v.map(v.string(), v.number());
        const input = new Map([['a', 1], ['b', 2]]);
        const result = schema.parse(input);
        expect(result).toBeInstanceOf(Map);
        expect(result.get('a')).toBe(1);
        expect(result.get('b')).toBe(2);
      });

      it('throws for non-Map input', () => {
        const schema = v.map(v.string(), v.number());
        expect(() => schema.parse({ a: 1 })).toThrow(ValError);
        expect(() => schema.parse([['a', 1]])).toThrow(ValError);
      });

      it('validates keys and values', () => {
        const schema = v.map(v.string(), v.number());
        const invalidKey = new Map([[123 as unknown as string, 1]]);
        expect(() => schema.parse(invalidKey)).toThrow(ValError);

        const invalidValue = new Map([['a', 'not a number' as unknown as number]]);
        expect(() => schema.parse(invalidValue)).toThrow(ValError);
      });
    });
  });

  describe('v.set()', () => {
    describe('basic parsing', () => {
      it('validates Set objects', () => {
        const schema = v.set(v.string());
        const input = new Set(['a', 'b', 'c']);
        const result = schema.parse(input);
        expect(result).toBeInstanceOf(Set);
        expect(result.has('a')).toBe(true);
        expect(result.has('b')).toBe(true);
      });

      it('throws for non-Set input', () => {
        const schema = v.set(v.string());
        expect(() => schema.parse(['a', 'b'])).toThrow(ValError);
        expect(() => schema.parse({ a: true })).toThrow(ValError);
      });

      it('validates values', () => {
        const schema = v.set(v.number());
        const invalid = new Set(['not a number' as unknown as number]);
        expect(() => schema.parse(invalid)).toThrow(ValError);
      });
    });
  });

  describe('v.literal()', () => {
    describe('string literals', () => {
      it('accepts exact string value', () => {
        const schema = v.literal('hello');
        expect(schema.parse('hello')).toBe('hello');
        expect(() => schema.parse('world')).toThrow(ValError);
      });
    });

    describe('number literals', () => {
      it('accepts exact number value', () => {
        const schema = v.literal(42);
        expect(schema.parse(42)).toBe(42);
        expect(() => schema.parse(43)).toThrow(ValError);
        expect(() => schema.parse('42')).toThrow(ValError);
      });
    });

    describe('boolean literals', () => {
      it('accepts exact boolean value', () => {
        const trueSchema = v.literal(true);
        expect(trueSchema.parse(true)).toBe(true);
        expect(() => trueSchema.parse(false)).toThrow(ValError);

        const falseSchema = v.literal(false);
        expect(falseSchema.parse(false)).toBe(false);
        expect(() => falseSchema.parse(true)).toThrow(ValError);
      });
    });

    describe('null and undefined literals', () => {
      it('accepts null literal', () => {
        const schema = v.literal(null);
        expect(schema.parse(null)).toBe(null);
        expect(() => schema.parse(undefined)).toThrow(ValError);
      });

      it('accepts undefined literal', () => {
        const schema = v.literal(undefined);
        expect(schema.parse(undefined)).toBe(undefined);
        expect(() => schema.parse(null)).toThrow(ValError);
      });
    });

    describe('type inference', () => {
      it('infers literal types', () => {
        const schema = v.literal('hello');
        type L = Infer<typeof schema>;
        const result: L = schema.parse('hello');
        expect(result).toBe('hello');
      });
    });
  });

  describe('v.enum()', () => {
    describe('basic parsing', () => {
      it('accepts any of the enum values', () => {
        const schema = v.enum(['admin', 'user', 'guest']);
        expect(schema.parse('admin')).toBe('admin');
        expect(schema.parse('user')).toBe('user');
        expect(schema.parse('guest')).toBe('guest');
      });

      it('throws for non-enum values', () => {
        const schema = v.enum(['admin', 'user', 'guest']);
        expect(() => schema.parse('other')).toThrow(ValError);
        expect(() => schema.parse('')).toThrow(ValError);
      });

      it('throws for non-string values', () => {
        const schema = v.enum(['admin', 'user']);
        expect(() => schema.parse(123)).toThrow(ValError);
        expect(() => schema.parse(null)).toThrow(ValError);
      });
    });

    describe('.enum property', () => {
      it('provides enum-like access to values', () => {
        const Role = v.enum(['admin', 'user', 'guest']);
        expect(Role.enum.admin).toBe('admin');
        expect(Role.enum.user).toBe('user');
        expect(Role.enum.guest).toBe('guest');
      });
    });

    describe('type inference', () => {
      it('infers union of literal types', () => {
        const schema = v.enum(['a', 'b', 'c']);
        type E = Infer<typeof schema>;
        const result: E = schema.parse('a');
        expect(result).toBe('a');
      });
    });
  });

  describe('v.nativeEnum()', () => {
    enum Direction {
      Up,
      Down,
      Left,
      Right,
    }

    enum StringDirection {
      Up = 'UP',
      Down = 'DOWN',
    }

    describe('numeric enums', () => {
      it('accepts numeric enum values', () => {
        const schema = v.nativeEnum(Direction);
        expect(schema.parse(Direction.Up)).toBe(0);
        expect(schema.parse(Direction.Down)).toBe(1);
        expect(schema.parse(0)).toBe(0);
        expect(schema.parse(3)).toBe(3);
      });

      it('throws for invalid values', () => {
        const schema = v.nativeEnum(Direction);
        expect(() => schema.parse(4)).toThrow(ValError);
        expect(() => schema.parse('Up')).toThrow(ValError);
      });
    });

    describe('string enums', () => {
      it('accepts string enum values', () => {
        const schema = v.nativeEnum(StringDirection);
        expect(schema.parse('UP')).toBe('UP');
        expect(schema.parse('DOWN')).toBe('DOWN');
        expect(schema.parse(StringDirection.Up)).toBe('UP');
      });

      it('throws for invalid values', () => {
        const schema = v.nativeEnum(StringDirection);
        expect(() => schema.parse('INVALID')).toThrow(ValError);
        expect(() => schema.parse(0)).toThrow(ValError);
      });
    });
  });

  describe('immutability', () => {
    it('array methods return new instances', () => {
      const base = v.array(v.string());
      const withMin = base.min(2);
      const withMax = base.max(5);

      expect(base.parse(['a'])).toEqual(['a']);
      expect(() => withMin.parse(['a'])).toThrow(ValError);
      expect(withMax.parse(['a'])).toEqual(['a']);
    });
  });

  describe('JSON Schema generation', () => {
    it('generates array JSON Schema', () => {
      const schema = v.array(v.string());
      const jsonSchema = schema.toJsonSchema();
      expect(jsonSchema.type).toBe('array');
      expect(jsonSchema.items).toEqual({ type: 'string' });
    });

    it('generates tuple JSON Schema', () => {
      const schema = v.tuple([v.string(), v.number()]);
      const jsonSchema = schema.toJsonSchema();
      expect(jsonSchema.type).toBe('array');
      expect(jsonSchema.prefixItems).toEqual([{ type: 'string' }, { type: 'number' }]);
      expect(jsonSchema.minItems).toBe(2);
      expect(jsonSchema.maxItems).toBe(2);
    });

    it('generates union JSON Schema', () => {
      const schema = v.union([v.string(), v.number()]);
      const jsonSchema = schema.toJsonSchema();
      expect(jsonSchema.oneOf).toEqual([{ type: 'string' }, { type: 'number' }]);
    });

    it('generates intersection JSON Schema', () => {
      const A = v.object({ a: v.string() });
      const B = v.object({ b: v.number() });
      const schema = v.intersection(A, B);
      const jsonSchema = schema.toJsonSchema();
      expect(jsonSchema.allOf).toBeDefined();
      expect(jsonSchema.allOf).toHaveLength(2);
    });

    it('generates record JSON Schema', () => {
      const schema = v.record(v.number());
      const jsonSchema = schema.toJsonSchema();
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.additionalProperties).toEqual({ type: 'number' });
    });

    it('generates literal JSON Schema', () => {
      const schema = v.literal('hello');
      const jsonSchema = schema.toJsonSchema();
      expect(jsonSchema.const).toBe('hello');
    });

    it('generates enum JSON Schema', () => {
      const schema = v.enum(['a', 'b', 'c']);
      const jsonSchema = schema.toJsonSchema();
      expect(jsonSchema.type).toBe('string');
      expect(jsonSchema.enum).toEqual(['a', 'b', 'c']);
    });
  });
});

// ============================================================================
// Phase 5: Transforms and Refinements
// ============================================================================

describe('Phase 5: Transforms and Refinements', () => {
  describe('.transform()', () => {
    describe('basic transforms', () => {
      it('transforms string to number', () => {
        const schema = v.string().transform(s => parseInt(s, 10));
        expect(schema.parse('42')).toBe(42);
        expect(schema.parse('100')).toBe(100);
        expect(schema.parse('-5')).toBe(-5);
      });

      it('transforms number to string', () => {
        const schema = v.number().transform(n => n.toString());
        expect(schema.parse(42)).toBe('42');
        expect(schema.parse(3.14)).toBe('3.14');
      });

      it('transforms string to array', () => {
        const schema = v.string().transform(s => s.split(','));
        expect(schema.parse('a,b,c')).toEqual(['a', 'b', 'c']);
        expect(schema.parse('hello')).toEqual(['hello']);
      });

      it('transforms to object', () => {
        const schema = v.string().transform(s => ({ value: s, length: s.length }));
        expect(schema.parse('hello')).toEqual({ value: 'hello', length: 5 });
      });

      it('fails validation before transform', () => {
        const schema = v.string().transform(s => parseInt(s, 10));
        expect(() => schema.parse(42)).toThrow(ValError);
        expect(() => schema.parse(null)).toThrow(ValError);
      });
    });

    describe('chained transforms', () => {
      it('chains multiple transforms', () => {
        const schema = v.string()
          .trim()
          .transform(s => s.split(','))
          .transform(arr => arr.map(Number));
        expect(schema.parse('  1,2,3  ')).toEqual([1, 2, 3]);
      });

      it('transforms after validation', () => {
        const schema = v.string()
          .min(3)
          .transform(s => s.toUpperCase());
        expect(schema.parse('hello')).toBe('HELLO');
        expect(() => schema.parse('hi')).toThrow(ValError);
      });
    });

    describe('async transforms', () => {
      it('handles async transform', async () => {
        const schema = v.string().transform(async (s) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return parseInt(s, 10);
        });
        expect(await schema.parseAsync('42')).toBe(42);
      });

      it('async transform with safeParse', async () => {
        const schema = v.string().transform(async (s) => {
          return s.toUpperCase();
        });
        const result = await schema.safeParseAsync('hello');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('HELLO');
        }
      });
    });

    describe('type inference', () => {
      it('infers correct input and output types', () => {
        const schema = v.string().transform(s => parseInt(s, 10));
        type Input = Infer<typeof schema>;
        // At runtime, verify transform works
        const result: Input = schema.parse('42');
        expect(result).toBe(42);
      });
    });

    describe('returns correct class', () => {
      it('returns ValTransformed instance', () => {
        const schema = v.string().transform(s => s.length);
        expect(schema).toBeInstanceOf(ValTransformed);
      });
    });
  });

  describe('.refine()', () => {
    describe('basic refinements', () => {
      it('validates with predicate', () => {
        const schema = v.string().refine(s => s.length > 0, 'Required');
        expect(schema.parse('hello')).toBe('hello');
        expect(() => schema.parse('')).toThrow(ValError);
      });

      it('uses custom error message', () => {
        const schema = v.string().refine(s => s.includes('@'), 'Must contain @');
        const result = schema.safeParse('hello');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Must contain @');
        }
      });

      it('uses options object', () => {
        const schema = v.string().refine(
          s => s.includes('@'),
          { message: 'Must contain @', path: ['email'] }
        );
        const result = schema.safeParse('hello');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Must contain @');
          expect(result.error.issues[0]?.path).toEqual(['email']);
        }
      });

      it('chains multiple refinements', () => {
        const schema = v.string()
          .refine(s => s.length >= 3, 'Min 3 chars')
          .refine(s => s.length <= 10, 'Max 10 chars');
        expect(schema.parse('hello')).toBe('hello');
        expect(() => schema.parse('hi')).toThrow(ValError);
        expect(() => schema.parse('this is way too long')).toThrow(ValError);
      });

      it('works with number schema', () => {
        const schema = v.number().refine(n => n % 2 === 0, 'Must be even');
        expect(schema.parse(4)).toBe(4);
        expect(() => schema.parse(3)).toThrow(ValError);
      });
    });

    describe('async refinements', () => {
      it('handles async predicate', async () => {
        const schema = v.string().refine(async (s) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return s.length > 0;
        }, 'Required');
        expect(await schema.parseAsync('hello')).toBe('hello');
      });

      it('async refinement failure', async () => {
        const schema = v.string().refine(async (s) => {
          return s.includes('@');
        }, 'Must contain @');
        const result = await schema.safeParseAsync('hello');
        expect(result.success).toBe(false);
      });
    });

    describe('returns correct class', () => {
      it('returns ValRefined instance', () => {
        const schema = v.string().refine(s => s.length > 0);
        expect(schema).toBeInstanceOf(ValRefined);
      });
    });
  });

  describe('.superRefine()', () => {
    describe('basic superRefine', () => {
      it('can add single issue', () => {
        const schema = v.string().superRefine((val, ctx) => {
          if (val.length < 5) {
            ctx.addIssue({
              code: 'custom',
              message: 'Too short',
            });
          }
        });
        expect(schema.parse('hello')).toBe('hello');
        expect(() => schema.parse('hi')).toThrow(ValError);
      });

      it('can add multiple issues', () => {
        const schema = v.string().superRefine((val, ctx) => {
          if (val.length < 5) {
            ctx.addIssue({
              code: 'custom',
              message: 'Too short',
            });
          }
          if (val.length > 100) {
            ctx.addIssue({
              code: 'custom',
              message: 'Too long',
            });
          }
          if (!val.includes('@')) {
            ctx.addIssue({
              code: 'custom',
              message: 'Must contain @',
            });
          }
        });

        const result = schema.safeParse('hi');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBe(2);
          const messages = result.error.issues.map(i => i.message);
          expect(messages).toContain('Too short');
          expect(messages).toContain('Must contain @');
        }
      });

      it('includes path in issues', () => {
        const schema = v.string().superRefine((val, ctx) => {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid',
            path: ['field', 'nested'],
          });
        });
        const result = schema.safeParse('anything');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.path).toEqual(['field', 'nested']);
        }
      });
    });

    describe('async superRefine', () => {
      it('handles async validation', async () => {
        const schema = v.string().superRefine(async (val, ctx) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          if (val !== 'valid') {
            ctx.addIssue({
              code: 'custom',
              message: 'Not valid',
            });
          }
        });
        expect(await schema.parseAsync('valid')).toBe('valid');
        await expect(schema.parseAsync('invalid')).rejects.toThrow(ValError);
      });
    });

    describe('returns correct class', () => {
      it('returns ValSuperRefined instance', () => {
        const schema = v.string().superRefine(() => {});
        expect(schema).toBeInstanceOf(ValSuperRefined);
      });
    });
  });

  describe('.pipe()', () => {
    describe('basic pipe', () => {
      it('pipes transform output to another schema', () => {
        const schema = v.string()
          .transform(s => parseInt(s, 10))
          .pipe(v.number().positive());
        expect(schema.parse('42')).toBe(42);
        expect(() => schema.parse('-5')).toThrow(ValError);
      });

      it('validates through pipe', () => {
        const schema = v.string()
          .transform(s => s.split(',').map(Number))
          .pipe(v.array(v.number()).min(2));
        expect(schema.parse('1,2,3')).toEqual([1, 2, 3]);
        expect(() => schema.parse('1')).toThrow(ValError);
      });

      it('chains multiple pipes', () => {
        const schema = v.string()
          .transform(s => parseInt(s, 10))
          .pipe(v.number().positive())
          .transform(n => n * 2)
          .pipe(v.number().max(100));
        expect(schema.parse('10')).toBe(20);
        expect(() => schema.parse('60')).toThrow(ValError); // 60 * 2 = 120 > 100
      });
    });

    describe('returns correct class', () => {
      it('returns ValPiped instance', () => {
        const schema = v.string()
          .transform(s => parseInt(s, 10))
          .pipe(v.number());
        expect(schema).toBeInstanceOf(ValPiped);
      });
    });
  });

  describe('v.preprocess()', () => {
    describe('basic preprocessing', () => {
      it('preprocesses before validation', () => {
        const schema = v.preprocess(
          (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
          v.number()
        );
        expect(schema.parse('42')).toBe(42);
        expect(schema.parse(42)).toBe(42);
      });

      it('coerces to string', () => {
        const schema = v.preprocess(
          (val) => String(val),
          v.string()
        );
        expect(schema.parse(42)).toBe('42');
        expect(schema.parse(true)).toBe('true');
      });

      it('handles null/undefined', () => {
        const schema = v.preprocess(
          (val) => val ?? 'default',
          v.string()
        );
        expect(schema.parse(null)).toBe('default');
        expect(schema.parse(undefined)).toBe('default');
        expect(schema.parse('hello')).toBe('hello');
      });

      it('validation still runs after preprocess', () => {
        const schema = v.preprocess(
          (val) => val,
          v.string().min(3)
        );
        expect(schema.parse('hello')).toBe('hello');
        expect(() => schema.parse('hi')).toThrow(ValError);
      });
    });

    describe('returns correct class', () => {
      it('returns ValPreprocessed instance', () => {
        const schema = v.preprocess((val) => val, v.string());
        expect(schema).toBeInstanceOf(ValPreprocessed);
      });
    });
  });

  describe('v.coerce', () => {
    describe('coerce.string()', () => {
      it('coerces number to string', () => {
        const schema = v.coerce.string();
        expect(schema.parse(42)).toBe('42');
        expect(schema.parse(3.14)).toBe('3.14');
      });

      it('coerces boolean to string', () => {
        const schema = v.coerce.string();
        expect(schema.parse(true)).toBe('true');
        expect(schema.parse(false)).toBe('false');
      });

      it('coerces null and undefined', () => {
        const schema = v.coerce.string();
        expect(schema.parse(null)).toBe('null');
        expect(schema.parse(undefined)).toBe('undefined');
      });

      it('keeps string as is', () => {
        const schema = v.coerce.string();
        expect(schema.parse('hello')).toBe('hello');
      });
    });

    describe('coerce.number()', () => {
      it('coerces string to number', () => {
        const schema = v.coerce.number();
        expect(schema.parse('42')).toBe(42);
        expect(schema.parse('3.14')).toBe(3.14);
        expect(schema.parse('-100')).toBe(-100);
      });

      it('coerces boolean to number', () => {
        const schema = v.coerce.number();
        expect(schema.parse(true)).toBe(1);
        expect(schema.parse(false)).toBe(0);
      });

      it('keeps number as is', () => {
        const schema = v.coerce.number();
        expect(schema.parse(42)).toBe(42);
      });

      it('fails for non-coercible values', () => {
        const schema = v.coerce.number();
        expect(() => schema.parse('not a number')).toThrow(ValError);
        expect(() => schema.parse({})).toThrow(ValError);
      });
    });

    describe('coerce.boolean()', () => {
      it('coerces truthy values to true', () => {
        const schema = v.coerce.boolean();
        expect(schema.parse(1)).toBe(true);
        expect(schema.parse('hello')).toBe(true);
        expect(schema.parse({})).toBe(true);
        expect(schema.parse([])).toBe(true);
      });

      it('coerces falsy values to false', () => {
        const schema = v.coerce.boolean();
        expect(schema.parse(0)).toBe(false);
        expect(schema.parse('')).toBe(false);
        expect(schema.parse(null)).toBe(false);
        expect(schema.parse(undefined)).toBe(false);
      });

      it('keeps boolean as is', () => {
        const schema = v.coerce.boolean();
        expect(schema.parse(true)).toBe(true);
        expect(schema.parse(false)).toBe(false);
      });
    });

    describe('coerce.bigint()', () => {
      it('coerces string to bigint', () => {
        const schema = v.coerce.bigint();
        expect(schema.parse('42')).toBe(42n);
        expect(schema.parse('-100')).toBe(-100n);
      });

      it('coerces number to bigint', () => {
        const schema = v.coerce.bigint();
        expect(schema.parse(42)).toBe(42n);
      });

      it('keeps bigint as is', () => {
        const schema = v.coerce.bigint();
        expect(schema.parse(42n)).toBe(42n);
      });

      it('fails for non-coercible values', () => {
        const schema = v.coerce.bigint();
        expect(() => schema.parse('not a number')).toThrow(ValError);
        expect(() => schema.parse(3.14)).toThrow(ValError);
      });
    });

    describe('coerce.date()', () => {
      it('coerces string to Date', () => {
        const schema = v.coerce.date();
        const result = schema.parse('2024-01-15');
        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2024);
      });

      it('coerces number (timestamp) to Date', () => {
        const schema = v.coerce.date();
        const timestamp = 1704067200000; // 2024-01-01
        const result = schema.parse(timestamp);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(timestamp);
      });

      it('keeps Date as is', () => {
        const schema = v.coerce.date();
        const date = new Date('2024-01-15');
        expect(schema.parse(date)).toBe(date);
      });

      it('fails for invalid dates', () => {
        const schema = v.coerce.date();
        expect(() => schema.parse('not a date')).toThrow(ValError);
        expect(() => schema.parse(new Date('invalid'))).toThrow(ValError);
      });
    });
  });

  describe('parseAsync and safeParseAsync', () => {
    describe('parseAsync', () => {
      it('works with sync schemas', async () => {
        const schema = v.string();
        expect(await schema.parseAsync('hello')).toBe('hello');
      });

      it('throws for invalid input', async () => {
        const schema = v.string();
        await expect(schema.parseAsync(42)).rejects.toThrow(ValError);
      });

      it('works with async transforms', async () => {
        const schema = v.string().transform(async (s) => s.toUpperCase());
        expect(await schema.parseAsync('hello')).toBe('HELLO');
      });
    });

    describe('safeParseAsync', () => {
      it('returns success for valid input', async () => {
        const schema = v.string();
        const result = await schema.safeParseAsync('hello');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('hello');
        }
      });

      it('returns error for invalid input', async () => {
        const schema = v.string();
        const result = await schema.safeParseAsync(42);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(ValError);
        }
      });

      it('works with async refinements', async () => {
        const schema = v.string().refine(async (s) => s.length > 0, 'Required');
        const success = await schema.safeParseAsync('hello');
        expect(success.success).toBe(true);
        const failure = await schema.safeParseAsync('');
        expect(failure.success).toBe(false);
      });
    });
  });

  describe('complex transform/refine combinations', () => {
    it('transform then refine', () => {
      const schema = v.string()
        .transform(s => parseInt(s, 10))
        .refine(n => n > 0, 'Must be positive');
      expect(schema.parse('42')).toBe(42);
      expect(() => schema.parse('-5')).toThrow(ValError);
    });

    it('refine then transform', () => {
      const schema = v.string()
        .refine(s => s.length > 0, 'Required')
        .transform(s => s.toUpperCase());
      expect(schema.parse('hello')).toBe('HELLO');
      expect(() => schema.parse('')).toThrow(ValError);
    });

    it('complex pipeline', () => {
      const schema = v.string()
        .trim()
        .refine(s => s.length > 0, 'Required')
        .transform(s => s.split(','))
        .transform(arr => arr.map(s => parseInt(s.trim(), 10)))
        .refine(arr => arr.every(n => !isNaN(n)), 'All must be numbers')
        .transform(arr => arr.reduce((a, b) => a + b, 0));

      expect(schema.parse('1, 2, 3')).toBe(6);
      expect(schema.parse('  10, 20  ')).toBe(30);
      expect(() => schema.parse('  ')).toThrow(ValError);
    });

    it('object with transformed fields', () => {
      const schema = v.object({
        age: v.string().transform(s => parseInt(s, 10)),
        name: v.string().transform(s => s.toUpperCase()),
      });

      expect(schema.parse({ age: '25', name: 'alice' })).toEqual({
        age: 25,
        name: 'ALICE',
      });
    });

    it('array with transformed elements', () => {
      const schema = v.array(v.string().transform(s => parseInt(s, 10)));
      expect(schema.parse(['1', '2', '3'])).toEqual([1, 2, 3]);
    });
  });

  describe('immutability', () => {
    it('transform returns new instance', () => {
      const base = v.string();
      const transformed = base.transform(s => s.length);

      expect(base.parse('hello')).toBe('hello');
      expect(transformed.parse('hello')).toBe(5);
    });

    it('refine returns new instance', () => {
      const base = v.string();
      const refined = base.refine(s => s.length > 0, 'Required');

      expect(base.parse('')).toBe('');
      expect(() => refined.parse('')).toThrow(ValError);
    });
  });
});
