/**
 * Base schema class providing the fluent API wrapper around Standard Schema.
 *
 * This module provides the `ValSchema` base class that all schema types extend.
 * It wraps the internal Standard Schema implementation and exposes Zod-like methods.
 */

import type {
  StandardSchemaV1,
  StandardJSONSchemaV1,
  ValidationResult,
  JsonSchemaOptions,
  PathSegment,
  ValidationIssue,
} from './types';
import { isValidationSuccess } from './types';
import { ValError } from './error';
import { VENDOR, VERSION, success } from './factory';
import { compileSchema, type CompiledValidator } from './compiler';

// ============================================================================
// Refinement Context Types
// ============================================================================

/**
 * Context object passed to superRefine callbacks.
 * Allows adding multiple validation issues.
 */
export interface RefinementContext {
  /**
   * Adds a validation issue.
   */
  addIssue(issue: {
    code: string;
    message: string;
    path?: ReadonlyArray<PathSegment>;
    fatal?: boolean;
  }): void;
}

/**
 * Options for refine method.
 */
export interface RefinementOptions {
  message?: string;
  path?: ReadonlyArray<PathSegment>;
}

/**
 * Transform function type - can be sync or async.
 */
export type TransformFn<Input, Output> = (value: Input) => Output | Promise<Output>;

/**
 * Refinement predicate function type - can be sync or async.
 */
export type RefinePredicate<T> = (value: T) => boolean | Promise<boolean>;

/**
 * SuperRefine function type - can be sync or async.
 */
export type SuperRefineFn<T> = (value: T, ctx: RefinementContext) => void | Promise<void>;

/**
 * The result of a successful `safeParse()` call.
 */
export interface SafeParseSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: undefined;
}

/**
 * The result of a failed `safeParse()` call.
 */
export interface SafeParseError {
  readonly success: false;
  readonly error: ValError;
  readonly data?: undefined;
}

/**
 * The result of a `safeParse()` call.
 */
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseError;

/**
 * Type guard to check if a SafeParseResult is successful.
 */
export function isSafeParseSuccess<T>(
  result: SafeParseResult<T>
): result is SafeParseSuccess<T> {
  return result.success === true;
}

/**
 * Type guard to check if a SafeParseResult is a failure.
 */
export function isSafeParseError<T>(
  result: SafeParseResult<T>
): result is SafeParseError {
  return result.success === false;
}

/**
 * Internal validation function type.
 */
type ValidateFn<T> = (value: unknown) => ValidationResult<T>;

/**
 * Internal JSON Schema function type.
 */
type JsonSchemaFn = (target: string) => Record<string, unknown>;

