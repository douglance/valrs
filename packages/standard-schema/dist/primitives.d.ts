/**
 * Primitive schema definitions.
 *
 * These schemas validate JavaScript primitives using the WASM bindings.
 * Each schema implements both validation and JSON Schema generation.
 */
import type { StandardJSONSchemaV1 } from './types';
/**
 * Schema for validating string values.
 *
 * @example
 * ```typescript
 * import { init, StringSchema } from '@standard-schema/rust';
 *
 * await init();
 *
 * const result = StringSchema['~standard'].validate('hello');
 * // { value: 'hello' }
 *
 * const invalid = StringSchema['~standard'].validate(123);
 * // { issues: [{ message: 'Expected string' }] }
 * ```
 */
export declare const StringSchema: StandardJSONSchemaV1<string, string>;
/**
 * Schema for validating number values (JavaScript number, IEEE 754 double).
 *
 * @example
 * ```typescript
 * const result = NumberSchema['~standard'].validate(3.14);
 * // { value: 3.14 }
 * ```
 */
export declare const NumberSchema: StandardJSONSchemaV1<number, number>;
/**
 * Schema for validating boolean values.
 *
 * @example
 * ```typescript
 * const result = BooleanSchema['~standard'].validate(true);
 * // { value: true }
 * ```
 */
export declare const BooleanSchema: StandardJSONSchemaV1<boolean, boolean>;
/**
 * Schema for validating 32-bit signed integers.
 *
 * Range: -2,147,483,648 to 2,147,483,647
 *
 * @example
 * ```typescript
 * const result = Int32Schema['~standard'].validate(42);
 * // { value: 42 }
 *
 * const invalid = Int32Schema['~standard'].validate(3.14);
 * // { issues: [{ message: 'Expected i32' }] }
 * ```
 */
export declare const Int32Schema: StandardJSONSchemaV1<number, number>;
/**
 * Schema for validating 64-bit signed integers.
 *
 * Note: JavaScript numbers can only safely represent integers up to 2^53 - 1.
 * For full i64 range, consider using BigInt.
 *
 * Range: -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807
 */
export declare const Int64Schema: StandardJSONSchemaV1<number, number>;
/**
 * Schema for validating 32-bit unsigned integers.
 *
 * Range: 0 to 4,294,967,295
 */
export declare const Uint32Schema: StandardJSONSchemaV1<number, number>;
/**
 * Schema for validating 64-bit unsigned integers.
 *
 * Note: JavaScript numbers can only safely represent integers up to 2^53 - 1.
 *
 * Range: 0 to 18,446,744,073,709,551,615
 */
export declare const Uint64Schema: StandardJSONSchemaV1<number, number>;
/**
 * Schema for validating 32-bit floating point numbers.
 */
export declare const Float32Schema: StandardJSONSchemaV1<number, number>;
/**
 * Schema for validating 64-bit floating point numbers.
 */
export declare const Float64Schema: StandardJSONSchemaV1<number, number>;
/**
 * Alias for Float64Schema - the default JavaScript number type.
 */
export { Float64Schema as DoubleSchema };
/**
 * Alias for Int32Schema - commonly used integer type.
 */
export { Int32Schema as IntegerSchema };
//# sourceMappingURL=primitives.d.ts.map