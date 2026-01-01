/**
 * ValError - Zod-compatible error class for validation failures.
 *
 * Thrown by `schema.parse()` when validation fails.
 * Contains detailed information about all validation issues with
 * Zod-compatible error codes and formatting methods.
 */

import type { PathSegment, ValidationIssue } from './types';

// ============================================================================
// Zod-Compatible Issue Codes
// ============================================================================

/**
 * All possible Zod-compatible validation error codes.
 */
export type ValIssueCode =
  | 'invalid_type'
  | 'invalid_literal'
  | 'custom'
  | 'invalid_union'
  | 'invalid_union_discriminator'
  | 'invalid_enum_value'
  | 'unrecognized_keys'
  | 'invalid_arguments'
  | 'invalid_return_type'
  | 'invalid_date'
  | 'invalid_string'
  | 'too_small'
  | 'too_big'
  | 'invalid_intersection_types'
  | 'not_multiple_of'
  | 'not_finite';

// ============================================================================
// Zod-Compatible Issue Types
// ============================================================================

/**
 * Base interface for all validation issues.
 */
export interface ValIssueBase {
  readonly code: ValIssueCode;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

/**
 * Issue for type validation failures.
 */
export interface InvalidTypeIssue extends ValIssueBase {
  readonly code: 'invalid_type';
  readonly expected: string;
  readonly received: string;
}

/**
 * Issue for literal value validation failures.
 */
export interface InvalidLiteralIssue extends ValIssueBase {
  readonly code: 'invalid_literal';
  readonly expected: unknown;
  readonly received: unknown;
}

/**
 * Issue for custom validation failures.
 */
export interface CustomIssue extends ValIssueBase {
  readonly code: 'custom';
  readonly params?: Record<string, unknown> | undefined;
}

/**
 * Issue for union validation failures.
 */
export interface InvalidUnionIssue extends ValIssueBase {
  readonly code: 'invalid_union';
  readonly unionErrors: ReadonlyArray<ValError>;
}

/**
 * Issue for discriminated union validation failures.
 */
export interface InvalidUnionDiscriminatorIssue extends ValIssueBase {
  readonly code: 'invalid_union_discriminator';
  readonly options: ReadonlyArray<string | number>;
}

/**
 * Issue for enum validation failures.
 */
export interface InvalidEnumValueIssue extends ValIssueBase {
  readonly code: 'invalid_enum_value';
  readonly options: ReadonlyArray<string | number>;
  readonly received: unknown;
}

/**
 * Issue for unrecognized object keys.
 */
export interface UnrecognizedKeysIssue extends ValIssueBase {
  readonly code: 'unrecognized_keys';
  readonly keys: ReadonlyArray<string>;
}

/**
 * Issue for invalid function arguments.
 */
export interface InvalidArgumentsIssue extends ValIssueBase {
  readonly code: 'invalid_arguments';
  readonly argumentsError: ValError;
}

/**
 * Issue for invalid function return type.
 */
export interface InvalidReturnTypeIssue extends ValIssueBase {
  readonly code: 'invalid_return_type';
  readonly returnTypeError: ValError;
}

/**
 * Issue for invalid Date values.
 */
export interface InvalidDateIssue extends ValIssueBase {
  readonly code: 'invalid_date';
}

/**
 * String validation type for too_small/too_big.
 */
export type StringValidation =
  | 'email'
  | 'url'
  | 'emoji'
  | 'uuid'
  | 'cuid'
  | 'cuid2'
  | 'ulid'
  | 'regex'
  | 'datetime'
  | 'ip'
  | 'base64';

/**
 * Issue for invalid string format.
 */
export interface InvalidStringIssue extends ValIssueBase {
  readonly code: 'invalid_string';
  readonly validation: StringValidation | { readonly includes: string; readonly position?: number } | { readonly startsWith: string } | { readonly endsWith: string };
}

/**
 * Constraint type for size validation.
 */
export type SizeType = 'string' | 'number' | 'array' | 'set' | 'date' | 'bigint';

/**
 * Issue for values that are too small.
 */
export interface TooSmallIssue extends ValIssueBase {
  readonly code: 'too_small';
  readonly type: SizeType;
  readonly minimum: number | bigint;
  readonly inclusive: boolean;
  readonly exact?: boolean | undefined;
}

/**
 * Issue for values that are too big.
 */
export interface TooBigIssue extends ValIssueBase {
  readonly code: 'too_big';
  readonly type: SizeType;
  readonly maximum: number | bigint;
  readonly inclusive: boolean;
  readonly exact?: boolean | undefined;
}

/**
 * Issue for intersection type validation failures.
 */
export interface InvalidIntersectionTypesIssue extends ValIssueBase {
  readonly code: 'invalid_intersection_types';
}

/**
 * Issue for values that are not a multiple of a given number.
 */
export interface NotMultipleOfIssue extends ValIssueBase {
  readonly code: 'not_multiple_of';
  readonly multipleOf: number;
}

/**
 * Issue for non-finite number values.
 */
export interface NotFiniteIssue extends ValIssueBase {
  readonly code: 'not_finite';
}

/**
 * Union of all issue types.
 */
export type ValIssue =
  | InvalidTypeIssue
  | InvalidLiteralIssue
  | CustomIssue
  | InvalidUnionIssue
  | InvalidUnionDiscriminatorIssue
  | InvalidEnumValueIssue
  | UnrecognizedKeysIssue
  | InvalidArgumentsIssue
  | InvalidReturnTypeIssue
  | InvalidDateIssue
  | InvalidStringIssue
  | TooSmallIssue
  | TooBigIssue
  | InvalidIntersectionTypesIssue
  | NotMultipleOfIssue
  | NotFiniteIssue;

// ============================================================================
// Error Map Types
// ============================================================================

/**
 * Context provided to error map functions.
 */
export interface ErrorMapContext {
  readonly defaultError: string;
  readonly data: unknown;
}

/**
 * Function type for custom error messages.
 */
export type ErrorMapFn = (issue: ValIssue, ctx: ErrorMapContext) => string;

/**
 * Options for schema-level error customization.
 */
export interface SchemaErrorOptions {
  readonly errorMap?: ErrorMapFn;
  readonly message?: string;
}

// ============================================================================
// Global Error Map
// ============================================================================

let globalErrorMap: ErrorMapFn | undefined;

/**
 * Sets the global error map for all validations.
 *
 * @param errorMap - Function to generate custom error messages
 *
 * @example
 * ```typescript
 * v.setErrorMap((issue, ctx) => {
 *   if (issue.code === 'invalid_type') {
 *     return `Expected ${issue.expected}, got ${issue.received}`;
 *   }
 *   return ctx.defaultError;
 * });
 * ```
 */
export function setErrorMap(errorMap: ErrorMapFn | undefined): void {
  globalErrorMap = errorMap;
}

/**
 * Gets the current global error map.
 */
export function getErrorMap(): ErrorMapFn | undefined {
  return globalErrorMap;
}

/**
 * Resets the global error map to undefined.
 */
export function resetErrorMap(): void {
  globalErrorMap = undefined;
}

// ============================================================================
// Issue Creation Helpers
// ============================================================================

/**
 * Gets the JavaScript type of a value as a string.
 */
export function getTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof Map) return 'map';
  if (value instanceof Set) return 'set';
  if (typeof value === 'bigint') return 'bigint';
  if (typeof value === 'symbol') return 'symbol';
  if (typeof value === 'function') return 'function';
  return typeof value;
}

