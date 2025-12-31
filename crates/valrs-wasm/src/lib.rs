//! WASM bindings for Standard Schema.
//!
//! This crate provides wasm-bindgen exports for validation and JSON Schema generation
//! to be used in JavaScript/TypeScript environments.
//!
//! # Architecture
//!
//! The Standard Schema spec requires a `~standard` property on schema objects, but
//! wasm-bindgen cannot export properties with `~` in the name. Therefore:
//!
//! 1. This WASM layer exports raw functions (validation, JSON schema generation)
//! 2. A TypeScript wrapper (Phase 5) will wrap these in objects with `~standard` property
//!
//! # Usage
//!
//! ## Primitive Type Validation
//!
//! ```javascript
//! import { validate_string, validate_i32 } from 'valrs-wasm';
//!
//! const result = validate_string("hello");
//! if (result.value !== undefined) {
//!     console.log("Valid:", result.value);
//! } else {
//!     console.log("Invalid:", result.issues);
//! }
//! ```
//!
//! ## JSON Schema Generation
//!
//! ```javascript
//! import { string_json_schema, i32_json_schema } from 'valrs-wasm';
//!
//! const schema = string_json_schema("draft-2020-12");
//! console.log(schema); // { type: "string", "$schema": "..." }
//! ```
//!
//! ## Schema Registry for Custom Types
//!
//! ```javascript
//! import { SchemaRegistry } from 'valrs-wasm';
//!
//! const registry = new SchemaRegistry();
//! registry.register("User", { type: "object", properties: { name: { type: "string" } } });
//! const result = registry.validate("User", { name: "Alice" });
//! ```

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use valrs::{
    JsonSchemaTarget, StandardJsonSchema, Valrs, ValidationIssue, ValidationResult,
};

// =============================================================================
// Target Conversion
// =============================================================================

/// Error type for target parsing.
#[derive(Debug, Clone)]
pub struct TargetParseError {
    target: String,
}

impl std::fmt::Display for TargetParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Unknown target '{}'. Supported: draft-2020-12, draft-07, openapi-3.0",
            self.target
        )
    }
}

impl std::error::Error for TargetParseError {}

/// Parses a target string into a JsonSchemaTarget.
///
/// Supported values:
/// - "draft-2020-12" -> JsonSchemaTarget::Draft202012
/// - "draft-07" -> JsonSchemaTarget::Draft07
/// - "openapi-3.0" -> JsonSchemaTarget::OpenApi30
fn parse_target(target: &str) -> Result<JsonSchemaTarget, TargetParseError> {
    match target.to_lowercase().as_str() {
        "draft-2020-12" | "draft2020-12" | "2020-12" => Ok(JsonSchemaTarget::Draft202012),
        "draft-07" | "draft07" | "07" => Ok(JsonSchemaTarget::Draft07),
        "openapi-3.0" | "openapi30" | "openapi" => Ok(JsonSchemaTarget::OpenApi30),
        _ => Err(TargetParseError {
            target: target.to_string(),
        }),
    }
}

// =============================================================================
// Primitive Type Validators
// =============================================================================

/// Validates that a value is a string.
///
/// # Arguments
/// * `value` - The JavaScript value to validate
///
/// # Returns
/// An object with either `{ value: string }` on success or `{ issues: Issue[] }` on failure.
#[wasm_bindgen]
pub fn validate_string(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<String>(value)
}

/// Validates that a value is a boolean.
#[wasm_bindgen]
pub fn validate_bool(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<bool>(value)
}

/// Validates that a value is an i8 integer.
#[wasm_bindgen]
pub fn validate_i8(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<i8>(value)
}

/// Validates that a value is an i16 integer.
#[wasm_bindgen]
pub fn validate_i16(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<i16>(value)
}

/// Validates that a value is an i32 integer.
#[wasm_bindgen]
pub fn validate_i32(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<i32>(value)
}

/// Validates that a value is an i64 integer.
#[wasm_bindgen]
pub fn validate_i64(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<i64>(value)
}

/// Validates that a value is a u8 integer.
#[wasm_bindgen]
pub fn validate_u8(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<u8>(value)
}