/**
 * Base schema class that provides the Zod-compatible API.
 *
 * All schema types extend this class, inheriting methods like `parse()`,
 * `safeParse()`, and maintaining Standard Schema compliance via `~standard`.
 *
 * @template Input - The expected input type
 * @template Output - The validated output type (defaults to Input)
 *
 * @example
 * ```typescript
 * const schema = v.string();
 *
 * // Throws ValError on failure
 * const value = schema.parse('hello');
 *
 * // Returns { success, data } or { success, error }
 * const result = schema.safeParse('hello');
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export class ValSchema<Input = unknown, Output = Input>
  implements StandardJSONSchemaV1<Input, Output>
{
  /**
   * Standard Schema interface for interoperability.
   *
   * This property makes ValSchema compatible with any library that
   * supports the Standard Schema specification.
   */
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: 'valrs';
    readonly validate: (value: unknown) => ValidationResult<Output>;
    readonly jsonSchema: {
      readonly input: (options: JsonSchemaOptions) => Record<string, unknown>;
      readonly output: (options: JsonSchemaOptions) => Record<string, unknown>;
    };
  };

  /**
   * Compiled validator for fast boolean checks.
   * Lazily initialized on first check() call.
   */
  private _compiledCheck?: CompiledValidator;

  /**
   * Whether this schema or any of its children contain transforms.
   * When true, validation must go through WASM to apply transforms.
   */
  protected _hasTransforms: boolean = false;

  /**
   * Returns whether this schema contains transforms.
   * Used internally to determine validation path.
   */
  hasTransforms(): boolean {
    return this._hasTransforms;
  }

  /**
   * Creates a new ValSchema wrapping a validation function.
   *
   * @param validateFn - Function that validates input values
   * @param inputJsonSchemaFn - Function that generates JSON Schema for input type
   * @param outputJsonSchemaFn - Function that generates JSON Schema for output type
   */
  constructor(
    validateFn: ValidateFn<Output>,
    inputJsonSchemaFn: JsonSchemaFn,
    outputJsonSchemaFn?: JsonSchemaFn
  ) {
    const outputFn = outputJsonSchemaFn ?? inputJsonSchemaFn;

    this['~standard'] = {
      version: VERSION,
      vendor: VENDOR,
      validate: validateFn,
      jsonSchema: {
        input: (options: JsonSchemaOptions) => inputJsonSchemaFn(options.target),
        output: (options: JsonSchemaOptions) => outputFn(options.target),
      },
    };
  }

  /**
   * Parses the input and returns the validated value.
   *
   * Throws a `ValError` if validation fails.
   *
   * @param data - The value to validate
   * @returns The validated value with the correct type
   * @throws {ValError} If validation fails
   *
   * @example
   * ```typescript
   * const name = v.string().parse('Alice'); // 'Alice'
   * const age = v.number().parse('42');     // throws ValError
   * ```
   */
  parse(data: unknown): Output {
    const result = this['~standard'].validate(data);

    if (isValidationSuccess(result)) {
      return result.value;
    }

    throw new ValError(result.issues);
  }

  /**
   * Parses the input and returns a result object.
   *
   * Never throws. Returns `{ success: true, data }` on success,
   * or `{ success: false, error }` on failure.
   *
   * @param data - The value to validate
   * @returns A result object indicating success or failure
   *
   * @example
   * ```typescript
   * const result = v.string().safeParse(input);
   *
   * if (result.success) {
   *   console.log(result.data); // The validated string
   * } else {
   *   console.log(result.error.issues); // Array of validation issues
   * }
   * ```
   */
  safeParse(data: unknown): SafeParseResult<Output> {
    // Fast path: use JS-compiled check for non-transform schemas
    if (!this._hasTransforms && this.check(data)) {
      return {
        success: true,
        data: data as Output,
      };
    }

    // Full validation path (WASM) for transforms or when check fails
    const result = this['~standard'].validate(data);

    if (isValidationSuccess(result)) {
      return {
        success: true,
        data: result.value,
      };
    }

    return {
      success: false,
      error: new ValError(result.issues),
    };
  }

  /**
   * Alias for `safeParse()` that matches Standard Schema naming.
   */
  validate(data: unknown): SafeParseResult<Output> {
    return this.safeParse(data);
  }

  /**
   * Returns the JSON Schema for this schema's input type.
   *
   * @param target - The JSON Schema version (e.g., 'draft-2020-12', 'draft-07', 'openapi-3.0')
   * @returns A JSON Schema object
   *
   * @example
   * ```typescript
   * const schema = v.string();
   * const jsonSchema = schema.toJsonSchema('draft-2020-12');
   * // { type: 'string' }
   * ```
   */
  toJsonSchema(target: string = 'draft-2020-12'): Record<string, unknown> {
    return this['~standard'].jsonSchema.input({ target });
  }

  /**
   * Fast boolean check using JS-compiled validator.
   *
   * Returns true if the data passes validation, false otherwise.
   * Does NOT apply transforms - use safeParse() for that.
   *
   * @param data - The value to check
   * @returns true if valid, false otherwise
   *
   * @example
   * ```typescript
   * const schema = v.string();
   * schema.check('hello'); // true
   * schema.check(42);      // false
   * ```
   */
  check(data: unknown): boolean {
    if (!this._compiledCheck) {
      try {
        const jsonSchema = this.toJsonSchema();
        this._compiledCheck = compileSchema(jsonSchema as Parameters<typeof compileSchema>[0]);
      } catch {
        // Fallback: always return true if compilation fails
        this._compiledCheck = () => true;
      }
    }
    return this._compiledCheck(data);
  }

  /**
   * Checks if the schema is optional.
   *
   * Override in subclasses that support optionality.
   */
  isOptional(): boolean {
    return false;
  }

  /**
   * Checks if the schema is nullable.
   *
   * Override in subclasses that support nullability.
   */
  isNullable(): boolean {
    return false;
  }

  /**
   * Makes the schema accept undefined values.
   *
   * @returns A new schema that accepts T | undefined
   *
   * @example
   * ```typescript
   * const schema = v.string().optional();
   * schema.parse(undefined); // undefined
   * schema.parse('hello');   // 'hello'
   * ```
   */
  optional(): ValOptional<this> {
    return new ValOptional(this);
  }

  /**
   * Makes the schema accept null values.
   *
   * @returns A new schema that accepts T | null
   *
   * @example
   * ```typescript
   * const schema = v.string().nullable();
   * schema.parse(null);    // null
   * schema.parse('hello'); // 'hello'
   * ```
   */
  nullable(): ValNullable<this> {
    return new ValNullable(this);
  }

  /**
   * Makes the schema accept null or undefined values.
   *
   * @returns A new schema that accepts T | null | undefined
   *
   * @example
   * ```typescript
   * const schema = v.string().nullish();
   * schema.parse(null);      // null
   * schema.parse(undefined); // undefined
   * schema.parse('hello');   // 'hello'
   * ```
   */
  nullish(): ValNullish<this> {
    return new ValNullish(this);
  }

  /**
   * Provides a default value when the input is undefined.
   *
   * @param defaultValue - The default value or a function that returns it
   * @returns A new schema that uses the default when input is undefined
   *
   * @example
   * ```typescript
   * const schema = v.string().default('anonymous');
   * schema.parse(undefined); // 'anonymous'
   * schema.parse('hello');   // 'hello'
   * ```
   */
  default(defaultValue: Output | (() => Output)): ValDefault<this, Output> {
    return new ValDefault(this, defaultValue);
  }

  /**
   * Provides a fallback value when parsing fails.
   *
   * @param catchValue - The fallback value or a function that returns it
   * @returns A new schema that uses the fallback on parse error
   *
   * @example
   * ```typescript
   * const schema = v.number().catch(0);
   * schema.parse('not a number'); // 0
   * schema.parse(42);             // 42
   * ```
   */
  catch(catchValue: Output | (() => Output)): ValCatch<this, Output> {
    return new ValCatch(this, catchValue);
  }

  /**
   * Creates an array schema with this schema as the element type.
   *
   * This is an alternative syntax for `v.array(schema)`.
   *
   * @returns A new array schema
   *
   * @example
   * ```typescript
   * const schema = v.string().array();
   * schema.parse(['a', 'b', 'c']); // ['a', 'b', 'c']
   *
   * type Arr = v.infer<typeof schema>; // string[]
   * ```
   */
  array(): ValArray<this> {
    return new ValArray(this);
  }

  /**
   * Creates a union of this schema with another schema.
   *
   * @param other - The other schema to union with
   * @returns A new union schema
   *
   * @example
   * ```typescript
   * const schema = v.string().or(v.number());
   * schema.parse('hello'); // 'hello'
   * schema.parse(42);      // 42
   *
   * type T = v.infer<typeof schema>; // string | number
   * ```
   */
  or<T extends ValSchema<unknown, unknown>>(other: T): ValUnion<readonly [this, T]> {
    return new ValUnion([this, other] as const);
  }

  /**
   * Creates an intersection of this schema with another schema.
   *
   * @param other - The other schema to intersect with
   * @returns A new intersection schema
   *
   * @example
   * ```typescript
   * const A = v.object({ a: v.string() });
   * const B = v.object({ b: v.number() });
   * const AB = A.and(B);
   *
   * type AB = v.infer<typeof AB>; // { a: string } & { b: number }
   * ```
   */
  and<T extends ValSchema<unknown, unknown>>(other: T): ValIntersection<this, T> {
    return new ValIntersection(this, other);
  }

  // ============================================================================
  // Transform and Refinement Methods
  // ============================================================================

  /**
   * Transforms the output value after validation.
   *
   * Changes the output type of the schema.
   *
   * @param fn - Transform function that receives validated value
   * @returns A new schema with transformed output type
   *
   * @example
   * ```typescript
   * const schema = v.string().transform(s => parseInt(s, 10));
   * schema.parse('42'); // 42 (number)
   *
   * type Input = v.input<typeof schema>;   // string
   * type Output = v.output<typeof schema>; // number
   * ```
   */
  transform<NewOutput>(fn: TransformFn<Output, NewOutput>): ValTransformed<Input, Output, NewOutput> {
    return new ValTransformed(this, fn);
  }

  /**
   * Adds a custom validation refinement.
   *
   * Does not change the output type.
   *
   * @param predicate - Function that returns true if valid, false otherwise
   * @param messageOrOptions - Error message or options object
   * @returns A new schema with the refinement
   *
   * @example
   * ```typescript
   * const schema = v.string().refine(
   *   s => s.length > 0,
   *   'Required'
   * );
   *
   * const schemaWithPath = v.string().refine(
   *   s => s.includes('@'),
   *   { message: 'Must contain @', path: ['email'] }
   * );
   * ```
   */
  refine(
    predicate: RefinePredicate<Output>,
    messageOrOptions: string | RefinementOptions = 'Invalid value'
  ): ValRefined<Input, Output> {
    const options = typeof messageOrOptions === 'string'
      ? { message: messageOrOptions }
      : messageOrOptions;
    return new ValRefined(this, predicate, options);
  }

  /**
   * Adds advanced refinement that can add multiple issues.
   *
   * Provides a context object for adding validation issues.
   *
   * @param fn - Refinement function with context
   * @returns A new schema with the refinement
   *
   * @example
   * ```typescript
   * const schema = v.string().superRefine((val, ctx) => {
   *   if (val.length < 5) {
   *     ctx.addIssue({
   *       code: 'custom',
   *       message: 'Too short',
   *       path: [],
   *     });
   *   }
   *   if (val.length > 100) {
   *     ctx.addIssue({
   *       code: 'custom',
   *       message: 'Too long',
   *       path: [],
   *     });
   *   }
   * });
   * ```
   */
  superRefine(fn: SuperRefineFn<Output>): ValSuperRefined<Input, Output> {
    return new ValSuperRefined(this, fn);
  }

  /**
   * Pipes the output of this schema into another schema.
   *
   * Useful for chaining transforms with additional validation.
   *
   * @param schema - The schema to pipe into
   * @returns A new schema that validates with both schemas
   *
   * @example
   * ```typescript
   * const schema = v.string()
   *   .transform(s => parseInt(s, 10))
   *   .pipe(v.number().positive());
   *
   * schema.parse('42');  // 42
   * schema.parse('-5');  // throws (not positive)
   * ```
   */
  pipe<NextOutput>(schema: ValSchema<Output, NextOutput>): ValPiped<Input, Output, NextOutput> {
    return new ValPiped(this, schema);
  }

  // ============================================================================
  // Async Parsing Methods
  // ============================================================================

  /**
   * Asynchronously parses the input value.
   *
   * Required when using async transforms or refinements.
   *
   * @param data - The value to validate
   * @returns Promise resolving to the validated value
   * @throws {ValError} If validation fails
   *
   * @example
   * ```typescript
   * const schema = v.string().refine(async (s) => {
   *   return await checkIfExists(s);
   * }, 'Not found');
   *
   * const value = await schema.parseAsync('test');
   * ```
   */
  async parseAsync(data: unknown): Promise<Output> {
    const result = await this.safeParseAsync(data);
    if (result.success) {
      return result.data;
    }
    throw result.error;
  }

  /**
   * Asynchronously parses the input and returns a result object.
   *
   * Never throws. Required when using async transforms or refinements.
   *
   * @param data - The value to validate
   * @returns Promise resolving to result object
   *
   * @example
   * ```typescript
   * const schema = v.string().transform(async (s) => {
   *   return await lookupValue(s);
   * });
   *
   * const result = await schema.safeParseAsync('key');
   * if (result.success) {
   *   console.log(result.data);
   * }
   * ```
   */
  async safeParseAsync(data: unknown): Promise<SafeParseResult<Output>> {
    const result = this['~standard'].validate(data);

    // Handle both sync and async validation results
    const resolvedResult = result instanceof Promise ? await result : result;

    if (isValidationSuccess<Output>(resolvedResult)) {
      return {
        success: true,
        data: resolvedResult.value,
      };
    }

    return {
      success: false,
      error: new ValError(resolvedResult.issues),
    };
  }
}

