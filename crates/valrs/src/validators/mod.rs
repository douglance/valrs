//! Built-in validators for primitive types.
//!
//! This module provides `Valrs` and `StandardJsonSchema` implementations
//! for common Rust types.

mod number;
mod option;
mod string;

pub use string::{MaxLengthString, MinLengthString, NonEmptyString};

use crate::{JsonSchemaTarget, StandardJsonSchema, ValidationResult, Valrs};
use serde_json::{Value, json};

// =============================================================================
// Boolean implementations
// =============================================================================

/// Validates that a value is a boolean.
impl Valrs for bool {
    type Input = bool;
    type Output = bool;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value {
            Value::Bool(b) => ValidationResult::success(*b),
            _ => ValidationResult::failure("Expected boolean"),
        }
    }
}

impl StandardJsonSchema for bool {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "boolean" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

// =============================================================================
// Null (unit) implementations
// =============================================================================

/// Validates that a value is null.
impl Valrs for () {
    type Input = ();
    type Output = ();

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value {
            Value::Null => ValidationResult::success(()),
            _ => ValidationResult::failure("Expected null"),
        }
    }
}

impl StandardJsonSchema for () {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "null" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

// =============================================================================
// Helper functions
// =============================================================================

/// Adds the `$schema` URI to a schema object if applicable for the target.
pub(crate) fn add_schema_uri(schema: &mut Value, target: JsonSchemaTarget) {
    if let Value::Object(map) = schema {
        let uri = target.schema_uri();
        if !uri.is_empty() {
            map.insert("$schema".to_string(), Value::String(uri.to_string()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_bool_validation() {
        assert!(bool::validate(&json!(true)).is_success());
        assert!(bool::validate(&json!(false)).is_success());
        assert!(bool::validate(&json!("true")).is_failure());
        assert!(bool::validate(&json!(1)).is_failure());
    }

    #[test]
    fn test_null_validation() {
        assert!(<()>::validate(&json!(null)).is_success());
        assert!(<()>::validate(&json!(0)).is_failure());
        assert!(<()>::validate(&json!("")).is_failure());
    }

    #[test]
    fn test_bool_json_schema() {
        let schema = <bool as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::Draft202012);
        assert_eq!(schema["type"], "boolean");
        assert_eq!(
            schema["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
    }

    #[test]
    fn test_null_json_schema() {
        let schema = <() as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::Draft202012);
        assert_eq!(schema["type"], "null");
    }
}
