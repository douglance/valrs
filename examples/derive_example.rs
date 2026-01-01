//! Example demonstrating the Valrs and StandardJsonSchema derive macros.
//!
//! Run with: cargo run --example derive_example

use serde_json::json;
use valrs::{JsonSchemaTarget, StandardJsonSchema, ValidationResult, Valrs};
use valrs_derive::{StandardJsonSchema, Valrs};

/// A user with basic information.
#[derive(Debug, Valrs, StandardJsonSchema)]
pub struct User {
    pub name: String,
    #[schema(rename = "emailAddress")]
    pub email: String,
    pub age: u32,
    #[schema(optional)]
    pub nickname: Option<String>,
}

/// A profile with string length validations.
#[derive(Debug, Valrs, StandardJsonSchema)]
pub struct Profile {
    #[schema(min_length = 2, max_length = 50)]
    pub username: String,
    #[schema(optional, min_length = 10)]
    pub bio: Option<String>,
}

fn main() {
    println!("=== Valrs Derive Macro Example ===\n");

    // =========================================================================
    // Part 1: Validation Examples
    // =========================================================================

    println!("--- Part 1: Validation ---\n");

    // Test 1: Valid user data
    println!("Test 1: Valid user data");
    let valid_user = json!({
        "name": "Alice",
        "emailAddress": "alice@example.com",
        "age": 30,
        "nickname": "Ali"
    });

    match User::validate(&valid_user) {
        ValidationResult::Success(user) => {
            println!("  SUCCESS: {:?}\n", user);
        }
        ValidationResult::Failure(issues) => {
            println!("  FAILURE: {:?}\n", issues);
        }
    }

    // Test 2: Valid user without optional nickname
    println!("Test 2: Valid user without optional nickname");
    let user_no_nickname = json!({
        "name": "Bob",
        "emailAddress": "bob@example.com",
        "age": 25
    });

    match User::validate(&user_no_nickname) {
        ValidationResult::Success(user) => {
            println!("  SUCCESS: {:?}\n", user);
        }
        ValidationResult::Failure(issues) => {
            println!("  FAILURE: {:?}\n", issues);
        }
    }

    // Test 3: Missing required field
    println!("Test 3: Missing required field (email)");
    let missing_email = json!({
        "name": "Charlie",
        "age": 20
    });

    match User::validate(&missing_email) {
        ValidationResult::Success(user) => {
            println!("  SUCCESS: {:?}\n", user);
        }
        ValidationResult::Failure(issues) => {
            println!("  FAILURE:");
            for issue in &issues {
                println!("    - {} at {:?}", issue.message, issue.path);
            }
            println!();
        }
    }

    // Test 4: Wrong type for field
    println!("Test 4: Wrong type for field (age as string)");
    let wrong_type = json!({
        "name": "Diana",
        "emailAddress": "diana@example.com",
        "age": "thirty"
    });

    match User::validate(&wrong_type) {
        ValidationResult::Success(user) => {
            println!("  SUCCESS: {:?}\n", user);
        }
        ValidationResult::Failure(issues) => {
            println!("  FAILURE:");
            for issue in &issues {
                println!("    - {} at {:?}", issue.message, issue.path);
            }
            println!();
        }
    }

    // Test 5: Not an object
    println!("Test 5: Not an object");
    let not_object = json!("just a string");

    match User::validate(&not_object) {
        ValidationResult::Success(user) => {
            println!("  SUCCESS: {:?}\n", user);
        }
        ValidationResult::Failure(issues) => {
            println!("  FAILURE:");
            for issue in &issues {
                println!("    - {}", issue.message);
            }
            println!();
        }
    }

    // Test 6: Valid profile with length constraints
    println!("Test 6: Valid profile");
    let valid_profile = json!({
        "username": "alice123",
        "bio": "This is my biography text"
    });

    match Profile::validate(&valid_profile) {
        ValidationResult::Success(profile) => {
            println!("  SUCCESS: {:?}\n", profile);
        }
        ValidationResult::Failure(issues) => {
            println!("  FAILURE:");
            for issue in &issues {
                println!("    - {} at {:?}", issue.message, issue.path);
            }
            println!();
        }
    }

    // Test 7: Profile with username too short
    println!("Test 7: Profile with username too short");
    let short_username = json!({
        "username": "a"
    });

    match Profile::validate(&short_username) {
        ValidationResult::Success(profile) => {
            println!("  SUCCESS: {:?}\n", profile);
        }
        ValidationResult::Failure(issues) => {
            println!("  FAILURE:");
            for issue in &issues {
                println!("    - {} at {:?}", issue.message, issue.path);
            }
            println!();
        }
    }

    // =========================================================================
    // Part 2: JSON Schema Generation Examples
    // =========================================================================

    println!("--- Part 2: JSON Schema Generation ---\n");

    // Test 8: Generate JSON Schema for User (Draft 2020-12)
    println!("Test 8: JSON Schema for User (Draft 2020-12)");
    let user_schema = User::json_schema_input(JsonSchemaTarget::Draft202012);
    println!("{}\n", serde_json::to_string_pretty(&user_schema).unwrap());

    // Test 9: Generate JSON Schema for User (OpenAPI 3.0)
    println!("Test 9: JSON Schema for User (OpenAPI 3.0)");
    let user_schema_openapi = User::json_schema_input(JsonSchemaTarget::OpenApi30);
    println!(
        "{}\n",
        serde_json::to_string_pretty(&user_schema_openapi).unwrap()
    );

    // Test 10: Generate JSON Schema for Profile with constraints
    println!("Test 10: JSON Schema for Profile (with minLength/maxLength)");
    let profile_schema = Profile::json_schema_input(JsonSchemaTarget::Draft202012);
    println!(
        "{}\n",
        serde_json::to_string_pretty(&profile_schema).unwrap()
    );

    // Test 11: Primitive type schemas
    println!("Test 11: Primitive type JSON Schemas");
    println!(
        "  String: {}",
        <String as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30)
    );
    println!(
        "  i32:    {}",
        <i32 as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30)
    );
    println!(
        "  f64:    {}",
        <f64 as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30)
    );
    println!(
        "  bool:   {}",
        <bool as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30)
    );
    println!(
        "  ():     {}",
        <() as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30)
    );
    println!();

    // Test 12: Option<T> schema
    println!("Test 12: Option<String> JSON Schema");
    println!(
        "  OpenAPI 3.0:   {}",
        <Option<String> as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::OpenApi30)
    );
    println!(
        "  Draft 2020-12: {}",
        <Option<String> as StandardJsonSchema>::json_schema_input(JsonSchemaTarget::Draft202012)
    );
    println!();

    println!("=== All tests complete ===");
}