// ============================================================================
// Wrapper Schema Classes
// ============================================================================

/**
 * Extracts the output type from a ValSchema.
 */
type InferOutput<T extends ValSchema<unknown, unknown>> = T extends ValSchema<unknown, infer O> ? O : never;

/**
 * Extracts the input type from a ValSchema.
 */
type InferInput<T extends ValSchema<unknown, unknown>> = T extends ValSchema<infer I, unknown> ? I : never;

// ============================================================================
// ValArray Class
// ============================================================================

/**
 * Validator type for arrays.
 */
type ArrayValidator<T> = (value: ReadonlyArray<T>) => { issues: Array<{ message: string }> } | null;

/**
 * Schema for array values with validation methods.
 *
 * Supports chainable methods like `.min()`, `.max()`, `.length()`, `.nonempty()`.
 * Each method returns a new schema instance (immutable).
 *
 * @template S - The element schema type
 *
 * @example
 * ```typescript
 * const schema = v.array(v.string());
 * schema.parse(['a', 'b', 'c']); // ['a', 'b', 'c']
 *
 * const nonEmpty = v.array(v.number()).nonempty();
 * nonEmpty.parse([1, 2]); // [1, 2]
 * nonEmpty.parse([]);     // throws
 * ```
 */
export class ValArray<S extends ValSchema<unknown, unknown>> extends ValSchema<
  ReadonlyArray<InferInput<S>>,
  Array<InferOutput<S>>
