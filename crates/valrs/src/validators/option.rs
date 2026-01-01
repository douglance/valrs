//! Option validation implementations.

use crate::validators::add_schema_uri;
use crate::{JsonSchemaTarget, StandardJsonSchema, ValidationResult, Valrs};
use serde_json::{Value, json};

impl<T: Valrs> Valrs for Option<T> {
    type Input = Option<T::Input>;
    type Output = Option<T::Output>;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value {
            Value::Null => ValidationResult::success(None),
            _ => T::validate(value).map(Some),
        }
    }
}

impl<T: StandardJsonSchema> StandardJsonSchema for Option<T> {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        // Get the inner type's schema without $schema field
        let inner_schema = T::json_schema_input(JsonSchemaTarget::OpenApi30);

        match target {
            // OpenAPI 3.0 uses nullable: true
            JsonSchemaTarget::OpenApi30 => {
                let mut schema = inner_schema;
                if let Value::Object(map) = &mut schema {
                    map.insert("nullable".to_string(), Value::Bool(true));
                }
                schema
            }
            // JSON Schema uses anyOf with null type
            JsonSchemaTarget::Draft202012 | JsonSchemaTarget::Draft07 => {
                let mut schema = json!({
                    "anyOf": [
                        inner_schema,
                        { "type": "null" }
                    ]
                });
                add_schema_uri(&mut schema, target);
                schema
            }
        }
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_option_string_validation() {
        // null -> None
        let result = <Option<String>>::validate(&json!(null));
        assert!(result.is_success());
        assert_eq!(result.ok(), Some(None));

        // string -> Some(string)
        let result = <Option<String>>::validate(&json!("hello"));
        assert!(result.is_success());
        assert_eq!(result.ok(), Some(Some("hello".to_string())));

        // wrong type -> failure
        let result = <Option<String>>::validate(&json!(123));
        assert!(result.is_failure());
    }

    #[test]
    fn test_option_i32_validation() {
        let result = <Option<i32>>::validate(&json!(null));
        assert_eq!(result.ok(), Some(None));

        let result = <Option<i32>>::validate(&json!(42));
        assert_eq!(result.ok(), Some(Some(42)));

        let result = <Option<i32>>::validate(&json!("42"));
        assert!(result.is_failure());
    }

    #[test]
    fn test_nested_option() {
        // Option<Option<i32>>
        let result = <Option<Option<i32>>>::validate(&json!(null));
        assert_eq!(result.ok(), Some(None));

        let result = <Option<Option<i32>>>::validate(&json!(42));
        assert_eq!(result.ok(), Some(Some(Some(42))));
    }

    #[test]
    fn test_option_string_json_schema_openapi() {
        let schema =
            <Option<String> as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
        assert_eq!(schema["type"], "string");
        assert_eq!(schema["nullable"], true);
    }

    #[test]
    fn test_option_string_json_schema_draft_2020_12() {
        let schema = <Option<String> as StandardJsonSchema>::json_schema_input(
            JsonSchemaTarget::Draft202012,
        );
        assert!(schema["anyOf"].is_array());

        let any_of = schema["anyOf"].as_array().unwrap();
        assert_eq!(any_of.len(), 2);
        assert_eq!(any_of[0]["type"], "string");
        assert_eq!(any_of[1]["type"], "null");
        assert_eq!(
            schema["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
    }

    #[test]
    fn test_option_i32_json_schema() {
        let schema =
            <Option<i32> as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
        assert_eq!(schema["type"], "integer");
        assert_eq!(schema["nullable"], true);
    }
}