/**
 * Creates an invalid_type issue.
 */
export function createInvalidTypeIssue(
  expected: string,
  received: unknown,
  path: ReadonlyArray<string | number> = [],
  message?: string
): InvalidTypeIssue {
  const receivedType = getTypeName(received);
  return {
    code: 'invalid_type',
    expected,
    received: receivedType,
    path,
    message: message ?? `Expected ${expected}, received ${receivedType}`,
  };
}

/**
 * Creates a too_small issue.
 */
export function createTooSmallIssue(
  type: SizeType,
  minimum: number | bigint,
  inclusive: boolean,
  path: ReadonlyArray<string | number> = [],
  message?: string,
  exact?: boolean
): TooSmallIssue {
  const defaultMessage = exact
    ? `${type === 'string' ? 'String' : type === 'array' ? 'Array' : 'Value'} must be exactly ${minimum}`
    : inclusive
      ? `${type === 'string' ? 'String' : type === 'array' ? 'Array' : 'Value'} must be at least ${minimum}`
      : `${type === 'string' ? 'String' : type === 'array' ? 'Array' : 'Value'} must be greater than ${minimum}`;

  return {
    code: 'too_small',
    type,
    minimum,
    inclusive,
    exact,
    path,
    message: message ?? defaultMessage,
  };
}