> {
  readonly element: S;
  private readonly validators: ReadonlyArray<ArrayValidator<InferOutput<S>>>;

  constructor(
    elementSchema: S,
    validators: ReadonlyArray<ArrayValidator<InferOutput<S>>> = []
  ) {
    const capturedValidators = validators;

    const validateFn = (value: unknown): ValidationResult<Array<InferOutput<S>>> => {
      if (!Array.isArray(value)) {
        return { issues: [{ message: 'Expected array' }] };
      }

      const result: Array<InferOutput<S>> = [];
      const issues: Array<{ message: string; path?: ReadonlyArray<PathSegment> }> = [];

      for (let i = 0; i < value.length; i++) {
        const elementResult = elementSchema['~standard'].validate(value[i]);
        if (elementResult.issues !== undefined) {
          for (const issue of elementResult.issues) {
            issues.push({
              message: issue.message,
              path: [i, ...(issue.path ?? [])],
            });
          }
        } else {
          result.push(elementResult.value as InferOutput<S>);
        }
      }

      if (issues.length > 0) {
        return { issues };
      }

      // Run array-level validators
      for (let i = 0; i < capturedValidators.length; i++) {
        const validator = capturedValidators[i];
        if (validator !== undefined) {
          const issue = validator(result);
          if (issue !== null) {
            return issue;
          }
        }
      }

      return { value: result };
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      type: 'array',
      items: elementSchema['~standard'].jsonSchema.input({ target }),
    });

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      type: 'array',
      items: elementSchema['~standard'].jsonSchema.output({ target }),
    });

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.element = elementSchema;
    this.validators = validators;
    this._hasTransforms = elementSchema.hasTransforms() || validators.length > 0;
  }

  /**
   * Creates a copy of this schema with additional validators.
   */
  private clone(additionalValidators: ReadonlyArray<ArrayValidator<InferOutput<S>>>): ValArray<S> {
    return new ValArray(this.element, [...this.validators, ...additionalValidators]);
  }

  /**
   * Requires array to have at least `length` elements.
   */
  min(length: number, message?: string): ValArray<S> {
    return this.clone([
      (arr) =>
        arr.length >= length
          ? null
          : { issues: [{ message: message ?? `Array must have at least ${length} element(s)` }] },
    ]);
  }

  /**
   * Requires array to have at most `length` elements.
   */
  max(length: number, message?: string): ValArray<S> {
    return this.clone([
      (arr) =>
        arr.length <= length
          ? null
          : { issues: [{ message: message ?? `Array must have at most ${length} element(s)` }] },
    ]);
  }

  /**
   * Requires array to have exactly `len` elements.
   */
  length(len: number, message?: string): ValArray<S> {
    return this.clone([
      (arr) =>
        arr.length === len
          ? null
          : { issues: [{ message: message ?? `Array must have exactly ${len} element(s)` }] },
    ]);
  }

  /**
   * Requires array to be non-empty (at least 1 element).
   */
  nonempty(message?: string): ValArray<S> {
    return this.min(1, message ?? 'Array must not be empty');
  }
}