/// Validates that a value is a u16 integer.
#[wasm_bindgen]
pub fn validate_u16(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<u16>(value)
}

/// Validates that a value is a u32 integer.
#[wasm_bindgen]
pub fn validate_u32(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<u32>(value)
}

/// Validates that a value is a u64 integer.
#[wasm_bindgen]
pub fn validate_u64(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<u64>(value)
}

/// Validates that a value is an f32 number.
#[wasm_bindgen]
pub fn validate_f32(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<f32>(value)
}

/// Validates that a value is an f64 number.
#[wasm_bindgen]
pub fn validate_f64(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<f64>(value)
}

/// Validates that a value is null.
#[wasm_bindgen]
pub fn validate_null(value: JsValue) -> Result<JsValue, JsError> {
    validate_primitive::<()>(value)
}

/// Internal helper to validate primitive types.
fn validate_primitive<T>(value: JsValue) -> Result<JsValue, JsError>
where
    T: Valrs + Serialize,
    T::Output: Serialize,
{
    let json_value: Value = serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsError::new(&format!("Failed to deserialize value: {}", e)))?;

    let result = T::validate(&json_value);

    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsError::new(&format!("Failed to serialize result: {}", e)))
}

// =============================================================================
// JSON Schema Generation for Primitives
// =============================================================================

/// Generates a JSON Schema for the string type.
///
/// # Arguments
/// * `target` - The target JSON Schema version: "draft-2020-12", "draft-07", or "openapi-3.0"
///
/// # Returns
/// The JSON Schema object for strings.
#[wasm_bindgen]
pub fn string_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<String>(target)
}

/// Generates a JSON Schema for the boolean type.
#[wasm_bindgen]
pub fn bool_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<bool>(target)
}

/// Generates a JSON Schema for the i8 type.
#[wasm_bindgen]
pub fn i8_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<i8>(target)
}

/// Generates a JSON Schema for the i16 type.
#[wasm_bindgen]
pub fn i16_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<i16>(target)
}

/// Generates a JSON Schema for the i32 type.
#[wasm_bindgen]
pub fn i32_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<i32>(target)
}

/// Generates a JSON Schema for the i64 type.
#[wasm_bindgen]
pub fn i64_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<i64>(target)
}

/// Generates a JSON Schema for the u8 type.
#[wasm_bindgen]
pub fn u8_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<u8>(target)
}

/// Generates a JSON Schema for the u16 type.
#[wasm_bindgen]
pub fn u16_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<u16>(target)
}

/// Generates a JSON Schema for the u32 type.
#[wasm_bindgen]
pub fn u32_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<u32>(target)
}

/// Generates a JSON Schema for the u64 type.
#[wasm_bindgen]
pub fn u64_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<u64>(target)
}

/// Generates a JSON Schema for the f32 type.
#[wasm_bindgen]
pub fn f32_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<f32>(target)
}

/// Generates a JSON Schema for the f64 type.
#[wasm_bindgen]
pub fn f64_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<f64>(target)
}

/// Generates a JSON Schema for the null type.
#[wasm_bindgen]
pub fn null_json_schema(target: &str) -> Result<JsValue, JsError> {
    json_schema_for_type::<()>(target)
}

/// Internal helper to generate JSON Schema for a type.
fn json_schema_for_type<T: StandardJsonSchema>(target: &str) -> Result<JsValue, JsError> {
    let target = parse_target(target)?;
    let schema = T::json_schema_input(target);

    // Convert serde_json::Value to JSON string, then parse to JsValue
    // This is necessary because serde_wasm_bindgen doesn't correctly serialize serde_json::Value
    let json_str = serde_json::to_string(&schema)
        .map_err(|e| JsError::new(&format!("Failed to serialize schema: {}", e)))?;

    js_sys::JSON::parse(&json_str)
        .map_err(|e| JsError::new(&format!("Failed to parse JSON: {:?}", e)))
}

// =============================================================================
// Schema Registry for User-Defined Types
// =============================================================================

/// A registered schema with its JSON Schema and validation logic.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RegisteredSchema {
    /// The JSON Schema for validation reference
    schema: Value,
}

