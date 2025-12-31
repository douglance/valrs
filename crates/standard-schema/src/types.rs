use serde::{Deserialize, Serialize};

/// The result of a validation operation.
///
/// This corresponds to the `Result<Output>` type in the TypeScript spec:
/// - `Success` variant maps to `{ value: Output }`
/// - `Failure` variant maps to `{ issues: Issue[] }`
#[derive(Debug, Clone)]
pub enum ValidationResult<T> {
    /// Validation succeeded with the output value.
    Success(T),
    /// Validation failed with one or more issues.
    Failure(Vec<ValidationIssue>),
}

impl<T> ValidationResult<T> {
    /// Creates a successful validation result.
    pub fn success(value: T) -> Self {
        ValidationResult::Success(value)
    }

    /// Creates a failed validation result with a single issue.
    pub fn failure(message: impl Into<String>) -> Self {
        ValidationResult::Failure(vec![ValidationIssue::new(message)])
    }

    /// Creates a failed validation result with a single issue at a path.
    pub fn failure_at(message: impl Into<String>, path: Vec<PathSegment>) -> Self {
        ValidationResult::Failure(vec![ValidationIssue::with_path(message, path)])
    }

    /// Creates a failed validation result with multiple issues.
    pub fn failures(issues: Vec<ValidationIssue>) -> Self {
        ValidationResult::Failure(issues)
    }

    /// Returns `true` if the result is a success.
    pub fn is_success(&self) -> bool {
        matches!(self, ValidationResult::Success(_))
    }

    /// Returns `true` if the result is a failure.
    pub fn is_failure(&self) -> bool {
        matches!(self, ValidationResult::Failure(_))
    }

    /// Converts to an `Option`, returning `Some(value)` on success.
    pub fn ok(self) -> Option<T> {
        match self {
            ValidationResult::Success(v) => Some(v),
            ValidationResult::Failure(_) => None,
        }
    }

    /// Returns the issues if this is a failure, empty vec otherwise.
    pub fn issues(&self) -> &[ValidationIssue] {
        match self {
            ValidationResult::Success(_) => &[],
            ValidationResult::Failure(issues) => issues,
        }
    }

    /// Maps a `ValidationResult<T>` to `ValidationResult<U>` by applying a function.
    pub fn map<U, F: FnOnce(T) -> U>(self, f: F) -> ValidationResult<U> {
        match self {
            ValidationResult::Success(v) => ValidationResult::Success(f(v)),
            ValidationResult::Failure(issues) => ValidationResult::Failure(issues),
        }
    }

    /// Prepends a path segment to all issues.
    pub fn with_path_prefix(self, segment: PathSegment) -> Self {
        match self {
            ValidationResult::Success(v) => ValidationResult::Success(v),
            ValidationResult::Failure(issues) => {
                let issues = issues
                    .into_iter()
                    .map(|mut issue| {
                        let mut new_path = vec![segment.clone()];
                        if let Some(path) = issue.path.take() {
                            new_path.extend(path);
                        }
                        issue.path = Some(new_path);
                        issue
                    })
                    .collect();
                ValidationResult::Failure(issues)
            }
        }
    }
}

impl<T: Serialize> Serialize for ValidationResult<T> {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        #[derive(Serialize)]
        struct SuccessResult<'a, T> {
            value: &'a T,
        }

        #[derive(Serialize)]
        struct FailureResult<'a> {
            issues: &'a [ValidationIssue],
        }

        match self {
            ValidationResult::Success(v) => SuccessResult { value: v }.serialize(serializer),
            ValidationResult::Failure(issues) => FailureResult { issues }.serialize(serializer),
        }
    }
}

/// A validation issue describing why validation failed.
///
/// This corresponds to the `Issue` interface in the TypeScript spec.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
    /// The error message describing the issue.
    pub message: String,

    /// The path to the value that caused the issue.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<Vec<PathSegment>>,
}

impl ValidationIssue {
    /// Creates a new issue with a message.
    pub fn new(message: impl Into<String>) -> Self {
        ValidationIssue {
            message: message.into(),
            path: None,
        }
    }

    /// Creates a new issue with a message and path.
    pub fn with_path(message: impl Into<String>, path: Vec<PathSegment>) -> Self {
        ValidationIssue {
            message: message.into(),
            path: Some(path),
        }
    }
}

/// A segment in a validation path.
///
/// This corresponds to the path item types in the TypeScript spec:
/// - `Key(String)` maps to a string property key or `{ key: string }`
/// - `Index(usize)` maps to a numeric index or `{ key: number }`
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum PathSegment {
    /// A string key (object property name).
    Key(String),
    /// A numeric index (array index).
    Index(usize),
}

impl From<String> for PathSegment {
    fn from(s: String) -> Self {
        PathSegment::Key(s)
    }
}

impl From<&str> for PathSegment {
    fn from(s: &str) -> Self {
        PathSegment::Key(s.to_string())
    }
}

impl From<usize> for PathSegment {
    fn from(i: usize) -> Self {
        PathSegment::Index(i)
    }
}

/// Target version for JSON Schema generation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JsonSchemaTarget {
    /// JSON Schema Draft 2020-12
    Draft202012,
    /// JSON Schema Draft 07
    Draft07,
    /// OpenAPI 3.0 compatible (based on Draft 04 superset)
    OpenApi30,
}

impl JsonSchemaTarget {
    /// Returns the `$schema` URI for this target.
    pub fn schema_uri(&self) -> &'static str {
        match self {
            JsonSchemaTarget::Draft202012 => "https://json-schema.org/draft/2020-12/schema",
            JsonSchemaTarget::Draft07 => "http://json-schema.org/draft-07/schema#",
            JsonSchemaTarget::OpenApi30 => "", // OpenAPI doesn't use $schema
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_validation_result_success_serialization() {
        let result: ValidationResult<i32> = ValidationResult::success(42);
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json, json!({ "value": 42 }));
    }

    #[test]
    fn test_validation_result_failure_serialization() {
        let result: ValidationResult<i32> = ValidationResult::failure("Invalid");
        let json = serde_json::to_value(&result).unwrap();
        assert_eq!(json, json!({ "issues": [{ "message": "Invalid" }] }));
    }

    #[test]
    fn test_validation_issue_with_path() {
        let issue = ValidationIssue::with_path(
            "Invalid value",
            vec![PathSegment::Key("user".into()), PathSegment::Index(0)],
        );
        let json = serde_json::to_value(&issue).unwrap();
        assert_eq!(
            json,
            json!({
                "message": "Invalid value",
                "path": ["user", 0]
            })
        );
    }

    #[test]
    fn test_path_prefix() {
        let result: ValidationResult<i32> = ValidationResult::failure("error");
        let result = result.with_path_prefix(PathSegment::Key("field".into()));
        if let ValidationResult::Failure(issues) = result {
            assert_eq!(issues[0].path, Some(vec![PathSegment::Key("field".into())]));
        }
    }
}
