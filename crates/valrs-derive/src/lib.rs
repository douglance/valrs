//! Derive macros for Standard Schema.
//!
//! Provides `#[derive(Valrs)]` and `#[derive(StandardJsonSchema)]` for automatic implementation.

use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;
use quote::quote;
use syn::{
    Attribute, Data, DeriveInput, Error, Expr, ExprLit, Field, Fields, Ident, Lit, Type,
    parse_macro_input,
};

/// Field-level schema attributes.
#[derive(Default)]
struct FieldAttrs {
    /// Whether the field is optional (can be missing from input).
    optional: bool,
    /// Rename the JSON key for this field.
    rename: Option<String>,
    /// Minimum string length validation.
    min_length: Option<usize>,
    /// Maximum string length validation.
    max_length: Option<usize>,
}

impl FieldAttrs {
    fn from_attributes(attrs: &[Attribute]) -> syn::Result<Self> {
        let mut field_attrs = FieldAttrs::default();

        for attr in attrs {
            if !attr.path().is_ident("schema") {
                continue;
            }

            attr.parse_nested_meta(|meta| {
                if meta.path.is_ident("optional") {
                    field_attrs.optional = true;
                    Ok(())
                } else if meta.path.is_ident("rename") {
                    let value: Expr = meta.value()?.parse()?;
                    if let Expr::Lit(ExprLit {
                        lit: Lit::Str(lit_str),
                        ..
                    }) = value
                    {
                        field_attrs.rename = Some(lit_str.value());
                        Ok(())
                    } else {
                        Err(meta.error("expected string literal for rename"))
                    }
                } else if meta.path.is_ident("min_length") {
                    let value: Expr = meta.value()?.parse()?;
                    if let Expr::Lit(ExprLit {
                        lit: Lit::Int(lit_int),
                        ..
                    }) = value
                    {
                        field_attrs.min_length = Some(lit_int.base10_parse()?);
                        Ok(())
                    } else {
                        Err(meta.error("expected integer literal for min_length"))
                    }
                } else if meta.path.is_ident("max_length") {
                    let value: Expr = meta.value()?.parse()?;
                    if let Expr::Lit(ExprLit {
                        lit: Lit::Int(lit_int),
                        ..
                    }) = value
                    {
                        field_attrs.max_length = Some(lit_int.base10_parse()?);
                        Ok(())
                    } else {
                        Err(meta.error("expected integer literal for max_length"))
                    }
                } else {
                    Err(meta.error("unknown schema attribute"))
                }
            })?;
        }

        Ok(field_attrs)
    }
}

/// Parsed field information.
struct ParsedField {
    ident: Ident,
    ty: Type,
    attrs: FieldAttrs,
}

impl ParsedField {
    fn json_key(&self) -> String {
        self.attrs
            .rename
            .clone()
            .unwrap_or_else(|| self.ident.to_string())
    }
}

/// Derives the `Valrs` trait for a struct.
///
/// # Example
///
/// ```ignore
/// use valrs::Valrs;
/// use valrs_derive::Valrs;
///
/// #[derive(Valrs)]
/// pub struct User {
///     pub name: String,
///     pub age: u32,
/// }
/// ```
///
/// # Attributes
///
/// - `#[schema(optional)]` - Field can be missing from input (for `Option<T>`)
/// - `#[schema(rename = "fieldName")]` - Use different JSON key
/// - `#[schema(min_length = N)]` - String minimum length validation
/// - `#[schema(max_length = N)]` - String maximum length validation
#[proc_macro_derive(Valrs, attributes(schema))]
pub fn derive_valrs(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    match derive_valrs_impl(input) {
        Ok(tokens) => tokens.into(),
        Err(e) => e.to_compile_error().into(),
    }
}