/**
 * Creates a too_big issue.
 */
export function createTooBigIssue(
  type: SizeType,
  maximum: number | bigint,
  inclusive: boolean,
  path: ReadonlyArray<string | number> = [],
  message?: string,
  exact?: boolean
): TooBigIssue {
  const defaultMessage = exact
    ? `${type === 'string' ? 'String' : type === 'array' ? 'Array' : 'Value'} must be exactly ${maximum}`
    : inclusive
      ? `${type === 'string' ? 'String' : type === 'array' ? 'Array' : 'Value'} must be at most ${maximum}`
      : `${type === 'string' ? 'String' : type === 'array' ? 'Array' : 'Value'} must be less than ${maximum}`;

  return {
    code: 'too_big',
    type,
    maximum,
    inclusive,
    exact,
    path,
    message: message ?? defaultMessage,
  };
}

/**
 * Creates an invalid_string issue.
 */
export function createInvalidStringIssue(
  validation: InvalidStringIssue['validation'],
  path: ReadonlyArray<string | number> = [],
  message?: string
): InvalidStringIssue {
  let defaultMessage: string;
  if (typeof validation === 'string') {
    defaultMessage = `Invalid ${validation}`;
  } else if ('includes' in validation) {
    defaultMessage = `String must include "${validation.includes}"`;
  } else if ('startsWith' in validation) {
    defaultMessage = `String must start with "${validation.startsWith}"`;
  } else {
    defaultMessage = `String must end with "${validation.endsWith}"`;
  }

  return {
    code: 'invalid_string',
    validation,
    path,
    message: message ?? defaultMessage,
  };
}

/**
 * Creates an invalid_enum_value issue.
 */
export function createInvalidEnumValueIssue(
  options: ReadonlyArray<string | number>,
  received: unknown,
  path: ReadonlyArray<string | number> = [],
  message?: string
): InvalidEnumValueIssue {
  return {
    code: 'invalid_enum_value',
    options,
    received,
    path,
    message: message ?? `Invalid enum value. Expected ${options.map(o => JSON.stringify(o)).join(' | ')}, received ${JSON.stringify(received)}`,
  };
}

/**
 * Creates an invalid_union issue.
 */
export function createInvalidUnionIssue(
  unionErrors: ReadonlyArray<ValError>,
  path: ReadonlyArray<string | number> = [],
  message?: string
): InvalidUnionIssue {
  return {
    code: 'invalid_union',
    unionErrors,
    path,
    message: message ?? 'Invalid union: none of the variants matched',
  };
}

/**
 * Creates an unrecognized_keys issue.
 */
export function createUnrecognizedKeysIssue(
  keys: ReadonlyArray<string>,
  path: ReadonlyArray<string | number> = [],
  message?: string
): UnrecognizedKeysIssue {
  return {
    code: 'unrecognized_keys',
    keys,
    path,
    message: message ?? `Unrecognized key(s) in object: ${keys.map(k => `'${k}'`).join(', ')}`,
  };
}

/**
 * Creates a custom issue.
 */
export function createCustomIssue(
  message: string,
  path: ReadonlyArray<string | number> = [],
  params?: Record<string, unknown>
): CustomIssue {
  return {
    code: 'custom',
    path,
    message,
    params,
  };
}

/**
 * Creates an invalid_literal issue.
 */
export function createInvalidLiteralIssue(
  expected: unknown,
  received: unknown,
  path: ReadonlyArray<string | number> = [],
  message?: string
): InvalidLiteralIssue {
  return {
    code: 'invalid_literal',
    expected,
    received,
    path,
    message: message ?? `Invalid literal value, expected ${JSON.stringify(expected)}`,
  };
}

/**
 * Creates a not_multiple_of issue.
 */
export function createNotMultipleOfIssue(
  multipleOf: number,
  path: ReadonlyArray<string | number> = [],
  message?: string
): NotMultipleOfIssue {
  return {
    code: 'not_multiple_of',
    multipleOf,
    path,
    message: message ?? `Number must be a multiple of ${multipleOf}`,
  };
}