/// A registry for user-defined schemas.
///
/// This allows JavaScript code to register JSON Schemas for complex types
/// and then validate values against them.
///
/// # Example
///
/// ```javascript
/// const registry = new SchemaRegistry();
///
/// // Register a user schema
/// registry.register("User", {
///     type: "object",
///     properties: {
///         name: { type: "string" },
///         age: { type: "integer" }
///     },
///     required: ["name", "age"]
/// });
///
/// // Validate a value
/// const result = registry.validate("User", { name: "Alice", age: 30 });
/// ```
#[wasm_bindgen]
pub struct SchemaRegistry {
    schemas: HashMap<String, RegisteredSchema>,
}

#[wasm_bindgen]
impl SchemaRegistry {
    /// Creates a new empty schema registry.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        SchemaRegistry {
            schemas: HashMap::new(),
        }
    }

    /// Registers a schema by name.
    ///
    /// # Arguments
    /// * `name` - The name to register the schema under
    /// * `schema_json` - The JSON Schema object
    ///
    /// # Errors
    /// Returns an error if the schema cannot be parsed.
    pub fn register(&mut self, name: &str, schema_json: JsValue) -> Result<(), JsError> {
        let schema: Value = serde_wasm_bindgen::from_value(schema_json)
            .map_err(|e| JsError::new(&format!("Failed to parse schema: {}", e)))?;

        self.schemas.insert(
            name.to_string(),
            RegisteredSchema { schema },
        );

        Ok(())
    }

    /// Unregisters a schema by name.
    ///
    /// # Arguments
    /// * `name` - The name of the schema to remove
    ///
    /// # Returns
    /// `true` if the schema was removed, `false` if it was not found.
    pub fn unregister(&mut self, name: &str) -> bool {
        self.schemas.remove(name).is_some()
    }

    /// Checks if a schema is registered.
    ///
    /// # Arguments
    /// * `name` - The name of the schema to check
    #[wasm_bindgen(js_name = hasSchema)]
    pub fn has_schema(&self, name: &str) -> bool {
        self.schemas.contains_key(name)
    }

    /// Lists all registered schema names.
    #[wasm_bindgen(js_name = listSchemas)]
    pub fn list_schemas(&self) -> JsValue {
        let names: Vec<&String> = self.schemas.keys().collect();
        serde_wasm_bindgen::to_value(&names).unwrap_or(JsValue::NULL)
    }

    /// Validates a value using a registered schema.
    ///
    /// # Arguments
    /// * `name` - The name of the registered schema
    /// * `value` - The JavaScript value to validate
    ///
    /// # Returns
    /// An object with either `{ value: T }` on success or `{ issues: Issue[] }` on failure.
    pub fn validate(&self, name: &str, value: JsValue) -> Result<JsValue, JsError> {
        let registered = self.schemas.get(name).ok_or_else(|| {
            JsError::new(&format!("Schema '{}' not found in registry", name))
        })?;

        let json_value: Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsError::new(&format!("Failed to deserialize value: {}", e)))?;

        let result = validate_against_schema(&json_value, &registered.schema);

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsError::new(&format!("Failed to serialize result: {}", e)))
    }

    /// Gets the JSON Schema for a registered schema.
    ///
    /// # Arguments
    /// * `name` - The name of the registered schema
    /// * `target` - The target JSON Schema version (for adding $schema)
    ///
    /// # Returns
    /// The JSON Schema object with the appropriate $schema URI.
    #[wasm_bindgen(js_name = jsonSchema)]
    pub fn json_schema(&self, name: &str, target: &str) -> Result<JsValue, JsError> {
        let registered = self.schemas.get(name).ok_or_else(|| {
            JsError::new(&format!("Schema '{}' not found in registry", name))
        })?;

        let target = parse_target(target)?;
        let mut schema = registered.schema.clone();

        // Add $schema URI if applicable
        if let Value::Object(map) = &mut schema {
            let uri = target.schema_uri();
            if !uri.is_empty() {
                map.insert("$schema".to_string(), Value::String(uri.to_string()));
            }
        }

        // Convert to JSON string then parse to JsValue
        let json_str = serde_json::to_string(&schema)
            .map_err(|e| JsError::new(&format!("Failed to serialize schema: {}", e)))?;

        js_sys::JSON::parse(&json_str)
            .map_err(|e| JsError::new(&format!("Failed to parse JSON: {:?}", e)))
    }
}