fn derive_valrs_impl(input: DeriveInput) -> syn::Result<TokenStream2> {
    let struct_name = &input.ident;

    // Only support named structs
    let fields = match &input.data {
        Data::Struct(data) => match &data.fields {
            Fields::Named(named) => &named.named,
            Fields::Unnamed(_) => {
                return Err(Error::new_spanned(
                    struct_name,
                    "Valrs derive does not support tuple structs",
                ));
            }
            Fields::Unit => {
                return Err(Error::new_spanned(
                    struct_name,
                    "Valrs derive does not support unit structs",
                ));
            }
        },
        Data::Enum(_) => {
            return Err(Error::new_spanned(
                struct_name,
                "Valrs derive does not support enums yet",
            ));
        }
        Data::Union(_) => {
            return Err(Error::new_spanned(
                struct_name,
                "Valrs derive does not support unions",
            ));
        }
    };

    // Parse all fields
    let parsed_fields: Vec<ParsedField> =
        fields.iter().map(parse_field).collect::<syn::Result<_>>()?;

    // Generate validation code for each field
    let field_validations = parsed_fields
        .iter()
        .map(generate_field_validation)
        .collect::<Vec<_>>();

    // Generate struct construction
    let field_names: Vec<_> = parsed_fields.iter().map(|f| &f.ident).collect();

    let expanded = quote! {
        impl ::valrs::Valrs for #struct_name {
            type Input = #struct_name;
            type Output = #struct_name;

            fn validate(value: &::serde_json::Value) -> ::valrs::ValidationResult<Self::Output> {
                let obj = match value.as_object() {
                    Some(o) => o,
                    None => return ::valrs::ValidationResult::failure("Expected object"),
                };

                let mut issues: Vec<::valrs::ValidationIssue> = Vec::new();

                #(#field_validations)*

                if !issues.is_empty() {
                    return ::valrs::ValidationResult::Failure(issues);
                }

                ::valrs::ValidationResult::Success(#struct_name {
                    #(#field_names),*
                })
            }
        }
    };

    Ok(expanded)
}

fn parse_field(field: &Field) -> syn::Result<ParsedField> {
    let ident = field
        .ident
        .clone()
        .ok_or_else(|| Error::new_spanned(field, "expected named field"))?;

    let attrs = FieldAttrs::from_attributes(&field.attrs)?;

    Ok(ParsedField {
        ident,
        ty: field.ty.clone(),
        attrs,
    })
}

