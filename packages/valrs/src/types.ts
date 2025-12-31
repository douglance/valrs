/**
 * Standard Schema type definitions.
 *
 * These types implement the Standard Schema specification v1.
 * @see https://standardschema.dev/
 */

/**
 * A path segment in a validation issue.
 * Can be a string key, numeric index, or an object with a key property.
 */
export type PathSegment = string | number | { readonly key: string | number };

/**
 * A validation issue describing why validation failed.
 *
 * Corresponds to the `Issue` interface in the Standard Schema spec.
 */
export interface ValidationIssue {
  /** The error message describing the issue. */
  readonly message: string;
  /** The path to the value that caused the issue. */
  readonly path?: ReadonlyArray<PathSegment>;
}

/**
 * The result of a validation operation.
 *
 * Either contains a successfully validated value, or an array of validation issues.
 * This is a discriminated union based on the presence of `issues`.
 */
export type ValidationResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<ValidationIssue>; readonly value?: undefined };

/**
 * Options passed to JSON Schema generation functions.
 */
export interface JsonSchemaOptions {
  /** The target JSON Schema version or format. */
  readonly target: string;
}

/**
 * The core Standard Schema interface for runtime validation.
 *
 * This interface corresponds to the `StandardSchemaV1` in the TypeScript spec.
 * Any schema library implementing this interface is Standard Schema compliant.
 *
 * @template Input - The expected input type
 * @template Output - The validated output type (defaults to Input)
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. Using `~` prefix for namespacing. */
  readonly '~standard': {
    /** The Standard Schema version (always 1 for this version). */
    readonly version: 1;
    /** The vendor/library name that provides this schema. */
    readonly vendor: string;
    /** Validates an unknown value and returns a typed result. */
    readonly validate: (
      value: unknown
    ) => ValidationResult<Output> | Promise<ValidationResult<Output>>;
  };
}

/**
 * Extended interface for schemas that can generate JSON Schema.
 *
 * This interface corresponds to the `StandardJSONSchemaV1` in the TypeScript spec.
 * Schemas implementing this interface can convert to JSON Schema format.
 *
 * @template Input - The expected input type
 * @template Output - The validated output type (defaults to Input)
 */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input>
  extends StandardSchemaV1<Input, Output> {
  readonly '~standard': StandardSchemaV1<Input, Output>['~standard'] & {
    /** JSON Schema generation functions. */
    readonly jsonSchema: {
      /** Generates a JSON Schema for the input type. */
      readonly input: (options: JsonSchemaOptions) => Record<string, unknown>;
      /** Generates a JSON Schema for the output type. */
      readonly output: (options: JsonSchemaOptions) => Record<string, unknown>;
    };
  };
}

/**
 * Infers the input type from a Standard Schema.
 */
export type InferInput<T extends StandardSchemaV1> =
  T extends StandardSchemaV1<infer I, unknown> ? I : never;

/**
 * Infers the output type from a Standard Schema.
 */
export type InferOutput<T extends StandardSchemaV1> =
  T extends StandardSchemaV1<unknown, infer O> ? O : never;

/**
 * Type guard to check if a validation result is successful.
 */
export function isValidationSuccess<T>(
  result: ValidationResult<T>
): result is { readonly value: T; readonly issues?: undefined } {
  return result.issues === undefined;
}

/**
 * Type guard to check if a validation result is a failure.
 */
export function isValidationFailure<T>(
  result: ValidationResult<T>
): result is { readonly issues: ReadonlyArray<ValidationIssue>; readonly value?: undefined } {
  return result.issues !== undefined;
}