// ============================================================================
// ValUnion Class
// ============================================================================

/**
 * Infers union input type from an array of schemas.
 */
type InferUnionInput<T extends ReadonlyArray<ValSchema<unknown, unknown>>> = T[number] extends ValSchema<infer I, unknown> ? I : never;

/**
 * Infers union output type from an array of schemas.
 */
type InferUnionOutput<T extends ReadonlyArray<ValSchema<unknown, unknown>>> = T[number] extends ValSchema<unknown, infer O> ? O : never;

/**
 * Schema for union types (one of multiple schemas).
 *
 * @template T - Array of member schemas
 *
 * @example
 * ```typescript
 * const schema = v.union([v.string(), v.number()]);
 * schema.parse('hello'); // 'hello'
 * schema.parse(42);      // 42
 *
 * type U = v.infer<typeof schema>; // string | number
 * ```
 */
export class ValUnion<T extends ReadonlyArray<ValSchema<unknown, unknown>>> extends ValSchema<
  InferUnionInput<T>,
  InferUnionOutput<T>
> {
  readonly options: T;

  constructor(options: T) {
    const validateFn = (value: unknown): ValidationResult<InferUnionOutput<T>> => {
      for (const option of options) {
        const result = option['~standard'].validate(value);
        if (result.issues === undefined) {
          return { value: result.value as InferUnionOutput<T> };
        }
      }

      return {
        issues: [{ message: `Invalid union: none of ${options.length} variants matched` }],
      };
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      oneOf: options.map((o) => o['~standard'].jsonSchema.input({ target })),
    });

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      oneOf: options.map((o) => o['~standard'].jsonSchema.output({ target })),
    });

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.options = options;
    this._hasTransforms = options.some(s => s.hasTransforms());
  }
}

// ============================================================================
// ValIntersection Class
// ============================================================================

/**
 * Schema for intersection types (all of multiple schemas).
 *
 * @template L - Left schema
 * @template R - Right schema
 *
 * @example
 * ```typescript
 * const A = v.object({ a: v.string() });
 * const B = v.object({ b: v.number() });
 * const AB = v.intersection(A, B);
 *
 * type AB = v.infer<typeof AB>; // { a: string } & { b: number }
 * ```
 */
export class ValIntersection<
  L extends ValSchema<unknown, unknown>,
  R extends ValSchema<unknown, unknown>
> extends ValSchema<
  InferInput<L> & InferInput<R>,
  InferOutput<L> & InferOutput<R>
> {
  readonly left: L;
  readonly right: R;

  constructor(left: L, right: R) {
    type OutputType = InferOutput<L> & InferOutput<R>;

    const validateFn = (value: unknown): ValidationResult<OutputType> => {
      const leftResult = left['~standard'].validate(value);
      if (leftResult.issues !== undefined) {
        return leftResult as ValidationResult<OutputType>;
      }

      const rightResult = right['~standard'].validate(value);
      if (rightResult.issues !== undefined) {
        return rightResult as ValidationResult<OutputType>;
      }

      // Merge results for objects
      if (
        typeof leftResult.value === 'object' &&
        leftResult.value !== null &&
        typeof rightResult.value === 'object' &&
        rightResult.value !== null
      ) {
        return { value: { ...leftResult.value, ...rightResult.value } as OutputType };
      }

      // For non-objects, just return the left result (both passed)
      return { value: leftResult.value as OutputType };
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      allOf: [
        left['~standard'].jsonSchema.input({ target }),
        right['~standard'].jsonSchema.input({ target }),
      ],
    });

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => ({
      allOf: [
        left['~standard'].jsonSchema.output({ target }),
        right['~standard'].jsonSchema.output({ target }),
      ],
    });

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.left = left;
    this.right = right;
    this._hasTransforms = left.hasTransforms() || right.hasTransforms();
  }
}

/**
 * Schema wrapper that makes the inner schema optional (accepts undefined).
 */
export class ValOptional<T extends ValSchema<unknown, unknown>> extends ValSchema<
  InferInput<T> | undefined,
  InferOutput<T> | undefined
