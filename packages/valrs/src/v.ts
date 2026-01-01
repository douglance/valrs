/**
 * Zod-compatible fluent API for valrs.
 *
 * This module provides a `v` namespace with schema builders that mirror
 * Zod's API while maintaining Standard Schema compliance.
 *
 * @example
 * ```typescript
 * import { v } from 'valrs';
 *
 * // Create schemas
 * const userSchema = v.object({
 *   name: v.string(),
 *   age: v.number(),
 * });
 *
 * // Parse data
 * const user = userSchema.parse({ name: 'Alice', age: 30 });
 *
 * // Infer types
 * type User = v.infer<typeof userSchema>;
 * ```
 */

import type { StandardSchemaV1, ValidationResult } from './types';
import {
  ValSchema,
  ValArray,
  ValUnion,
  ValIntersection,
  ValPreprocessed,
} from './schema';
import {
  StringSchema,
  NumberSchema,
  BooleanSchema,
  Int32Schema,
  Int64Schema,
  Uint32Schema,
  Uint64Schema,
  Float32Schema,
  Float64Schema,
} from './primitives';
import { success, fail } from './factory';
import {
  stream,
  streamLines,
  createMockStream,
  createChunkedStream,
} from './streaming';
export type {
  StreamOptions,
  StreamResult,
  StreamError,
  StreamResultWithErrors,
  StreamInput,
} from './streaming';

// Re-export types for convenience
export type {
  SafeParseResult,
  SafeParseSuccess,
  SafeParseError,
} from './schema';
export { ValSchema } from './schema';
export { isSafeParseSuccess, isSafeParseError } from './schema';

// Error types and functions (Phase 7)
import {
  ValError as ValErrorClass,
  setErrorMap as setErrorMapFn,
  getErrorMap as getErrorMapFn,
  resetErrorMap as resetErrorMapFn,
  getTypeName,
  createInvalidTypeIssue,
  createTooSmallIssue,
  createTooBigIssue,
  createInvalidStringIssue,
  createInvalidEnumValueIssue,
  createInvalidUnionIssue,
  createUnrecognizedKeysIssue,
  createCustomIssue,
  createInvalidLiteralIssue,
  createNotMultipleOfIssue,
  createNotFiniteIssue,
  createInvalidDateIssue,
} from './error';

// Re-export error functions
export const ValError = ValErrorClass;
export const setErrorMap = setErrorMapFn;
export const getErrorMap = getErrorMapFn;
export const resetErrorMap = resetErrorMapFn;
export {
  getTypeName,
  createInvalidTypeIssue,
  createTooSmallIssue,
  createTooBigIssue,
  createInvalidStringIssue,
  createInvalidEnumValueIssue,
  createInvalidUnionIssue,
  createUnrecognizedKeysIssue,
  createCustomIssue,
  createInvalidLiteralIssue,
  createNotMultipleOfIssue,
  createNotFiniteIssue,
  createInvalidDateIssue,
};
export type {
  ValIssueCode,
  ValIssueBase,
  ValIssue,
  InvalidTypeIssue,
  TooSmallIssue,
  TooBigIssue,
  InvalidStringIssue,
  InvalidEnumValueIssue,
  InvalidUnionIssue,
  CustomIssue,
  SizeType,
  ErrorMapFn,
  ErrorMapContext,
  FormattedError,
  FlattenedError,
} from './error';

// ============================================================================
// Type Inference Utilities
// ============================================================================

/**
 * Infers the output type from a schema.
 *
 * This is the primary type inference utility, matching Zod's `z.infer`.
 *
 * @example
 * ```typescript
 * const schema = v.string();
 * type MyString = v.infer<typeof schema>; // string
 * ```
 */
export type Infer<T extends ValSchema<unknown, unknown>> =
  T extends ValSchema<unknown, infer O> ? O : never;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type infer<T extends ValSchema<unknown, unknown>> = Infer<T>;

/**
 * Infers the input type from a schema.
 *
 * Use this when the input type differs from the output type
 * (e.g., with coercion or transforms).
 *
 * @example
 * ```typescript
 * const schema = v.coerce.number();
 * type Input = v.input<typeof schema>;  // unknown
 * type Output = v.output<typeof schema>; // number
 * ```
 */
export type input<T extends ValSchema<unknown, unknown>> =
  T extends ValSchema<infer I, unknown> ? I : never;

/**
 * Infers the output type from a schema.
 *
 * Alias for `v.infer` for symmetry with `v.input`.
 */
export type output<T extends ValSchema<unknown, unknown>> = Infer<T>;

// ============================================================================
// Primitive Schema Classes
// ============================================================================

// ============================================================================
// Validation Issue Creation
// ============================================================================

/**
 * Creates a validation issue with a Zod-compatible error code.
 * Issues include the code and any additional metadata for proper error formatting.
 */
function createIssue(
  code: string,
  message: string,
  metadata?: Record<string, unknown>
): { issues: Array<{ code: string; message: string; [key: string]: unknown }> } {
  return {
    issues: [{ code, message, ...metadata }],
  };
}

/**
 * Creates an invalid_type issue for type validation failures.
 */
function createTypeIssue(
  expected: string,
  received: unknown,
  message?: string
): { issues: Array<{ code: string; expected: string; received: string; message: string }> } {
  const receivedType = received === null ? 'null'
    : received === undefined ? 'undefined'
    : Array.isArray(received) ? 'array'
    : typeof received;

  return {
    issues: [{
      code: 'invalid_type',
      expected,
      received: receivedType,
      message: message ?? `Expected ${expected}, received ${receivedType}`,
    }],
  };
}

// ============================================================================
// String Validator Types and Regex Patterns
// ============================================================================

type StringValidator = (value: string) => { issues: Array<{ message: string }> } | null;
type StringTransform = (value: string) => string;

/** Email regex - simplified but covers most common cases */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** URL regex - supports http, https, ftp protocols */
const URL_REGEX = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;

/** UUID v4 regex */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** CUID regex (original format) */
const CUID_REGEX = /^c[a-z0-9]{24}$/;

/** CUID2 regex (newer format, variable length) */
const CUID2_REGEX = /^[a-z][a-z0-9]{23,}$/;

/** ULID regex (26 characters, Crockford Base32) */
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/** ISO 8601 datetime regex */
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** IPv4 regex */
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

