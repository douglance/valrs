/**
 * Schema factory functions for creating Standard Schema compliant objects.
 *
 * These factories wrap validation and JSON Schema generation functions
 * into the Standard Schema format with the `~standard` property.
 */

import type {
  StandardSchemaV1,
  StandardJSONSchemaV1,
  ValidationResult,
  ValidationIssue,
  JsonSchemaOptions,
} from './types';

/** The vendor name for schemas created by this library. */
export const VENDOR = 'standard-schema-rs' as const;

/** The Standard Schema version. */
export const VERSION = 1 as const;

/**
 * A function that validates an unknown value.
 */
export type ValidateFn<T> = (value: unknown) => ValidationResult<T>;

/**
 * A function that generates a JSON Schema.
 */
export type JsonSchemaFn = (target: string) => Record<string, unknown>;

/**
 * Creates a Standard Schema from a validation function.
 *
 * This is the simplest way to create a compliant schema. The returned
 * object has the `~standard` property with the validate function.
 *
 * @template T - The validated output type
 * @param validateFn - The validation function
 * @returns A Standard Schema compliant object
 *
 * @example
 * ```typescript
 * const PositiveNumber = createSchema<number>((value) => {
 *   if (typeof value !== 'number') {
 *     return { issues: [{ message: 'Expected a number' }] };
 *   }
 *   if (value <= 0) {
 *     return { issues: [{ message: 'Must be positive' }] };
 *   }
 *   return { value };
 * });
 * ```
 */
export function createSchema<T>(validateFn: ValidateFn<T>): StandardSchemaV1<T, T> {
  return {
    '~standard': {
      version: VERSION,
      vendor: VENDOR,
      validate: validateFn,
    },
  };
}

/**
 * Creates a Standard Schema with JSON Schema generation support.
 *
 * This extends the basic schema with the ability to generate JSON Schema
 * representations for different targets (Draft 2020-12, Draft 07, OpenAPI 3.0).
 *
 * @template T - The validated output type
 * @param validateFn - The validation function
 * @param jsonSchemaFn - Function to generate JSON Schema for a target
 * @returns A Standard JSON Schema compliant object
 *
 * @example
 * ```typescript
 * const StringSchema = createSchemaWithJsonSchema<string>(
 *   (value) => {
 *     if (typeof value !== 'string') {
 *       return { issues: [{ message: 'Expected a string' }] };
 *     }
 *     return { value };
 *   },
 *   (target) => ({ type: 'string' })
 * );
 * ```
 */
export function createSchemaWithJsonSchema<T>(
  validateFn: ValidateFn<T>,
  jsonSchemaFn: JsonSchemaFn
): StandardJSONSchemaV1<T, T> {
  return {
    '~standard': {
      version: VERSION,
      vendor: VENDOR,
      validate: validateFn,
      jsonSchema: {
        input: (options: JsonSchemaOptions) => jsonSchemaFn(options.target),
        output: (options: JsonSchemaOptions) => jsonSchemaFn(options.target),
      },
    },
  };
}

/**
 * Creates a Standard Schema with separate input/output JSON Schemas.
 *
 * Use this when the input and output types differ (e.g., coercion, defaults).
 *
 * @template Input - The input type
 * @template Output - The output type after transformation
 * @param validateFn - The validation function
 * @param inputSchemaFn - Function to generate input JSON Schema
 * @param outputSchemaFn - Function to generate output JSON Schema
 * @returns A Standard JSON Schema compliant object
 */
export function createSchemaWithSeparateJsonSchemas<Input, Output>(
  validateFn: ValidateFn<Output>,
  inputSchemaFn: JsonSchemaFn,
  outputSchemaFn: JsonSchemaFn
): StandardJSONSchemaV1<Input, Output> {
  return {
    '~standard': {
      version: VERSION,
      vendor: VENDOR,
      validate: validateFn,
      jsonSchema: {
        input: (options: JsonSchemaOptions) => inputSchemaFn(options.target),
        output: (options: JsonSchemaOptions) => outputSchemaFn(options.target),
      },
    },
  };
}

/**
 * Creates a validation success result.
 *
 * @template T - The value type
 * @param value - The validated value
 * @returns A successful validation result
 */
export function success<T>(value: T): ValidationResult<T> {
  return { value };
}

/**
 * Creates a validation failure result.
 *
 * @param issues - The validation issues
 * @returns A failed validation result
 */
export function failure(issues: ReadonlyArray<ValidationIssue>): ValidationResult<never> {
  return { issues };
}

/**
 * Creates a validation failure with a single issue.
 *
 * @param message - The error message
 * @param path - Optional path to the invalid value
 * @returns A failed validation result
 */
export function fail(
  message: string,
  path?: ReadonlyArray<string | number | { readonly key: string | number }>
): ValidationResult<never> {
  const issue: ValidationIssue = path !== undefined ? { message, path } : { message };
  return { issues: [issue] };
}