impl Default for SchemaRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Schema Validation Logic
// =============================================================================

/// Validates a JSON value against a JSON Schema.
///
/// This is a simplified implementation that handles common JSON Schema features:
/// - type validation (string, number, integer, boolean, null, object, array)
/// - required properties
/// - properties validation (recursive)
/// - items validation for arrays
fn validate_against_schema(value: &Value, schema: &Value) -> ValidationResult<Value> {
    let schema_obj = match schema.as_object() {
        Some(obj) => obj,
        None => return ValidationResult::success(value.clone()),
    };

    // Check type constraint
    if let Some(type_value) = schema_obj.get("type") {
        if !validate_type(value, type_value) {
            return ValidationResult::failure(format!(
                "Expected type {}, got {}",
                type_value,
                json_type_name(value)
            ));
        }
    }

    // For objects, validate properties and required
    if value.is_object() {
        if let Some(issues) = validate_object_schema(value, schema_obj) {
            return ValidationResult::failures(issues);
        }
    }

    // For arrays, validate items
    if value.is_array() {
        if let Some(issues) = validate_array_schema(value, schema_obj) {
            return ValidationResult::failures(issues);
        }
    }

    ValidationResult::success(value.clone())
}

/// Validates that a value matches the expected JSON Schema type.
fn validate_type(value: &Value, type_value: &Value) -> bool {
    match type_value {
        Value::String(t) => match t.as_str() {
            "string" => value.is_string(),
            "number" => value.is_number(),
            "integer" => value.is_i64() || value.is_u64(),
            "boolean" => value.is_boolean(),
            "null" => value.is_null(),
            "object" => value.is_object(),
            "array" => value.is_array(),
            _ => true, // Unknown types pass
        },
        Value::Array(types) => {
            // Union types: any type in the array is valid
            types.iter().any(|t| validate_type(value, t))
        }
        _ => true,
    }
}