/** IPv6 regex (simplified) */
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}:(?:[0-9a-fA-F]{1,4}:){0,4}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,3}:(?:[0-9a-fA-F]{1,4}:){0,3}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,4}:(?:[0-9a-fA-F]{1,4}:){0,2}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}:(?:[0-9a-fA-F]{1,4}:)?[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$/;

// ============================================================================
// ValString Class
// ============================================================================

/**
 * Schema for string values with validation and transformation methods.
 *
 * Supports chainable methods like `.min()`, `.max()`, `.email()`, `.url()`, etc.
 * Each method returns a new schema instance (immutable).
 *
 * @example
 * ```typescript
 * const emailSchema = v.string().email();
 * const usernameSchema = v.string().min(3).max(20);
 * const normalizedSchema = v.string().trim().toLowerCase();
 * ```
 */
export class ValString extends ValSchema<string, string> {
  private readonly validators: ReadonlyArray<StringValidator>;
  private readonly transforms: ReadonlyArray<StringTransform>;

  constructor(
    validators: ReadonlyArray<StringValidator> = [],
    transforms: ReadonlyArray<StringTransform> = []
  ) {
    const baseValidate = StringSchema['~standard'].validate as (value: unknown) => ValidationResult<string>;

    // Capture validators and transforms for use in closure
    const capturedValidators = validators;
    const capturedTransforms = transforms;

    // Create a wrapped validation function that runs all validators and transforms
    const wrappedValidate = (value: unknown): ValidationResult<string> => {
      // First, validate base type
      const baseResult = baseValidate(value);
      if (baseResult.issues !== undefined) {
        return baseResult as ValidationResult<string>;
      }

      // At this point we know baseResult.value is defined
      const baseValue = baseResult.value as string;

      // Apply transforms first
      let transformedValue: string = baseValue;
      for (let i = 0; i < capturedTransforms.length; i++) {
        const transform = capturedTransforms[i];
        if (transform !== undefined) {
          transformedValue = transform(transformedValue);
        }
      }

      // Then run all validators on the transformed value
      for (let i = 0; i < capturedValidators.length; i++) {
        const validator = capturedValidators[i];
        if (validator !== undefined) {
          const issue = validator(transformedValue);
          if (issue !== null) {
            return issue;
          }
        }
      }

      return success(transformedValue);
    };

    super(
      wrappedValidate,
      (target: string) => StringSchema['~standard'].jsonSchema.input({ target }),
      (target: string) => StringSchema['~standard'].jsonSchema.output({ target })
    );

    this.validators = validators;
    this.transforms = transforms;
    this._hasTransforms = validators.length > 0 || transforms.length > 0;
  }

  /**
   * Creates a copy of this schema with additional validators/transforms.
   */
  private clone(
    additionalValidators: ReadonlyArray<StringValidator> = [],
    additionalTransforms: ReadonlyArray<StringTransform> = []
  ): ValString {
    return new ValString(
      [...this.validators, ...additionalValidators],
      [...this.transforms, ...additionalTransforms]
    );
  }

  // ============================================================================
  // Length Validation Methods
  // ============================================================================

  /**
   * Requires string to be at least `length` characters.
   */
  min(length: number, message?: string): ValString {
    return this.clone([
      (v) =>
        v.length >= length
          ? null
          : createIssue('too_small', message ?? `String must be at least ${length} character(s)`, {
              type: 'string',
              minimum: length,
              inclusive: true,
            }),
    ]);
  }

  /**
   * Requires string to be at most `length` characters.
   */
  max(length: number, message?: string): ValString {
    return this.clone([
      (v) =>
        v.length <= length
          ? null
          : createIssue('too_big', message ?? `String must be at most ${length} character(s)`, {
              type: 'string',
              maximum: length,
              inclusive: true,
            }),
    ]);
  }

  /**
   * Requires string to be exactly `len` characters.
   */
  length(len: number, message?: string): ValString {
    return this.clone([
      (v) =>
        v.length === len
          ? null
          : createIssue('too_small', message ?? `String must be exactly ${len} character(s)`, {
              type: 'string',
              minimum: len,
              inclusive: true,
              exact: true,
            }),
    ]);
  }

  // ============================================================================
  // Format Validation Methods
  // ============================================================================

  /**
   * Validates that the string is a valid email address.
   */
  email(message?: string): ValString {
    return this.clone([
      (v) =>
        EMAIL_REGEX.test(v)
          ? null
          : createIssue('invalid_email', message ?? 'Invalid email address'),
    ]);
  }

  /**
   * Validates that the string is a valid URL.
   */
  url(message?: string): ValString {
    return this.clone([
      (v) =>
        URL_REGEX.test(v)
          ? null
          : createIssue('invalid_url', message ?? 'Invalid URL'),
    ]);
  }

  /**
   * Validates that the string is a valid UUID.
   */
  uuid(message?: string): ValString {
    return this.clone([
      (v) =>
        UUID_REGEX.test(v)
          ? null
          : createIssue('invalid_uuid', message ?? 'Invalid UUID'),
    ]);
  }

  /**
   * Validates that the string is a valid CUID.
   */
  cuid(message?: string): ValString {
    return this.clone([
      (v) =>
        CUID_REGEX.test(v)
          ? null
          : createIssue('invalid_cuid', message ?? 'Invalid CUID'),
    ]);
  }

  /**
   * Validates that the string is a valid CUID2.
   */
  cuid2(message?: string): ValString {
    return this.clone([
      (v) =>
        CUID2_REGEX.test(v)
          ? null
          : createIssue('invalid_cuid2', message ?? 'Invalid CUID2'),
    ]);
  }

  /**
   * Validates that the string is a valid ULID.
   */
  ulid(message?: string): ValString {
    return this.clone([
      (v) =>
        ULID_REGEX.test(v)
          ? null
          : createIssue('invalid_ulid', message ?? 'Invalid ULID'),
    ]);
  }

  /**
   * Validates that the string matches the provided regex pattern.
   */
  regex(pattern: RegExp, message?: string): ValString {
    return this.clone([
      (v) =>
        pattern.test(v)
          ? null
          : createIssue('invalid_regex', message ?? 'String does not match pattern'),
    ]);
  }

  /**
   * Validates that the string is a valid ISO 8601 datetime.
   */
  datetime(message?: string): ValString {
    return this.clone([
      (v) =>
        DATETIME_REGEX.test(v)
          ? null
          : createIssue('invalid_datetime', message ?? 'Invalid datetime format'),
    ]);
  }

  /**
   * Validates that the string is a valid IP address (v4 or v6).
   */
  ip(message?: string): ValString {
    return this.clone([
      (v) =>
        IPV4_REGEX.test(v) || IPV6_REGEX.test(v)
          ? null
          : createIssue('invalid_ip', message ?? 'Invalid IP address'),
    ]);
  }

  // ============================================================================
  // Content Validation Methods
  // ============================================================================

  /**
   * Validates that the string includes the specified substring.
   */
  includes(needle: string, message?: string): ValString {
    return this.clone([
      (v) =>
        v.includes(needle)
          ? null
          : createIssue('invalid_includes', message ?? `String must include "${needle}"`),
    ]);
  }

  /**
   * Validates that the string starts with the specified prefix.
   */
  startsWith(prefix: string, message?: string): ValString {
    return this.clone([
      (v) =>
        v.startsWith(prefix)
          ? null
          : createIssue('invalid_starts_with', message ?? `String must start with "${prefix}"`),
    ]);
  }

  /**
   * Validates that the string ends with the specified suffix.
   */
  endsWith(suffix: string, message?: string): ValString {
    return this.clone([
      (v) =>
        v.endsWith(suffix)
          ? null
          : createIssue('invalid_ends_with', message ?? `String must end with "${suffix}"`),
    ]);
  }

  // ============================================================================
  // Transform Methods
  // ============================================================================

  /**
   * Trims whitespace from both ends of the string.
   */
  trim(): ValString {
    return this.clone([], [(v) => v.trim()]);
  }

  /**
   * Converts the string to lowercase.
   */
  toLowerCase(): ValString {
    return this.clone([], [(v) => v.toLowerCase()]);
  }

  /**
   * Converts the string to uppercase.
   */
  toUpperCase(): ValString {
    return this.clone([], [(v) => v.toUpperCase()]);
  }
}

// ============================================================================
// Number Validator Type
// ============================================================================

type NumberValidator = (value: number) => { issues: Array<{ message: string }> } | null;

// ============================================================================
// ValNumber Class
// ============================================================================

/**
 * Schema for number values with validation methods.
 *
 * Supports chainable methods like `.gt()`, `.gte()`, `.int()`, `.positive()`, etc.
 * Each method returns a new schema instance (immutable).
 *
 * @example
 * ```typescript
 * const ageSchema = v.number().int().positive();
 * const priceSchema = v.number().gte(0).lte(1000);
 * const percentSchema = v.number().gte(0).lte(100);
 * ```
 */
export class ValNumber extends ValSchema<number, number> {
  private readonly validators: ReadonlyArray<NumberValidator>;

  constructor(validators: ReadonlyArray<NumberValidator> = []) {
    const baseValidate = NumberSchema['~standard'].validate as (value: unknown) => ValidationResult<number>;

    // Capture validators for use in closure
    const capturedValidators = validators;

    // Create a wrapped validation function that runs all validators
    const wrappedValidate = (value: unknown): ValidationResult<number> => {
      // First, validate base type
      const baseResult = baseValidate(value);
      if (baseResult.issues !== undefined) {
        return baseResult as ValidationResult<number>;
      }

      // At this point we know baseResult.value is defined
      const validatedValue: number = baseResult.value as number;

      // Then run all validators
      for (let i = 0; i < capturedValidators.length; i++) {
        const validator = capturedValidators[i];
        if (validator !== undefined) {
          const issue = validator(validatedValue);
          if (issue !== null) {
            return issue;
          }
        }
      }

      return success(validatedValue);
    };

    super(
      wrappedValidate,
      (target: string) => NumberSchema['~standard'].jsonSchema.input({ target }),
      (target: string) => NumberSchema['~standard'].jsonSchema.output({ target })
    );

    this.validators = validators;
    this._hasTransforms = validators.length > 0;
  }

  /**
   * Creates a copy of this schema with additional validators.
   */
  private clone(additionalValidators: ReadonlyArray<NumberValidator>): ValNumber {
    return new ValNumber([...this.validators, ...additionalValidators]);
  }

  // ============================================================================
  // Comparison Methods
  // ============================================================================

  /**
   * Requires number to be greater than `value`.
   */
  gt(value: number, message?: string): ValNumber {
    return this.clone([
      (v) =>
        v > value
          ? null
          : createIssue('too_small', message ?? `Number must be greater than ${value}`, {
              type: 'number',
              minimum: value,
              inclusive: false,
            }),
    ]);
  }

  /**
   * Requires number to be greater than or equal to `value`.
   */
  gte(value: number, message?: string): ValNumber {
    return this.clone([
      (v) =>
        v >= value
          ? null
          : createIssue('too_small', message ?? `Number must be greater than or equal to ${value}`, {
              type: 'number',
              minimum: value,
              inclusive: true,
            }),
    ]);
  }

  /**
   * Alias for `gte()`.
   */
  min(value: number, message?: string): ValNumber {
    return this.gte(value, message);
  }

  /**
   * Requires number to be less than `value`.
   */
  lt(value: number, message?: string): ValNumber {
    return this.clone([
      (v) =>
        v < value
          ? null
          : createIssue('too_big', message ?? `Number must be less than ${value}`, {
              type: 'number',
              maximum: value,
              inclusive: false,
            }),
    ]);
  }

  /**
   * Requires number to be less than or equal to `value`.
   */
  lte(value: number, message?: string): ValNumber {
    return this.clone([
      (v) =>
        v <= value
          ? null
          : createIssue('too_big', message ?? `Number must be less than or equal to ${value}`, {
              type: 'number',
              maximum: value,
              inclusive: true,
            }),
    ]);
  }

  /**
   * Alias for `lte()`.
   */
  max(value: number, message?: string): ValNumber {
    return this.lte(value, message);
  }

  // ============================================================================
  // Integer and Sign Methods
  // ============================================================================

  /**
   * Requires number to be an integer.
   */
  int(message?: string): ValNumber {
    return this.clone([
      (v) =>
        Number.isInteger(v)
          ? null
          : createIssue('invalid_type', message ?? 'Number must be an integer'),
    ]);
  }

  /**
   * Requires number to be positive (> 0).
   */
  positive(message?: string): ValNumber {
    return this.clone([
      (v) =>
        v > 0
          ? null
          : createIssue('too_small', message ?? 'Number must be positive', {
              type: 'number',
              minimum: 0,
              inclusive: false,
            }),
    ]);
  }

  /**
   * Requires number to be non-negative (>= 0).
   */
  nonnegative(message?: string): ValNumber {
    return this.clone([
      (v) =>
        v >= 0
          ? null
          : createIssue('too_small', message ?? 'Number must be non-negative', {
              type: 'number',
              minimum: 0,
              inclusive: true,
            }),
    ]);
  }

  /**
   * Requires number to be negative (< 0).
   */
  negative(message?: string): ValNumber {
    return this.clone([
      (v) =>
        v < 0
          ? null
          : createIssue('too_big', message ?? 'Number must be negative', {
              type: 'number',
              maximum: 0,
              inclusive: false,
            }),
    ]);
  }

  /**
   * Requires number to be non-positive (<= 0).
   */
  nonpositive(message?: string): ValNumber {
    return this.clone([
      (v) =>
        v <= 0
          ? null
          : createIssue('too_big', message ?? 'Number must be non-positive', {
              type: 'number',
              maximum: 0,
              inclusive: true,
            }),
    ]);
  }

  // ============================================================================
  // Other Validation Methods
  // ============================================================================

  /**
   * Requires number to be a multiple of `value`.
   *
   * Uses tolerance-based comparison to handle floating point precision issues.
   */
  multipleOf(value: number, message?: string): ValNumber {
    return this.clone([
      (v) => {
        // Handle floating point precision by checking if remainder is close to 0 or close to value
        const remainder = Math.abs(v % value);
        const isMultiple = remainder < Number.EPSILON * 100 || Math.abs(remainder - Math.abs(value)) < Number.EPSILON * 100;
        return isMultiple
          ? null
          : createIssue('not_multiple_of', message ?? `Number must be a multiple of ${value}`, {
              multipleOf: value,
            });
      },
    ]);
  }

  /**
   * Alias for `multipleOf()`.
   */
  step(value: number, message?: string): ValNumber {
    return this.multipleOf(value, message);
  }

  /**
   * Requires number to be finite (not Infinity or -Infinity).
   */
  finite(message?: string): ValNumber {
    return this.clone([
      (v) =>
        Number.isFinite(v)
          ? null
          : createIssue('not_finite', message ?? 'Number must be finite'),
    ]);
  }

  /**
   * Requires number to be a safe integer (within Number.MIN_SAFE_INTEGER to Number.MAX_SAFE_INTEGER).
   */
  safe(message?: string): ValNumber {
    return this.clone([
      (v) =>
        Number.isSafeInteger(v)
          ? null
          : createIssue('not_safe', message ?? 'Number must be a safe integer'),
    ]);
  }
}

/**
 * Schema for bigint values.
 *
 * Validates that the input is a JavaScript BigInt.
 */
export class ValBigInt extends ValSchema<bigint, bigint> {
  constructor() {
    super(
      (value: unknown): ValidationResult<bigint> => {
        if (typeof value !== 'bigint') {
          return createTypeIssue('bigint', value);
        }
        return success(value);
      },
      (_target: string) => ({
        type: 'integer',
        description: 'A BigInt value represented as a JSON integer',
      })
    );
  }
}

/**
 * Schema for boolean values.
 */
export class ValBoolean extends ValSchema<boolean, boolean> {
  constructor() {
    super(
      BooleanSchema['~standard'].validate as (value: unknown) => ValidationResult<boolean>,
      (target: string) => BooleanSchema['~standard'].jsonSchema.input({ target }),
      (target: string) => BooleanSchema['~standard'].jsonSchema.output({ target })
    );
  }
}

/**
 * Schema for Date values.
 *
 * Validates that the input is a valid Date object (not Invalid Date).
 */
export class ValDate extends ValSchema<Date, Date> {
  constructor() {
    super(
      (value: unknown): ValidationResult<Date> => {
        if (!(value instanceof Date)) {
          return createTypeIssue('date', value);
        }
        if (Number.isNaN(value.getTime())) {
          return createIssue('invalid_date', 'Invalid date');
        }
        return success(value);
      },
      (_target: string) => ({
        type: 'string',
        format: 'date-time',
      })
    );
  }
}

/**
 * Schema for undefined values.
 */
export class ValUndefined extends ValSchema<undefined, undefined> {
  constructor() {
    super(
      (value: unknown): ValidationResult<undefined> => {
        if (value !== undefined) {
          return createTypeIssue('undefined', value);
        }
        return success(value);
      },
      (_target: string) => ({
        not: {},
      })
    );
  }

  override isOptional(): boolean {
    return true;
  }
}

/**
 * Schema for null values.
 */
export class ValNull extends ValSchema<null, null> {
  constructor() {
    super(
      (value: unknown): ValidationResult<null> => {
        if (value !== null) {
          return createTypeIssue('null', value);
        }
        return success(value);
      },
      (_target: string) => ({
        type: 'null',
      })
    );
  }

  override isNullable(): boolean {
    return true;
  }
}

/**
 * Schema for void (undefined).
 *
 * Alias for undefined schema, matching Zod's behavior.
 */
export class ValVoid extends ValSchema<void, void> {
  constructor() {
    super(
      (value: unknown): ValidationResult<void> => {
        if (value !== undefined) {
          return createTypeIssue('void', value);
        }
        return success(value);
      },
      (_target: string) => ({
        not: {},
      })
    );
  }
}

/**
 * Schema that accepts any value.
 *
 * Use sparingly - prefer more specific schemas when possible.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class ValAny extends ValSchema<any, any> {
  constructor() {
    super(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (value: unknown): ValidationResult<any> => success(value as any),
      (_target: string) => ({})
    );
  }
}

/**
 * Schema that accepts any value as unknown.
 *
 * Unlike `any`, `unknown` requires type narrowing before use.
 */
export class ValUnknown extends ValSchema<unknown, unknown> {
  constructor() {
    super(
      (value: unknown): ValidationResult<unknown> => success(value),
      (_target: string) => ({})
    );
  }
}

/**
 * Schema that never validates successfully.
 *
 * Useful for exhaustive type checking and unreachable code paths.
 */
export class ValNever extends ValSchema<never, never> {
  constructor() {
    super(
      (value: unknown): ValidationResult<never> => createTypeIssue('never', value),
      (_target: string) => ({
        not: {},
      })
    );
  }
}

// ============================================================================
// Integer Schema Classes (for Phase 2 extensibility)
// ============================================================================

/**
 * Schema for 32-bit signed integers.
 */
export class ValInt32 extends ValSchema<number, number> {
  constructor() {
    super(
      Int32Schema['~standard'].validate as (value: unknown) => ValidationResult<number>,
      (target: string) => Int32Schema['~standard'].jsonSchema.input({ target }),
      (target: string) => Int32Schema['~standard'].jsonSchema.output({ target })
    );
  }
}

/**
 * Schema for 64-bit signed integers.
 */
export class ValInt64 extends ValSchema<number, number> {
  constructor() {
    super(
      Int64Schema['~standard'].validate as (value: unknown) => ValidationResult<number>,
      (target: string) => Int64Schema['~standard'].jsonSchema.input({ target }),
      (target: string) => Int64Schema['~standard'].jsonSchema.output({ target })
    );
  }
}

/**
 * Schema for 32-bit unsigned integers.
 */
export class ValUint32 extends ValSchema<number, number> {
  constructor() {
    super(
      Uint32Schema['~standard'].validate as (value: unknown) => ValidationResult<number>,
      (target: string) => Uint32Schema['~standard'].jsonSchema.input({ target }),
      (target: string) => Uint32Schema['~standard'].jsonSchema.output({ target })
    );
  }
}

/**
 * Schema for 64-bit unsigned integers.
 */
export class ValUint64 extends ValSchema<number, number> {
  constructor() {
    super(
      Uint64Schema['~standard'].validate as (value: unknown) => ValidationResult<number>,
      (target: string) => Uint64Schema['~standard'].jsonSchema.input({ target }),
      (target: string) => Uint64Schema['~standard'].jsonSchema.output({ target })
    );
  }
}

/**
 * Schema for 32-bit floating point numbers.
 */
export class ValFloat32 extends ValSchema<number, number> {
  constructor() {
    super(
      Float32Schema['~standard'].validate as (value: unknown) => ValidationResult<number>,
      (target: string) => Float32Schema['~standard'].jsonSchema.input({ target }),
      (target: string) => Float32Schema['~standard'].jsonSchema.output({ target })
    );
  }
}

/**
 * Schema for 64-bit floating point numbers.
 */
export class ValFloat64 extends ValSchema<number, number> {
  constructor() {
    super(
      Float64Schema['~standard'].validate as (value: unknown) => ValidationResult<number>,
      (target: string) => Float64Schema['~standard'].jsonSchema.input({ target }),
      (target: string) => Float64Schema['~standard'].jsonSchema.output({ target })
    );
  }
}

// ============================================================================
// Object Schema Type Utilities
// ============================================================================

/**
 * A shape is a record of string keys to ValSchema instances.
 */
type Shape = Record<string, ValSchema<unknown, unknown>>;

/**
 * Infers the input type from a shape definition.
 */
type InferShapeInput<T extends Shape> = {
  [K in keyof T]: T[K] extends ValSchema<infer I, unknown> ? I : never;
};

/**
 * Infers the output type from a shape definition.
 */
type InferShapeOutput<T extends Shape> = {
  [K in keyof T]: T[K] extends ValSchema<unknown, infer O> ? O : never;
};

/**
 * Gets the keys that are optional in a shape (schemas that accept undefined).
 */
type OptionalKeys<T extends Shape> = {
  [K in keyof T]: undefined extends InferShapeOutput<T>[K] ? K : never;
}[keyof T];

/**
 * Gets the keys that are required in a shape.
 */
type RequiredKeys<T extends Shape> = Exclude<keyof T, OptionalKeys<T>>;

/**
 * Builds the proper object type with optional keys marked with ?.
 */
type BuildObjectType<T extends Shape> =
  { [K in RequiredKeys<T>]: InferShapeOutput<T>[K] } &
  { [K in OptionalKeys<T>]?: InferShapeOutput<T>[K] };

/**
 * Flatten intersection types for better readability.
 */
type Flatten<T> = { [K in keyof T]: T[K] } & {};

/**
 * Unknown key handling mode for object schemas.
 */
type UnknownKeyMode = 'strip' | 'strict' | 'passthrough';

// ============================================================================
// ValObject Class
// ============================================================================

/**
 * Schema for object values with a defined shape.
 *
 * Supports validation of each property, unknown key handling, and various
 * transformation methods like pick, omit, partial, extend, etc.
 *
 * @template T - The shape definition (record of property schemas)
 *
 * @example
 * ```typescript
 * const User = v.object({
 *   name: v.string(),
 *   age: v.number().int().positive(),
 *   email: v.string().email().optional(),
 * });
 *
 * type User = v.infer<typeof User>;
 * // { name: string; age: number; email?: string }
 *
 * User.parse({ name: 'Alice', age: 30 });
 * ```
 */
export class ValObject<T extends Shape> extends ValSchema<
  Flatten<InferShapeInput<T>>,
  Flatten<BuildObjectType<T>>
> {
  /**
   * The shape definition containing all property schemas.
   */
  readonly shape: T;

  private readonly unknownKeyMode: UnknownKeyMode;
  private readonly catchallSchema: ValSchema<unknown, unknown> | null;

  constructor(
    shape: T,
    unknownKeyMode: UnknownKeyMode = 'strip',
    catchallSchema: ValSchema<unknown, unknown> | null = null
  ) {
    const validateFn = (value: unknown): ValidationResult<Flatten<BuildObjectType<T>>> => {
      // Check if value is an object
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return createTypeIssue('object', value);
      }

      const input = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      const issues: Array<{ code: string; message: string; path?: ReadonlyArray<string | number | { readonly key: string | number }>; [key: string]: unknown }> = [];

      // Track which keys we've processed
      const processedKeys = new Set<string>();

      // Validate each defined property
      for (const key of Object.keys(shape)) {
        processedKeys.add(key);
        const propertySchema = shape[key];
        if (propertySchema === undefined) continue;

        const propertyValue = input[key];

        // Check if property is missing (not present in input)
        if (!(key in input)) {
          // If the property schema accepts undefined, use undefined
          // Otherwise, report a missing required property
          if (propertySchema.isOptional()) {
            // Don't include in result - it's optional and not provided
            continue;
          } else {
            issues.push({ code: 'invalid_type', expected: 'string', received: 'undefined', message: 'Required', path: [key] });
            continue;
          }
        }

        const propertyResult = propertySchema['~standard'].validate(propertyValue);
        if (propertyResult.issues !== undefined) {
          for (const issue of propertyResult.issues) {
            const issueWithCode = issue as { code?: string; message: string; path?: ReadonlyArray<unknown>; [key: string]: unknown };
            issues.push({
              code: issueWithCode.code ?? 'custom',
              message: issue.message,
              path: [key, ...(issue.path ?? [])],
              ...Object.fromEntries(Object.entries(issueWithCode).filter(([k]) => !['code', 'message', 'path'].includes(k))),
            });
          }
        } else {
          result[key] = propertyResult.value;
        }
      }

      // Handle unknown keys
      for (const key of Object.keys(input)) {
        if (processedKeys.has(key)) continue;

        if (unknownKeyMode === 'strict') {
          issues.push({ code: 'unrecognized_keys', keys: [key], message: `Unrecognized key(s) in object: '${key}'`, path: [] });
        } else if (unknownKeyMode === 'passthrough') {
          result[key] = input[key];
        } else if (catchallSchema !== null) {
          // Validate unknown keys with catchall schema
          const catchallResult = catchallSchema['~standard'].validate(input[key]);
          if (catchallResult.issues !== undefined) {
            for (const issue of catchallResult.issues) {
              const issueWithCode = issue as { code?: string; message: string; path?: ReadonlyArray<unknown>; [key: string]: unknown };
              issues.push({
                code: issueWithCode.code ?? 'custom',
                message: issue.message,
                path: [key, ...(issue.path ?? [])],
                ...Object.fromEntries(Object.entries(issueWithCode).filter(([k]) => !['code', 'message', 'path'].includes(k))),
              });
            }
          } else {
            result[key] = catchallResult.value;
          }
        }
        // 'strip' mode: just don't include the key
      }

      if (issues.length > 0) {
        return { issues };
      }

      return success(result as Flatten<BuildObjectType<T>>);
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const properties: Record<string, Record<string, unknown>> = {};
      const required: string[] = [];

      for (const key of Object.keys(shape)) {
        const propertySchema = shape[key];
        if (propertySchema === undefined) continue;

        properties[key] = propertySchema['~standard'].jsonSchema.input({ target });

        if (!propertySchema.isOptional()) {
          required.push(key);
        }
      }

      const jsonSchema: Record<string, unknown> = {
        type: 'object',
        properties,
      };

      if (required.length > 0) {
        jsonSchema['required'] = required;
      }

      if (unknownKeyMode === 'strict') {
        jsonSchema['additionalProperties'] = false;
      } else if (catchallSchema !== null) {
        jsonSchema['additionalProperties'] = catchallSchema['~standard'].jsonSchema.input({ target });
      }

      return jsonSchema;
    };

    super(validateFn, inputJsonSchemaFn);
    this.shape = shape;
    this.unknownKeyMode = unknownKeyMode;
    this.catchallSchema = catchallSchema;
    this._hasTransforms = Object.values(shape).some(s => s._hasTransforms);
  }

  // ============================================================================
  // Object Transformation Methods
  // ============================================================================

  /**
   * Extends the object schema with additional properties.
   *
   * @param augmentation - Additional property schemas to add
   * @returns A new object schema with the combined shape
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string() });
   * const Admin = User.extend({ role: v.string() });
   * // { name: string; role: string }
   * ```
   */
  extend<U extends Shape>(augmentation: U): ValObject<Flatten<T & U>> {
    return new ValObject(
      { ...this.shape, ...augmentation } as Flatten<T & U>,
      this.unknownKeyMode,
      this.catchallSchema
    );
  }

  /**
   * Merges this object schema with another object schema.
   *
   * Properties from the other schema override properties in this schema.
   *
   * @param other - Another object schema to merge with
   * @returns A new object schema with the merged shape
   *
   * @example
   * ```typescript
   * const A = v.object({ a: v.string(), shared: v.number() });
   * const B = v.object({ b: v.boolean(), shared: v.string() });
   * const Merged = A.merge(B);
   * // { a: string; b: boolean; shared: string }
   * ```
   */
  merge<U extends Shape>(other: ValObject<U>): ValObject<Flatten<T & U>> {
    return new ValObject(
      { ...this.shape, ...other.shape } as Flatten<T & U>,
      this.unknownKeyMode,
      this.catchallSchema
    );
  }

  /**
   * Creates a new schema with only the specified keys.
   *
   * @param mask - An object with keys to pick (values should be true)
   * @returns A new object schema with only the picked keys
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string(), age: v.number(), email: v.string() });
   * const NameOnly = User.pick({ name: true });
   * // { name: string }
   * ```
   */
  pick<K extends keyof T>(mask: { [key in K]: true }): ValObject<Pick<T, K>> {
    const newShape: Partial<T> = {};
    for (const key of Object.keys(mask) as K[]) {
      if (key in this.shape) {
        newShape[key] = this.shape[key];
      }
    }
    return new ValObject(newShape as Pick<T, K>, this.unknownKeyMode, this.catchallSchema);
  }

  /**
   * Creates a new schema without the specified keys.
   *
   * @param mask - An object with keys to omit (values should be true)
   * @returns A new object schema without the omitted keys
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string(), age: v.number(), email: v.string() });
   * const WithoutEmail = User.omit({ email: true });
   * // { name: string; age: number }
   * ```
   */
  omit<K extends keyof T>(mask: { [key in K]: true }): ValObject<Omit<T, K>> {
    const newShape: Partial<T> = {};
    const keysToOmit = new Set(Object.keys(mask));
    for (const key of Object.keys(this.shape)) {
      if (!keysToOmit.has(key)) {
        newShape[key as keyof T] = this.shape[key as keyof T];
      }
    }
    return new ValObject(newShape as Omit<T, K>, this.unknownKeyMode, this.catchallSchema);
  }

  /**
   * Makes all properties optional.
   *
   * @returns A new object schema where all properties are optional
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string(), age: v.number() });
   * const PartialUser = User.partial();
   * // { name?: string; age?: number }
   * ```
   */
  partial(): ValObject<{ [K in keyof T]: ReturnType<T[K]['optional']> }> {
    const newShape: Record<string, ValSchema<unknown, unknown>> = {};
    for (const key of Object.keys(this.shape)) {
      const schema = this.shape[key];
      if (schema !== undefined) {
        newShape[key] = schema.optional();
      }
    }
    return new ValObject(
      newShape as { [K in keyof T]: ReturnType<T[K]['optional']> },
      this.unknownKeyMode,
      this.catchallSchema
    );
  }

  /**
   * Makes all properties deeply optional (recursive).
   *
   * For nested objects, this recursively applies partial().
   *
   * @returns A new object schema where all properties are deeply optional
   *
   * @example
   * ```typescript
   * const User = v.object({
   *   name: v.string(),
   *   address: v.object({ city: v.string(), zip: v.string() }),
   * });
   * const DeepPartialUser = User.deepPartial();
   * // { name?: string; address?: { city?: string; zip?: string } }
   * ```
   */
  deepPartial(): ValObject<{ [K in keyof T]: ReturnType<T[K]['optional']> }> {
    const newShape: Record<string, ValSchema<unknown, unknown>> = {};
    for (const key of Object.keys(this.shape)) {
      const schema = this.shape[key];
      if (schema === undefined) continue;

      if (schema instanceof ValObject) {
        // Recursively apply deepPartial to nested objects
        newShape[key] = schema.deepPartial().optional();
      } else {
        newShape[key] = schema.optional();
      }
    }
    return new ValObject(
      newShape as { [K in keyof T]: ReturnType<T[K]['optional']> },
      this.unknownKeyMode,
      this.catchallSchema
    );
  }

  /**
   * Makes all properties required (removes optional).
   *
   * @returns A new object schema where all properties are required
   *
   * @example
   * ```typescript
   * const PartialUser = v.object({ name: v.string().optional(), age: v.number().optional() });
   * const User = PartialUser.required();
   * // { name: string; age: number }
   * ```
   */
  required(): ValObject<{ [K in keyof T]: ValSchema<unknown, Exclude<InferShapeOutput<T>[K], undefined>> }> {
    const newShape: Record<string, ValSchema<unknown, unknown>> = {};
    for (const key of Object.keys(this.shape)) {
      const schema = this.shape[key];
      if (schema === undefined) continue;

      // Create a wrapper that rejects undefined
      newShape[key] = new ValSchema<unknown, unknown>(
        (value: unknown): ValidationResult<unknown> => {
          if (value === undefined) {
            return fail('Required');
          }
          return schema['~standard'].validate(value);
        },
        (target: string) => schema['~standard'].jsonSchema.input({ target }),
        (target: string) => schema['~standard'].jsonSchema.output({ target })
      );
    }
    return new ValObject(
      newShape as { [K in keyof T]: ValSchema<unknown, Exclude<InferShapeOutput<T>[K], undefined>> },
      this.unknownKeyMode,
      this.catchallSchema
    );
  }

  // ============================================================================
  // Unknown Key Handling Methods
  // ============================================================================

  /**
   * Allows unknown keys to pass through without validation.
   *
   * @returns A new object schema that preserves unknown keys
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string() }).passthrough();
   * User.parse({ name: 'Alice', extra: 'value' });
   * // { name: 'Alice', extra: 'value' }
   * ```
   */
  passthrough(): ValObject<T> {
    return new ValObject(this.shape, 'passthrough', null);
  }

  /**
   * Rejects any unknown keys (throws validation error).
   *
   * @returns A new object schema that rejects unknown keys
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string() }).strict();
   * User.parse({ name: 'Alice', extra: 'value' }); // throws
   * ```
   */
  strict(): ValObject<T> {
    return new ValObject(this.shape, 'strict', null);
  }

  /**
   * Silently removes unknown keys (default behavior).
   *
   * @returns A new object schema that strips unknown keys
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string() }).strip();
   * User.parse({ name: 'Alice', extra: 'value' });
   * // { name: 'Alice' }
   * ```
   */
  strip(): ValObject<T> {
    return new ValObject(this.shape, 'strip', null);
  }

  /**
   * Validates unknown keys with the provided schema.
   *
   * @param schema - Schema to validate unknown keys with
   * @returns A new object schema that validates unknown keys
   *
   * @example
   * ```typescript
   * const Metadata = v.object({ id: v.string() }).catchall(v.number());
   * Metadata.parse({ id: 'abc', count: 42, score: 100 });
   * // { id: 'abc', count: 42, score: 100 }
   * ```
   */
  catchall<U>(schema: ValSchema<unknown, U>): ValObject<T> {
    return new ValObject(this.shape, 'strip', schema);
  }

  /**
   * Returns a schema that validates to a union of the object's literal keys.
   *
   * @returns A schema for the object's keys as literals
   *
   * @example
   * ```typescript
   * const User = v.object({ name: v.string(), age: v.number() });
   * const UserKey = User.keyof();
   * UserKey.parse('name'); // 'name'
   * UserKey.parse('age');  // 'age'
   * UserKey.parse('email'); // throws
   * ```
   */
  keyof(): ValLiteral<keyof T & string> {
    const keys = Object.keys(this.shape) as Array<keyof T & string>;
    return new ValLiteral(keys);
  }
}