/**
 * Creates a not_finite issue.
 */
export function createNotFiniteIssue(
  path: ReadonlyArray<string | number> = [],
  message?: string
): NotFiniteIssue {
  return {
    code: 'not_finite',
    path,
    message: message ?? 'Number must be finite',
  };
}

/**
 * Creates an invalid_date issue.
 */
export function createInvalidDateIssue(
  path: ReadonlyArray<string | number> = [],
  message?: string
): InvalidDateIssue {
  return {
    code: 'invalid_date',
    path,
    message: message ?? 'Invalid date',
  };
}

// ============================================================================
// Path Normalization
// ============================================================================

/**
 * Normalizes a path segment to a simple string or number.
 */
function normalizePathSegment(segment: PathSegment): string | number {
  if (typeof segment === 'object' && segment !== null && 'key' in segment) {
    return segment.key;
  }
  return segment;
}

/**
 * Converts a ValidationIssue from Standard Schema format to ValIssue format.
 */
function toValIssue(issue: ValidationIssue & { code?: ValIssueCode; [key: string]: unknown }): ValIssue {
  const path = issue.path?.map(normalizePathSegment) ?? [];
  const code = issue.code ?? 'custom';

  // Handle structured issues that already have Zod-compatible format
  if (code === 'invalid_type' && 'expected' in issue && 'received' in issue) {
    return {
      code: 'invalid_type',
      expected: String(issue['expected']),
      received: String(issue['received']),
      path,
      message: issue.message,
    };
  }

  if (code === 'too_small' && 'type' in issue && 'minimum' in issue) {
    return {
      code: 'too_small',
      type: issue['type'] as SizeType,
      minimum: issue['minimum'] as number | bigint,
      inclusive: (issue['inclusive'] as boolean) ?? true,
      exact: issue['exact'] as boolean | undefined,
      path,
      message: issue.message,
    };
  }

  if (code === 'too_big' && 'type' in issue && 'maximum' in issue) {
    return {
      code: 'too_big',
      type: issue['type'] as SizeType,
      maximum: issue['maximum'] as number | bigint,
      inclusive: (issue['inclusive'] as boolean) ?? true,
      exact: issue['exact'] as boolean | undefined,
      path,
      message: issue.message,
    };
  }

  if (code === 'invalid_string' && 'validation' in issue) {
    return {
      code: 'invalid_string',
      validation: issue['validation'] as InvalidStringIssue['validation'],
      path,
      message: issue.message,
    };
  }

  if (code === 'invalid_enum_value' && 'options' in issue) {
    return {
      code: 'invalid_enum_value',
      options: issue['options'] as ReadonlyArray<string | number>,
      received: issue['received'],
      path,
      message: issue.message,
    };
  }

  if (code === 'invalid_union' && 'unionErrors' in issue) {
    return {
      code: 'invalid_union',
      unionErrors: issue['unionErrors'] as ReadonlyArray<ValError>,
      path,
      message: issue.message,
    };
  }

  if (code === 'unrecognized_keys' && 'keys' in issue) {
    return {
      code: 'unrecognized_keys',
      keys: issue['keys'] as ReadonlyArray<string>,
      path,
      message: issue.message,
    };
  }

  if (code === 'invalid_literal' && 'expected' in issue) {
    return {
      code: 'invalid_literal',
      expected: issue['expected'],
      received: issue['received'],
      path,
      message: issue.message,
    };
  }

  if (code === 'not_multiple_of' && 'multipleOf' in issue) {
    return {
      code: 'not_multiple_of',
      multipleOf: issue['multipleOf'] as number,
      path,
      message: issue.message,
    };
  }

  if (code === 'not_finite') {
    return {
      code: 'not_finite',
      path,
      message: issue.message,
    };
  }

  if (code === 'invalid_date') {
    return {
      code: 'invalid_date',
      path,
      message: issue.message,
    };
  }

  if (code === 'invalid_union_discriminator' && 'options' in issue) {
    return {
      code: 'invalid_union_discriminator',
      options: issue['options'] as ReadonlyArray<string | number>,
      path,
      message: issue.message,
    };
  }

  // Default to custom issue
  return {
    code: 'custom',
    path,
    message: issue.message,
    params: issue['params'] as Record<string, unknown> | undefined,
  };
}

