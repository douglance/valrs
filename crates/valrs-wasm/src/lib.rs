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

use js_sys;
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

use valrs::{
    JsonSchemaTarget, PathSegment, StandardJsonSchema, ValidationIssue, ValidationResult, Valrs,
};

// =============================================================================
// Compiled Validator IR
// =============================================================================

/// Type tags for efficient type checking without string comparisons.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TypeTag {
    String,
    Number,
    Integer,
    Boolean,
    Null,
    Object,
    Array,
}

impl TypeTag {
    /// Returns the human-readable name for this type tag.
    fn name(self) -> &'static str {
        match self {
            TypeTag::String => "string",
            TypeTag::Number => "number",
            TypeTag::Integer => "integer",
            TypeTag::Boolean => "boolean",
            TypeTag::Null => "null",
            TypeTag::Object => "object",
            TypeTag::Array => "array",
        }
    }
}

/// Parses a JSON Schema type string into a TypeTag.
fn parse_type_tag(type_str: &str) -> Option<TypeTag> {
    match type_str {
        "string" => Some(TypeTag::String),
        "number" => Some(TypeTag::Number),
        "integer" => Some(TypeTag::Integer),
        "boolean" => Some(TypeTag::Boolean),
        "null" => Some(TypeTag::Null),
        "object" => Some(TypeTag::Object),
        "array" => Some(TypeTag::Array),
        _ => None,
    }
}

/// Checks if a JSON value matches a type tag.
fn check_type_tag(value: &Value, expected: TypeTag) -> bool {
    match expected {
        TypeTag::String => value.is_string(),
        TypeTag::Number => value.is_number(),
        TypeTag::Integer => value.is_i64() || value.is_u64(),
        TypeTag::Boolean => value.is_boolean(),
        TypeTag::Null => value.is_null(),
        TypeTag::Object => value.is_object(),
        TypeTag::Array => value.is_array(),
    }
}

/// Validation operations that form the compiled instruction set.
///
/// These operations are generated at schema registration time and executed
/// at validation time. This eliminates runtime schema interpretation overhead.
#[derive(Debug, Clone)]
enum ValidationOp {
    // Type checks
    CheckType(TypeTag),

    // Object operations
    EnterObject,
    CheckProperty { key: String, required: bool },
    ExitObject,

    // Array operations
    EnterArray,
    CheckArrayItems,
    ExitArray,

    // Numeric constraints
    CheckMinimum(f64),
    CheckMaximum(f64),
    CheckExclusiveMinimum(f64),
    CheckExclusiveMaximum(f64),

    // String constraints
    CheckMinLength(usize),
    CheckMaxLength(usize),

    // Array constraints
    CheckMinItems(usize),
    CheckMaxItems(usize),

    // Control flow
    Done,
}

/// A compiled schema consisting of a flat list of validation operations.
///
/// This is the result of compiling a JSON Schema at registration time.
/// Validation is performed by executing these operations in sequence.
#[derive(Debug, Clone)]
struct CompiledSchema {
    ops: Vec<ValidationOp>,
}

/// Compiles a JSON Schema into a CompiledSchema.
///
/// This function is called once at registration time, converting the
/// JSON Schema tree into a flat list of operations.
fn compile_schema(schema: &Value) -> CompiledSchema {
    let mut ops = Vec::new();
    compile_schema_recursive(schema, &mut ops);
    ops.push(ValidationOp::Done);
    CompiledSchema { ops }
}

/// Recursively compiles a JSON Schema node into validation operations.
fn compile_schema_recursive(schema: &Value, ops: &mut Vec<ValidationOp>) {
    let schema_obj = match schema.as_object() {
        Some(obj) => obj,
        None => return,
    };

    // Emit type check
    if let Some(type_value) = schema_obj.get("type") {
        if let Some(type_str) = type_value.as_str() {
            if let Some(tag) = parse_type_tag(type_str) {
                ops.push(ValidationOp::CheckType(tag));
            }
        }
    }

    // Emit numeric constraints
    if let Some(Value::Number(n)) = schema_obj.get("minimum") {
        if let Some(v) = n.as_f64() {
            ops.push(ValidationOp::CheckMinimum(v));
        }
    }
    if let Some(Value::Number(n)) = schema_obj.get("maximum") {
        if let Some(v) = n.as_f64() {
            ops.push(ValidationOp::CheckMaximum(v));
        }
    }
    if let Some(Value::Number(n)) = schema_obj.get("exclusiveMinimum") {
        if let Some(v) = n.as_f64() {
            ops.push(ValidationOp::CheckExclusiveMinimum(v));
        }
    }
    if let Some(Value::Number(n)) = schema_obj.get("exclusiveMaximum") {
        if let Some(v) = n.as_f64() {
            ops.push(ValidationOp::CheckExclusiveMaximum(v));
        }
    }

    // Emit string constraints
    if let Some(Value::Number(n)) = schema_obj.get("minLength") {
        if let Some(v) = n.as_u64() {
            ops.push(ValidationOp::CheckMinLength(v as usize));
        }
    }
    if let Some(Value::Number(n)) = schema_obj.get("maxLength") {
        if let Some(v) = n.as_u64() {
            ops.push(ValidationOp::CheckMaxLength(v as usize));
        }
    }

    // Handle object properties
    if let Some(Value::Object(properties)) = schema_obj.get("properties") {
        ops.push(ValidationOp::EnterObject);

        let required: HashSet<&str> = schema_obj
            .get("required")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect())
            .unwrap_or_default();

        for (key, prop_schema) in properties {
            ops.push(ValidationOp::CheckProperty {
                key: key.clone(),
                required: required.contains(key.as_str()),
            });
            compile_schema_recursive(prop_schema, ops);
        }

        ops.push(ValidationOp::ExitObject);
    }

    // Handle array constraints BEFORE entering array context
    // This ensures minItems/maxItems are checked on the array itself
    if let Some(Value::Number(n)) = schema_obj.get("minItems") {
        if let Some(v) = n.as_u64() {
            ops.push(ValidationOp::CheckMinItems(v as usize));
        }
    }
    if let Some(Value::Number(n)) = schema_obj.get("maxItems") {
        if let Some(v) = n.as_u64() {
            ops.push(ValidationOp::CheckMaxItems(v as usize));
        }
    }

    // Handle array items
    if let Some(items_schema) = schema_obj.get("items") {
        ops.push(ValidationOp::EnterArray);
        ops.push(ValidationOp::CheckArrayItems);
        compile_schema_recursive(items_schema, ops);
        ops.push(ValidationOp::ExitArray);
    }
}