// ============================================================================
// ValLiteral Class (for keyof)
// ============================================================================

/**
 * Schema for literal union values.
 *
 * Used by object.keyof() to create a schema that validates to one of the
 * object's keys.
 *
 * @template T - The union of literal values
 */
export class ValLiteral<T extends string> extends ValSchema<T, T> {
  readonly values: ReadonlyArray<T>;

  constructor(values: ReadonlyArray<T>) {
    const validateFn = (value: unknown): ValidationResult<T> => {
      if (typeof value !== 'string') {
        return fail(`Expected one of: ${values.join(', ')}`);
      }
      if (!values.includes(value as T)) {
        return fail(`Expected one of: ${values.join(', ')}`);
      }
      return success(value as T);
    };

    const jsonSchemaFn = (_target: string): Record<string, unknown> => ({
      type: 'string',
      enum: values,
    });

    super(validateFn, jsonSchemaFn);
    this.values = values;
  }
}

// Re-export ValArray, ValUnion, ValIntersection from schema.ts
export { ValArray, ValUnion, ValIntersection } from './schema';

/**
 * Helper type to infer input type from a schema.
 */
type InferSchemaInput<T extends ValSchema<unknown, unknown>> = T extends ValSchema<infer I, unknown> ? I : never;

/**
 * Helper type to infer output type from a schema.
 */
