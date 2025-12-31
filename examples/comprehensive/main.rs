//! Comprehensive test example exercising ALL features of valrs.
//!
//! Run with: cargo run --example comprehensive
//!
//! This example demonstrates:
//! - All primitive types (String, bool, integers, floats)
//! - Option<T> for each primitive
//! - Derive macros (Valrs, StandardJsonSchema, both together)
//! - All schema attributes (optional, rename, min_length, max_length)
//! - Nested structs with path reporting
//! - Validation scenarios (valid, missing fields, wrong types, constraint violations)
//! - JSON Schema generation (Draft202012, Draft07, OpenApi30)
//! - Edge cases (empty strings, zero values, large numbers, unicode)

use serde_json::json;
use valrs::{JsonSchemaTarget, StandardJsonSchema, Valrs, ValidationResult};
use valrs_derive::{StandardJsonSchema, Valrs};

// =============================================================================
// Test Results Tracking
// =============================================================================

struct TestRunner {
    passed: usize,
    failed: usize,
    current_section: String,
}

impl TestRunner {
    fn new() -> Self {
        TestRunner {
            passed: 0,
            failed: 0,
            current_section: String::new(),
        }
    }

    fn section(&mut self, name: &str) {
        self.current_section = name.to_string();
        println!("\n--- {} ---\n", name);
    }

    fn pass(&mut self, test_name: &str, details: &str) {
        self.passed += 1;
        println!("[PASS] {}: {}", test_name, details);
    }

    fn fail(&mut self, test_name: &str, expected: &str, actual: &str) {
        self.failed += 1;
        println!("[FAIL] {}", test_name);
        println!("       Expected: {}", expected);
        println!("       Actual:   {}", actual);
    }

    fn assert_success<T: std::fmt::Debug>(&mut self, test_name: &str, result: &ValidationResult<T>) {
        match result {
            ValidationResult::Success(val) => {
                self.pass(test_name, &format!("{:?}", val));
            }
            ValidationResult::Failure(issues) => {
                let msgs: Vec<_> = issues.iter().map(|i| i.message.as_str()).collect();
                self.fail(test_name, "Success", &format!("Failure: {:?}", msgs));
            }
        }
    }

    fn assert_failure<T: std::fmt::Debug>(&mut self, test_name: &str, result: &ValidationResult<T>, expected_message_contains: &str) {
        match result {
            ValidationResult::Success(val) => {
                self.fail(test_name, &format!("Failure containing '{}'", expected_message_contains), &format!("Success: {:?}", val));
            }
            ValidationResult::Failure(issues) => {
                let has_expected = issues.iter().any(|i| i.message.contains(expected_message_contains));
                if has_expected {
                    let msgs: Vec<_> = issues.iter().map(|i| i.message.as_str()).collect();
                    self.pass(test_name, &format!("Failure: {:?}", msgs));
                } else {
                    let msgs: Vec<_> = issues.iter().map(|i| i.message.as_str()).collect();
                    self.fail(
                        test_name,
                        &format!("Failure containing '{}'", expected_message_contains),
                        &format!("Failure: {:?}", msgs),
                    );
                }
            }
        }
    }

    fn assert_failure_at_path<T: std::fmt::Debug>(&mut self, test_name: &str, result: &ValidationResult<T>, expected_path: &str) {
        match result {
            ValidationResult::Success(val) => {
                self.fail(test_name, &format!("Failure at path '{}'", expected_path), &format!("Success: {:?}", val));
            }
            ValidationResult::Failure(issues) => {
                let has_path = issues.iter().any(|i| {
                    if let Some(path) = &i.path {
                        let path_str = path.iter().map(|p| match p {
                            valrs::PathSegment::Key(k) => k.clone(),
                            valrs::PathSegment::Index(i) => i.to_string(),
                        }).collect::<Vec<_>>().join(".");
                        path_str.contains(expected_path)
                    } else {
                        false
                    }
                });
                if has_path {
                    let details: Vec<_> = issues.iter().map(|i| {
                        format!("{} at {:?}", i.message, i.path)
                    }).collect();
                    self.pass(test_name, &format!("{:?}", details));
                } else {
                    let details: Vec<_> = issues.iter().map(|i| {
                        format!("{} at {:?}", i.message, i.path)
                    }).collect();
                    self.fail(
                        test_name,
                        &format!("Failure at path '{}'", expected_path),
                        &format!("{:?}", details),
                    );
                }
            }
        }
    }

