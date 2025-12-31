/**
 * Primitive schema definitions.
 *
 * These schemas validate JavaScript primitives using the WASM bindings.
 * Each schema implements both validation and JSON Schema generation.
 */

import { getWasm, type WasmValidationResult } from './wasm';
import { createSchemaWithJsonSchema, success, fail } from './factory';
import type { StandardJSONSchemaV1, ValidationResult, ValidationIssue } from './types';

/**
 * Converts a WASM validation result to the Standard Schema format.
 */
function convertWasmResult<T>(result: WasmValidationResult): ValidationResult<T> {
  if (result.issues !== undefined && result.issues.length > 0) {
    const issues: ValidationIssue[] = result.issues.map((issue) => {
      const baseIssue: ValidationIssue = { message: issue.message };
      if (issue.path !== undefined) {
        return { ...baseIssue, path: issue.path };
      }
      return baseIssue;
    });
    return { issues };
  }
  return { value: result.value as T };
}

/**
 * Schema for validating string values.
 *
 * @example
 * ```typescript
 * import { init, StringSchema } from 'valrs';
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
export const StringSchema: StandardJSONSchemaV1<string, string> = createSchemaWithJsonSchema<string>(
  (value: unknown): ValidationResult<string> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateString(value);
      return convertWasmResult<string>(result);
    } catch {
      // Fallback if WASM is not available - pure JS validation
      if (typeof value !== 'string') {
        return fail('Expected string');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.stringJsonSchema(target);
    } catch {
      // Fallback JSON Schema
      return { type: 'string' };
    }
  }
);

/**
 * Schema for validating number values (JavaScript number, IEEE 754 double).
 *
 * @example
 * ```typescript
 * const result = NumberSchema['~standard'].validate(3.14);
 * // { value: 3.14 }
 * ```
 */
export const NumberSchema: StandardJSONSchemaV1<number, number> = createSchemaWithJsonSchema<number>(
  (value: unknown): ValidationResult<number> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateNumber(value);
      return convertWasmResult<number>(result);
    } catch {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return fail('Expected number');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.numberJsonSchema(target);
    } catch {
      return { type: 'number' };
    }
  }
);

/**
 * Schema for validating boolean values.
 *
 * @example
 * ```typescript
 * const result = BooleanSchema['~standard'].validate(true);
 * // { value: true }
 * ```
 */
export const BooleanSchema: StandardJSONSchemaV1<boolean, boolean> = createSchemaWithJsonSchema<boolean>(
  (value: unknown): ValidationResult<boolean> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateBoolean(value);
      return convertWasmResult<boolean>(result);
    } catch {
      if (typeof value !== 'boolean') {
        return fail('Expected boolean');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.booleanJsonSchema(target);
    } catch {
      return { type: 'boolean' };
    }
  }
);

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
export const Int32Schema: StandardJSONSchemaV1<number, number> = createSchemaWithJsonSchema<number>(
  (value: unknown): ValidationResult<number> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateI32(value);
      return convertWasmResult<number>(result);
    } catch {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return fail('Expected i32');
      }
      const MIN_I32 = -2147483648;
      const MAX_I32 = 2147483647;
      if (value < MIN_I32 || value > MAX_I32) {
        return fail('Value out of i32 range');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.i32JsonSchema(target);
    } catch {
      return {
        type: 'integer',
        minimum: -2147483648,
        maximum: 2147483647,
      };
    }
  }
);

/**
 * Schema for validating 64-bit signed integers.
 *
 * Note: JavaScript numbers can only safely represent integers up to 2^53 - 1.
 * For full i64 range, consider using BigInt.
 *
 * Range: -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807
 */
export const Int64Schema: StandardJSONSchemaV1<number, number> = createSchemaWithJsonSchema<number>(
  (value: unknown): ValidationResult<number> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateI64(value);
      return convertWasmResult<number>(result);
    } catch {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return fail('Expected i64');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.i64JsonSchema(target);
    } catch {
      return { type: 'integer' };
    }
  }
);

/**
 * Schema for validating 32-bit unsigned integers.
 *
 * Range: 0 to 4,294,967,295
 */
export const Uint32Schema: StandardJSONSchemaV1<number, number> = createSchemaWithJsonSchema<number>(
  (value: unknown): ValidationResult<number> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateU32(value);
      return convertWasmResult<number>(result);
    } catch {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        return fail('Expected u32');
      }
      const MAX_U32 = 4294967295;
      if (value < 0 || value > MAX_U32) {
        return fail('Value out of u32 range');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.u32JsonSchema(target);
    } catch {
      return {
        type: 'integer',
        minimum: 0,
        maximum: 4294967295,
      };
    }
  }
);

/**
 * Schema for validating 64-bit unsigned integers.
 *
 * Note: JavaScript numbers can only safely represent integers up to 2^53 - 1.
 *
 * Range: 0 to 18,446,744,073,709,551,615
 */
export const Uint64Schema: StandardJSONSchemaV1<number, number> = createSchemaWithJsonSchema<number>(
  (value: unknown): ValidationResult<number> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateU64(value);
      return convertWasmResult<number>(result);
    } catch {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        return fail('Expected u64');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.u64JsonSchema(target);
    } catch {
      return { type: 'integer', minimum: 0 };
    }
  }
);

/**
 * Schema for validating 32-bit floating point numbers.
 */
export const Float32Schema: StandardJSONSchemaV1<number, number> = createSchemaWithJsonSchema<number>(
  (value: unknown): ValidationResult<number> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateF32(value);
      return convertWasmResult<number>(result);
    } catch {
      if (typeof value !== 'number') {
        return fail('Expected f32');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.f32JsonSchema(target);
    } catch {
      return { type: 'number' };
    }
  }
);

/**
 * Schema for validating 64-bit floating point numbers.
 */
export const Float64Schema: StandardJSONSchemaV1<number, number> = createSchemaWithJsonSchema<number>(
  (value: unknown): ValidationResult<number> => {
    try {
      const wasm = getWasm();
      const result = wasm.validateF64(value);
      return convertWasmResult<number>(result);
    } catch {
      if (typeof value !== 'number') {
        return fail('Expected f64');
      }
      return success(value);
    }
  },
  (target: string): Record<string, unknown> => {
    try {
      const wasm = getWasm();
      return wasm.f64JsonSchema(target);
    } catch {
      return { type: 'number' };
    }
  }
);

/**
 * Alias for Float64Schema - the default JavaScript number type.
 */
export { Float64Schema as DoubleSchema };

/**
 * Alias for Int32Schema - commonly used integer type.
 */
export { Int32Schema as IntegerSchema };