type InferSchemaOutput<T extends ValSchema<unknown, unknown>> = T extends ValSchema<unknown, infer O> ? O : never;

// ============================================================================
// ValTuple Class
// ============================================================================

/**
 * Infers tuple input type from an array of schemas.
 */
type InferTupleInput<T extends ReadonlyArray<ValSchema<unknown, unknown>>> = {
  [K in keyof T]: T[K] extends ValSchema<infer I, unknown> ? I : never;
};

/**
 * Infers tuple output type from an array of schemas.
 */
type InferTupleOutput<T extends ReadonlyArray<ValSchema<unknown, unknown>>> = {
  [K in keyof T]: T[K] extends ValSchema<unknown, infer O> ? O : never;
};

/**
 * Schema for tuple values with fixed element types.
 *
 * @template T - The array of element schemas
 *
 * @example
 * ```typescript
 * const schema = v.tuple([v.string(), v.number()]);
 * schema.parse(['hello', 42]); // ['hello', 42]
 *
 * type Tuple = v.infer<typeof schema>; // [string, number]
 * ```
 */
export class ValTuple<
  T extends ReadonlyArray<ValSchema<unknown, unknown>>,
  R extends ValSchema<unknown, unknown> | null = null
> extends ValSchema<
  R extends ValSchema<infer RI, unknown>
    ? [...InferTupleInput<T>, ...RI[]]
    : InferTupleInput<T>,
  R extends ValSchema<unknown, infer RO>
    ? [...InferTupleOutput<T>, ...RO[]]
    : InferTupleOutput<T>
