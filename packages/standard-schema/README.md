# @standard-schema/rust

Rust-powered [Standard Schema](https://standardschema.dev/) implementation with WebAssembly bindings.

## Features

- Full Standard Schema v1 compliance
- WASM-powered validation for high performance
- JSON Schema generation (Draft 2020-12, Draft 07, OpenAPI 3.0)
- Type-safe TypeScript API
- Pure JS fallback when WASM is unavailable

## Installation

```bash
npm install @standard-schema/rust
```

## Quick Start

```typescript
import { init, StringSchema, Int32Schema, isValidationSuccess } from '@standard-schema/rust';

async function main() {
  // Initialize the WASM module (required before validation)
  await init();

  // Validate values
  const stringResult = StringSchema['~standard'].validate('hello');
  if (isValidationSuccess(stringResult)) {
    console.log(stringResult.value); // 'hello'
  }

  const intResult = Int32Schema['~standard'].validate(42);
  if (isValidationSuccess(intResult)) {
    console.log(intResult.value); // 42
  }

  // Handle validation errors
  const invalidResult = Int32Schema['~standard'].validate('not a number');
  if (!isValidationSuccess(invalidResult)) {
    console.log(invalidResult.issues); // [{ message: 'Expected i32' }]
  }

  // Generate JSON Schema
  const schema = StringSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
  console.log(schema); // { type: 'string' }
}
```

## Available Schemas

### Primitive Types

| Schema | TypeScript Type | Description |
|--------|-----------------|-------------|
| `StringSchema` | `string` | Any string value |
| `NumberSchema` | `number` | IEEE 754 double-precision float |
| `BooleanSchema` | `boolean` | `true` or `false` |
| `Int32Schema` | `number` | 32-bit signed integer |
| `Int64Schema` | `number` | 64-bit signed integer* |
| `Uint32Schema` | `number` | 32-bit unsigned integer |
| `Uint64Schema` | `number` | 64-bit unsigned integer* |
| `Float32Schema` | `number` | 32-bit float |
| `Float64Schema` | `number` | 64-bit float (same as `NumberSchema`) |

*Note: JavaScript numbers can only safely represent integers up to 2^53 - 1.

### Aliases

- `IntegerSchema` - Alias for `Int32Schema`
- `DoubleSchema` - Alias for `Float64Schema`

## Creating Custom Schemas

### Basic Schema

```typescript
import { createSchema } from '@standard-schema/rust';

const PositiveNumber = createSchema<number>((value) => {
  if (typeof value !== 'number') {
    return { issues: [{ message: 'Expected a number' }] };
  }
  if (value <= 0) {
    return { issues: [{ message: 'Must be positive' }] };
  }
  return { value };
});
```

### Schema with JSON Schema Support

```typescript
import { createSchemaWithJsonSchema } from '@standard-schema/rust';

const EmailSchema = createSchemaWithJsonSchema<string>(
  (value) => {
    if (typeof value !== 'string') {
      return { issues: [{ message: 'Expected string' }] };
    }
    if (!value.includes('@')) {
      return { issues: [{ message: 'Invalid email format' }] };
    }
    return { value };
  },
  (target) => ({
    type: 'string',
    format: 'email',
  })
);
```

## Type Inference

```typescript
import type { InferInput, InferOutput, StandardSchemaV1 } from '@standard-schema/rust';

// Infer types from a schema
type StringInput = InferInput<typeof StringSchema>; // string
type StringOutput = InferOutput<typeof StringSchema>; // string

// Use as a type constraint
function validate<T extends StandardSchemaV1>(
  schema: T,
  value: unknown
): InferOutput<T> | null {
  const result = schema['~standard'].validate(value);
  if ('value' in result) {
    return result.value;
  }
  return null;
}
```

## JSON Schema Generation

All schemas with `StandardJSONSchemaV1` support can generate JSON Schema:

```typescript
// Generate for different targets
const draft2020 = StringSchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
const draft07 = StringSchema['~standard'].jsonSchema.input({ target: 'draft-07' });
const openapi = StringSchema['~standard'].jsonSchema.input({ target: 'openapi-3.0' });
```

## Standard Schema Compliance

This library implements the [Standard Schema](https://standardschema.dev/) specification v1:

```typescript
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => ValidationResult<Output>;
  };
}
```

Any schema from this library can be used with tools that support Standard Schema.

## API Reference

### Initialization

- `init()` - Initialize the WASM module (required before validation)
- `isInitialized()` - Check if WASM is ready

### Type Guards

- `isValidationSuccess(result)` - Check if validation succeeded
- `isValidationFailure(result)` - Check if validation failed

### Schema Factories

- `createSchema(validateFn)` - Create a basic schema
- `createSchemaWithJsonSchema(validateFn, jsonSchemaFn)` - Create schema with JSON Schema support
- `createSchemaWithSeparateJsonSchemas(validateFn, inputSchemaFn, outputSchemaFn)` - Create schema with different input/output JSON Schemas

### Result Helpers

- `success(value)` - Create a success result
- `failure(issues)` - Create a failure result with multiple issues
- `fail(message, path?)` - Create a failure result with a single issue

### Constants

- `VENDOR` - The vendor name (`'standard-schema-rs'`)
- `VERSION` - The Standard Schema version (`1`)

## License

MIT
