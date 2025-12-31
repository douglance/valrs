/**
 * Standard Schema type definitions.
 *
 * These types implement the Standard Schema specification v1.
 * @see https://standardschema.dev/
 */
/**
 * Type guard to check if a validation result is successful.
 */
export function isValidationSuccess(result) {
    return result.issues === undefined;
}
/**
 * Type guard to check if a validation result is a failure.
 */
export function isValidationFailure(result) {
    return result.issues !== undefined;
}
//# sourceMappingURL=types.js.map