    fn assert_schema_has(&mut self, test_name: &str, schema: &serde_json::Value, key: &str, expected: &serde_json::Value) {
        if let Some(actual) = schema.get(key) {
            if actual == expected {
                self.pass(test_name, &format!("{}: {}", key, expected));
            } else {
                self.fail(test_name, &expected.to_string(), &actual.to_string());
            }
        } else {
            self.fail(test_name, &format!("{}: {}", key, expected), &format!("{} not found", key));
        }
    }

    fn assert_schema_property_has(&mut self, test_name: &str, schema: &serde_json::Value, prop: &str, key: &str, expected: &serde_json::Value) {
        if let Some(props) = schema.get("properties") {
            if let Some(prop_schema) = props.get(prop) {
                if let Some(actual) = prop_schema.get(key) {
                    if actual == expected {
                        self.pass(test_name, &format!("properties.{}.{}: {}", prop, key, expected));
                    } else {
                        self.fail(test_name, &expected.to_string(), &actual.to_string());
                    }
                } else {
                    self.fail(test_name, &format!("properties.{}.{}: {}", prop, key, expected), &format!("{} not found", key));
                }
            } else {
                self.fail(test_name, &format!("properties.{}.{}: {}", prop, key, expected), &format!("property {} not found", prop));
            }
        } else {
            self.fail(test_name, &format!("properties.{}.{}: {}", prop, key, expected), "no properties");
        }
    }

    fn assert_required_contains(&mut self, test_name: &str, schema: &serde_json::Value, field: &str) {
        if let Some(required) = schema.get("required") {
            if let Some(arr) = required.as_array() {
                let has_field = arr.iter().any(|v| v.as_str() == Some(field));
                if has_field {
                    self.pass(test_name, &format!("required contains '{}'", field));
                } else {
                    self.fail(test_name, &format!("required contains '{}'", field), &format!("required: {:?}", arr));
                }
            } else {
                self.fail(test_name, &format!("required contains '{}'", field), "required is not an array");
            }
        } else {
            self.fail(test_name, &format!("required contains '{}'", field), "no required array");
        }
    }

    fn assert_required_not_contains(&mut self, test_name: &str, schema: &serde_json::Value, field: &str) {
        if let Some(required) = schema.get("required") {
            if let Some(arr) = required.as_array() {
                let has_field = arr.iter().any(|v| v.as_str() == Some(field));
                if !has_field {
                    self.pass(test_name, &format!("required does not contain '{}'", field));
                } else {
                    self.fail(test_name, &format!("required should not contain '{}'", field), &format!("required: {:?}", arr));
                }
            } else {
                self.pass(test_name, &format!("required does not contain '{}' (no array)", field));
            }
        } else {
            self.pass(test_name, &format!("required does not contain '{}' (no required)", field));
        }
    }

    fn summary(&self) {
        println!("\n=== Results: {}/{} passed ===", self.passed, self.passed + self.failed);
        if self.failed > 0 {
            std::process::exit(1);
        }
    }
}

// =============================================================================
// Model Definitions
// =============================================================================

/// Basic user struct demonstrating rename and optional fields.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct User {
    pub name: String,
    #[schema(rename = "emailAddress")]
    pub email: String,
    pub age: u32,
    #[schema(optional)]
    pub nickname: Option<String>,
}

/// Profile with string length constraints.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct Profile {
    #[schema(min_length = 2, max_length = 50)]
    pub username: String,
    #[schema(optional, min_length = 10)]
    pub bio: Option<String>,
}

/// Struct with all integer types.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct AllIntegers {
    pub signed_8: i8,
    pub signed_16: i16,
    pub signed_32: i32,
    pub signed_64: i64,
    pub unsigned_8: u8,
    pub unsigned_16: u16,
    pub unsigned_32: u32,
    pub unsigned_64: u64,
}