> {
  private readonly innerSchema: T;

  constructor(schema: T) {
    const validateFn = (value: unknown): ValidationResult<InferOutput<T> | undefined> => {
      if (value === undefined) {
        return { value: undefined };
      }
      return schema['~standard'].validate(value) as ValidationResult<InferOutput<T>>;
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const innerSchema = schema['~standard'].jsonSchema.input({ target });
      return { oneOf: [innerSchema, { type: 'null' }] };
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const innerSchema = schema['~standard'].jsonSchema.output({ target });
      return { oneOf: [innerSchema, { type: 'null' }] };
    };

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.innerSchema = schema;
  }

  override isOptional(): boolean {
    return true;
  }

  /**
   * Returns the inner schema (unwrapped).
   */
  unwrap(): T {
    return this.innerSchema;
  }
}

/**
 * Schema wrapper that makes the inner schema nullable (accepts null).
 */
export class ValNullable<T extends ValSchema<unknown, unknown>> extends ValSchema<
  InferInput<T> | null,
  InferOutput<T> | null
> {
  private readonly innerSchema: T;

  constructor(schema: T) {
    const validateFn = (value: unknown): ValidationResult<InferOutput<T> | null> => {
      if (value === null) {
        return { value: null };
      }
      return schema['~standard'].validate(value) as ValidationResult<InferOutput<T>>;
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const innerSchema = schema['~standard'].jsonSchema.input({ target });
      return { oneOf: [innerSchema, { type: 'null' }] };
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const innerSchema = schema['~standard'].jsonSchema.output({ target });
      return { oneOf: [innerSchema, { type: 'null' }] };
    };

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.innerSchema = schema;
  }

  override isNullable(): boolean {
    return true;
  }

  /**
   * Returns the inner schema (unwrapped).
   */
  unwrap(): T {
    return this.innerSchema;
  }
}

/**
 * Schema wrapper that makes the inner schema nullish (accepts null or undefined).
 */
export class ValNullish<T extends ValSchema<unknown, unknown>> extends ValSchema<
  InferInput<T> | null | undefined,
  InferOutput<T> | null | undefined
> {
  private readonly innerSchema: T;

  constructor(schema: T) {
    const validateFn = (value: unknown): ValidationResult<InferOutput<T> | null | undefined> => {
      if (value === null) {
        return { value: null };
      }
      if (value === undefined) {
        return { value: undefined };
      }
      return schema['~standard'].validate(value) as ValidationResult<InferOutput<T>>;
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const innerSchema = schema['~standard'].jsonSchema.input({ target });
      return { oneOf: [innerSchema, { type: 'null' }] };
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      const innerSchema = schema['~standard'].jsonSchema.output({ target });
      return { oneOf: [innerSchema, { type: 'null' }] };
    };

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.innerSchema = schema;
  }

  override isOptional(): boolean {
    return true;
  }

  override isNullable(): boolean {
    return true;
  }

  /**
   * Returns the inner schema (unwrapped).
   */
  unwrap(): T {
    return this.innerSchema;
  }
}

/**
 * Schema wrapper that provides a default value when input is undefined.
 */
export class ValDefault<T extends ValSchema<unknown, unknown>, D> extends ValSchema<
  InferInput<T> | undefined,
  InferOutput<T>
> {
  private readonly innerSchema: T;

  constructor(schema: T, defaultValue: D | (() => D)) {
    const capturedDefault = defaultValue;
    const validateFn = (value: unknown): ValidationResult<InferOutput<T>> => {
      if (value === undefined) {
        const resolved = typeof capturedDefault === 'function'
          ? (capturedDefault as () => D)()
          : capturedDefault;
        return { value: resolved as InferOutput<T> };
      }
      return schema['~standard'].validate(value) as ValidationResult<InferOutput<T>>;
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return schema['~standard'].jsonSchema.input({ target });
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return schema['~standard'].jsonSchema.output({ target });
    };

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.innerSchema = schema;
    this._hasTransforms = true;
  }

  /**
   * Removes the default wrapper.
   */
  removeDefault(): T {
    return this.innerSchema;
  }
}

/**
 * Schema wrapper that provides a catch value when parsing fails.
 */
export class ValCatch<T extends ValSchema<unknown, unknown>, C> extends ValSchema<
  unknown,
  InferOutput<T>
> {
  private readonly innerSchema: T;

  constructor(schema: T, catchValue: C | (() => C)) {
    const capturedCatch = catchValue;
    const validateFn = (value: unknown): ValidationResult<InferOutput<T>> => {
      const result = schema['~standard'].validate(value);
      if (result.issues !== undefined) {
        const resolved = typeof capturedCatch === 'function'
          ? (capturedCatch as () => C)()
          : capturedCatch;
        return { value: resolved as InferOutput<T> };
      }
      return result as ValidationResult<InferOutput<T>>;
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return schema['~standard'].jsonSchema.input({ target });
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return schema['~standard'].jsonSchema.output({ target });
    };

    super(validateFn, inputJsonSchemaFn, outputJsonSchemaFn);
    this.innerSchema = schema;
    this._hasTransforms = true;
  }

  /**
   * Removes the catch wrapper.
   */
  removeCatch(): T {
    return this.innerSchema;
  }
}

// ============================================================================
// Transform and Refinement Schema Classes
// ============================================================================

