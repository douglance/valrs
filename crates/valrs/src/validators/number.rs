//! Number validation implementations.

use crate::validators::add_schema_uri;
use crate::{JsonSchemaTarget, StandardJsonSchema, ValidationResult, Valrs};
use serde_json::{Value, json};

// =============================================================================
// Signed integer implementations
// =============================================================================

impl Valrs for i8 {
    type Input = i8;
    type Output = i8;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_i64() {
            Some(n) if n >= i8::MIN as i64 && n <= i8::MAX as i64 => {
                ValidationResult::success(n as i8)
            }
            Some(_) => ValidationResult::failure(format!(
                "Integer out of range for i8 ({} to {})",
                i8::MIN,
                i8::MAX
            )),
            None => ValidationResult::failure("Expected integer"),
        }
    }
}

impl StandardJsonSchema for i8 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for i16 {
    type Input = i16;
    type Output = i16;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_i64() {
            Some(n) if n >= i16::MIN as i64 && n <= i16::MAX as i64 => {
                ValidationResult::success(n as i16)
            }
            Some(_) => ValidationResult::failure(format!(
                "Integer out of range for i16 ({} to {})",
                i16::MIN,
                i16::MAX
            )),
            None => ValidationResult::failure("Expected integer"),
        }
    }
}

impl StandardJsonSchema for i16 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for i32 {
    type Input = i32;
    type Output = i32;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_i64() {
            Some(n) if n >= i32::MIN as i64 && n <= i32::MAX as i64 => {
                ValidationResult::success(n as i32)
            }
            Some(_) => ValidationResult::failure(format!(
                "Integer out of range for i32 ({} to {})",
                i32::MIN,
                i32::MAX
            )),
            None => ValidationResult::failure("Expected integer"),
        }
    }
}

impl StandardJsonSchema for i32 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for i64 {
    type Input = i64;
    type Output = i64;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_i64() {
            Some(n) => ValidationResult::success(n),
            None => ValidationResult::failure("Expected integer"),
        }
    }
}

impl StandardJsonSchema for i64 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for isize {
    type Input = isize;
    type Output = isize;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_i64() {
            Some(n) if n >= isize::MIN as i64 && n <= isize::MAX as i64 => {
                ValidationResult::success(n as isize)
            }
            Some(_) => ValidationResult::failure("Integer out of range for isize"),
            None => ValidationResult::failure("Expected integer"),
        }
    }
}

impl StandardJsonSchema for isize {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

// =============================================================================
// Unsigned integer implementations
// =============================================================================

impl Valrs for u8 {
    type Input = u8;
    type Output = u8;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_u64() {
            Some(n) if n <= u8::MAX as u64 => ValidationResult::success(n as u8),
            Some(_) => {
                ValidationResult::failure(format!("Integer out of range for u8 (0 to {})", u8::MAX))
            }
            None => ValidationResult::failure("Expected non-negative integer"),
        }
    }
}

impl StandardJsonSchema for u8 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for u16 {
    type Input = u16;
    type Output = u16;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_u64() {
            Some(n) if n <= u16::MAX as u64 => ValidationResult::success(n as u16),
            Some(_) => ValidationResult::failure(format!(
                "Integer out of range for u16 (0 to {})",
                u16::MAX
            )),
            None => ValidationResult::failure("Expected non-negative integer"),
        }
    }
}

impl StandardJsonSchema for u16 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for u32 {
    type Input = u32;
    type Output = u32;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_u64() {
            Some(n) if n <= u32::MAX as u64 => ValidationResult::success(n as u32),
            Some(_) => ValidationResult::failure(format!(
                "Integer out of range for u32 (0 to {})",
                u32::MAX
            )),
            None => ValidationResult::failure("Expected non-negative integer"),
        }
    }
}

impl StandardJsonSchema for u32 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for u64 {
    type Input = u64;
    type Output = u64;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_u64() {
            Some(n) => ValidationResult::success(n),
            None => ValidationResult::failure("Expected non-negative integer"),
        }
    }
}

impl StandardJsonSchema for u64 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for usize {
    type Input = usize;
    type Output = usize;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_u64() {
            Some(n) if n <= usize::MAX as u64 => ValidationResult::success(n as usize),
            Some(_) => ValidationResult::failure("Integer out of range for usize"),
            None => ValidationResult::failure("Expected non-negative integer"),
        }
    }
}

impl StandardJsonSchema for usize {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "integer" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

// =============================================================================
// Float implementations
// =============================================================================

impl Valrs for f32 {
    type Input = f32;
    type Output = f32;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_f64() {
            Some(n) => ValidationResult::success(n as f32),
            None => ValidationResult::failure("Expected number"),
        }
    }
}

impl StandardJsonSchema for f32 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "number" });
        add_schema_uri(&mut schema, target);
        schema
    }

    fn json_schema_output(target: JsonSchemaTarget) -> Value {
        Self::json_schema_input(target)
    }
}

impl Valrs for f64 {
    type Input = f64;
    type Output = f64;

    fn validate(value: &Value) -> ValidationResult<Self::Output> {
        match value.as_f64() {
            Some(n) => ValidationResult::success(n),
            None => ValidationResult::failure("Expected number"),
        }
    }
}

impl StandardJsonSchema for f64 {
    fn json_schema_input(target: JsonSchemaTarget) -> Value {
        let mut schema = json!({ "type": "number" });
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
    fn test_i32_validation() {
        assert!(i32::validate(&json!(42)).is_success());
        assert!(i32::validate(&json!(-42)).is_success());
        assert!(i32::validate(&json!(2147483647)).is_success()); // i32::MAX
        assert!(i32::validate(&json!(2147483648_i64)).is_failure()); // i32::MAX + 1
        assert!(i32::validate(&json!("42")).is_failure());
    }

    #[test]
    fn test_u32_validation() {
        assert!(u32::validate(&json!(42)).is_success());
        assert!(u32::validate(&json!(0)).is_success());
        assert!(u32::validate(&json!(-1)).is_failure());
        assert!(u32::validate(&json!(4294967295_u64)).is_success()); // u32::MAX
        assert!(u32::validate(&json!(4294967296_u64)).is_failure()); // u32::MAX + 1
    }

    #[test]
    fn test_f64_validation() {
        assert!(f64::validate(&json!(3.14)).is_success());
        assert!(f64::validate(&json!(42)).is_success()); // integers are valid
        assert!(f64::validate(&json!("3.14")).is_failure());
    }

    #[test]
    fn test_i8_range() {
        assert!(i8::validate(&json!(127)).is_success());
        assert!(i8::validate(&json!(-128)).is_success());
        assert!(i8::validate(&json!(128)).is_failure());
        assert!(i8::validate(&json!(-129)).is_failure());
    }

    #[test]
    fn test_i32_json_schema() {
        let schema = <i32 as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::Draft202012);
        assert_eq!(schema["type"], "integer");
        assert_eq!(
            schema["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
    }

    #[test]
    fn test_u64_json_schema() {
        let schema = <u64 as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
        assert_eq!(schema["type"], "integer");
        assert!(schema.get("$schema").is_none());
    }

    #[test]
    fn test_f64_json_schema() {
        let schema = <f64 as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::Draft07);
        assert_eq!(schema["type"], "number");
        assert_eq!(schema["$schema"], "http://json-schema.org/draft-07/schema#");
    }
}
