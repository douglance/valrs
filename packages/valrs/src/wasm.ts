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
  // Primitive validation functions
  validateString: (value: unknown) => WasmValidationResult;
  validateNumber: (value: unknown) => WasmValidationResult;
  validateBoolean: (value: unknown) => WasmValidationResult;
  validateI32: (value: unknown) => WasmValidationResult;
  validateI64: (value: unknown) => WasmValidationResult;
  validateU32: (value: unknown) => WasmValidationResult;
  validateU64: (value: unknown) => WasmValidationResult;
  validateF32: (value: unknown) => WasmValidationResult;
  validateF64: (value: unknown) => WasmValidationResult;

  // JSON Schema generation functions
  stringJsonSchema: (target: string) => Record<string, unknown>;
  numberJsonSchema: (target: string) => Record<string, unknown>;
  booleanJsonSchema: (target: string) => Record<string, unknown>;
  i32JsonSchema: (target: string) => Record<string, unknown>;
  i64JsonSchema: (target: string) => Record<string, unknown>;
  u32JsonSchema: (target: string) => Record<string, unknown>;
  u64JsonSchema: (target: string) => Record<string, unknown>;
  f32JsonSchema: (target: string) => Record<string, unknown>;
  f64JsonSchema: (target: string) => Record<string, unknown>;

  // Array and object validation
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

/** The loaded WASM module instance. */
let wasmModule: WasmExports | null = null;

/** Promise tracking the initialization state. */
let initPromise: Promise<void> | null = null;

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
 * import { init, StringSchema } from 'valrs';
 *
 * async function main() {
 *   await init();
 *   const result = StringSchema['~standard'].validate('hello');
 * }
 * ```
 */
export async function init(): Promise<void> {
  // Return immediately if already initialized
  if (wasmModule !== null) {
    return;
  }

  // Return existing promise if initialization is in progress
  if (initPromise !== null) {
    return initPromise;
  }

  initPromise = (async (): Promise<void> => {
    try {
      // Dynamic import of the WASM package
      // The path is relative to the compiled output directory
      const wasm = await import('valrs-wasm');

      // Initialize the WASM module if it has an init function
      if (typeof wasm.default === 'function') {
        await wasm.default();
      }

      wasmModule = wasm as unknown as WasmExports;
    } catch (error) {
      initPromise = null;
      throw new Error(
        `Failed to initialize WASM module: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  })();

  return initPromise;
}

/**
 * Returns the loaded WASM module.
 *
 * @throws {Error} If the WASM module has not been initialized.
 * @returns The WASM module exports.
 */
export function getWasm(): WasmExports {
  if (wasmModule === null) {
    throw new Error(
      'WASM module not initialized. Call init() and await its completion before using schemas.'
    );
  }
  return wasmModule;
}

/**
 * Checks if the WASM module has been initialized.
 *
 * @returns True if the WASM module is ready for use.
 */
export function isInitialized(): boolean {
  return wasmModule !== null;
}

/**
 * Resets the WASM module state.
 *
 * This is primarily useful for testing. In production, the module
 * should remain initialized for the lifetime of the application.
 *
 * @internal
 */
export function resetWasmState(): void {
  wasmModule = null;
  initPromise = null;
}
