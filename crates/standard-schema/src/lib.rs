//! # Standard Schema
//!
//! Rust implementation of the [Standard Schema](https://standardschema.dev/) specification.
//!
//! Standard Schema is a TypeScript-first specification that standardizes how validation
//! libraries expose their capabilities, enabling ecosystem-wide interoperability.
//!
//! ## Usage
//!
//! ```rust
//! use standard_schema::{StandardSchema, ValidationResult};
//! use serde_json::json;
//!
//! // Implement StandardSchema for your types
//! struct Email(String);
//!
//! impl StandardSchema for Email {
//!     type Input = String;
//!     type Output = Email;
//!
//!     fn validate(value: &serde_json::Value) -> ValidationResult<Self::Output> {
//!         match value.as_str() {
//!             Some(s) if s.contains('@') => ValidationResult::success(Email(s.to_string())),
//!             Some(_) => ValidationResult::failure("Invalid email format"),
//!             None => ValidationResult::failure("Expected string"),
//!         }
//!     }
//! }
//! ```

mod traits;
mod types;
pub mod validators;

pub use traits::{StandardJsonSchema, StandardSchema};
pub use types::{JsonSchemaTarget, PathSegment, ValidationIssue, ValidationResult};