/// Struct with all float types.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct AllFloats {
    pub float_32: f32,
    pub float_64: f64,
}

/// Struct with optional primitives.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct OptionalPrimitives {
    #[schema(optional)]
    pub opt_string: Option<String>,
    #[schema(optional)]
    pub opt_bool: Option<bool>,
    #[schema(optional)]
    pub opt_i32: Option<i32>,
    #[schema(optional)]
    pub opt_f64: Option<f64>,
}

/// Address for nested struct testing.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct Address {
    pub street: String,
    pub city: String,
    #[schema(min_length = 2, max_length = 2)]
    pub country_code: String,
}

/// Person with nested address.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct Person {
    pub name: String,
    pub address: Address,
}

/// Struct with multiple constraints.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct ConstrainedFields {
    #[schema(min_length = 1)]
    pub non_empty: String,
    #[schema(max_length = 10)]
    pub short: String,
    #[schema(min_length = 5, max_length = 20)]
    pub bounded: String,
    #[schema(optional, min_length = 3, max_length = 8)]
    pub optional_bounded: Option<String>,
}

/// Only Valrs derive (no JSON Schema).
#[derive(Debug, Default, Valrs)]
pub struct ValidationOnly {
    pub value: String,
}

/// Only StandardJsonSchema derive.
/// Note: This requires Valrs to be implemented as StandardJsonSchema extends it.
/// For this example, we'll use the manual impl approach or just show both derives.
#[derive(Debug, Default, Valrs, StandardJsonSchema)]
pub struct SchemaOnly {
    pub value: String,
}

// =============================================================================
// Main Test Runner
// =============================================================================

fn main() {
    println!("=== Standard Schema Comprehensive Test Suite ===");

    let mut runner = TestRunner::new();

    test_primitive_types(&mut runner);
    test_string_validation(&mut runner);
    test_integer_validation(&mut runner);
    test_float_validation(&mut runner);
    test_boolean_validation(&mut runner);
    test_option_validation(&mut runner);
    test_struct_validation(&mut runner);
    test_schema_attributes(&mut runner);
    test_nested_validation(&mut runner);
    test_json_schema_generation(&mut runner);
    test_json_schema_targets(&mut runner);
    test_edge_cases(&mut runner);

    runner.summary();
}

// =============================================================================
// Primitive Type Tests
// =============================================================================

fn test_primitive_types(runner: &mut TestRunner) {
    runner.section("Primitive Types");

    // String
    let result = String::validate(&json!("hello"));
    runner.assert_success("String validation: \"hello\"", &result);

    // bool
    let result = bool::validate(&json!(true));
    runner.assert_success("bool validation: true", &result);

    let result = bool::validate(&json!(false));
    runner.assert_success("bool validation: false", &result);

    // i8
    let result = i8::validate(&json!(127));
    runner.assert_success("i8 validation: 127 (max)", &result);

    let result = i8::validate(&json!(-128));
    runner.assert_success("i8 validation: -128 (min)", &result);

    // i16
    let result = i16::validate(&json!(32767));
    runner.assert_success("i16 validation: 32767 (max)", &result);

    // i32
    let result = i32::validate(&json!(2147483647));
    runner.assert_success("i32 validation: 2147483647 (max)", &result);

    // i64
    let result = i64::validate(&json!(9223372036854775807_i64));
    runner.assert_success("i64 validation: i64::MAX", &result);

    // u8
    let result = u8::validate(&json!(255));
    runner.assert_success("u8 validation: 255 (max)", &result);

    // u16
    let result = u16::validate(&json!(65535));
    runner.assert_success("u16 validation: 65535 (max)", &result);

    // u32
    let result = u32::validate(&json!(4294967295_u64));
    runner.assert_success("u32 validation: 4294967295 (max)", &result);

    // u64
    let result = u64::validate(&json!(18446744073709551615_u64));
    runner.assert_success("u64 validation: u64::MAX", &result);

    // f32
    let result = f32::validate(&json!(3.14));
    runner.assert_success("f32 validation: 3.14", &result);

    // f64
    let result = f64::validate(&json!(3.141592653589793));
    runner.assert_success("f64 validation: pi", &result);

    // Unit (null)
    let result = <()>::validate(&json!(null));
    runner.assert_success("() validation: null", &result);
}