/// Execution context for tracking nested object/array traversal.
#[derive(Debug, Clone)]
enum ExecutionContext {
    /// Currently validating object properties
    Object {
        /// Current property key (if any) - used to navigate to property value
        current_key: Option<String>,
    },
    /// Currently validating array items
    Array {
        /// Current item index
        current_index: usize,
        /// Instructions for validating each item (start position in ops)
        items_ops_start: usize,
    },
}

/// Executes a compiled schema against a JSON value.
///
/// This function performs validation by interpreting the compiled operations.
/// It maintains execution context for nested structures and collects all
/// validation issues.
fn execute_compiled(value: &Value, compiled: &CompiledSchema) -> ValidationResult<Value> {
    let mut issues = Vec::new();
    let mut path_stack: Vec<PathSegment> = Vec::new();
    let mut context_stack: Vec<ExecutionContext> = Vec::new();

    /// Get the current value to validate based on context.
    /// This navigates through the value tree based on the context stack.
    fn get_current_value<'a>(
        root: &'a Value,
        context_stack: &[ExecutionContext],
    ) -> Option<&'a Value> {
        let mut current = root;
        for ctx in context_stack {
            match ctx {
                ExecutionContext::Object { current_key } => {
                    if let Some(key) = current_key {
                        current = current.as_object()?.get(key)?;
                    }
                    // If current_key is None, we stay at the object level
                }
                ExecutionContext::Array { current_index, .. } => {
                    current = current.as_array()?.get(*current_index)?;
                }
            }
        }
        Some(current)
    }

    let mut ip = 0; // instruction pointer

    while ip < compiled.ops.len() {
        let op = &compiled.ops[ip];

        match op {
            ValidationOp::CheckType(expected) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if !check_type_tag(v, *expected) {
                        issues.push(ValidationIssue::with_path(
                            format!(
                                "Expected type {}, got {}",
                                expected.name(),
                                json_type_name(v)
                            ),
                            path_stack.clone(),
                        ));
                    }
                }
            }

            ValidationOp::CheckMinimum(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n < *min {
                            issues.push(ValidationIssue::with_path(
                                format!("Value {} is less than minimum {}", n, min),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::CheckMaximum(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n > *max {
                            issues.push(ValidationIssue::with_path(
                                format!("Value {} is greater than maximum {}", n, max),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::CheckExclusiveMinimum(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n <= *min {
                            issues.push(ValidationIssue::with_path(
                                format!("Value {} must be greater than {}", n, min),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::CheckExclusiveMaximum(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n >= *max {
                            issues.push(ValidationIssue::with_path(
                                format!("Value {} must be less than {}", n, max),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::CheckMinLength(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(s) = v.as_str() {
                        let len = s.chars().count();
                        if len < *min {
                            issues.push(ValidationIssue::with_path(
                                format!("String length {} is less than minimum {}", len, min),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::CheckMaxLength(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(s) = v.as_str() {
                        let len = s.chars().count();
                        if len > *max {
                            issues.push(ValidationIssue::with_path(
                                format!("String length {} is greater than maximum {}", len, max),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::CheckMinItems(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(arr) = v.as_array() {
                        if arr.len() < *min {
                            issues.push(ValidationIssue::with_path(
                                format!("Array has {} items, minimum is {}", arr.len(), min),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::CheckMaxItems(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(arr) = v.as_array() {
                        if arr.len() > *max {
                            issues.push(ValidationIssue::with_path(
                                format!("Array has {} items, maximum is {}", arr.len(), max),
                                path_stack.clone(),
                            ));
                        }
                    }
                }
            }

            ValidationOp::EnterObject => {
                context_stack.push(ExecutionContext::Object { current_key: None });
            }

            ValidationOp::CheckProperty { key, required } => {
                // First, clean up from previous property if any
                if let Some(ExecutionContext::Object { current_key }) = context_stack.last_mut() {
                    if current_key.is_some() {
                        // Pop path from previous property
                        path_stack.pop();
                        *current_key = None;
                    }
                }

                // Now get the parent object (with current_key as None)
                if let Some(obj_value) = get_current_value(value, &context_stack) {
                    if let Some(obj) = obj_value.as_object() {
                        if obj.contains_key(key) {
                            // Property exists - update context and path
                            if let Some(ExecutionContext::Object { current_key }) =
                                context_stack.last_mut()
                            {
                                *current_key = Some(key.clone());
                            }
                            path_stack.push(PathSegment::from(key.clone()));
                        } else if *required {
                            // Required property missing
                            issues.push(ValidationIssue::with_path(
                                format!("Missing required property '{}'", key),
                                path_stack.clone(),
                            ));
                            // Skip to next property or ExitObject
                            let mut depth = 0;
                            ip += 1;
                            while ip < compiled.ops.len() {
                                match &compiled.ops[ip] {
                                    ValidationOp::EnterObject | ValidationOp::EnterArray => {
                                        depth += 1;
                                    }
                                    ValidationOp::ExitObject | ValidationOp::ExitArray => {
                                        if depth == 0 {
                                            ip -= 1;
                                            break;
                                        }
                                        depth -= 1;
                                    }
                                    ValidationOp::CheckProperty { .. } if depth == 0 => {
                                        ip -= 1;
                                        break;
                                    }
                                    _ => {}
                                }
                                ip += 1;
                            }
                        } else {
                            // Optional property not present, skip its validation ops
                            let mut depth = 0;
                            ip += 1;
                            while ip < compiled.ops.len() {
                                match &compiled.ops[ip] {
                                    ValidationOp::EnterObject | ValidationOp::EnterArray => {
                                        depth += 1;
                                    }
                                    ValidationOp::ExitObject | ValidationOp::ExitArray => {
                                        if depth == 0 {
                                            ip -= 1;
                                            break;
                                        }
                                        depth -= 1;
                                    }
                                    ValidationOp::CheckProperty { .. } if depth == 0 => {
                                        ip -= 1;
                                        break;
                                    }
                                    _ => {}
                                }
                                ip += 1;
                            }
                        }
                    }
                }
            }

            ValidationOp::ExitObject => {
                // Clean up the last property's path if needed
                if let Some(ExecutionContext::Object { current_key }) = context_stack.last() {
                    if current_key.is_some() {
                        path_stack.pop();
                    }
                }
                context_stack.pop();
            }

            ValidationOp::EnterArray => {
                // Find CheckArrayItems position (start of item validation)
                let items_start = ip + 1;
                context_stack.push(ExecutionContext::Array {
                    current_index: 0,
                    items_ops_start: items_start,
                });
            }

            ValidationOp::CheckArrayItems => {
                // Get array info without mutable borrow first
                let (current_idx, should_process) = {
                    if let Some(ExecutionContext::Array { current_index, .. }) =
                        context_stack.last()
                    {
                        // Get the parent context to find the array
                        let parent_ctx: Vec<_> = context_stack
                            .iter()
                            .take(context_stack.len().saturating_sub(1))
                            .cloned()
                            .collect();

                        let arr_len = get_current_value(value, &parent_ctx)
                            .and_then(|v| v.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);

                        (*current_index, *current_index < arr_len)
                    } else {
                        (0, false)
                    }
                };

                // Pop previous item's path if needed
                if current_idx > 0 {
                    path_stack.pop();
                }

                if should_process {
                    // Push path for current item
                    path_stack.push(PathSegment::from(current_idx));
                    // Continue to validate this item
                } else {
                    // No more items - skip to ExitArray
                    let mut depth = 1;
                    ip += 1;
                    while ip < compiled.ops.len() {
                        match &compiled.ops[ip] {
                            ValidationOp::EnterArray => depth += 1,
                            ValidationOp::ExitArray => {
                                depth -= 1;
                                if depth == 0 {
                                    ip -= 1; // Will be incremented at end
                                    break;
                                }
                            }
                            _ => {}
                        }
                        ip += 1;
                    }
                }
            }

            ValidationOp::ExitArray => {
                // Get array info without mutable borrow first
                let (arr_len, items_start) = {
                    if let Some(ExecutionContext::Array {
                        items_ops_start, ..
                    }) = context_stack.last()
                    {
                        let parent_ctx: Vec<_> = context_stack
                            .iter()
                            .take(context_stack.len().saturating_sub(1))
                            .cloned()
                            .collect();

                        let len = get_current_value(value, &parent_ctx)
                            .and_then(|v| v.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);

                        (len, *items_ops_start)
                    } else {
                        (0, 0)
                    }
                };

                if let Some(ExecutionContext::Array { current_index, .. }) =
                    context_stack.last_mut()
                {
                    // Pop current item path if we had one
                    if *current_index < arr_len {
                        path_stack.pop();
                    }

                    *current_index += 1;

                    if *current_index < arr_len {
                        // More items to process - jump back to CheckArrayItems
                        ip = items_start - 1; // Will be incremented at end
                    } else {
                        // Done with array
                        context_stack.pop();
                    }
                } else {
                    context_stack.pop();
                }
            }

            ValidationOp::Done => break,
        }

        ip += 1;
    }

    if issues.is_empty() {
        ValidationResult::success(value.clone())
    } else {
        ValidationResult::failures(issues)
    }
}

/// Fast compiled execution that returns just bool - no result building.
/// This is the hot path for validation benchmarks.
#[inline]
fn execute_compiled_bool(value: &Value, compiled: &CompiledSchema) -> bool {
    let mut context_stack: Vec<ExecutionContext> = Vec::new();

    fn get_current_value<'a>(
        root: &'a Value,
        context_stack: &[ExecutionContext],
    ) -> Option<&'a Value> {
        let mut current = root;
        for ctx in context_stack {
            match ctx {
                ExecutionContext::Object { current_key } => {
                    if let Some(key) = current_key {
                        current = current.as_object()?.get(key)?;
                    }
                }
                ExecutionContext::Array { current_index, .. } => {
                    current = current.as_array()?.get(*current_index)?;
                }
            }
        }
        Some(current)
    }

    let mut ip = 0;

    while ip < compiled.ops.len() {
        match &compiled.ops[ip] {
            ValidationOp::CheckType(expected) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if !check_type_tag(v, *expected) {
                        return false;
                    }
                }
            }
            ValidationOp::CheckMinimum(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n < *min {
                            return false;
                        }
                    }
                }
            }
            ValidationOp::CheckMaximum(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n > *max {
                            return false;
                        }
                    }
                }
            }
            ValidationOp::CheckExclusiveMinimum(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n <= *min {
                            return false;
                        }
                    }
                }
            }
            ValidationOp::CheckExclusiveMaximum(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(n) = v.as_f64() {
                        if n >= *max {
                            return false;
                        }
                    }
                }
            }
            ValidationOp::CheckMinLength(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(s) = v.as_str() {
                        if s.len() < *min {
                            return false;
                        } // Use byte len for speed
                    }
                }
            }
            ValidationOp::CheckMaxLength(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(s) = v.as_str() {
                        if s.len() > *max {
                            return false;
                        } // Use byte len for speed
                    }
                }
            }
            ValidationOp::CheckMinItems(min) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(arr) = v.as_array() {
                        if arr.len() < *min {
                            return false;
                        }
                    }
                }
            }
            ValidationOp::CheckMaxItems(max) => {
                if let Some(v) = get_current_value(value, &context_stack) {
                    if let Some(arr) = v.as_array() {
                        if arr.len() > *max {
                            return false;
                        }
                    }
                }
            }
            ValidationOp::EnterObject => {
                context_stack.push(ExecutionContext::Object { current_key: None });
            }
            ValidationOp::CheckProperty { key, required } => {
                // Clean up previous property
                if let Some(ExecutionContext::Object { current_key }) = context_stack.last_mut() {
                    *current_key = None;
                }

                if let Some(obj_value) = get_current_value(value, &context_stack) {
                    if let Some(obj) = obj_value.as_object() {
                        if obj.contains_key(key) {
                            if let Some(ExecutionContext::Object { current_key }) =
                                context_stack.last_mut()
                            {
                                *current_key = Some(key.clone());
                            }
                        } else if *required {
                            return false; // Missing required property
                        } else {
                            // Skip optional property ops
                            let mut depth = 0;
                            ip += 1;
                            while ip < compiled.ops.len() {
                                match &compiled.ops[ip] {
                                    ValidationOp::EnterObject | ValidationOp::EnterArray => {
                                        depth += 1
                                    }
                                    ValidationOp::ExitObject | ValidationOp::ExitArray => {
                                        if depth == 0 {
                                            ip -= 1;
                                            break;
                                        }
                                        depth -= 1;
                                    }
                                    ValidationOp::CheckProperty { .. } if depth == 0 => {
                                        ip -= 1;
                                        break;
                                    }
                                    _ => {}
                                }
                                ip += 1;
                            }
                        }
                    }
                }
            }
            ValidationOp::ExitObject => {
                context_stack.pop();
            }
            ValidationOp::EnterArray => {
                context_stack.push(ExecutionContext::Array {
                    current_index: 0,
                    items_ops_start: ip + 1,
                });
            }
            ValidationOp::CheckArrayItems => {
                let arr_len = {
                    let parent_ctx: Vec<_> = context_stack
                        .iter()
                        .take(context_stack.len().saturating_sub(1))
                        .cloned()
                        .collect();
                    get_current_value(value, &parent_ctx)
                        .and_then(|v| v.as_array())
                        .map(|a| a.len())
                        .unwrap_or(0)
                };

                let current_idx = match context_stack.last() {
                    Some(ExecutionContext::Array { current_index, .. }) => *current_index,
                    _ => 0,
                };

                if current_idx >= arr_len {
                    // Skip to ExitArray
                    let mut depth = 1;
                    ip += 1;
                    while ip < compiled.ops.len() {
                        match &compiled.ops[ip] {
                            ValidationOp::EnterArray => depth += 1,
                            ValidationOp::ExitArray => {
                                depth -= 1;
                                if depth == 0 {
                                    ip -= 1;
                                    break;
                                }
                            }
                            _ => {}
                        }
                        ip += 1;
                    }
                }
            }
            ValidationOp::ExitArray => {
                let (arr_len, items_start) = {
                    if let Some(ExecutionContext::Array {
                        items_ops_start, ..
                    }) = context_stack.last()
                    {
                        let parent_ctx: Vec<_> = context_stack
                            .iter()
                            .take(context_stack.len().saturating_sub(1))
                            .cloned()
                            .collect();
                        let len = get_current_value(value, &parent_ctx)
                            .and_then(|v| v.as_array())
                            .map(|a| a.len())
                            .unwrap_or(0);
                        (len, *items_ops_start)
                    } else {
                        (0, 0)
                    }
                };

                if let Some(ExecutionContext::Array { current_index, .. }) =
                    context_stack.last_mut()
                {
                    *current_index += 1;
                    if *current_index < arr_len {
                        ip = items_start - 1;
                    } else {
                        context_stack.pop();
                    }
                } else {
                    context_stack.pop();
                }
            }
            ValidationOp::Done => break,
        }
        ip += 1;
    }

    true
}

// =============================================================================
// Fast Validation (Zero-Serialization Path) - DEPRECATED
// =============================================================================

/// Execution context for fast validation - tracks nested object/array traversal.
#[derive(Debug, Clone)]
enum FastExecutionContext {
    /// Currently validating object properties
    Object {
        /// Current property key being validated
        current_key: Option<String>,
    },
    /// Currently validating array items
    Array {
        /// Current item index
        current_index: usize,
        /// Instructions for validating each item (start position in ops)
        items_ops_start: usize,
    },
}

/// Check type directly on JsValue without conversion to serde_json::Value.
/// This is the key optimization - no serialization overhead.
fn check_type_tag_js(value: &JsValue, expected: TypeTag) -> bool {
    match expected {
        TypeTag::String => value.is_string(),
        TypeTag::Number => value.as_f64().is_some(),
        TypeTag::Integer => {
            if let Some(n) = value.as_f64() {
                n.fract() == 0.0 && n >= i64::MIN as f64 && n <= i64::MAX as f64
            } else {
                false
            }
        }
        TypeTag::Boolean => *value == JsValue::TRUE || *value == JsValue::FALSE,
        TypeTag::Null => value.is_null(),
        TypeTag::Object => value.is_object() && !value.is_null() && !js_sys::Array::is_array(value),
        TypeTag::Array => js_sys::Array::is_array(value),
    }
}

/// Fast validation that works directly on JsValue without serialization.
/// Returns true if valid, false if invalid.
/// This is optimized for speed: no error messages, early return on first failure.
fn execute_compiled_fast(value: &JsValue, compiled: &CompiledSchema) -> bool {
    let mut context_stack: Vec<FastExecutionContext> = Vec::new();
    let mut value_stack: Vec<JsValue> = vec![value.clone()];

    let mut ip = 0;

    while ip < compiled.ops.len() {
        let current_value = match value_stack.last() {
            Some(v) => v,
            None => return false,
        };

        match &compiled.ops[ip] {
            ValidationOp::CheckType(expected) => {
                if !check_type_tag_js(current_value, *expected) {
                    return false;
                }
            }
            ValidationOp::CheckMinimum(min) => {
                if let Some(n) = current_value.as_f64() {
                    if n < *min {
                        return false;
                    }
                }
            }
            ValidationOp::CheckMaximum(max) => {
                if let Some(n) = current_value.as_f64() {
                    if n > *max {
                        return false;
                    }
                }
            }
            ValidationOp::CheckExclusiveMinimum(min) => {
                if let Some(n) = current_value.as_f64() {
                    if n <= *min {
                        return false;
                    }
                }
            }
            ValidationOp::CheckExclusiveMaximum(max) => {
                if let Some(n) = current_value.as_f64() {
                    if n >= *max {
                        return false;
                    }
                }
            }
            ValidationOp::CheckMinLength(min) => {
                if let Some(s) = current_value.as_string() {
                    if s.chars().count() < *min {
                        return false;
                    }
                }
            }
            ValidationOp::CheckMaxLength(max) => {
                if let Some(s) = current_value.as_string() {
                    if s.chars().count() > *max {
                        return false;
                    }
                }
            }
            ValidationOp::CheckMinItems(min) => {
                if js_sys::Array::is_array(current_value) {
                    let arr = js_sys::Array::from(current_value);
                    if (arr.length() as usize) < *min {
                        return false;
                    }
                }
            }
            ValidationOp::CheckMaxItems(max) => {
                if js_sys::Array::is_array(current_value) {
                    let arr = js_sys::Array::from(current_value);
                    if (arr.length() as usize) > *max {
                        return false;
                    }
                }
            }
            ValidationOp::EnterObject => {
                context_stack.push(FastExecutionContext::Object { current_key: None });
            }
            ValidationOp::CheckProperty { key, required } => {
                // Pop previous property value if we had one
                if let Some(FastExecutionContext::Object { current_key }) = context_stack.last_mut()
                {
                    if current_key.is_some() && value_stack.len() > 1 {
                        value_stack.pop();
                    }
                    *current_key = None;
                }

                // Get the current object (should be on top of stack now)
                let obj = match value_stack.last() {
                    Some(v) => v,
                    None => return false,
                };

                // Use js_sys::Reflect to get property directly - no serde!
                let prop_value = js_sys::Reflect::get(obj, &JsValue::from_str(key));

                match prop_value {
                    Ok(v) if !v.is_undefined() => {
                        // Property exists - push to value stack
                        value_stack.push(v);
                        if let Some(FastExecutionContext::Object { current_key }) =
                            context_stack.last_mut()
                        {
                            *current_key = Some(key.clone());
                        }
                    }
                    _ if *required => {
                        return false; // Missing required property
                    }
                    _ => {
                        // Optional property missing - skip its validation ops
                        let mut depth = 0;
                        ip += 1;
                        while ip < compiled.ops.len() {
                            match &compiled.ops[ip] {
                                ValidationOp::EnterObject | ValidationOp::EnterArray => depth += 1,
                                ValidationOp::ExitObject | ValidationOp::ExitArray => {
                                    if depth == 0 {
                                        ip -= 1;
                                        break;
                                    }
                                    depth -= 1;
                                }
                                ValidationOp::CheckProperty { .. } if depth == 0 => {
                                    ip -= 1;
                                    break;
                                }
                                _ => {}
                            }
                            ip += 1;
                        }
                    }
                }
            }
            ValidationOp::ExitObject => {
                // Pop property value if we had one
                if let Some(FastExecutionContext::Object { current_key }) = context_stack.last() {
                    if current_key.is_some() && value_stack.len() > 1 {
                        value_stack.pop();
                    }
                }
                context_stack.pop();
            }
            ValidationOp::EnterArray => {
                context_stack.push(FastExecutionContext::Array {
                    current_index: 0,
                    items_ops_start: ip + 1,
                });
            }
            ValidationOp::CheckArrayItems => {
                // Get array info
                let (current_idx, arr_len) = {
                    if let Some(FastExecutionContext::Array { current_index, .. }) =
                        context_stack.last()
                    {
                        // Get the parent array (one level up in value stack, before any item)
                        let parent_idx = if *current_index > 0 {
                            value_stack.len().saturating_sub(2)
                        } else {
                            value_stack.len().saturating_sub(1)
                        };
                        let len = value_stack
                            .get(parent_idx)
                            .filter(|v| js_sys::Array::is_array(v))
                            .map(|v| js_sys::Array::from(v).length() as usize)
                            .unwrap_or(0);
                        (*current_index, len)
                    } else {
                        (0, 0)
                    }
                };

                // Pop previous item if needed
                if current_idx > 0 && value_stack.len() > 1 {
                    value_stack.pop();
                }

                if current_idx < arr_len {
                    // Get current array item and push to stack
                    let parent_idx = value_stack.len().saturating_sub(1);
                    if let Some(parent) = value_stack.get(parent_idx) {
                        if js_sys::Array::is_array(parent) {
                            let arr = js_sys::Array::from(parent);
                            value_stack.push(arr.get(current_idx as u32));
                        }
                    }
                } else {
                    // No more items - skip to ExitArray
                    let mut depth = 1;
                    ip += 1;
                    while ip < compiled.ops.len() {
                        match &compiled.ops[ip] {
                            ValidationOp::EnterArray => depth += 1,
                            ValidationOp::ExitArray => {
                                depth -= 1;
                                if depth == 0 {
                                    ip -= 1;
                                    break;
                                }
                            }
                            _ => {}
                        }
                        ip += 1;
                    }
                }
            }
            ValidationOp::ExitArray => {
                let (arr_len, items_start) = {
                    if let Some(FastExecutionContext::Array {
                        items_ops_start,
                        current_index,
                        ..
                    }) = context_stack.last()
                    {
                        // Calculate array length from parent
                        let parent_idx = if *current_index > 0 {
                            value_stack.len().saturating_sub(2)
                        } else {
                            value_stack.len().saturating_sub(1)
                        };
                        let len = value_stack
                            .get(parent_idx)
                            .filter(|v| js_sys::Array::is_array(v))
                            .map(|v| js_sys::Array::from(v).length() as usize)
                            .unwrap_or(0);
                        (len, *items_ops_start)
                    } else {
                        (0, 0)
                    }
                };

                if let Some(FastExecutionContext::Array { current_index, .. }) =
                    context_stack.last_mut()
                {
                    // Pop current item if we had one
                    if *current_index < arr_len && value_stack.len() > 1 {
                        value_stack.pop();
                    }

                    *current_index += 1;

                    if *current_index < arr_len {
                        // More items to process - jump back to CheckArrayItems
                        ip = items_start - 1;
                    } else {
                        // Done with array
                        context_stack.pop();
                    }
                } else {
                    context_stack.pop();
                }
            }
            ValidationOp::Done => break,
        }

        ip += 1;
    }

    true // All checks passed
}

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

/// A registered schema with its JSON Schema and compiled validation logic.
#[derive(Debug, Clone)]
struct RegisteredSchema {
    /// The JSON Schema for validation reference and JSON Schema output
    schema: Value,
    /// The compiled validation operations for fast execution
    compiled: CompiledSchema,
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
    /// The schema is compiled into an optimized instruction list at registration
    /// time, eliminating the need for runtime schema interpretation during validation.
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

        // Compile the schema at registration time for fast validation
        let compiled = compile_schema(&schema);

        self.schemas
            .insert(name.to_string(), RegisteredSchema { schema, compiled });

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
    /// This uses the pre-compiled validation operations for fast execution,
    /// avoiding runtime schema interpretation overhead.
    ///
    /// # Arguments
    /// * `name` - The name of the registered schema
    /// * `value` - The JavaScript value to validate
    ///
    /// # Returns
    /// An object with either `{ value: T }` on success or `{ issues: Issue[] }` on failure.
    pub fn validate(&self, name: &str, value: JsValue) -> Result<JsValue, JsError> {
        let registered = self
            .schemas
            .get(name)
            .ok_or_else(|| JsError::new(&format!("Schema '{}' not found in registry", name)))?;

        let json_value: Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsError::new(&format!("Failed to deserialize value: {}", e)))?;

        // Use compiled validator for fast execution
        let result = execute_compiled(&json_value, &registered.compiled);

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsError::new(&format!("Failed to serialize result: {}", e)))
    }

    /// Ultra-fast validation that returns just a boolean.
    ///
    /// Fast validation that returns just a boolean.
    /// Uses serde for input but skips result object serialization.
    ///
    /// # Arguments
    /// * `name` - The name of the registered schema
    /// * `value` - The JavaScript value to validate
    ///
    /// # Returns
    /// `true` if the value is valid, `false` otherwise.
    #[wasm_bindgen(js_name = validateFast)]
    pub fn validate_fast(&self, name: &str, value: JsValue) -> Result<bool, JsError> {
        let registered = self
            .schemas
            .get(name)
            .ok_or_else(|| JsError::new(&format!("Schema '{}' not found in registry", name)))?;

        // Deserialize input
        let json_value: Value = serde_wasm_bindgen::from_value(value)
            .map_err(|e| JsError::new(&format!("Failed to deserialize: {}", e)))?;

        // Execute compiled validator, return bool only (no result serialization)
        Ok(execute_compiled_bool(&json_value, &registered.compiled))
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
        let registered = self
            .schemas
            .get(name)
            .ok_or_else(|| JsError::new(&format!("Schema '{}' not found in registry", name)))?;

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
// Schema Validation Logic (Interpreted - kept for reference and edge cases)
// =============================================================================

// These functions are the original interpreted validation implementation.
// They are kept for reference, potential edge case handling, and testing.
// The compiled validator (execute_compiled) is now used for performance.

/// Validates a JSON value against a JSON Schema.
///
/// This is a simplified implementation that handles common JSON Schema features:
/// - type validation (string, number, integer, boolean, null, object, array)
/// - required properties
/// - properties validation (recursive)
/// - items validation for arrays
/// - minimum/maximum for numbers
/// - minLength/maxLength for strings
///
/// NOTE: This is the original interpreted validator, kept for reference and testing.
/// The compiled validator (execute_compiled) is now used for performance.
#[allow(dead_code)]
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

    // For numbers, validate minimum/maximum
    if value.is_number() {
        if let Some(issues) = validate_number_schema(value, schema_obj) {
            return ValidationResult::failures(issues);
        }
    }

    // For strings, validate minLength/maxLength
    if value.is_string() {
        if let Some(issues) = validate_string_schema(value, schema_obj) {
            return ValidationResult::failures(issues);
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
fn validate_object_schema(
    value: &Value,
    schema: &Map<String, Value>,
) -> Option<Vec<ValidationIssue>> {
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
fn validate_array_schema(
    value: &Value,
    schema: &Map<String, Value>,
) -> Option<Vec<ValidationIssue>> {
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

/// Validates a number against numeric schema constraints (minimum, maximum).
fn validate_number_schema(
    value: &Value,
    schema: &Map<String, Value>,
) -> Option<Vec<ValidationIssue>> {
    let num = value.as_f64()?;
    let mut issues = Vec::new();

    // Check minimum
    if let Some(Value::Number(min)) = schema.get("minimum") {
        if let Some(min_val) = min.as_f64() {
            if num < min_val {
                issues.push(ValidationIssue::new(format!(
                    "Value {} is less than minimum {}",
                    num, min_val
                )));
            }
        }
    }

    // Check maximum
    if let Some(Value::Number(max)) = schema.get("maximum") {
        if let Some(max_val) = max.as_f64() {
            if num > max_val {
                issues.push(ValidationIssue::new(format!(
                    "Value {} is greater than maximum {}",
                    num, max_val
                )));
            }
        }
    }

    // Check exclusiveMinimum
    if let Some(Value::Number(min)) = schema.get("exclusiveMinimum") {
        if let Some(min_val) = min.as_f64() {
            if num <= min_val {
                issues.push(ValidationIssue::new(format!(
                    "Value {} must be greater than {}",
                    num, min_val
                )));
            }
        }
    }

    // Check exclusiveMaximum
    if let Some(Value::Number(max)) = schema.get("exclusiveMaximum") {
        if let Some(max_val) = max.as_f64() {
            if num >= max_val {
                issues.push(ValidationIssue::new(format!(
                    "Value {} must be less than {}",
                    num, max_val
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

/// Validates a string against string schema constraints (minLength, maxLength).
fn validate_string_schema(
    value: &Value,
    schema: &Map<String, Value>,
) -> Option<Vec<ValidationIssue>> {
    let s = value.as_str()?;
    let len = s.chars().count();
    let mut issues = Vec::new();

    // Check minLength
    if let Some(Value::Number(min)) = schema.get("minLength") {
        if let Some(min_val) = min.as_u64() {
            if (len as u64) < min_val {
                issues.push(ValidationIssue::new(format!(
                    "String length {} is less than minimum {}",
                    len, min_val
                )));
            }
        }
    }

    // Check maxLength
    if let Some(Value::Number(max)) = schema.get("maxLength") {
        if let Some(max_val) = max.as_u64() {
            if (len as u64) > max_val {
                issues.push(ValidationIssue::new(format!(
                    "String length {} is greater than maximum {}",
                    len, max_val
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

        // Test internal functionality - compile schema and insert
        let compiled = compile_schema(&schema);
        registry
            .schemas
            .insert("User".to_string(), RegisteredSchema { schema, compiled });

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

    // =========================================================================
    // Compiled Validator Tests
    // =========================================================================

    #[test]
    fn test_compile_schema_simple_type() {
        let schema = json!({ "type": "string" });
        let compiled = compile_schema(&schema);

        // Should have CheckType(String) and Done
        assert!(matches!(
            &compiled.ops[0],
            ValidationOp::CheckType(TypeTag::String)
        ));
        assert!(matches!(&compiled.ops[1], ValidationOp::Done));
    }

    #[test]
    fn test_execute_compiled_simple() {
        let schema = json!({ "type": "string" });
        let compiled = compile_schema(&schema);

        // Valid string
        let result = execute_compiled(&json!("hello"), &compiled);
        assert!(result.is_success());

        // Invalid - number instead of string
        let result = execute_compiled(&json!(123), &compiled);
        assert!(result.is_failure());
    }

    #[test]
    fn test_execute_compiled_matches_interpreted_type() {
        let schema = json!({ "type": "string" });
        let compiled = compile_schema(&schema);

        // Test valid case
        let value = json!("hello");
        let compiled_result = execute_compiled(&value, &compiled);
        let interpreted_result = validate_against_schema(&value, &schema);
        assert_eq!(
            compiled_result.is_success(),
            interpreted_result.is_success()
        );

        // Test invalid case
        let value = json!(123);
        let compiled_result = execute_compiled(&value, &compiled);
        let interpreted_result = validate_against_schema(&value, &schema);
        assert_eq!(
            compiled_result.is_failure(),
            interpreted_result.is_failure()
        );
    }

    #[test]
    fn test_execute_compiled_numeric_constraints() {
        let schema = json!({
            "type": "number",
            "minimum": 0,
            "maximum": 100
        });
        let compiled = compile_schema(&schema);

        // Valid - in range
        let result = execute_compiled(&json!(50), &compiled);
        assert!(result.is_success());

        // Invalid - below minimum
        let result = execute_compiled(&json!(-1), &compiled);
        assert!(result.is_failure());

        // Invalid - above maximum
        let result = execute_compiled(&json!(101), &compiled);
        assert!(result.is_failure());
    }

    #[test]
    fn test_execute_compiled_string_constraints() {
        let schema = json!({
            "type": "string",
            "minLength": 2,
            "maxLength": 10
        });
        let compiled = compile_schema(&schema);

        // Valid
        let result = execute_compiled(&json!("hello"), &compiled);
        assert!(result.is_success());

        // Too short
        let result = execute_compiled(&json!("a"), &compiled);
        assert!(result.is_failure());

        // Too long
        let result = execute_compiled(&json!("this is way too long"), &compiled);
        assert!(result.is_failure());
    }

    #[test]
    fn test_execute_compiled_object() {
        let schema = json!({
            "type": "object",
            "properties": {
                "name": { "type": "string" },
                "age": { "type": "integer" }
            },
            "required": ["name"]
        });
        let compiled = compile_schema(&schema);

        // Valid object with all properties
        let result = execute_compiled(&json!({"name": "Alice", "age": 30}), &compiled);
        assert!(result.is_success());

        // Valid - optional property missing
        let result = execute_compiled(&json!({"name": "Alice"}), &compiled);
        assert!(result.is_success());

        // Invalid - required property missing
        let result = execute_compiled(&json!({"age": 30}), &compiled);
        assert!(result.is_failure());

        // Invalid - wrong type for property
        let result = execute_compiled(&json!({"name": 123}), &compiled);
        assert!(result.is_failure());
    }

    #[test]
    fn test_execute_compiled_matches_interpreted_object() {
        let schema = json!({
            "type": "object",
            "properties": {
                "name": { "type": "string" },
                "age": { "type": "integer" }
            },
            "required": ["name", "age"]
        });
        let compiled = compile_schema(&schema);

        let test_values = vec![
            json!({"name": "Alice", "age": 30}),
            json!({"name": "Bob"}),
            json!({"age": 25}),
            json!({"name": 123, "age": "thirty"}),
            json!({}),
        ];

        for value in test_values {
            let compiled_result = execute_compiled(&value, &compiled);
            let interpreted_result = validate_against_schema(&value, &schema);
            assert_eq!(
                compiled_result.is_success(),
                interpreted_result.is_success(),
                "Mismatch for value: {:?}",
                value
            );
        }
    }

    #[test]
    fn test_execute_compiled_array() {
        let schema = json!({
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 1,
            "maxItems": 3
        });
        let compiled = compile_schema(&schema);

        // Valid array
        let result = execute_compiled(&json!([1, 2, 3]), &compiled);
        assert!(result.is_success());

        // Too few items
        let result = execute_compiled(&json!([]), &compiled);
        assert!(result.is_failure());

        // Too many items
        let result = execute_compiled(&json!([1, 2, 3, 4]), &compiled);
        assert!(result.is_failure());

        // Wrong item type
        let result = execute_compiled(&json!([1, "two", 3]), &compiled);
        assert!(result.is_failure());
    }

    #[test]
    fn test_execute_compiled_matches_interpreted_array() {
        let schema = json!({
            "type": "array",
            "items": { "type": "integer" },
            "minItems": 1,
            "maxItems": 3
        });
        let compiled = compile_schema(&schema);

        let test_values = vec![
            json!([1, 2, 3]),
            json!([]),
            json!([1, 2, 3, 4]),
            json!([1, "two", 3]),
            json!([1]),
        ];

        for value in test_values {
            let compiled_result = execute_compiled(&value, &compiled);
            let interpreted_result = validate_against_schema(&value, &schema);
            assert_eq!(
                compiled_result.is_success(),
                interpreted_result.is_success(),
                "Mismatch for value: {:?}",
                value
            );
        }
    }

    #[test]
    fn test_execute_compiled_exclusive_bounds() {
        let schema = json!({
            "type": "number",
            "exclusiveMinimum": 0,
            "exclusiveMaximum": 100
        });
        let compiled = compile_schema(&schema);

        // Valid - strictly within bounds
        let result = execute_compiled(&json!(50), &compiled);
        assert!(result.is_success());

        // Invalid - exactly at exclusiveMinimum
        let result = execute_compiled(&json!(0), &compiled);
        assert!(result.is_failure());

        // Invalid - exactly at exclusiveMaximum
        let result = execute_compiled(&json!(100), &compiled);
        assert!(result.is_failure());
    }

    #[test]
    fn test_type_tag_parsing() {
        assert_eq!(parse_type_tag("string"), Some(TypeTag::String));
        assert_eq!(parse_type_tag("number"), Some(TypeTag::Number));
        assert_eq!(parse_type_tag("integer"), Some(TypeTag::Integer));
        assert_eq!(parse_type_tag("boolean"), Some(TypeTag::Boolean));
        assert_eq!(parse_type_tag("null"), Some(TypeTag::Null));
        assert_eq!(parse_type_tag("object"), Some(TypeTag::Object));
        assert_eq!(parse_type_tag("array"), Some(TypeTag::Array));
        assert_eq!(parse_type_tag("unknown"), None);
    }

    #[test]
    fn test_check_type_tag() {
        assert!(check_type_tag(&json!("hello"), TypeTag::String));
        assert!(!check_type_tag(&json!(123), TypeTag::String));

        assert!(check_type_tag(&json!(123.5), TypeTag::Number));
        assert!(check_type_tag(&json!(123), TypeTag::Number));

        assert!(check_type_tag(&json!(123), TypeTag::Integer));
        assert!(!check_type_tag(&json!(123.5), TypeTag::Integer));

        assert!(check_type_tag(&json!(true), TypeTag::Boolean));
        assert!(check_type_tag(&json!(null), TypeTag::Null));
        assert!(check_type_tag(&json!({}), TypeTag::Object));
        assert!(check_type_tag(&json!([]), TypeTag::Array));
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
        assert_eq!(
            result["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
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

        let result = registry
            .validate("TestString", JsValue::from_str("hello"))
            .unwrap();
        let result: Value = serde_wasm_bindgen::from_value(result).unwrap();
        assert_eq!(result["value"], "hello");

        let result = registry
            .validate("TestString", JsValue::from_f64(123.0))
            .unwrap();
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
        assert_eq!(
            result["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
    }

    #[wasm_bindgen_test]
    fn wasm_test_vendor_and_version() {
        assert_eq!(vendor(), "valrs");
        assert_eq!(version(), 1);
    }
}
