/**
 * WASM module initialization and access.
 *
 * This module handles loading and accessing the Rust WASM bindings.
 */
/** The loaded WASM module instance. */
let wasmModule = null;
/** Promise tracking the initialization state. */
let initPromise = null;
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
export async function init() {
    // Return immediately if already initialized
    if (wasmModule !== null) {
        return;
    }
    // Return existing promise if initialization is in progress
    if (initPromise !== null) {
        return initPromise;
    }
    initPromise = (async () => {
        try {
            // Dynamic import of the WASM package
            // The path is relative to the compiled output directory
            const wasm = await import('standard-schema-wasm');
            // Initialize the WASM module if it has an init function
            if (typeof wasm.default === 'function') {
                await wasm.default();
            }
            wasmModule = wasm;
        }
        catch (error) {
            initPromise = null;
            throw new Error(`Failed to initialize WASM module: ${error instanceof Error ? error.message : String(error)}`);
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
export function getWasm() {
    if (wasmModule === null) {
        throw new Error('WASM module not initialized. Call init() and await its completion before using schemas.');
    }
    return wasmModule;
}
/**
 * Checks if the WASM module has been initialized.
 *
 * @returns True if the WASM module is ready for use.
 */
export function isInitialized() {
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
export function resetWasmState() {
    wasmModule = null;
    initPromise = null;
}
//# sourceMappingURL=wasm.js.map