> {
  readonly items: T;

  constructor(items: T, restSchema: R = null as R) {
    type OutputType = R extends ValSchema<unknown, infer RO>
      ? [...InferTupleOutput<T>, ...RO[]]
      : InferTupleOutput<T>;

    const validateFn = (value: unknown): ValidationResult<OutputType> => {
      if (!Array.isArray(value)) {
        return createTypeIssue('array', value);
      }

      const minLength = items.length;
      if (restSchema === null && value.length !== minLength) {
        return createIssue('too_small', `Expected tuple of length ${minLength}`, { type: 'array', minimum: minLength, inclusive: true, exact: true });
      }
      if (restSchema !== null && value.length < minLength) {
        return createIssue('too_small', `Expected at least ${minLength} elements`, { type: 'array', minimum: minLength, inclusive: true });
      }

      const result: unknown[] = [];
      const issues: Array<{ code: string; message: string; path?: ReadonlyArray<string | number | { readonly key: string | number }>; [key: string]: unknown }> = [];

      // Validate fixed elements
      for (let i = 0; i < items.length; i++) {
        const elementSchema = items[i];
        if (elementSchema === undefined) continue;

        const elementResult = elementSchema['~standard'].validate(value[i]);
        if (elementResult.issues !== undefined) {
          for (const issue of elementResult.issues) {
            const issueWithCode = issue as { code?: string; message: string; path?: ReadonlyArray<unknown>; [key: string]: unknown };
            issues.push({
              code: issueWithCode.code ?? 'custom',
              message: issue.message,
              path: [i, ...(issue.path ?? [])],
              ...Object.fromEntries(Object.entries(issueWithCode).filter(([k]) => !['code', 'message', 'path'].includes(k))),
            });
          }
        } else {
          result.push(elementResult.value);
        }
      }

      // Validate rest elements
      if (restSchema !== null) {
        for (let i = items.length; i < value.length; i++) {
          const elementResult = restSchema['~standard'].validate(value[i]);
          if (elementResult.issues !== undefined) {
            for (const issue of elementResult.issues) {
              const issueWithCode = issue as { code?: string; message: string; path?: ReadonlyArray<unknown>; [key: string]: unknown };
              issues.push({
                code: issueWithCode.code ?? 'custom',
                message: issue.message,
                path: [i, ...(issue.path ?? [])],
                ...Object.fromEntries(Object.entries(issueWithCode).filter(([k]) => !['code', 'message', 'path'].includes(k))),
              });
            }
          } else {
            result.push(elementResult.value);
          }
        }
      }

      if (issues.length > 0) {
        return { issues };
      }

      return success(result as OutputType);
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const prefixItems = items.map((s) => s['~standard'].jsonSchema.input({ target }));
      const schema: Record<string, unknown> = {
        type: 'array',
        prefixItems,
        minItems: items.length,
      };
      if (restSchema === null) {
        schema['maxItems'] = items.length;
      } else {
        schema['items'] = restSchema['~standard'].jsonSchema.input({ target });
      }
      return schema;
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const prefixItems = items.map((s) => s['~standard'].jsonSchema.output({ target }));
      const schema: Record<string, unknown> = {
        type: 'array',
        prefixItems,
        minItems: items.length,
      };
      if (restSchema === null) {
        schema['maxItems'] = items.length;
      } else {
        schema['items'] = restSchema['~standard'].jsonSchema.output({ target });
      }
      return schema;
    };

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.items = items;
  }

  /**
   * Adds a rest element type to the tuple.
   *
   * @example
   * ```typescript
   * const schema = v.tuple([v.string()]).rest(v.number());
   * schema.parse(['hello', 1, 2, 3]); // ['hello', 1, 2, 3]
   *
   * type T = v.infer<typeof schema>; // [string, ...number[]]
   * ```
   */
  rest<RNew extends ValSchema<unknown, unknown>>(restSchema: RNew): ValTuple<T, RNew> {
    return new ValTuple(this.items, restSchema);
  }
}

// ============================================================================
// Type helpers for unions
// ============================================================================

/**
 * Infers union input type from an array of schemas.
 */
type InferUnionInput<T extends ReadonlyArray<ValSchema<unknown, unknown>>> = T[number] extends ValSchema<infer I, unknown> ? I : never;

/**
 * Infers union output type from an array of schemas.
 */
type InferUnionOutput<T extends ReadonlyArray<ValSchema<unknown, unknown>>> = T[number] extends ValSchema<unknown, infer O> ? O : never;

// ============================================================================
// ValDiscriminatedUnion Class
// ============================================================================

/**
 * Schema for discriminated union types (tagged unions).
 *
 * Provides better error messages by identifying the discriminator first.
 *
 * @example
 * ```typescript
 * const schema = v.discriminatedUnion('type', [
 *   v.object({ type: v.literal('a'), value: v.string() }),
 *   v.object({ type: v.literal('b'), count: v.number() }),
 * ]);
 *
 * schema.parse({ type: 'a', value: 'hello' }); // OK
 * schema.parse({ type: 'b', count: 42 });      // OK
 * ```
 */
export class ValDiscriminatedUnion<
  D extends string,
  T extends ReadonlyArray<ValObject<Shape>>
> extends ValSchema<
  InferUnionInput<T>,
  InferUnionOutput<T>
> {
  readonly discriminator: D;
  readonly options: T;

  constructor(discriminator: D, options: T) {
    const validateFn = (value: unknown): ValidationResult<InferUnionOutput<T>> => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return createTypeIssue('object', value);
      }

      const input = value as Record<string, unknown>;
      const discriminatorValue = input[discriminator];

      if (discriminatorValue === undefined) {
        return createIssue('invalid_union_discriminator', `Missing discriminator property "${discriminator}"`, { options: [] });
      }

      // Find matching variant
      for (const option of options) {
        const discriminatorSchema = option.shape[discriminator];
        if (discriminatorSchema === undefined) continue;

        const discriminatorResult = discriminatorSchema['~standard'].validate(discriminatorValue);
        if (discriminatorResult.issues === undefined) {
          // This variant's discriminator matches, validate the full object
          const result = option['~standard'].validate(value);
          return result as ValidationResult<InferUnionOutput<T>>;
        }
      }

      // Build list of expected discriminator values for error message
      const expectedValues: (string | number)[] = [];
      for (const option of options) {
        const discSchema = option.shape[discriminator];
        if (discSchema instanceof ValLiteralValue) {
          const val = discSchema.value;
          if (typeof val === 'string' || typeof val === 'number') {
            expectedValues.push(val);
          }
        }
      }

      return createIssue(
        'invalid_union_discriminator',
        `Invalid discriminator value. Expected one of: ${expectedValues.join(', ')}, got: ${String(discriminatorValue)}`,
        { options: expectedValues }
      );
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      oneOf: options.map((o) => o['~standard'].jsonSchema.input({ target })),
      discriminator: { propertyName: discriminator },
    });

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      oneOf: options.map((o) => o['~standard'].jsonSchema.output({ target })),
      discriminator: { propertyName: discriminator },
    });

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.discriminator = discriminator;
    this.options = options;
  }
}

// ============================================================================
// ValRecord Class
// ============================================================================

/**
 * Schema for record/dictionary values with string keys.
 *
 * @template K - Key schema (must be string)
 * @template V - Value schema
 *
 * @example
 * ```typescript
 * const schema = v.record(v.string());
 * schema.parse({ a: 'hello', b: 'world' }); // OK
 *
 * const typedRecord = v.record(v.string(), v.number());
 * typedRecord.parse({ count: 42, score: 100 }); // OK
 * ```
 */
