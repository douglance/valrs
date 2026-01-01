//! JSON Schema generation utilities for Standard Schema.
//!
//! This crate provides helper functions for building JSON Schema objects.
//! The core `StandardJsonSchema` implementations for primitive types are in
//! the `valrs` crate.
//!
//! # Helper Functions
//!
//! - `create_object_schema` - Build an object schema from properties
//! - `string_schema_with_constraints` - Build a string schema with length constraints
//! - `property_schema` - Get a type's schema for use as a property (no `$schema`)
//!
//! # Example
//!
//! ```rust
//! use serde_json::json;
//! use valrs::JsonSchemaTarget;
//! use valrs_json::create_object_schema;
//!
//! let mut properties = serde_json::Map::new();
//! properties.insert("name".to_string(), json!({ "type": "string" }));
//! properties.insert("age".to_string(), json!({ "type": "integer" }));
//!
//! let required = vec!["name".to_string(), "age".to_string()];
//!
//! let schema = create_object_schema(
//!     JsonSchemaTarget::Draft202012,
//!     properties,
//!     required,
//! );
//! ```

pub use valrs::{JsonSchemaTarget, StandardJsonSchema, Valrs};

use serde_json::{Value, json};

/// Creates a property schema for use in object schemas (without `$schema` field).
///
/// This is useful when generating schemas for struct fields where you do not
/// want the `$schema` URI to be included in nested schemas.
///
/// # Example
///
/// ```rust
/// use valrs_json::property_schema;
///
/// let schema = property_schema::<String>();
/// assert_eq!(schema["type"], "string");
/// assert!(schema.get("$schema").is_none());
/// ```
pub fn property_schema<T: StandardJsonSchema>() -> Value {
    // Use OpenApi30 target to avoid adding $schema to nested schemas
    T::json_schema_input(JsonSchemaTarget::OpenApi30)
}

/// Creates an object schema from properties and required fields.
///
/// # Arguments
///
/// * `target` - The JSON Schema target version
/// * `properties` - Map of property names to their schemas
/// * `required` - List of required property names
///
/// # Example
///
/// ```rust
/// use serde_json::json;
/// use valrs::JsonSchemaTarget;
/// use valrs_json::create_object_schema;
///
/// let mut properties = serde_json::Map::new();
/// properties.insert("name".to_string(), json!({ "type": "string" }));
/// properties.insert("age".to_string(), json!({ "type": "integer" }));
///
/// let required = vec!["name".to_string(), "age".to_string()];
///
/// let schema = create_object_schema(
///     JsonSchemaTarget::Draft202012,
///     properties,
///     required,
/// );
///
/// assert_eq!(schema["type"], "object");
/// assert_eq!(schema["properties"]["name"]["type"], "string");
/// ```
pub fn create_object_schema(
    target: JsonSchemaTarget,
    properties: serde_json::Map<String, Value>,
    required: Vec<String>,
) -> Value {
    let mut schema = json!({
        "type": "object",
        "properties": properties,
    });

    if let Value::Object(map) = &mut schema {
        // Only add required array if there are required fields
        if !required.is_empty() {
            map.insert(
                "required".to_string(),
                Value::Array(required.into_iter().map(Value::String).collect()),
            );
        }

        // Add $schema for root schemas
        let uri = target.schema_uri();
        if !uri.is_empty() {
            map.insert("$schema".to_string(), Value::String(uri.to_string()));
        }
    }

    schema
}

/// Creates a string schema with optional constraints.
///
/// # Arguments
///
/// * `min_length` - Optional minimum string length
/// * `max_length` - Optional maximum string length
///
/// # Example
///
/// ```rust
/// use valrs_json::string_schema_with_constraints;
///
/// let schema = string_schema_with_constraints(Some(1), Some(100));
/// assert_eq!(schema["type"], "string");
/// assert_eq!(schema["minLength"], 1);
/// assert_eq!(schema["maxLength"], 100);
/// ```
pub fn string_schema_with_constraints(
    min_length: Option<usize>,
    max_length: Option<usize>,
) -> Value {
    let mut schema = json!({ "type": "string" });

    if let Value::Object(map) = &mut schema {
        if let Some(min) = min_length {
            map.insert("minLength".to_string(), Value::Number(min.into()));
        }
        if let Some(max) = max_length {
            map.insert("maxLength".to_string(), Value::Number(max.into()));
        }
    }

    schema
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_object_schema() {
        let mut properties = serde_json::Map::new();
        properties.insert("name".to_string(), json!({ "type": "string" }));
        properties.insert("age".to_string(), json!({ "type": "integer" }));

        let required = vec!["name".to_string(), "age".to_string()];

        let schema = create_object_schema(JsonSchemaTarget::Draft202012, properties, required);

        assert_eq!(schema["type"], "object");
        assert_eq!(schema["properties"]["name"]["type"], "string");
        assert_eq!(schema["properties"]["age"]["type"], "integer");
        assert!(
            schema["required"]
                .as_array()
                .unwrap()
                .contains(&json!("name"))
        );
        assert!(
            schema["required"]
                .as_array()
                .unwrap()
                .contains(&json!("age"))
        );
        assert_eq!(
            schema["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
    }

    #[test]
    fn test_create_object_schema_no_required() {
        let properties = serde_json::Map::new();
        let required: Vec<String> = vec![];

        let schema = create_object_schema(JsonSchemaTarget::OpenApi30, properties, required);

        assert_eq!(schema["type"], "object");
        assert!(schema.get("required").is_none());
        assert!(schema.get("$schema").is_none());
    }

    #[test]
    fn test_string_schema_with_constraints() {
        let schema = string_schema_with_constraints(Some(1), Some(100));
        assert_eq!(schema["type"], "string");
        assert_eq!(schema["minLength"], 1);
        assert_eq!(schema["maxLength"], 100);
    }

    #[test]
    fn test_string_schema_with_only_min() {
        let schema = string_schema_with_constraints(Some(5), None);
        assert_eq!(schema["type"], "string");
        assert_eq!(schema["minLength"], 5);
        assert!(schema.get("maxLength").is_none());
    }

    #[test]
    fn test_string_schema_with_only_max() {
        let schema = string_schema_with_constraints(None, Some(50));
        assert_eq!(schema["type"], "string");
        assert!(schema.get("minLength").is_none());
        assert_eq!(schema["maxLength"], 50);
    }

    #[test]
    fn test_property_schema() {
        let schema = property_schema::<String>();
        assert_eq!(schema["type"], "string");
        // Should not have $schema field
        assert!(schema.get("$schema").is_none());
    }

    #[test]
    fn test_property_schema_integer() {
        let schema = property_schema::<i32>();
        assert_eq!(schema["type"], "integer");
        assert!(schema.get("$schema").is_none());
    }
}