/**
 * Schema that applies a transform function after validation.
 *
 * Changes the output type of the schema.
 *
 * @template Input - The original input type
 * @template Middle - The intermediate validated type
 * @template Output - The final transformed output type
 */
export class ValTransformed<Input, Middle, Output> extends ValSchema<Input, Output> {
  constructor(schema: ValSchema<Input, Middle>, fn: TransformFn<Middle, Output>) {
    const capturedFn = fn;
    const capturedSchema = schema;

    const validateFn = (value: unknown): ValidationResult<Output> | Promise<ValidationResult<Output>> => {
      const result = capturedSchema['~standard'].validate(value);

      // Handle async inner validation
      if (result instanceof Promise) {
        return result.then((resolvedResult) => {
          if (resolvedResult.issues !== undefined) {
            return resolvedResult as ValidationResult<Output>;
          }
          const transformed = capturedFn(resolvedResult.value);
          if (transformed instanceof Promise) {
            return transformed.then((v) => success(v));
          }
          return success(transformed);
        });
      }

      if (result.issues !== undefined) {
        return result as ValidationResult<Output>;
      }

      // Apply transform
      const transformed = capturedFn(result.value);
      if (transformed instanceof Promise) {
        return transformed.then((v) => success(v));
      }
      return success(transformed);
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedSchema['~standard'].jsonSchema.input({ target });
    };

    // Output JSON schema is not available for arbitrary transforms
    const outputJsonSchemaFn = (_target: string): Record<string, unknown> => {
      return {};
    };

    // Cast to sync validate function - async is handled by parseAsync/safeParseAsync
    super(validateFn as ValidateFn<Output>, inputJsonSchemaFn, outputJsonSchemaFn);
    this._hasTransforms = true;
  }
}

/**
 * Schema that adds a refinement predicate.
 *
 * Does not change the output type.
 *
 * @template Input - The input type
 * @template Output - The output type
 */
export class ValRefined<Input, Output> extends ValSchema<Input, Output> {
  constructor(
    schema: ValSchema<Input, Output>,
    predicate: RefinePredicate<Output>,
    options: RefinementOptions
  ) {
    const capturedPredicate = predicate;
    const capturedOptions = options;
    const capturedSchema = schema;

    const validateFn = (value: unknown): ValidationResult<Output> | Promise<ValidationResult<Output>> => {
      const result = capturedSchema['~standard'].validate(value);

      // Handle async inner validation
      if (result instanceof Promise) {
        return result.then((resolvedResult) => {
          if (resolvedResult.issues !== undefined) {
            return resolvedResult;
          }
          return applyRefinement(resolvedResult.value);
        });
      }

      if (result.issues !== undefined) {
        return result;
      }

      return applyRefinement(result.value);

      function applyRefinement(validatedValue: Output): ValidationResult<Output> | Promise<ValidationResult<Output>> {
        const predicateResult = capturedPredicate(validatedValue);
        if (predicateResult instanceof Promise) {
          return predicateResult.then((isValid) => {
            if (!isValid) {
              const issue: ValidationIssue = {
                message: capturedOptions.message ?? 'Invalid value',
              };
              if (capturedOptions.path !== undefined) {
                (issue as { path: ReadonlyArray<PathSegment> }).path = capturedOptions.path;
              }
              return { issues: [issue] };
            }
            return success(validatedValue);
          });
        }
        if (!predicateResult) {
          const issue: ValidationIssue = {
            message: capturedOptions.message ?? 'Invalid value',
          };
          if (capturedOptions.path !== undefined) {
            (issue as { path: ReadonlyArray<PathSegment> }).path = capturedOptions.path;
          }
          return { issues: [issue] };
        }
        return success(validatedValue);
      }
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedSchema['~standard'].jsonSchema.input({ target });
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedSchema['~standard'].jsonSchema.output({ target });
    };

    // Cast to sync validate function - async is handled by parseAsync/safeParseAsync
    super(validateFn as ValidateFn<Output>, inputJsonSchemaFn, outputJsonSchemaFn);
    this._hasTransforms = true;
  }
}

/**
 * Schema that applies a superRefine function for advanced validation.
 *
 * Allows adding multiple issues via the context.
 *
 * @template Input - The input type
 * @template Output - The output type
 */
export class ValSuperRefined<Input, Output> extends ValSchema<Input, Output> {
  constructor(schema: ValSchema<Input, Output>, fn: SuperRefineFn<Output>) {
    const capturedFn = fn;
    const capturedSchema = schema;

    const validateFn = (value: unknown): ValidationResult<Output> | Promise<ValidationResult<Output>> => {
      const result = capturedSchema['~standard'].validate(value);

      // Handle async inner validation
      if (result instanceof Promise) {
        return result.then((resolvedResult) => {
          if (resolvedResult.issues !== undefined) {
            return resolvedResult;
          }
          return applySuperRefine(resolvedResult.value);
        });
      }

      if (result.issues !== undefined) {
        return result;
      }

      return applySuperRefine(result.value);

      function applySuperRefine(validatedValue: Output): ValidationResult<Output> | Promise<ValidationResult<Output>> {
        const issues: ValidationIssue[] = [];
        const ctx: RefinementContext = {
          addIssue(issue) {
            const newIssue: ValidationIssue = {
              message: issue.message,
            };
            if (issue.path !== undefined) {
              (newIssue as { path: ReadonlyArray<PathSegment> }).path = issue.path;
            }
            issues.push(newIssue);
          },
        };

        const fnResult = capturedFn(validatedValue, ctx);
        if (fnResult instanceof Promise) {
          return fnResult.then(() => {
            if (issues.length > 0) {
              return { issues };
            }
            return success(validatedValue);
          });
        }

        if (issues.length > 0) {
          return { issues };
        }
        return success(validatedValue);
      }
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedSchema['~standard'].jsonSchema.input({ target });
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedSchema['~standard'].jsonSchema.output({ target });
    };

    // Cast to sync validate function - async is handled by parseAsync/safeParseAsync
    super(validateFn as ValidateFn<Output>, inputJsonSchemaFn, outputJsonSchemaFn);
    this._hasTransforms = true;
  }
}