// ============================================================================
// Formatted Error Types
// ============================================================================

/**
 * Type for the nested error format returned by format().
 */
export type FormattedError<T = unknown> = {
  _errors: string[];
} & (T extends object
  ? { [K in keyof T]?: FormattedError<T[K]> }
  : unknown);

/**
 * Type for the flattened error format returned by flatten().
 */
export interface FlattenedError<T = unknown> {
  formErrors: string[];
  fieldErrors: T extends object
    ? { [K in keyof T]?: string[] }
    : { [key: string]: string[] };
}

// ============================================================================
// ValError Class
// ============================================================================

/**
 * Error thrown when `schema.parse()` fails.
 *
 * Contains an array of issues describing all validation failures
 * with Zod-compatible error codes and formatting methods.
 *
 * @example
 * ```typescript
 * try {
 *   v.string().parse(123);
 * } catch (error) {
 *   if (error instanceof ValError) {
 *     console.log(error.issues);
 *     // [{ code: 'invalid_type', path: [], message: 'Expected string, received number', ... }]
 *
 *     console.log(error.format());
 *     // { _errors: ['Expected string, received number'] }
 *
 *     console.log(error.flatten());
 *     // { formErrors: ['Expected string, received number'], fieldErrors: {} }
 *   }
 * }
 * ```
 */
export class ValError extends Error {
  /** The name of this error class. */
  override readonly name = 'ValError';

  /** All validation issues that caused this error. */
  readonly issues: ReadonlyArray<ValIssue>;