export class ValRecord<
  K extends ValSchema<string, string>,
  V extends ValSchema<unknown, unknown>
> extends ValSchema<
  Record<InferSchemaOutput<K>, InferSchemaInput<V>>,
  Record<InferSchemaOutput<K>, InferSchemaOutput<V>>
> {
  readonly keySchema: K;
  readonly valueSchema: V;

  constructor(keySchema: K, valueSchema: V) {
    type OutputType = Record<InferSchemaOutput<K>, InferSchemaOutput<V>>;

    const validateFn = (value: unknown): ValidationResult<OutputType> => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return createTypeIssue('object', value);
      }

      const input = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      const issues: Array<{ code: string; message: string; path?: ReadonlyArray<string | number | { readonly key: string | number }>; [key: string]: unknown }> = [];

      for (const key of Object.keys(input)) {
        // Validate key
        const keyResult = keySchema['~standard'].validate(key);
        if (keyResult.issues !== undefined) {
          for (const issue of keyResult.issues) {
            const issueWithCode = issue as { code?: string; message: string; [key: string]: unknown };
            issues.push({
              code: issueWithCode.code ?? 'custom',
              message: `Invalid key "${key}": ${issue.message}`,
              path: [key],
            });
          }
          continue;
        }

        // Validate value
        const valueResult = valueSchema['~standard'].validate(input[key]);
        if (valueResult.issues !== undefined) {
          for (const issue of valueResult.issues) {
            const issueWithCode = issue as { code?: string; message: string; path?: ReadonlyArray<unknown>; [key: string]: unknown };
            issues.push({
              code: issueWithCode.code ?? 'custom',
              message: issue.message,
              path: [key, ...(issue.path ?? [])],
              ...Object.fromEntries(Object.entries(issueWithCode).filter(([k]) => !['code', 'message', 'path'].includes(k))),
            });
          }
        } else {
          result[keyResult.value as string] = valueResult.value;
        }
      }

      if (issues.length > 0) {
        return { issues };
      }

      return success(result as OutputType);
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      type: 'object',
      additionalProperties: valueSchema['~standard'].jsonSchema.input({ target }),
    });

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      type: 'object',
      additionalProperties: valueSchema['~standard'].jsonSchema.output({ target }),
    });

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.keySchema = keySchema;
    this.valueSchema = valueSchema;
  }
}

// ============================================================================
// ValMap Class
// ============================================================================

/**
 * Schema for JavaScript Map objects.
 *
 * @template K - Key schema
 * @template V - Value schema
 *
 * @example
 * ```typescript
 * const schema = v.map(v.string(), v.number());
 * const map = new Map([['a', 1], ['b', 2]]);
 * schema.parse(map); // Map { 'a' => 1, 'b' => 2 }
 * ```
 */
export class ValMap<
  K extends ValSchema<unknown, unknown>,
  V extends ValSchema<unknown, unknown>
> extends ValSchema<
  Map<InferSchemaInput<K>, InferSchemaInput<V>>,
  Map<InferSchemaOutput<K>, InferSchemaOutput<V>>
> {
  readonly keySchema: K;
  readonly valueSchema: V;

  constructor(keySchema: K, valueSchema: V) {
    type OutputType = Map<InferSchemaOutput<K>, InferSchemaOutput<V>>;

    const validateFn = (value: unknown): ValidationResult<OutputType> => {
      if (!(value instanceof Map)) {
        return createTypeIssue('map', value);
      }

      const result = new Map<InferSchemaOutput<K>, InferSchemaOutput<V>>();
      const issues: Array<{ code: string; message: string; path?: ReadonlyArray<string | number | { readonly key: string | number }>; [key: string]: unknown }> = [];

      let index = 0;
      for (const [k, v] of value.entries()) {
        const keyResult = keySchema['~standard'].validate(k);
        if (keyResult.issues !== undefined) {
          for (const issue of keyResult.issues) {
            const issueWithCode = issue as { code?: string; message: string; [key: string]: unknown };
            issues.push({
              code: issueWithCode.code ?? 'custom',
              message: `Invalid key at index ${index}: ${issue.message}`,
              path: [index, 'key', ...(issue.path ?? [])],
            });
          }
        }

        const valueResult = valueSchema['~standard'].validate(v);
        if (valueResult.issues !== undefined) {
          for (const issue of valueResult.issues) {
            const issueWithCode = issue as { code?: string; message: string; path?: ReadonlyArray<unknown>; [key: string]: unknown };
            issues.push({
              code: issueWithCode.code ?? 'custom',
              message: issue.message,
              path: [index, 'value', ...(issue.path ?? [])],
              ...Object.fromEntries(Object.entries(issueWithCode).filter(([k]) => !['code', 'message', 'path'].includes(k))),
            });
          }
        }

        if (keyResult.issues === undefined && valueResult.issues === undefined) {
          result.set(keyResult.value as InferSchemaOutput<K>, valueResult.value as InferSchemaOutput<V>);
        }
        index++;
      }

      if (issues.length > 0) {
        return { issues };
      }

      return success(result);
    };

    const jsonSchemaFn = (target: string): Record<string, unknown> => ({
      type: 'array',
      items: {
        type: 'array',
        prefixItems: [
          keySchema['~standard'].jsonSchema.input({ target }),
          valueSchema['~standard'].jsonSchema.input({ target }),
        ],
        minItems: 2,
        maxItems: 2,
      },
      description: 'Map represented as array of [key, value] tuples',
    });

    super(validateFn, jsonSchemaFn);
    this.keySchema = keySchema;
    this.valueSchema = valueSchema;
  }
}

// ============================================================================
// ValSet Class
// ============================================================================

/**
 * Schema for JavaScript Set objects.
 *
 * @template V - Value schema
 *
 * @example
 * ```typescript
 * const schema = v.set(v.string());
 * schema.parse(new Set(['a', 'b', 'c'])); // Set { 'a', 'b', 'c' }
 * ```
 */
export class ValSet<V extends ValSchema<unknown, unknown>> extends ValSchema<
  Set<InferSchemaInput<V>>,
  Set<InferSchemaOutput<V>>
> {
  readonly valueSchema: V;

  constructor(valueSchema: V) {
    type OutputType = Set<InferSchemaOutput<V>>;

    const validateFn = (value: unknown): ValidationResult<OutputType> => {
      if (!(value instanceof Set)) {
        return createTypeIssue('set', value);
      }

      const result = new Set<InferSchemaOutput<V>>();
      const issues: Array<{ code: string; message: string; path?: ReadonlyArray<string | number | { readonly key: string | number }>; [key: string]: unknown }> = [];

      let index = 0;
      for (const item of value) {
        const itemResult = valueSchema['~standard'].validate(item);
        if (itemResult.issues !== undefined) {
          for (const issue of itemResult.issues) {
            const issueWithCode = issue as { code?: string; message: string; path?: ReadonlyArray<unknown>; [key: string]: unknown };
            issues.push({
              code: issueWithCode.code ?? 'custom',
              message: issue.message,
              path: [index, ...(issue.path ?? [])],
              ...Object.fromEntries(Object.entries(issueWithCode).filter(([k]) => !['code', 'message', 'path'].includes(k))),
            });
          }
        } else {
          result.add(itemResult.value as InferSchemaOutput<V>);
        }
        index++;
      }

      if (issues.length > 0) {
        return { issues };
      }

      return success(result);
    };

    const jsonSchemaFn = (target: string): Record<string, unknown> => ({
      type: 'array',
      items: valueSchema['~standard'].jsonSchema.input({ target }),
      uniqueItems: true,
      description: 'Set represented as array with unique items',
    });

    super(validateFn, jsonSchemaFn);
    this.valueSchema = valueSchema;
  }
}

// ============================================================================
// ValLiteralValue Class (for single literal values)
// ============================================================================

/**
 * Allowed literal types.
 */
type LiteralValue = string | number | boolean | null | undefined;

/**
 * Schema for a single literal value.
 *
 * @template T - The literal type
 *
 * @example
 * ```typescript
 * const schema = v.literal('hello');
 * schema.parse('hello'); // 'hello'
 * schema.parse('world'); // throws
 *
 * type Hello = v.infer<typeof schema>; // 'hello'
 * ```
 */
export class ValLiteralValue<T extends LiteralValue> extends ValSchema<T, T> {
  readonly value: T;

  constructor(literalValue: T) {
    const validateFn = (value: unknown): ValidationResult<T> => {
      if (value !== literalValue) {
        return fail(`Expected literal ${JSON.stringify(literalValue)}`);
      }
      return success(value as T);
    };

    const jsonSchemaFn = (_target: string): Record<string, unknown> => {
      if (literalValue === null) {
        return { type: 'null' };
      }
      if (literalValue === undefined) {
        return { not: {} };
      }
      return { const: literalValue };
    };

    super(validateFn, jsonSchemaFn);
    this.value = literalValue;
  }
}

// ============================================================================
// ValEnum Class
// ============================================================================

/**
 * Schema for enum values (one of a fixed set of string literals).
 *
 * @template T - Tuple of allowed string values
 *
 * @example
 * ```typescript
 * const RoleSchema = v.enum(['admin', 'user', 'guest']);
 * RoleSchema.parse('admin'); // 'admin'
 * RoleSchema.parse('other'); // throws
 *
 * type Role = v.infer<typeof RoleSchema>; // 'admin' | 'user' | 'guest'
 * ```
 */
export class ValEnum<T extends readonly [string, ...string[]]> extends ValSchema<T[number], T[number]> {
  readonly options: T;
  /** Enum-like object mapping values to themselves */
  readonly enum: { [K in T[number]]: K };

  constructor(values: T) {
    const validateFn = (value: unknown): ValidationResult<T[number]> => {
      if (typeof value !== 'string') {
        return fail(`Expected one of: ${values.join(', ')}`);
      }
      if (!values.includes(value)) {
        return fail(`Expected one of: ${values.join(', ')}, got: "${value}"`);
      }
      return success(value as T[number]);
    };

    const jsonSchemaFn = (_target: string): Record<string, unknown> => ({
      type: 'string',
      enum: [...values],
    });

    super(validateFn, jsonSchemaFn);
    this.options = values;
    // Create enum-like object
    this.enum = Object.fromEntries(values.map((v) => [v, v])) as { [K in T[number]]: K };
  }
}

// ============================================================================
// ValNativeEnum Class
// ============================================================================

/**
 * Gets the values of a TypeScript enum.
 */
type EnumLike = { [k: string]: string | number; [nu: number]: string };