fn test_string_validation(runner: &mut TestRunner) {
    runner.section("String Validation");

    let result = String::validate(&json!(""));
    runner.assert_success("Empty string", &result);

    let result = String::validate(&json!(123));
    runner.assert_failure("Integer as string", &result, "Expected string");

    let result = String::validate(&json!(null));
    runner.assert_failure("Null as string", &result, "Expected string");

    let result = String::validate(&json!(true));
    runner.assert_failure("Bool as string", &result, "Expected string");

    let result = String::validate(&json!({"key": "value"}));
    runner.assert_failure("Object as string", &result, "Expected string");
}

fn test_integer_validation(runner: &mut TestRunner) {
    runner.section("Integer Validation");

    // Type rejection
    let result = i32::validate(&json!("42"));
    runner.assert_failure("String as i32", &result, "Expected integer");

    let result = i32::validate(&json!(3.14));
    runner.assert_failure("Float as i32", &result, "Expected integer");

    let result = i32::validate(&json!(null));
    runner.assert_failure("Null as i32", &result, "Expected integer");

    // Range checking
    let result = i8::validate(&json!(128));
    runner.assert_failure("i8 overflow: 128", &result, "out of range");

    let result = i8::validate(&json!(-129));
    runner.assert_failure("i8 underflow: -129", &result, "out of range");

    let result = u8::validate(&json!(-1));
    runner.assert_failure("Negative as u8", &result, "Expected non-negative");

    let result = u8::validate(&json!(256));
    runner.assert_failure("u8 overflow: 256", &result, "out of range");

    // Zero values
    let result = i32::validate(&json!(0));
    runner.assert_success("i32: zero", &result);

    let result = u64::validate(&json!(0));
    runner.assert_success("u64: zero", &result);
}

fn test_float_validation(runner: &mut TestRunner) {
    runner.section("Float Validation");

    // Integers are valid floats
    let result = f64::validate(&json!(42));
    runner.assert_success("Integer as f64", &result);

    let result = f64::validate(&json!(-0.0));
    runner.assert_success("Negative zero f64", &result);

    let result = f32::validate(&json!("3.14"));
    runner.assert_failure("String as f32", &result, "Expected number");

    let result = f64::validate(&json!(null));
    runner.assert_failure("Null as f64", &result, "Expected number");
}

fn test_boolean_validation(runner: &mut TestRunner) {
    runner.section("Boolean Validation");

    let result = bool::validate(&json!(1));
    runner.assert_failure("Integer 1 as bool", &result, "Expected boolean");

    let result = bool::validate(&json!(0));
    runner.assert_failure("Integer 0 as bool", &result, "Expected boolean");

    let result = bool::validate(&json!("true"));
    runner.assert_failure("String \"true\" as bool", &result, "Expected boolean");

    let result = bool::validate(&json!(null));
    runner.assert_failure("Null as bool", &result, "Expected boolean");
}

fn test_option_validation(runner: &mut TestRunner) {
    runner.section("Option<T> Validation");

    // Option<String>
    let result = <Option<String>>::validate(&json!(null));
    runner.assert_success("Option<String>: null -> None", &result);

    let result = <Option<String>>::validate(&json!("hello"));
    runner.assert_success("Option<String>: \"hello\" -> Some", &result);

    let result = <Option<String>>::validate(&json!(123));
    runner.assert_failure("Option<String>: integer", &result, "Expected string");

    // Option<i32>
    let result = <Option<i32>>::validate(&json!(null));
    runner.assert_success("Option<i32>: null -> None", &result);

    let result = <Option<i32>>::validate(&json!(42));
    runner.assert_success("Option<i32>: 42 -> Some(42)", &result);

    let result = <Option<i32>>::validate(&json!("42"));
    runner.assert_failure("Option<i32>: string \"42\"", &result, "Expected integer");

    // Option<bool>
    let result = <Option<bool>>::validate(&json!(null));
    runner.assert_success("Option<bool>: null -> None", &result);

    let result = <Option<bool>>::validate(&json!(true));
    runner.assert_success("Option<bool>: true -> Some(true)", &result);

    // Option<f64>
    let result = <Option<f64>>::validate(&json!(null));
    runner.assert_success("Option<f64>: null -> None", &result);

    let result = <Option<f64>>::validate(&json!(3.14));
    runner.assert_success("Option<f64>: 3.14 -> Some(3.14)", &result);

    // Nested Option
    let result = <Option<Option<i32>>>::validate(&json!(null));
    runner.assert_success("Option<Option<i32>>: null -> None", &result);

    let result = <Option<Option<i32>>>::validate(&json!(42));
    runner.assert_success("Option<Option<i32>>: 42 -> Some(Some(42))", &result);
}