  /**
   * Creates a new ValError from an array of validation issues.
   */
  constructor(issues: ReadonlyArray<ValidationIssue>) {
    // Cast to the extended type for processing
    const extendedIssues = issues as ReadonlyArray<ValidationIssue & { code?: ValIssueCode; [key: string]: unknown }>;
    const valIssues = extendedIssues.map(toValIssue);
    const message = ValError.formatMessage(valIssues);
    super(message);

    this.issues = valIssues;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ValError.prototype);
  }

  /**
   * Creates a ValError directly from ValIssue array (no conversion needed).
   */
  static fromValIssues(issues: ReadonlyArray<ValIssue>): ValError {
    const error = Object.create(ValError.prototype) as ValError;
    Object.defineProperty(error, 'issues', { value: issues, writable: false });
    Object.defineProperty(error, 'name', { value: 'ValError', writable: false });
    Object.defineProperty(error, 'message', { value: ValError.formatMessage(issues), writable: false });
    return error;
  }

  /**
   * Formats the validation issues into a human-readable error message.
   */
  private static formatMessage(issues: ReadonlyArray<ValIssue>): string {
    if (issues.length === 0) {
      return 'Validation failed';
    }

    if (issues.length === 1) {
      const issue = issues[0];
      if (issue === undefined) {
        return 'Validation failed';
      }
      const pathStr = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
      return `${issue.message}${pathStr}`;
    }

    const issueMessages = issues.map((issue) => {
      const pathStr = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
      return `  - ${issue.message}${pathStr}`;
    });

    return `Validation failed with ${issues.length} issues:\n${issueMessages.join('\n')}`;
  }

  /**
   * Gets the first validation issue, if any.
   */
  get firstError(): ValIssue | undefined {
    return this.issues[0];
  }

  /**
   * Checks if there are errors at the specified path.
   *
   * @param path - Array of path segments to check
   * @returns true if there are errors at the specified path
   *
   * @example
   * ```typescript
   * error.hasErrorAt(['user', 'email']);
   * error.hasErrorAt(['items', 0, 'name']);
   * ```
   */
  hasErrorAt(path: ReadonlyArray<string | number>): boolean {
    return this.issues.some((issue) => this.pathsMatch(issue.path, path));
  }

  /**
   * Gets all errors at the specified path.
   *
   * @param path - Array of path segments to check
   * @returns Array of issues at the specified path
   *
   * @example
   * ```typescript
   * const emailErrors = error.errorsAt(['user', 'email']);
   * const itemErrors = error.errorsAt(['items', 0]);
   * ```
   */
  errorsAt(path: ReadonlyArray<string | number>): ReadonlyArray<ValIssue> {
    return this.issues.filter((issue) => this.pathsMatch(issue.path, path));
  }

  /**
   * Checks if two paths match exactly.
   */
  private pathsMatch(
    issuePath: ReadonlyArray<string | number>,
    targetPath: ReadonlyArray<string | number>
  ): boolean {
    if (issuePath.length !== targetPath.length) {
      return false;
    }
    for (let i = 0; i < issuePath.length; i++) {
      if (issuePath[i] !== targetPath[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Formats errors as a nested object matching the path structure.
   *
   * Each level has an `_errors` array containing error messages at that level.
   * Nested objects/arrays have their own nested structures.
   *
   * @example
   * ```typescript
   * const error = new ValError([
   *   { message: 'Required', path: ['user', 'name'], code: 'custom' },
   *   { message: 'Invalid email', path: ['user', 'email'], code: 'custom' },
   * ]);
   *
   * error.format();
   * // {
   * //   _errors: [],
   * //   user: {
   * //     _errors: [],
   * //     name: { _errors: ['Required'] },
   * //     email: { _errors: ['Invalid email'] },
   * //   }
   * // }
   * ```
   */
  format<T = unknown>(): FormattedError<T> {
    type FormattedNode = { _errors: string[]; [key: string]: string[] | FormattedNode };

    const result: FormattedNode = { _errors: [] };

    for (const issue of this.issues) {
      if (issue.path.length === 0) {
        result._errors.push(issue.message);
      } else {
        let current: FormattedNode = result;

        for (let i = 0; i < issue.path.length; i++) {
          const segment = issue.path[i];
          const key = String(segment);

          if (i === issue.path.length - 1) {
            // Last segment - add to _errors
            if (current[key] === undefined) {
              current[key] = { _errors: [] };
            }
            const node = current[key];
            if (typeof node === 'object' && '_errors' in node) {
              node._errors.push(issue.message);
            }
          } else {
            // Intermediate segment - create nested object if needed
            if (current[key] === undefined) {
              current[key] = { _errors: [] };
            }
            const node = current[key];
            if (typeof node === 'object' && '_errors' in node) {
              current = node;
            }
          }
        }
      }
    }

    return result as FormattedError<T>;
  }

  /**
   * Flattens the issues into a simple object mapping paths to error messages.
   *
   * Form-level errors (no path) go into `formErrors`.
   * Field-level errors go into `fieldErrors` with dot-notation keys.
   *
   * @example
   * ```typescript
   * const error = new ValError([
   *   { message: 'Required', path: ['user', 'name'], code: 'custom' },
   *   { message: 'Invalid email', path: ['user', 'email'], code: 'custom' },
   *   { message: 'Form error', path: [], code: 'custom' },
   * ]);
   *
   * error.flatten();
   * // {
   * //   formErrors: ['Form error'],
   * //   fieldErrors: {
   * //     'user.name': ['Required'],
   * //     'user.email': ['Invalid email'],
   * //   }
   * // }
   * ```
   */
  flatten<T = unknown>(): FlattenedError<T> {
    const formErrors: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of this.issues) {
      if (issue.path.length === 0) {
        formErrors.push(issue.message);
      } else {
        const key = issue.path.join('.');
        const existing = fieldErrors[key];
        if (existing !== undefined) {
          existing.push(issue.message);
        } else {
          fieldErrors[key] = [issue.message];
        }
      }
    }

    return { formErrors, fieldErrors } as FlattenedError<T>;
  }

  /**
   * Returns a human-readable string representation of the error.
   */
  override toString(): string {
    return this.message;
  }

  /**
   * Adds a new issue to a copy of this error.
   * Returns a new ValError instance.
   */
  addIssue(issue: ValIssue): ValError {
    return ValError.fromValIssues([...this.issues, issue]);
  }

  /**
   * Adds issues from another ValError to a copy of this error.
   * Returns a new ValError instance.
   */
  addIssues(issues: ReadonlyArray<ValIssue>): ValError {
    return ValError.fromValIssues([...this.issues, ...issues]);
  }

  /**
   * Checks if this is a ValError instance.
   */
  static isValError(value: unknown): value is ValError {
    return value instanceof ValError;
  }
}