/**
 * Schema for TypeScript native enums.
 *
 * @template T - The enum type
 *
 * @example
 * ```typescript
 * enum Status { Active, Inactive }
 * const schema = v.nativeEnum(Status);
 * schema.parse(Status.Active); // 0
 * schema.parse('Active');      // throws (numeric enum)
 * ```
 */
export class ValNativeEnum<T extends EnumLike> extends ValSchema<T[keyof T], T[keyof T]> {
  readonly enumObject: T;

  constructor(enumObj: T) {
    // Get the actual values from the enum
    const values = Object.values(enumObj).filter((v) => typeof v === 'number' || typeof v === 'string');
    // For numeric enums, TypeScript creates reverse mappings, so we need to filter
    const numericValues = values.filter((v) => typeof v === 'number');
    const actualValues = numericValues.length > 0 ? numericValues : values;

    const validateFn = (value: unknown): ValidationResult<T[keyof T]> => {
      if (!actualValues.includes(value as string | number)) {
        return fail(`Invalid enum value. Expected one of: ${actualValues.join(', ')}`);
      }
      return success(value as T[keyof T]);
    };

    const jsonSchemaFn = (_target: string): Record<string, unknown> => ({
      enum: actualValues,
    });

    super(validateFn, jsonSchemaFn);
    this.enumObject = enumObj;
  }
}

// ============================================================================
// Object Builder Function
// ============================================================================

/**
 * Creates an object schema from a shape definition.
 *
 * @param shape - An object mapping property names to their schemas
 * @returns A new object schema
 *
 * @example
 * ```typescript
 * const User = v.object({
 *   name: v.string(),
 *   age: v.number().int().positive(),
 *   email: v.string().email().optional(),
 * });
 *
 * type User = v.infer<typeof User>;
 * // { name: string; age: number; email?: string }
 *
 * const user = User.parse({ name: 'Alice', age: 30 });
 * ```
 */
export function object<T extends Shape>(shape: T): ValObject<T> {
  return new ValObject(shape);
}

// ============================================================================
// Schema Builder Functions
// ============================================================================

/**
 * Creates a string schema.
 *
 * @returns A new string schema
 *
 * @example
 * ```typescript
 * const nameSchema = v.string();
 * nameSchema.parse('Alice'); // 'Alice'
 * nameSchema.parse(123);     // throws ValError
 * ```
 */
export function string(): ValString {
  return new ValString();
}

/**
 * Creates a number schema.
 *
 * @returns A new number schema
 *
 * @example
 * ```typescript
 * const ageSchema = v.number();
 * ageSchema.parse(25);     // 25
 * ageSchema.parse('25');   // throws ValError
 * ```
 */
export function number(): ValNumber {
  return new ValNumber();
}

/**
 * Creates a bigint schema.
 *
 * @returns A new bigint schema
 *
 * @example
 * ```typescript
 * const bigSchema = v.bigint();
 * bigSchema.parse(123n);   // 123n
 * bigSchema.parse(123);    // throws ValError
 * ```
 */
export function bigint(): ValBigInt {
  return new ValBigInt();
}

/**
 * Creates a boolean schema.
 *
 * @returns A new boolean schema
 *
 * @example
 * ```typescript
 * const flagSchema = v.boolean();
 * flagSchema.parse(true);   // true
 * flagSchema.parse('true'); // throws ValError
 * ```
 */
function booleanFn(): ValBoolean {
  return new ValBoolean();
}

// Export as 'boolean' (reserved word workaround)
export { booleanFn as boolean };

/**
 * Creates a date schema.
 *
 * @returns A new date schema
 *
 * @example
 * ```typescript
 * const dateSchema = v.date();
 * dateSchema.parse(new Date());        // Date object
 * dateSchema.parse('2024-01-01');      // throws ValError
 * ```
 */
export function date(): ValDate {
  return new ValDate();
}

/**
 * Creates an undefined schema.
 *
 * @returns A new undefined schema
 */
function undefinedFn(): ValUndefined {
  return new ValUndefined();
}

// Export as 'undefined' (reserved word workaround)
export { undefinedFn as undefined };

/**
 * Creates a null schema.
 *
 * @returns A new null schema
 */
function nullFn(): ValNull {
  return new ValNull();
}

// Export as 'null' (reserved word workaround)
export { nullFn as null };

/**
 * Creates a void schema (alias for undefined).
 *
 * @returns A new void schema
 */
function voidFn(): ValVoid {
  return new ValVoid();
}

// Export as 'void' (reserved word workaround)
export { voidFn as void };

/**
 * Creates an any schema.
 *
 * Use sparingly - prefer more specific schemas when possible.
 *
 * @returns A new any schema
 */
export function any(): ValAny {
  return new ValAny();
}

/**
 * Creates an unknown schema.
 *
 * Unlike `any`, `unknown` requires type narrowing before use.
 *
 * @returns A new unknown schema
 */
export function unknown(): ValUnknown {
  return new ValUnknown();
}

/**
 * Creates a never schema.
 *
 * Useful for exhaustive type checking and unreachable code paths.
 *
 * @returns A new never schema
 */
export function never(): ValNever {
  return new ValNever();
}

// ============================================================================
// Integer Schema Builder Functions
// ============================================================================

/**
 * Creates a 32-bit signed integer schema.
 *
 * Range: -2,147,483,648 to 2,147,483,647
 */
export function int32(): ValInt32 {
  return new ValInt32();
}

/**
 * Creates a 64-bit signed integer schema.
 *
 * Note: JavaScript numbers can only safely represent integers up to 2^53 - 1.
 */
export function int64(): ValInt64 {
  return new ValInt64();
}

/**
 * Creates a 32-bit unsigned integer schema.
 *
 * Range: 0 to 4,294,967,295
 */
export function uint32(): ValUint32 {
  return new ValUint32();
}

/**
 * Creates a 64-bit unsigned integer schema.
 */
export function uint64(): ValUint64 {
  return new ValUint64();
}

/**
 * Creates a 32-bit floating point schema.
 */
export function float32(): ValFloat32 {
  return new ValFloat32();
}

/**
 * Creates a 64-bit floating point schema.
 */
export function float64(): ValFloat64 {
  return new ValFloat64();
}

// ============================================================================
// Phase 4 Builder Functions
// ============================================================================

/**
 * Creates an array schema for the given element type.
 *
 * @param element - The schema for array elements
 * @returns A new array schema
 *
 * @example
 * ```typescript
 * const schema = v.array(v.string());
 * schema.parse(['a', 'b', 'c']); // ['a', 'b', 'c']
 *
 * const withMin = v.array(v.number()).min(1);
 * withMin.parse([]);    // throws
 * withMin.parse([1, 2]); // [1, 2]
 * ```
 */
export function array<S extends ValSchema<unknown, unknown>>(element: S): ValArray<S> {
  return new ValArray(element);
}

/**
 * Creates a tuple schema with fixed element types.
 *
 * @param items - Array of schemas for each tuple element
 * @returns A new tuple schema
 *
 * @example
 * ```typescript
 * const schema = v.tuple([v.string(), v.number()]);
 * schema.parse(['hello', 42]); // ['hello', 42]
 *
 * const withRest = v.tuple([v.string()]).rest(v.number());
 * withRest.parse(['hello', 1, 2, 3]); // ['hello', 1, 2, 3]
 * ```
 */
export function tuple<T extends ReadonlyArray<ValSchema<unknown, unknown>>>(items: T): ValTuple<T, null> {
  return new ValTuple(items);
}

/**
 * Creates a union schema (one of multiple types).
 *
 * @param options - Array of schemas to union
 * @returns A new union schema
 *
 * @example
 * ```typescript
 * const schema = v.union([v.string(), v.number()]);
 * schema.parse('hello'); // 'hello'
 * schema.parse(42);      // 42
 * schema.parse(true);    // throws
 * ```
 */
export function union<T extends readonly [ValSchema<unknown, unknown>, ...ValSchema<unknown, unknown>[]]>(options: T): ValUnion<T> {
  return new ValUnion(options);
}

/**
 * Creates a discriminated union schema (tagged union).
 *
 * Uses a discriminator property to efficiently match variants.
 * Provides better error messages than regular unions.
 *
 * @param discriminator - The property name used to discriminate variants
 * @param options - Array of object schemas with the discriminator
 * @returns A new discriminated union schema
 *
 * @example
 * ```typescript
 * const schema = v.discriminatedUnion('type', [
 *   v.object({ type: v.literal('a'), value: v.string() }),
 *   v.object({ type: v.literal('b'), count: v.number() }),
 * ]);
 *
 * schema.parse({ type: 'a', value: 'hello' }); // OK
 * schema.parse({ type: 'b', count: 42 });      // OK
 * schema.parse({ type: 'c' });                 // throws with helpful error
 * ```
 */
export function discriminatedUnion<D extends string, T extends readonly [ValObject<Shape>, ...ValObject<Shape>[]]>(
  discriminator: D,
  options: T
): ValDiscriminatedUnion<D, T> {
  return new ValDiscriminatedUnion(discriminator, options);
}

/**
 * Creates an intersection schema (all types must match).
 *
 * @param left - First schema
 * @param right - Second schema
 * @returns A new intersection schema
 *
 * @example
 * ```typescript
 * const A = v.object({ a: v.string() });
 * const B = v.object({ b: v.number() });
 * const AB = v.intersection(A, B);
 *
 * AB.parse({ a: 'hello', b: 42 }); // { a: 'hello', b: 42 }
 * ```
 */
export function intersection<L extends ValSchema<unknown, unknown>, R extends ValSchema<unknown, unknown>>(
  left: L,
  right: R
): ValIntersection<L, R> {
  return new ValIntersection(left, right);
}

/**
 * Creates a record schema (object with string keys and typed values).
 *
 * @param valueSchema - Schema for all values (keys default to string)
 * @returns A new record schema
 *
 * @example
 * ```typescript
 * // Record<string, string>
 * const dict = v.record(v.string());
 * dict.parse({ a: 'hello', b: 'world' }); // OK
 *
 * // Record<string, number>
 * const counts = v.record(v.string(), v.number());
 * counts.parse({ count: 42, score: 100 }); // OK
 * ```
 */
export function record<V extends ValSchema<unknown, unknown>>(valueSchema: V): ValRecord<ValString, V>;
export function record<K extends ValSchema<string, string>, V extends ValSchema<unknown, unknown>>(keySchema: K, valueSchema: V): ValRecord<K, V>;
export function record(
  keyOrValue: ValSchema<unknown, unknown>,
  maybeValue?: ValSchema<unknown, unknown>
): ValRecord<ValSchema<string, string>, ValSchema<unknown, unknown>> {
  if (maybeValue === undefined) {
    // Single argument: just value schema, use string for keys
    return new ValRecord(new ValString(), keyOrValue);
  }
  // Two arguments: key schema and value schema
  return new ValRecord(keyOrValue as ValSchema<string, string>, maybeValue);
}