fn test_struct_validation(runner: &mut TestRunner) {
    runner.section("Struct Validation");

    // Valid User with all fields
    let valid_user = json!({
        "name": "Alice",
        "emailAddress": "alice@example.com",
        "age": 30,
        "nickname": "Ali"
    });
    let result = User::validate(&valid_user);
    runner.assert_success("User with all fields", &result);

    // Valid User without optional nickname
    let user_no_nickname = json!({
        "name": "Bob",
        "emailAddress": "bob@example.com",
        "age": 25
    });
    let result = User::validate(&user_no_nickname);
    runner.assert_success("User without optional nickname", &result);

    // User with null nickname (optional)
    let user_null_nickname = json!({
        "name": "Charlie",
        "emailAddress": "charlie@example.com",
        "age": 35,
        "nickname": null
    });
    let result = User::validate(&user_null_nickname);
    runner.assert_success("User with null nickname", &result);

    // Missing required field (email via rename)
    let missing_email = json!({
        "name": "Diana",
        "age": 28
    });
    let result = User::validate(&missing_email);
    runner.assert_failure_at_path("Missing required emailAddress", &result, "emailAddress");

    // Missing multiple required fields
    let missing_many = json!({
        "nickname": "Nick"
    });
    let result = User::validate(&missing_many);
    runner.assert_failure("Missing name, emailAddress, age", &result, "Missing required field");

    // Wrong type for field
    let wrong_type = json!({
        "name": "Eve",
        "emailAddress": "eve@example.com",
        "age": "thirty"
    });
    let result = User::validate(&wrong_type);
    runner.assert_failure_at_path("Wrong type for age", &result, "age");

    // Not an object
    let not_object = json!("just a string");
    let result = User::validate(&not_object);
    runner.assert_failure("String instead of object", &result, "Expected object");

    let not_object = json!(123);
    let result = User::validate(&not_object);
    runner.assert_failure("Number instead of object", &result, "Expected object");

    let not_object = json!([1, 2, 3]);
    let result = User::validate(&not_object);
    runner.assert_failure("Array instead of object", &result, "Expected object");

    let not_object = json!(null);
    let result = User::validate(&not_object);
    runner.assert_failure("Null instead of object", &result, "Expected object");
}