fn generate_field_validation(field: &ParsedField) -> TokenStream2 {
    let field_ident = &field.ident;
    let field_ty = &field.ty;
    let json_key = field.json_key();

    // Generate additional string length validations if specified
    let length_validations = generate_length_validations(field, &json_key);
    let has_length_validations =
        field.attrs.min_length.is_some() || field.attrs.max_length.is_some();

    if field.attrs.optional {
        // For optional fields, missing or null values become None.
        // We need to extract the inner type from Option<T> to validate it directly
        // when length validations are present.
        if let Some(inner_ty) =
            extract_option_inner_type(field_ty).filter(|_| has_length_validations)
        {
            // Validate the inner type directly and wrap in Some
            quote! {
                let #field_ident: #field_ty = match obj.get(#json_key) {
                    Some(::serde_json::Value::Null) | None => None,
                    Some(v) => {
                        match <#inner_ty as ::valrs::Valrs>::validate(v) {
                            ::valrs::ValidationResult::Success(inner_val) => {
                                // Apply length validations to the inner value
                                let val = &inner_val;
                                #length_validations
                                Some(inner_val)
                            }
                            ::valrs::ValidationResult::Failure(errs) => {
                                for mut err in errs {
                                    let mut new_path = vec![::valrs::PathSegment::Key(#json_key.to_string())];
                                    if let Some(existing_path) = err.path.take() {
                                        new_path.extend(existing_path);
                                    }
                                    err.path = Some(new_path);
                                    issues.push(err);
                                }
                                None
                            }
                        }
                    }
                };
            }
        } else {
            // No length validations - use the Option type's validate directly
            quote! {
                let #field_ident: #field_ty = match obj.get(#json_key) {
                    Some(::serde_json::Value::Null) | None => None,
                    Some(v) => {
                        match <#field_ty as ::valrs::Valrs>::validate(v) {
                            ::valrs::ValidationResult::Success(val) => val,
                            ::valrs::ValidationResult::Failure(errs) => {
                                for mut err in errs {
                                    let mut new_path = vec![::valrs::PathSegment::Key(#json_key.to_string())];
                                    if let Some(existing_path) = err.path.take() {
                                        new_path.extend(existing_path);
                                    }
                                    err.path = Some(new_path);
                                    issues.push(err);
                                }
                                None
                            }
                        }
                    }
                };
            }
        }
    } else {
        // For required fields, missing values are an error
        let length_block = if has_length_validations {
            quote! {
                let val = &validated_val;
                #length_validations
            }
        } else {
            quote! {}
        };

        quote! {
            let #field_ident: #field_ty = match obj.get(#json_key) {
                Some(v) => {
                    match <#field_ty as ::valrs::Valrs>::validate(v) {
                        ::valrs::ValidationResult::Success(validated_val) => {
                            #length_block
                            validated_val
                        }
                        ::valrs::ValidationResult::Failure(errs) => {
                            for mut err in errs {
                                let mut new_path = vec![::valrs::PathSegment::Key(#json_key.to_string())];
                                if let Some(existing_path) = err.path.take() {
                                    new_path.extend(existing_path);
                                }
                                err.path = Some(new_path);
                                issues.push(err);
                            }
                            // Use default to allow continuing validation of other fields
                            // The issues vec will cause failure at the end
                            <#field_ty as Default>::default()
                        }
                    }
                }
                None => {
                    issues.push(::valrs::ValidationIssue::with_path(
                        format!("Missing required field '{}'", #json_key),
                        vec![::valrs::PathSegment::Key(#json_key.to_string())],
                    ));
                    // Use default to allow continuing validation of other fields
                    <#field_ty as Default>::default()
                }
            };
        }
    }
}

/// Attempts to extract the inner type T from Option<T>.
/// Returns None if the type is not an Option.
fn extract_option_inner_type(ty: &Type) -> Option<&Type> {
    let Type::Path(type_path) = ty else {
        return None;
    };
    let segment = type_path.path.segments.last()?;
    if segment.ident != "Option" {
        return None;
    }
    let syn::PathArguments::AngleBracketed(args) = &segment.arguments else {
        return None;
    };
    match args.args.first()? {
        syn::GenericArgument::Type(inner) => Some(inner),
        _ => None,
    }
}

fn generate_length_validations(field: &ParsedField, json_key: &str) -> TokenStream2 {
    let mut validations = Vec::new();

    // For string length validations, `val` is a reference to the validated value.
    // For required String fields, val is &String.
    // For optional String fields with length validation, val is &String (inner type).

    if let Some(min_len) = field.attrs.min_length {
        validations.push(quote! {
            if val.len() < #min_len {
                issues.push(::valrs::ValidationIssue::with_path(
                    format!("String must be at least {} characters, got {}", #min_len, val.len()),
                    vec![::valrs::PathSegment::Key(#json_key.to_string())],
                ));
            }
        });
    }

    if let Some(max_len) = field.attrs.max_length {
        validations.push(quote! {
            if val.len() > #max_len {
                issues.push(::valrs::ValidationIssue::with_path(
                    format!("String must be at most {} characters, got {}", #max_len, val.len()),
                    vec![::valrs::PathSegment::Key(#json_key.to_string())],
                ));
            }
        });
    }

    if validations.is_empty() {
        quote! {}
    } else {
        quote! {
            #(#validations)*
        }
    }
}

// =============================================================================
// StandardJsonSchema derive macro
// =============================================================================

/// Derives the `StandardJsonSchema` trait for a struct.
///
/// This macro generates JSON Schema for the struct, including:
/// - Object schema with `type: "object"`
/// - Properties for each field
/// - Required array for non-optional fields
/// - String constraints (`minLength`, `maxLength`) when specified
///
/// # Example
///
/// ```ignore
/// use valrs::{Valrs, StandardJsonSchema, JsonSchemaTarget};
/// use valrs_derive::{Valrs, StandardJsonSchema};
///
/// #[derive(Valrs, StandardJsonSchema)]
/// pub struct User {
///     pub name: String,
///     #[schema(min_length = 1)]
///     pub email: String,
///     pub age: u32,
///     #[schema(optional)]
///     pub nickname: Option<String>,
/// }
///
/// // Generate JSON Schema
/// let schema = User::json_schema_input(JsonSchemaTarget::Draft202012);
/// ```
///
/// # Attributes
///
/// - `#[schema(optional)]` - Field is not required in the schema
/// - `#[schema(rename = "fieldName")]` - Use different property name in schema
/// - `#[schema(min_length = N)]` - Add `minLength` constraint for strings
/// - `#[schema(max_length = N)]` - Add `maxLength` constraint for strings
#[proc_macro_derive(StandardJsonSchema, attributes(schema))]
pub fn derive_standard_json_schema(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    match derive_standard_json_schema_impl(input) {
        Ok(tokens) => tokens.into(),
        Err(e) => e.to_compile_error().into(),
    }
}

fn derive_standard_json_schema_impl(input: DeriveInput) -> syn::Result<TokenStream2> {
    let struct_name = &input.ident;

    // Only support named structs
    let fields = match &input.data {
        Data::Struct(data) => match &data.fields {
            Fields::Named(named) => &named.named,
            Fields::Unnamed(_) => {
                return Err(Error::new_spanned(
                    struct_name,
                    "StandardJsonSchema derive does not support tuple structs",
                ));
            }
            Fields::Unit => {
                return Err(Error::new_spanned(
                    struct_name,
                    "StandardJsonSchema derive does not support unit structs",
                ));
            }
        },
        Data::Enum(_) => {
            return Err(Error::new_spanned(
                struct_name,
                "StandardJsonSchema derive does not support enums yet",
            ));
        }
        Data::Union(_) => {
            return Err(Error::new_spanned(
                struct_name,
                "StandardJsonSchema derive does not support unions",
            ));
        }
    };

    // Parse all fields
    let parsed_fields: Vec<ParsedField> =
        fields.iter().map(parse_field).collect::<syn::Result<_>>()?;

    // Generate property schema for each field
    let property_insertions = parsed_fields
        .iter()
        .map(generate_property_insertion)
        .collect::<Vec<_>>();

    // Generate required array entries (non-optional fields)
    let required_entries: Vec<_> = parsed_fields
        .iter()
        .filter(|f| !f.attrs.optional)
        .map(|f| {
            let json_key = f.json_key();
            quote! { required.push(#json_key.to_string()); }
        })
        .collect();

    let expanded = quote! {
        impl ::valrs::StandardJsonSchema for #struct_name {
            fn json_schema_input(target: ::valrs::JsonSchemaTarget) -> ::serde_json::Value {
                use ::serde_json::{json, Map, Value};

                let mut properties = Map::new();
                let mut required: Vec<String> = Vec::new();

                #(#property_insertions)*
                #(#required_entries)*

                let mut schema = json!({
                    "type": "object",
                    "properties": properties,
                });

                if let Value::Object(ref mut map) = schema {
                    // Only add required array if there are required fields
                    if !required.is_empty() {
                        map.insert(
                            "required".to_string(),
                            Value::Array(required.into_iter().map(Value::String).collect())
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

            fn json_schema_output(target: ::valrs::JsonSchemaTarget) -> ::serde_json::Value {
                Self::json_schema_input(target)
            }
        }
    };

    Ok(expanded)
}

/// Generates code to insert a property schema for a field.
fn generate_property_insertion(field: &ParsedField) -> TokenStream2 {
    let field_ty = &field.ty;
    let json_key = field.json_key();
    let has_string_constraints =
        field.attrs.min_length.is_some() || field.attrs.max_length.is_some();

    // For optional fields, get the inner type's schema
    let inner_ty = if field.attrs.optional {
        extract_option_inner_type(field_ty)
    } else {
        None
    };

    // Determine which type to use for the base schema
    let schema_ty = inner_ty.unwrap_or(field_ty);

    if has_string_constraints {
        // Generate string schema with constraints
        let min_len_code = field
            .attrs
            .min_length
            .map(|min| {
                quote! {
                    if let Value::Object(ref mut m) = prop_schema {
                        m.insert("minLength".to_string(), Value::Number(#min.into()));
                    }
                }
            })
            .unwrap_or_else(|| quote! {});

        let max_len_code = field
            .attrs
            .max_length
            .map(|max| {
                quote! {
                    if let Value::Object(ref mut m) = prop_schema {
                        m.insert("maxLength".to_string(), Value::Number(#max.into()));
                    }
                }
            })
            .unwrap_or_else(|| quote! {});

        quote! {
            {
                // Get base schema from the type (without $schema field)
                let mut prop_schema = <#schema_ty as ::valrs::StandardJsonSchema>::json_schema_input(
                    ::valrs::JsonSchemaTarget::OpenApi30
                );
                // Remove $schema if present (shouldn't be for OpenApi30, but be safe)
                if let Value::Object(ref mut m) = prop_schema {
                    m.remove("$schema");
                }
                #min_len_code
                #max_len_code
                properties.insert(#json_key.to_string(), prop_schema);
            }
        }
    } else {
        // No constraints, use the type's schema directly
        quote! {
            {
                // Get schema from the type (without $schema field)
                let mut prop_schema = <#schema_ty as ::valrs::StandardJsonSchema>::json_schema_input(
                    ::valrs::JsonSchemaTarget::OpenApi30
                );
                // Remove $schema if present (shouldn't be for OpenApi30, but be safe)
                if let Value::Object(ref mut m) = prop_schema {
                    m.remove("$schema");
                }
                properties.insert(#json_key.to_string(), prop_schema);
            }
        }
    }
}
