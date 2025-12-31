/**
 * @standard-schema/rust
 *
 * Rust-powered Standard Schema implementation with WASM bindings.
 *
 * @packageDocumentation
 * @see https://standardschema.dev/
 *
 * @example
 * ```typescript
 * import { init, StringSchema, Int32Schema, isValidationSuccess } from '@standard-schema/rust';
 *
 * async function main() {
 *   // Initialize the WASM module
 *   await init();
 *
 *   // Validate a string
 *   const stringResult = StringSchema['~standard'].validate('hello');
 *   if (isValidationSuccess(stringResult)) {
 *     console.log(stringResult.value); // 'hello'
 *   }
 *
 *   // Validate an integer
 *   const intResult = Int32Schema['~standard'].validate(42);
 *   if (isValidationSuccess(intResult)) {
 *     console.log(intResult.value); // 42
 *   }
 *
 *   // Get JSON Schema
 *   const schema = StringSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
 *   console.log(schema); // { type: 'string' }
 * }
 * ```
 */
export type { StandardSchemaV1, StandardJSONSchemaV1, ValidationResult, ValidationIssue, PathSegment, JsonSchemaOptions, InferInput, InferOutput, } from './types';
export { isValidationSuccess, isValidationFailure } from './types';
export { init, isInitialized } from './wasm';
export type { WasmExports, WasmValidationResult } from './wasm';
export { createSchema, createSchemaWithJsonSchema, createSchemaWithSeparateJsonSchemas, success, failure, fail, VENDOR, VERSION, } from './factory';
export type { ValidateFn, JsonSchemaFn } from './factory';
export { StringSchema, NumberSchema, BooleanSchema, Int32Schema, Int64Schema, Uint32Schema, Uint64Schema, Float32Schema, Float64Schema, DoubleSchema, IntegerSchema, } from './primitives';
//# sourceMappingURL=index.d.ts.map