/**
 * Creates a Map schema.
 *
 * @param keySchema - Schema for map keys
 * @param valueSchema - Schema for map values
 * @returns A new Map schema
 *
 * @example
 * ```typescript
 * const schema = v.map(v.string(), v.number());
 * schema.parse(new Map([['a', 1], ['b', 2]])); // OK
 * ```
 */
export function map<K extends ValSchema<unknown, unknown>, V extends ValSchema<unknown, unknown>>(
  keySchema: K,
  valueSchema: V
): ValMap<K, V> {
  return new ValMap(keySchema, valueSchema);
}

/**
 * Creates a Set schema.
 *
 * @param valueSchema - Schema for set values
 * @returns A new Set schema
 *
 * @example
 * ```typescript
 * const schema = v.set(v.string());
 * schema.parse(new Set(['a', 'b', 'c'])); // OK
 * ```
 */
export function set<V extends ValSchema<unknown, unknown>>(valueSchema: V): ValSet<V> {
  return new ValSet(valueSchema);
}

/**
 * Creates a literal schema for a single value.
 *
 * @param value - The literal value to match
 * @returns A new literal schema
 *
 * @example
 * ```typescript
 * const hello = v.literal('hello');
 * hello.parse('hello'); // 'hello'
 * hello.parse('world'); // throws
 *
 * const fortyTwo = v.literal(42);
 * fortyTwo.parse(42);   // 42
 *
 * type Hello = v.infer<typeof hello>; // 'hello'
 * ```
 */
export function literal<T extends string | number | boolean | null | undefined>(value: T): ValLiteralValue<T> {
  return new ValLiteralValue(value);
}

/**
 * Creates an enum schema for a fixed set of string values.
 *
 * @param values - Tuple of allowed string values
 * @returns A new enum schema with an `enum` property
 *
 * @example
 * ```typescript
 * const Role = v.enum(['admin', 'user', 'guest']);
 * Role.parse('admin'); // 'admin'
 * Role.parse('other'); // throws
 *
 * type Role = v.infer<typeof Role>; // 'admin' | 'user' | 'guest'
 *
 * // Access values like an enum
 * Role.enum.admin; // 'admin'
 * ```
 */
function enumFn<T extends readonly [string, ...string[]]>(values: T): ValEnum<T> {
  return new ValEnum(values);
}

// Export as 'enum' (reserved word workaround)
export { enumFn as enum };

/**
 * Creates a schema for a TypeScript native enum.
 *
 * @param enumObject - The TypeScript enum object
 * @returns A new native enum schema
 *
 * @example
 * ```typescript
 * enum Status { Active, Inactive }
 * const schema = v.nativeEnum(Status);
 *
 * schema.parse(Status.Active);   // 0
 * schema.parse(Status.Inactive); // 1
 * schema.parse(2);               // throws
 * ```
 */
export function nativeEnum<T extends EnumLike>(enumObject: T): ValNativeEnum<T> {
  return new ValNativeEnum(enumObject);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wraps an existing Standard Schema into a ValSchema.
 *
 * Useful for integrating schemas from other Standard Schema compliant libraries.
 *
 * @param schema - A Standard Schema compliant object
 * @returns A ValSchema instance with parse/safeParse methods
 *
 * @example
 * ```typescript
 * import { StringSchema } from 'valrs';
 *
 * const wrapped = v.wrap(StringSchema);
 * wrapped.parse('hello'); // 'hello'
 * ```
 */
export function wrap<Input, Output>(
  schema: StandardSchemaV1<Input, Output> & {
    '~standard': {
      jsonSchema?: {
        input: (options: { target: string }) => Record<string, unknown>;
        output: (options: { target: string }) => Record<string, unknown>;
      };
    };
  }
): ValSchema<Input, Output> {
  const std = schema['~standard'];

  // Check if schema has JSON Schema support
  if (std.jsonSchema !== undefined) {
    const inputFn = (target: string) => std.jsonSchema!.input({ target });
    const outputFn = (target: string) => std.jsonSchema!.output({ target });
    return new ValSchema<Input, Output>(
      std.validate as (value: unknown) => ValidationResult<Output>,
      inputFn,
      outputFn
    );
  }

  // Fallback for schemas without JSON Schema
  return new ValSchema<Input, Output>(
    std.validate as (value: unknown) => ValidationResult<Output>,
    () => ({})
  );
}

// ============================================================================
// Preprocess Function
// ============================================================================

/**
 * Preprocesses input before passing to the schema.
 *
 * Useful for coercing input types before validation.
 *
 * @param preprocessFn - Function to transform the raw input
 * @param schema - Schema to validate after preprocessing
 * @returns A new schema that preprocesses then validates
 *
 * @example
 * ```typescript
 * const schema = v.preprocess(
 *   (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
 *   v.number()
 * );
 *
 * schema.parse('42');  // 42
 * schema.parse(42);    // 42
 * ```
 */
export function preprocess<Input, Output>(
  preprocessFn: (value: unknown) => Input,
  schema: ValSchema<Input, Output>
): ValPreprocessed<Input, Output> {
  return new ValPreprocessed(preprocessFn, schema);
}

// ============================================================================
// Coerce Namespace
// ============================================================================

/**
 * Schema that coerces input to string using String().
 */
class ValCoerceString extends ValSchema<unknown, string> {
  constructor() {
    super(
      (value: unknown): ValidationResult<string> => {
        // Handle null and undefined specially
        if (value === null) {
          return success('null');
        }
        if (value === undefined) {
          return success('undefined');
        }
        return success(String(value));
      },
      (_target: string) => ({ type: 'string' })
    );
  }
}

/**
 * Schema that coerces input to number using Number().
 */
class ValCoerceNumber extends ValSchema<unknown, number> {
  constructor() {
    super(
      (value: unknown): ValidationResult<number> => {
        const coerced = Number(value);
        if (Number.isNaN(coerced)) {
          return fail('Expected a value that coerces to a valid number');
        }
        return success(coerced);
      },
      (_target: string) => ({ type: 'number' })
    );
  }
}

/**
 * Schema that coerces input to boolean.
 *
 * Truthy values become true, falsy values become false.
 */
class ValCoerceBoolean extends ValSchema<unknown, boolean> {
  constructor() {
    super(
      (value: unknown): ValidationResult<boolean> => {
        return success(Boolean(value));
      },
      (_target: string) => ({ type: 'boolean' })
    );
  }
}

/**
 * Schema that coerces input to bigint using BigInt().
 */
class ValCoerceBigInt extends ValSchema<unknown, bigint> {
  constructor() {
    super(
      (value: unknown): ValidationResult<bigint> => {
        try {
          // Handle string and number inputs
          if (typeof value === 'string' || typeof value === 'number') {
            return success(BigInt(value));
          }
          if (typeof value === 'bigint') {
            return success(value);
          }
          return fail('Expected a value that coerces to bigint');
        } catch {
          return fail('Expected a value that coerces to bigint');
        }
      },
      (_target: string) => ({ type: 'integer', description: 'Coerced BigInt' })
    );
  }
}

/**
 * Schema that coerces input to Date using new Date().
 */
class ValCoerceDate extends ValSchema<unknown, Date> {
  constructor() {
    super(
      (value: unknown): ValidationResult<Date> => {
        // Already a Date
        if (value instanceof Date) {
          if (Number.isNaN(value.getTime())) {
            return fail('Invalid Date');
          }
          return success(value);
        }

        // String or number input
        if (typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            return fail('Invalid Date');
          }
          return success(date);
        }

        return fail('Expected a value that coerces to Date');
      },
      (_target: string) => ({ type: 'string', format: 'date-time' })
    );
  }
}

/**
 * Coercion schema builders.
 *
 * These schemas attempt to convert input values to the target type
 * before validation. Similar to Zod's coerce namespace.
 *
 * @example
 * ```typescript
 * v.coerce.string().parse(42);       // '42'
 * v.coerce.number().parse('42');     // 42
 * v.coerce.boolean().parse(1);       // true
 * v.coerce.date().parse('2024-01-01'); // Date object
 * ```
 */
export const coerce = {
  /**
   * Coerces any value to string using String().
   */
  string: () => new ValCoerceString(),

  /**
   * Coerces any value to number using Number().
   * Fails if the result is NaN.
   */
  number: () => new ValCoerceNumber(),

  /**
   * Coerces any value to boolean using Boolean().
   */
  boolean: () => new ValCoerceBoolean(),

  /**
   * Coerces any value to bigint using BigInt().
   * Fails if the value cannot be converted.
   */
  bigint: () => new ValCoerceBigInt(),

  /**
   * Coerces any value to Date using new Date().
   * Fails if the result is an Invalid Date.
   */
  date: () => new ValCoerceDate(),
} as const;

// ============================================================================
// Phase 6: Streaming Validation Exports
// ============================================================================

// Re-export streaming functions for tree-shaking
export { stream, streamLines, createMockStream, createChunkedStream };

// ============================================================================
// Default Export - The v Namespace
// ============================================================================

/**
 * The main valrs namespace, providing a Zod-compatible API.
 *
 * @example
 * ```typescript
 * import { v } from 'valrs';
 *
 * const schema = v.string();
 * schema.parse('hello');
 *
 * type MyType = v.infer<typeof schema>;
 * ```
 */
export const v = {
  // Primitive builders
  string,
  number,
  bigint,
  boolean: booleanFn,
  date,
  undefined: undefinedFn,
  null: nullFn,
  void: voidFn,
  any,
  unknown,
  never,

  // Composite types
  object,
  array,
  tuple,

  // Union and intersection
  union,
  discriminatedUnion,
  intersection,

  // Collections
  record,
  map,
  set,

  // Literals and enums
  literal,
  enum: enumFn,
  nativeEnum,

  // Integer types
  int32,
  int64,
  uint32,
  uint64,
  float32,
  float64,

  // Transform and refinement utilities
  preprocess,
  coerce,

  // Utilities
  wrap,

  // Streaming validation (Phase 6)
  stream,
  streamLines,
  createMockStream,
  createChunkedStream,

  // Error formatting (Phase 7)
  setErrorMap: setErrorMapFn,
  getErrorMap: getErrorMapFn,
  resetErrorMap: resetErrorMapFn,
} as const;

// Also export individual functions for tree-shaking
export default v;