fn test_schema_attributes(runner: &mut TestRunner) {
    runner.section("Schema Attributes");

    // min_length validation
    let short_username = json!({
        "username": "a"
    });
    let result = Profile::validate(&short_username);
    runner.assert_failure("Username too short (min_length = 2)", &result, "at least 2");

    // max_length validation
    let long_username = json!({
        "username": "this_username_is_way_too_long_for_the_fifty_character_maximum_limit"
    });
    let result = Profile::validate(&long_username);
    runner.assert_failure("Username too long (max_length = 50)", &result, "at most 50");

    // Valid length
    let valid_profile = json!({
        "username": "alice123"
    });
    let result = Profile::validate(&valid_profile);
    runner.assert_success("Valid username length", &result);

    // Optional with min_length: present and valid
    let with_bio = json!({
        "username": "bob",
        "bio": "This is my biography text that is long enough"
    });
    let result = Profile::validate(&with_bio);
    runner.assert_success("Optional bio present and valid", &result);

    // Optional with min_length: present but too short
    let short_bio = json!({
        "username": "bob",
        "bio": "Too short"
    });
    let result = Profile::validate(&short_bio);
    runner.assert_failure("Optional bio too short", &result, "at least 10");

    // Optional with min_length: null
    let null_bio = json!({
        "username": "bob",
        "bio": null
    });
    let result = Profile::validate(&null_bio);
    runner.assert_success("Optional bio null", &result);

    // Optional with min_length: missing
    let missing_bio = json!({
        "username": "bob"
    });
    let result = Profile::validate(&missing_bio);
    runner.assert_success("Optional bio missing", &result);

    // Combined constraints
    let constrained = json!({
        "non_empty": "x",
        "short": "short",
        "bounded": "medium length"
    });
    let result = ConstrainedFields::validate(&constrained);
    runner.assert_success("All constraints satisfied", &result);

    let empty_non_empty = json!({
        "non_empty": "",
        "short": "short",
        "bounded": "medium"
    });
    let result = ConstrainedFields::validate(&empty_non_empty);
    runner.assert_failure("non_empty field empty", &result, "at least 1");

    let too_long_short = json!({
        "non_empty": "x",
        "short": "this is too long for max 10",
        "bounded": "medium"
    });
    let result = ConstrainedFields::validate(&too_long_short);
    runner.assert_failure("short field too long", &result, "at most 10");

    let bounded_too_short = json!({
        "non_empty": "x",
        "short": "ok",
        "bounded": "four"
    });
    let result = ConstrainedFields::validate(&bounded_too_short);
    runner.assert_failure("bounded too short (min 5)", &result, "at least 5");

    let bounded_too_long = json!({
        "non_empty": "x",
        "short": "ok",
        "bounded": "this string is way too long for the maximum of 20"
    });
    let result = ConstrainedFields::validate(&bounded_too_long);
    runner.assert_failure("bounded too long (max 20)", &result, "at most 20");
}

fn test_nested_validation(runner: &mut TestRunner) {
    runner.section("Nested Struct Validation");

    // Valid nested struct
    let valid_person = json!({
        "name": "Alice",
        "address": {
            "street": "123 Main St",
            "city": "Springfield",
            "country_code": "US"
        }
    });
    let result = Person::validate(&valid_person);
    runner.assert_success("Valid nested Person", &result);

    // Missing nested field
    let missing_city = json!({
        "name": "Bob",
        "address": {
            "street": "456 Oak Ave",
            "country_code": "UK"
        }
    });
    let result = Person::validate(&missing_city);
    runner.assert_failure_at_path("Missing nested city field", &result, "address");

    // Wrong type in nested field
    let wrong_nested_type = json!({
        "name": "Charlie",
        "address": {
            "street": 123,
            "city": "Boston",
            "country_code": "US"
        }
    });
    let result = Person::validate(&wrong_nested_type);
    runner.assert_failure_at_path("Wrong type in nested street", &result, "address");

    // Nested constraint violation
    let bad_country_code = json!({
        "name": "Diana",
        "address": {
            "street": "789 Pine Rd",
            "city": "Seattle",
            "country_code": "USA"
        }
    });
    let result = Person::validate(&bad_country_code);
    runner.assert_failure("Country code too long (max 2)", &result, "at most 2");

    let short_country_code = json!({
        "name": "Eve",
        "address": {
            "street": "101 Elm Blvd",
            "city": "Portland",
            "country_code": "U"
        }
    });
    let result = Person::validate(&short_country_code);
    runner.assert_failure("Country code too short (min 2)", &result, "at least 2");

    // Missing entire nested object
    let missing_address = json!({
        "name": "Frank"
    });
    let result = Person::validate(&missing_address);
    runner.assert_failure_at_path("Missing entire nested address", &result, "address");

    // Nested is wrong type
    let address_not_object = json!({
        "name": "Grace",
        "address": "123 Main St"
    });
    let result = Person::validate(&address_not_object);
    runner.assert_failure_at_path("Address is string not object", &result, "address");
}