/**
 * Schema that pipes the output of one schema into another.
 *
 * Useful for chaining transforms with additional validation.
 *
 * @template Input - The original input type
 * @template Middle - The intermediate validated type
 * @template Output - The final output type from the second schema
 */
export class ValPiped<Input, Middle, Output> extends ValSchema<Input, Output> {
  constructor(first: ValSchema<Input, Middle>, second: ValSchema<Middle, Output>) {
    const capturedFirst = first;
    const capturedSecond = second;

    const validateFn = (value: unknown): ValidationResult<Output> | Promise<ValidationResult<Output>> => {
      const firstResult = capturedFirst['~standard'].validate(value);

      // Handle async first validation
      if (firstResult instanceof Promise) {
        return firstResult.then((resolvedFirst) => {
          if (resolvedFirst.issues !== undefined) {
            return resolvedFirst as ValidationResult<Output>;
          }
          return capturedSecond['~standard'].validate(resolvedFirst.value) as ValidationResult<Output> | Promise<ValidationResult<Output>>;
        });
      }

      if (firstResult.issues !== undefined) {
        return firstResult as ValidationResult<Output>;
      }

      return capturedSecond['~standard'].validate(firstResult.value) as ValidationResult<Output> | Promise<ValidationResult<Output>>;
    };

    const inputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedFirst['~standard'].jsonSchema.input({ target });
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedSecond['~standard'].jsonSchema.output({ target });
    };

    // Cast to sync validate function - async is handled by parseAsync/safeParseAsync
    super(validateFn as ValidateFn<Output>, inputJsonSchemaFn, outputJsonSchemaFn);
    this._hasTransforms = first.hasTransforms() || second.hasTransforms();
  }
}

/**
 * Schema that preprocesses input before validation.
 *
 * Useful for coercing input types before validation.
 *
 * @template Input - The preprocessed input type
 * @template Output - The validated output type
 */
export class ValPreprocessed<Input, Output> extends ValSchema<unknown, Output> {
  constructor(preprocessFn: (value: unknown) => Input, schema: ValSchema<Input, Output>) {
    const capturedPreprocess = preprocessFn;
    const capturedSchema = schema;

    const validateFn = (value: unknown): ValidationResult<Output> | Promise<ValidationResult<Output>> => {
      const preprocessed = capturedPreprocess(value);
      return capturedSchema['~standard'].validate(preprocessed) as ValidationResult<Output> | Promise<ValidationResult<Output>>;
    };

    // Input schema is unknown since preprocessing accepts any input
    const inputJsonSchemaFn = (_target: string): Record<string, unknown> => {
      return {};
    };

    const outputJsonSchemaFn = (target: string): Record<string, unknown> => {
      return capturedSchema['~standard'].jsonSchema.output({ target });
    };

    // Cast to sync validate function - async is handled by parseAsync/safeParseAsync
    super(validateFn as ValidateFn<Output>, inputJsonSchemaFn, outputJsonSchemaFn);
    this._hasTransforms = true;
  }
}

/**
 * Creates a ValSchema from an existing Standard Schema object.
 *
 * Useful for wrapping schemas created with the factory functions.
 *
 * @param standardSchema - A Standard Schema compliant object
 * @returns A ValSchema instance
 */
export function fromStandardSchema<Input, Output>(
  standardSchema: StandardJSONSchemaV1<Input, Output>
): ValSchema<Input, Output> {
  const std = standardSchema['~standard'];
  return new ValSchema<Input, Output>(
    std.validate as ValidateFn<Output>,
    (target: string) => std.jsonSchema.input({ target }),
    (target: string) => std.jsonSchema.output({ target })
  );
}

/**
 * Creates a ValSchema from a simple Standard Schema (without JSON Schema support).
 *
 * @param standardSchema - A Standard Schema compliant object
 * @param jsonSchemaFn - Function to generate JSON Schema
 * @returns A ValSchema instance
 */
export function fromSimpleStandardSchema<T>(
  standardSchema: StandardSchemaV1<T, T>,
  jsonSchemaFn: JsonSchemaFn
): ValSchema<T, T> {
  return new ValSchema<T, T>(
    standardSchema['~standard'].validate as ValidateFn<T>,
    jsonSchemaFn
  );
}