/// Returns a human-readable type name for a JSON value.
fn json_type_name(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(n) => {
            if n.is_i64() || n.is_u64() {
                "integer"
            } else {
                "number"
            }
        }
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

/// Validates an object against object schema constraints.
fn validate_object_schema(value: &Value, schema: &Map<String, Value>) -> Option<Vec<ValidationIssue>> {
    let obj = value.as_object()?;
    let mut issues = Vec::new();

    // Check required properties
    if let Some(Value::Array(required)) = schema.get("required") {
        for req in required {
            if let Some(key) = req.as_str() {
                if !obj.contains_key(key) {
                    issues.push(ValidationIssue::with_path(
                        format!("Missing required property '{}'", key),
                        vec![key.into()],
                    ));
                }
            }
        }
    }

    // Validate properties against their schemas
    if let Some(Value::Object(properties)) = schema.get("properties") {
        for (key, prop_schema) in properties {
            if let Some(prop_value) = obj.get(key) {
                let result = validate_against_schema(prop_value, prop_schema);
                if let ValidationResult::Failure(prop_issues) = result {
                    for mut issue in prop_issues {
                        // Prepend the property key to the path
                        let mut new_path = vec![key.clone().into()];
                        if let Some(existing_path) = issue.path.take() {
                            new_path.extend(existing_path);
                        }
                        issue.path = Some(new_path);
                        issues.push(issue);
                    }
                }
            }
        }
    }

    if issues.is_empty() {
        None
    } else {
        Some(issues)
    }
}

/// Validates an array against array schema constraints.
fn validate_array_schema(value: &Value, schema: &Map<String, Value>) -> Option<Vec<ValidationIssue>> {
    let arr = value.as_array()?;
    let mut issues = Vec::new();

    // Validate items against items schema
    if let Some(items_schema) = schema.get("items") {
        for (index, item) in arr.iter().enumerate() {
            let result = validate_against_schema(item, items_schema);
            if let ValidationResult::Failure(item_issues) = result {
                for mut issue in item_issues {
                    // Prepend the array index to the path
                    let mut new_path = vec![index.into()];
                    if let Some(existing_path) = issue.path.take() {
                        new_path.extend(existing_path);
                    }
                    issue.path = Some(new_path);
                    issues.push(issue);
                }
            }
        }
    }

    // Check minItems
    if let Some(Value::Number(min)) = schema.get("minItems") {
        if let Some(min) = min.as_u64() {
            if (arr.len() as u64) < min {
                issues.push(ValidationIssue::new(format!(
                    "Array has {} items, minimum is {}",
                    arr.len(),
                    min
                )));
            }
        }
    }

    // Check maxItems
    if let Some(Value::Number(max)) = schema.get("maxItems") {
        if let Some(max) = max.as_u64() {
            if (arr.len() as u64) > max {
                issues.push(ValidationIssue::new(format!(
                    "Array has {} items, maximum is {}",
                    arr.len(),
                    max
                )));
            }
        }
    }

    if issues.is_empty() {
        None
    } else {
        Some(issues)
    }
}

// =============================================================================
// Metadata Functions
// =============================================================================

/// Returns the vendor name for this schema library.
#[wasm_bindgen]
pub fn vendor() -> String {
    "valrs".to_string()
}

/// Returns the Standard Schema spec version supported.
#[wasm_bindgen]
pub fn version() -> u8 {
    1
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_target() {
        assert!(matches!(
            parse_target("draft-2020-12"),
            Ok(JsonSchemaTarget::Draft202012)
        ));
        assert!(matches!(
            parse_target("draft-07"),
            Ok(JsonSchemaTarget::Draft07)
        ));
        assert!(matches!(
            parse_target("openapi-3.0"),
            Ok(JsonSchemaTarget::OpenApi30)
        ));
        assert!(parse_target("invalid").is_err());
    }

    #[test]
    fn test_validate_type() {
        assert!(validate_type(&json!("hello"), &json!("string")));
        assert!(!validate_type(&json!(123), &json!("string")));

        assert!(validate_type(&json!(123), &json!("integer")));
        assert!(validate_type(&json!(123.5), &json!("number")));

        assert!(validate_type(&json!(true), &json!("boolean")));
        assert!(validate_type(&json!(null), &json!("null")));

        assert!(validate_type(&json!({}), &json!("object")));
        assert!(validate_type(&json!([]), &json!("array")));
    }

    #[test]
    fn test_validate_against_schema_simple() {
        let schema = json!({ "type": "string" });
        let result = validate_against_schema(&json!("hello"), &schema);
        assert!(result.is_success());

        let result = validate_against_schema(&json!(123), &schema);
        assert!(result.is_failure());
    }

    #[test]
    fn test_validate_against_schema_object() {
        let schema = json!({
            "type": "object",
            "properties": {
                "name": { "type": "string" },
                "age": { "type": "integer" }
            },
            "required": ["name"]
        });

        // Valid object
        let result = validate_against_schema(&json!({"name": "Alice", "age": 30}), &schema);
        assert!(result.is_success());

        // Missing required property
        let result = validate_against_schema(&json!({"age": 30}), &schema);
        assert!(result.is_failure());

        // Wrong type for property
        let result = validate_against_schema(&json!({"name": 123}), &schema);
        assert!(result.is_failure());
    }

    #[test]
    fn test_validate_against_schema_array() {
        let schema = json!({
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 1,
            "maxItems": 3
        });

        // Valid array
        let result = validate_against_schema(&json!([1, 2, 3]), &schema);
        assert!(result.is_success());

        // Too few items
        let result = validate_against_schema(&json!([]), &schema);
        assert!(result.is_failure());

        // Too many items
        let result = validate_against_schema(&json!([1, 2, 3, 4]), &schema);
        assert!(result.is_failure());

        // Wrong item type
        let result = validate_against_schema(&json!([1, "two", 3]), &schema);
        assert!(result.is_failure());
    }

    #[test]
    fn test_schema_registry() {
        let mut registry = SchemaRegistry::new();

        let schema = json!({
            "type": "object",
            "properties": {
                "name": { "type": "string" }
            },
            "required": ["name"]
        });

        // Register should not panic (we cannot test JsValue directly in unit tests)
        assert!(!registry.has_schema("User"));

        // Test internal functionality
        registry.schemas.insert(
            "User".to_string(),
            RegisteredSchema { schema },
        );

        assert!(registry.has_schema("User"));
        assert!(!registry.has_schema("Unknown"));
    }

    #[test]
    fn test_json_type_name() {
        assert_eq!(json_type_name(&json!(null)), "null");
        assert_eq!(json_type_name(&json!(true)), "boolean");
        assert_eq!(json_type_name(&json!(42)), "integer");
        assert_eq!(json_type_name(&json!(3.14)), "number");
        assert_eq!(json_type_name(&json!("hello")), "string");
        assert_eq!(json_type_name(&json!([])), "array");
        assert_eq!(json_type_name(&json!({})), "object");
    }

}

/// WASM-specific tests that require the wasm32 target.
/// Run with: wasm-pack test --node
#[cfg(all(test, target_arch = "wasm32"))]
mod wasm_tests {
    use super::*;
    use serde_json::Value;
    use wasm_bindgen_test::*;

    wasm_bindgen_test_configure!(run_in_browser);

    #[wasm_bindgen_test]
    fn wasm_test_validate_string() {
        let result = validate_string(JsValue::from_str("hello")).unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["value"], "hello");
    }

    #[wasm_bindgen_test]
    fn wasm_test_validate_string_failure() {
        let result = validate_string(JsValue::from_f64(123.0)).unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert!(result["issues"].is_array());
    }

    #[wasm_bindgen_test]
    fn wasm_test_validate_i32() {
        let result = validate_i32(JsValue::from_f64(42.0)).unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["value"], 42);
    }

    #[wasm_bindgen_test]
    fn wasm_test_validate_bool() {
        let result = validate_bool(JsValue::TRUE).unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["value"], true);
    }

    #[wasm_bindgen_test]
    fn wasm_test_string_json_schema() {
        let result = string_json_schema("draft-2020-12").unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["type"], "string");
        assert_eq!(result["$schema"], "https://json-schema.org/draft/2020-12/schema");
    }

    #[wasm_bindgen_test]
    fn wasm_test_i32_json_schema() {
        let result = i32_json_schema("draft-07").unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["type"], "integer");
        assert_eq!(result["$schema"], "http://json-schema.org/draft-07/schema#");
    }

    #[wasm_bindgen_test]
    fn wasm_test_f64_json_schema() {
        let result = f64_json_schema("openapi-3.0").unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["type"], "number");
        // OpenAPI doesn't add $schema
        assert!(result.get("$schema").is_none());
    }

    #[wasm_bindgen_test]
    fn wasm_test_schema_registry() {
        let mut registry = SchemaRegistry::new();

        let schema = js_sys::Object::new();
        js_sys::Reflect::set(&schema, &"type".into(), &"string".into()).unwrap();

        registry.register("TestString", schema.into()).unwrap();
        assert!(registry.has_schema("TestString"));

        let result = registry.validate("TestString", JsValue::from_str("hello")).unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["value"], "hello");

        let result = registry.validate("TestString", JsValue::from_f64(123.0)).unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert!(result["issues"].is_array());
    }

    #[wasm_bindgen_test]
    fn wasm_test_registry_json_schema() {
        let mut registry = SchemaRegistry::new();

        let schema = js_sys::Object::new();
        js_sys::Reflect::set(&schema, &"type".into(), &"object".into()).unwrap();

        registry.register("TestObject", schema.into()).unwrap();

        let result = registry.json_schema("TestObject", "draft-2020-12").unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["type"], "object");
        assert_eq!(result["$schema"], "https://json-schema.org/draft/2020-12/schema");
    }

    #[wasm_bindgen_test]
    fn wasm_test_vendor_and_version() {
        assert_eq!(vendor(), "valrs");
        assert_eq!(version(), 1);
    }
}
