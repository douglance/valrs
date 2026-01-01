/**
 * valrs
 *
 * Rust-powered Standard Schema implementation with WASM bindings.
 *
 * Provides both a Zod-compatible fluent API (`v`) and Standard Schema
 * compliant exports for interoperability.
 *
 * @packageDocumentation
 * @see https://standardschema.dev/
 *
 * @example Zod-compatible API (recommended)
 * ```typescript
 * import { v } from 'valrs';
 *
 * // Create schemas with fluent API
 * const nameSchema = v.string();
 *
 * // Parse and validate
 * const name = nameSchema.parse('Alice');
 *
 * // Safe parsing (no exceptions)
 * const result = nameSchema.safeParse(input);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.log(result.error.issues);
 * }
 *
 * // Type inference
 * type Name = v.infer<typeof nameSchema>; // string
 * ```
 *
 * @example Standard Schema API
 * ```typescript
 * import { init, StringSchema, Int32Schema, isValidationSuccess } from 'valrs';
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

// Type definitions
export type {
  StandardSchemaV1,
  StandardJSONSchemaV1,
  ValidationResult,
  ValidationIssue,
  PathSegment,
  JsonSchemaOptions,
  InferInput,
  InferOutput,
} from './types';

export { isValidationSuccess, isValidationFailure } from './types';

// WASM initialization
export { init, isInitialized } from './wasm';
export type { WasmExports, WasmValidationResult } from './wasm';

// Schema factory functions
export {
  createSchema,
  createSchemaWithJsonSchema,
  createSchemaWithSeparateJsonSchemas,
  success,
  failure,
  fail,
  VENDOR,
  VERSION,
} from './factory';
export type { ValidateFn, JsonSchemaFn } from './factory';

// Primitive schemas
export {
  StringSchema,
  NumberSchema,
  BooleanSchema,
  Int32Schema,
  Int64Schema,
  Uint32Schema,
  Uint64Schema,
  Float32Schema,
  Float64Schema,
  DoubleSchema,
  IntegerSchema,
} from './primitives';

// Zod-compatible fluent API
export { v, v as default } from './v';
export type { Infer, infer, input, output, SafeParseResult, SafeParseSuccess, SafeParseError } from './v';
export {
  // Schema classes - primitives
  ValSchema,
  ValString,
  ValNumber,
  ValBigInt,
  ValBoolean,
  ValDate,
  ValUndefined,
  ValNull,
  ValVoid,
  ValAny,
  ValUnknown,
  ValNever,
  ValInt32,
  ValInt64,
  ValUint32,
  ValUint64,
  ValFloat32,
  ValFloat64,
  // Schema classes - composite
  ValObject,
  ValLiteral,
  // Schema classes - Phase 4
  ValArray,
  ValTuple,
  ValUnion,
  ValDiscriminatedUnion,
  ValIntersection,
  ValRecord,
  ValMap,
  ValSet,
  ValLiteralValue,
  ValEnum,
  ValNativeEnum,
  // Builder functions - primitives
  string,
  number,
  bigint,
  boolean,
  date,
  undefined,
  null,
  void,
  any,
  unknown,
  never,
  int32,
  int64,
  uint32,
  uint64,
  float32,
  float64,
  // Builder functions - composite
  object,
  // Builder functions - Phase 4
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
  // Utilities
  wrap,
  // Phase 5: Transform and refinement utilities
  preprocess,
  coerce,
  // Type guards
  isSafeParseSuccess,
  isSafeParseError,
} from './v';

// Use 'enum' as a named export (reserved word)
export { enum } from './v';

// Wrapper schema classes
export {
  ValOptional,
  ValNullable,
  ValNullish,
  ValDefault,
  ValCatch,
  // Phase 5: Transform and refinement wrappers
  ValTransformed,
  ValRefined,
  ValSuperRefined,
  ValPiped,
  ValPreprocessed,
} from './schema';

// Phase 5: Refinement types
export type {
  RefinementContext,
  RefinementOptions,
  TransformFn,
  RefinePredicate,
  SuperRefineFn,
} from './schema';

// Error types and formatting (Phase 7)
export {
  ValError,
  // Error map functions
  setErrorMap,
  getErrorMap,
  resetErrorMap,
  // Issue creation helpers
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

export type {
  // Issue code type
  ValIssueCode,
  // Base issue type
  ValIssueBase,
  // Specific issue types
  ValIssue,
  InvalidTypeIssue,
  InvalidLiteralIssue,
  CustomIssue,
  InvalidUnionIssue,
  InvalidUnionDiscriminatorIssue,
  InvalidEnumValueIssue,
  UnrecognizedKeysIssue,
  InvalidArgumentsIssue,
  InvalidReturnTypeIssue,
  InvalidDateIssue,
  InvalidStringIssue,
  TooSmallIssue,
  TooBigIssue,
  InvalidIntersectionTypesIssue,
  NotMultipleOfIssue,
  NotFiniteIssue,
  // Size type for too_small/too_big
  SizeType,
  StringValidation,
  // Error map types
  ErrorMapContext,
  ErrorMapFn,
  SchemaErrorOptions,
  // Formatted error types
  FormattedError,
  FlattenedError,
} from './error';

// Schema compiler (JS code generation)
export { compileSchema, compileSchemaToCode, CompiledRegistry } from './compiler';
export type { JsonSchema, CompiledValidator } from './compiler';

// Phase 6: Streaming validation
export {
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
