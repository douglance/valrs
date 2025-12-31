//! String validation implementations.

use crate::validators::add_schema_uri;
use crate::{JsonSchemaTarget, StandardJsonSchema, Valrs, ValidationResult};
use serde_json::{json, Value};

impl Valrs for String {
    type Input = String;
    type Output = String;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_str() {
            Some(s) => ValidationResult::success(s.to_string()),
            None => ValidationResult::failure("Expected string"),
        }
    }
}

impl StandardJsonSchema for String {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "string" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

/// A non-empty string validator.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NonEmptyString(pub String);

impl Valrs for NonEmptyString {
    type Input = String;
    type Output = NonEmptyString;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_str() {
            Some(s) if !s.is_empty() => ValidationResult::success(NonEmptyString(s.to_string())),
            Some(_) => ValidationResult::failure("String must not be empty"),
            None => ValidationResult::failure("Expected string"),
        }
    }
}

impl StandardJsonSchema for NonEmptyString {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({
            "type": "string",
            "minLength": 1
        });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

/// A string with minimum length validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MinLengthString<const N: usize>(pub String);

impl<const N: usize> Valrs for MinLengthString<N> {
    type Input = String;
    type Output = MinLengthString<N>;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_str() {
            Some(s) if s.len() >= N => ValidationResult::success(MinLengthString(s.to_string())),
            Some(s) => ValidationResult::failure(format!(
                "String must be at least {} characters, got {}",
                N,
                s.len()
            )),
            None => ValidationResult::failure("Expected string"),
        }
    }
}

impl<const N: usize> StandardJsonSchema for MinLengthString<N> {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({
            "type": "string",
            "minLength": N
        });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

/// A string with maximum length validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MaxLengthString<const N: usize>(pub String);

impl<const N: usize> Valrs for MaxLengthString<N> {
    type Input = String;
    type Output = MaxLengthString<N>;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_str() {
            Some(s) if s.len() <= N => ValidationResult::success(MaxLengthString(s.to_string())),
            Some(s) => ValidationResult::failure(format!(
                "String must be at most {} characters, got {}",
                N,
                s.len()
            )),
            None => ValidationResult::failure("Expected string"),
        }
    }
}

impl<const N: usize> StandardJsonSchema for MaxLengthString<N> {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({
            "type": "string",
            "maxLength": N
        });
        add_schema_uri(&mut schema, target);
        schema
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
    fn test_string_validation() {
        assert!(String::validate(&json!("hello")).is_success());
        assert!(String::validate(&json!("")).is_success());
        assert!(String::validate(&json!(123)).is_failure());
        assert!(String::validate(&json!(null)).is_failure());
    }

    #[test]
    fn test_non_empty_string() {
        assert!(NonEmptyString::validate(&json!("hello")).is_success());
        assert!(NonEmptyString::validate(&json!("")).is_failure());
    }

    #[test]
    fn test_min_length_string() {
        assert!(MinLengthString::<3>::validate(&json!("abc")).is_success());
        assert!(MinLengthString::<3>::validate(&json!("abcd")).is_success());
        assert!(MinLengthString::<3>::validate(&json!("ab")).is_failure());
    }

    #[test]
    fn test_max_length_string() {
        assert!(MaxLengthString::<5>::validate(&json!("abc")).is_success());
        assert!(MaxLengthString::<5>::validate(&json!("abcde")).is_success());
        assert!(MaxLengthString::<5>::validate(&json!("abcdef")).is_failure());
    }

    #[test]
    fn test_string_json_schema() {
        let schema =
            <String as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::Draft202012);
        assert_eq!(schema["type"], "string");
        assert_eq!(
            schema["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
    }

    #[test]
    fn test_non_empty_string_json_schema() {
        let schema =
            <NonEmptyString as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
        assert_eq!(schema["type"], "string");
        assert_eq!(schema["minLength"], 1);
    }

    #[test]
    fn test_min_length_string_json_schema() {
        let schema = <MinLengthString<5> as StandardJsonSchema>::json_schema_input(
            JsonSchemaTarget::OpenApi30,
        );
        assert_eq!(schema["type"], "string");
        assert_eq!(schema["minLength"], 5);
    }

    #[test]
    fn test_max_length_string_json_schema() {
        let schema = <MaxLengthString<10> as StandardJsonSchema>::json_schema_input(
            JsonSchemaTarget::OpenApi30,
        );
        assert_eq!(schema["type"], "string");
        assert_eq!(schema["maxLength"], 10);
    }
}