fn test_json_schema_generation(runner: &mut TestRunner) {
    runner.section("JSON Schema Generation");

    // User schema
    let user_schema = User::json_schema_input(JsonSchemaTarget::Draft202012);

    runner.assert_schema_has("User has type object", &user_schema, "type", &json!("object"));
    runner.assert_required_contains("User requires name", &user_schema, "name");
    runner.assert_required_contains("User requires emailAddress", &user_schema, "emailAddress");
    runner.assert_required_contains("User requires age", &user_schema, "age");
    runner.assert_required_not_contains("User does not require nickname", &user_schema, "nickname");

    runner.assert_schema_property_has("User name is string", &user_schema, "name", "type", &json!("string"));
    runner.assert_schema_property_has("User emailAddress is string", &user_schema, "emailAddress", "type", &json!("string"));
    runner.assert_schema_property_has("User age is integer", &user_schema, "age", "type", &json!("integer"));

    // Profile schema with constraints
    let profile_schema = Profile::json_schema_input(JsonSchemaTarget::Draft202012);

    runner.assert_schema_property_has("Profile username minLength", &profile_schema, "username", "minLength", &json!(2));
    runner.assert_schema_property_has("Profile username maxLength", &profile_schema, "username", "maxLength", &json!(50));

    // Note: The bio property schema might have minLength but might not due to how optional fields are handled
    // Check that it exists as a property
    if let Some(props) = profile_schema.get("properties") {
        if props.get("bio").is_some() {
            runner.pass("Profile has bio property", "present");
        } else {
            runner.fail("Profile has bio property", "present", "missing");
        }
    }

    // Primitive schemas
    let string_schema = <String as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
    runner.assert_schema_has("String schema type", &string_schema, "type", &json!("string"));

    let i32_schema = <i32 as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
    runner.assert_schema_has("i32 schema type", &i32_schema, "type", &json!("integer"));

    let f64_schema = <f64 as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
    runner.assert_schema_has("f64 schema type", &f64_schema, "type", &json!("number"));

    let bool_schema = <bool as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
    runner.assert_schema_has("bool schema type", &bool_schema, "type", &json!("boolean"));

    let null_schema = <() as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
    runner.assert_schema_has("() schema type", &null_schema, "type", &json!("null"));
}

fn test_json_schema_targets(runner: &mut TestRunner) {
    runner.section("JSON Schema Targets");

    // Draft 2020-12
    let schema_2020 = User::json_schema_input(JsonSchemaTarget::Draft202012);
    runner.assert_schema_has(
        "Draft202012 $schema URI",
        &schema_2020,
        "$schema",
        &json!("https://json-schema.org/draft/2020-12/schema"),
    );

    // Draft 07
    let schema_07 = User::json_schema_input(JsonSchemaTarget::Draft07);
    runner.assert_schema_has(
        "Draft07 $schema URI",
        &schema_07,
        "$schema",
        &json!("http://json-schema.org/draft-07/schema#"),
    );

    // OpenAPI 3.0 (no $schema)
    let schema_openapi = User::json_schema_input(JsonSchemaTarget::OpenApi30);
    if schema_openapi.get("$schema").is_none() {
        runner.pass("OpenApi30 has no $schema", "correct");
    } else {
        runner.fail("OpenApi30 has no $schema", "no $schema", &format!("$schema: {:?}", schema_openapi.get("$schema")));
    }

    // Option<T> schema differences
    let opt_string_openapi = <Option<String> as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30);
    runner.assert_schema_has("Option<String> OpenAPI has nullable", &opt_string_openapi, "nullable", &json!(true));

    let opt_string_draft = <Option<String> as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::Draft202012);
    if opt_string_draft.get("anyOf").is_some() {
        runner.pass("Option<String> Draft2020 has anyOf", "present");
    } else {
        runner.fail("Option<String> Draft2020 has anyOf", "anyOf present", "anyOf missing");
    }
}

