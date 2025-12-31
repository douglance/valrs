use crate::types::{JsonSchemaTarget, ValidationResult};
use serde_json::Value;

/// The core Standard Schema trait for runtime validation.
///
/// This trait corresponds to the `StandardSchemaV1` interface in the TypeScript spec.
/// Implementing types can validate arbitrary JSON values and produce typed output.
///
/// # Type Parameters
///
/// * `Input` - The expected input type (for type inference, not runtime checked)
/// * `Output` - The validated output type
///
/// # Example
///
/// ```rust
/// use valrs::{Valrs, ValidationResult};
/// use serde_json::Value;
///
/// struct PositiveInt(i64);
///
/// impl Valrs for PositiveInt {
///     type Input = i64;
///     type Output = PositiveInt;
///
///     fn validate(value: &Value) -> ValidationResult<Self::Output> {
///         match value.as_i64() {
///             Some(n) if n > 0 => ValidationResult::success(PositiveInt(n)),
///             Some(_) => ValidationResult::failure("Must be positive"),
///             None => ValidationResult::failure("Expected integer"),
///         }
///     }
/// }
/// ```
pub trait Valrs: Sized {
    /// The expected input type for type inference.
    type Input;

    /// The validated output type.
    type Output;

    /// The vendor name for this schema library.
    const VENDOR: &'static str = "valrs";

    /// The Standard Schema spec version.
    const VERSION: u8 = 1;

    /// Validates an unknown JSON value and returns a typed result.
    ///
    /// # Arguments
    ///
    /// * `value` - The JSON value to validate
    ///
    /// # Returns
    ///
    /// A `ValidationResult` containing either the validated output or validation issues.
    fn validate(value: &Value) -> ValidationResult<Self::Output>;
}

/// Extended trait for schemas that can generate JSON Schema.
///
/// This trait corresponds to the `StandardJSONSchemaV1` interface in the TypeScript spec.
/// Implementing types can convert their schema to JSON Schema format.
///
/// # Supported Targets
///
/// * `Draft202012` - JSON Schema Draft 2020-12
/// * `Draft07` - JSON Schema Draft 07
/// * `OpenApi30` - OpenAPI 3.0 compatible schema
pub trait StandardJsonSchema: Valrs {
    /// Generates a JSON Schema for the input type.
    ///
    /// # Arguments
    ///
    /// * `target` - The target JSON Schema version
    ///
    /// # Returns
    ///
    /// A JSON value representing the schema.
    ///
    /// # Panics
    ///
    /// May panic if the target is not supported by this schema.
    fn json_schema_input(target: JsonSchemaTarget) -> Value;

    /// Generates a JSON Schema for the output type.
    ///
    /// For most schemas, this is identical to `json_schema_input`.
    /// They differ when the schema transforms the input (e.g., coercion, defaults).
    ///
    /// # Arguments
    ///
    /// * `target` - The target JSON Schema version
    ///
    /// # Returns
    ///
    /// A JSON value representing the schema.
    fn json_schema_output(target: JsonSchemaTarget) -> Value;
}
