/**
 * WASM module initialization and access.
 *
 * This module handles loading and accessing the Rust WASM bindings.
 */
/**
 * Interface representing the expected WASM module exports.
 *
 * These types mirror the expected exports from the Rust WASM bindings (Phase 4).
 * The actual WASM module is loaded dynamically.
 */
export interface WasmExports {
    validateString: (value: unknown) => WasmValidationResult;
    validateNumber: (value: unknown) => WasmValidationResult;
    validateBoolean: (value: unknown) => WasmValidationResult;
    validateI32: (value: unknown) => WasmValidationResult;
    validateI64: (value: unknown) => WasmValidationResult;
    validateU32: (value: unknown) => WasmValidationResult;
    validateU64: (value: unknown) => WasmValidationResult;
    validateF32: (value: unknown) => WasmValidationResult;
    validateF64: (value: unknown) => WasmValidationResult;
    stringJsonSchema: (target: string) => Record<string, unknown>;
    numberJsonSchema: (target: string) => Record<string, unknown>;
    booleanJsonSchema: (target: string) => Record<string, unknown>;
    i32JsonSchema: (target: string) => Record<string, unknown>;
    i64JsonSchema: (target: string) => Record<string, unknown>;
    u32JsonSchema: (target: string) => Record<string, unknown>;
    u64JsonSchema: (target: string) => Record<string, unknown>;
    f32JsonSchema: (target: string) => Record<string, unknown>;
    f64JsonSchema: (target: string) => Record<string, unknown>;
    validateArray: (value: unknown, itemValidator: (item: unknown) => WasmValidationResult) => WasmValidationResult;
    arrayJsonSchema: (itemSchema: Record<string, unknown>, target: string) => Record<string, unknown>;
}
/**
 * WASM validation result structure.
 * Matches the serialized format from Rust.
 */
export interface WasmValidationResult {
    value?: unknown;
    issues?: ReadonlyArray<{
        message: string;
        path?: ReadonlyArray<string | number>;
    }>;
}
/**
 * Initializes the WASM module.
 *
 * This function must be called before using any schema validation functions.
 * It is safe to call multiple times; subsequent calls will return immediately.
 *
 * @returns A promise that resolves when the WASM module is ready.
 *
 * @example
 * ```typescript
 * import { init, StringSchema } from '@standard-schema/rust';
 *
 * async function main() {
 *   await init();
 *   const result = StringSchema['~standard'].validate('hello');
 * }
 * ```
 */
export declare function init(): Promise<void>;
/**
 * Returns the loaded WASM module.
 *
 * @throws {Error} If the WASM module has not been initialized.
 * @returns The WASM module exports.
 */
export declare function getWasm(): WasmExports;
/**
 * Checks if the WASM module has been initialized.
 *
 * @returns True if the WASM module is ready for use.
 */
export declare function isInitialized(): boolean;
/**
 * Resets the WASM module state.
 *
 * This is primarily useful for testing. In production, the module
 * should remain initialized for the lifetime of the application.
 *
 * @internal
 */
export declare function resetWasmState(): void;
//# sourceMappingURL=wasm.d.ts.map