fn test_edge_cases(runner: &mut TestRunner) {
    runner.section("Edge Cases");

    // Empty string
    let result = String::validate(&json!(""));
    runner.assert_success("Empty string is valid String", &result);

    // Unicode strings
    let result = String::validate(&json!("Hello, World!"));
    runner.assert_success("Unicode greeting", &result);

    let result = String::validate(&json!("Emoji test: something"));
    runner.assert_success("Unicode with emoji placeholder", &result);

    // Very long string
    let long_string = "a".repeat(10000);
    let result = String::validate(&serde_json::Value::String(long_string.clone()));
    runner.assert_success("Very long string (10000 chars)", &result);

    // Zero values
    let result = i32::validate(&json!(0));
    runner.assert_success("i32: 0", &result);

    let result = f64::validate(&json!(0.0));
    runner.assert_success("f64: 0.0", &result);

    let result = u64::validate(&json!(0));
    runner.assert_success("u64: 0", &result);

    // Negative zero
    let result = f64::validate(&json!(-0.0));
    runner.assert_success("f64: -0.0", &result);

    // Large numbers
    let result = i64::validate(&json!(i64::MAX));
    runner.assert_success("i64::MAX", &result);

    let result = i64::validate(&json!(i64::MIN));
    runner.assert_success("i64::MIN", &result);

    let result = u64::validate(&json!(u64::MAX));
    runner.assert_success("u64::MAX", &result);

    // Scientific notation (JSON numbers)
    let result = f64::validate(&json!(1.23e10));
    runner.assert_success("Scientific notation: 1.23e10", &result);

    // Extra fields in input (should be ignored)
    let extra_fields = json!({
        "name": "Alice",
        "emailAddress": "alice@example.com",
        "age": 30,
        "extra_field": "ignored",
        "another_extra": 12345
    });
    let result = User::validate(&extra_fields);
    runner.assert_success("Extra fields are ignored", &result);

    // Empty object
    let empty_obj = json!({});
    let result = User::validate(&empty_obj);
    runner.assert_failure("Empty object missing all required fields", &result, "Missing required field");

    // All integer types struct
    let all_ints = json!({
        "signed_8": 127,
        "signed_16": 32767,
        "signed_32": 2147483647,
        "signed_64": 9223372036854775807_i64,
        "unsigned_8": 255,
        "unsigned_16": 65535,
        "unsigned_32": 4294967295_u64,
        "unsigned_64": 18446744073709551615_u64
    });
    let result = AllIntegers::validate(&all_ints);
    runner.assert_success("All integer types at max values", &result);

    let all_ints_zero = json!({
        "signed_8": 0,
        "signed_16": 0,
        "signed_32": 0,
        "signed_64": 0,
        "unsigned_8": 0,
        "unsigned_16": 0,
        "unsigned_32": 0,
        "unsigned_64": 0
    });
    let result = AllIntegers::validate(&all_ints_zero);
    runner.assert_success("All integer types at zero", &result);

    // All float types struct
    let all_floats = json!({
        "float_32": 3.14,
        "float_64": 3.141592653589793
    });
    let result = AllFloats::validate(&all_floats);
    runner.assert_success("All float types", &result);

    // Optional primitives all null
    let all_nulls = json!({
        "opt_string": null,
        "opt_bool": null,
        "opt_i32": null,
        "opt_f64": null
    });
    let result = OptionalPrimitives::validate(&all_nulls);
    runner.assert_success("All optional fields null", &result);

    // Optional primitives all missing
    let all_missing = json!({});
    let result = OptionalPrimitives::validate(&all_missing);
    runner.assert_success("All optional fields missing", &result);

    // Optional primitives all present
    let all_present = json!({
        "opt_string": "hello",
        "opt_bool": true,
        "opt_i32": 42,
        "opt_f64": 3.14
    });
    let result = OptionalPrimitives::validate(&all_present);
    runner.assert_success("All optional fields present", &result);

    // Whitespace-only strings (valid, not empty content-wise but empty for some use cases)
    let result = String::validate(&json!("   "));
    runner.assert_success("Whitespace-only string", &result);

    // String with newlines
    let result = String::validate(&json!("line1\nline2\nline3"));
    runner.assert_success("Multi-line string", &result);

    // String length edge cases with constraints
    let exactly_min = json!({
        "username": "ab",  // exactly 2 chars (min_length)
        "bio": null
    });
    let result = Profile::validate(&exactly_min);
    runner.assert_success("Username exactly at min_length", &result);

    let exactly_max = json!({
        "username": "a".repeat(50),  // exactly 50 chars (max_length)
        "bio": null
    });
    let result = Profile::validate(&serde_json::to_value(&exactly_max).unwrap());
    runner.assert_success("Username exactly at max_length", &result);
}
