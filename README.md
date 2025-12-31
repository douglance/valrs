# valrs

High-performance schema validation powered by Rust and WebAssembly.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/valrs)](https://www.npmjs.com/package/valrs)
[![crates.io](https://img.shields.io/crates/v/valrs)](https://crates.io/crates/valrs)

## Overview

**valrs** is a schema validation library that implements the [Standard Schema](https://standardschema.dev/) specification. It's written in Rust and compiled to WebAssembly for near-native performance in browsers, with a pure JavaScript fallback for Node.js and other environments.

### Key Features

- **Fast** - Rust-powered validation, competitive with the fastest JS validators
- **Portable** - Works in browsers (WASM) and Node.js (JS fallback)
- **Standard Schema compliant** - Interoperates with any Standard Schema v1 tooling
- **JSON Schema generation** - Export to Draft 2020-12, Draft 07, or OpenAPI 3.0
- **Type-safe** - Full TypeScript support with type inference
- **Zero dependencies** - Minimal footprint

## Installation

```bash
npm install valrs
```

## Quick Start

```typescript
import { init, s, isValidationSuccess } from 'valrs';

// Initialize WASM (required before validation)
await init();

// Validate primitives
const result = s.string().validate('hello');
if (isValidationSuccess(result)) {
  console.log(result.value); // 'hello'
}

// Handle errors
const invalid = s.int32().validate('not a number');
if (!isValidationSuccess(invalid)) {
  console.log(invalid.issues); // [{ message: 'Expected i32' }]
}
```

## Packages

| Package | Description |
|---------|-------------|
| [`valrs`](packages/valrs) | TypeScript/JavaScript API with WASM bindings |
| [`valrs`](crates/valrs) | Core Rust validation library |
| [`valrs-derive`](crates/valrs-derive) | Procedural macros for deriving schemas |
| [`valrs-json`](crates/valrs-json) | JSON Schema generation |
| [`valrs-wasm`](crates/valrs-wasm) | WebAssembly bindings |

## Performance

valrs performs competitively with the fastest JavaScript validation libraries:

| Library | ops/sec | Relative |
|---------|---------|----------|
| TypeBox | 22.75M | 1.04x |
| **valrs** | 21.84M | baseline |
| ArkType | 7.73M | 0.35x |
| Valibot | 2.11M | 0.10x |
| Zod | 1.45M | 0.07x |

See [examples/benchmark](examples/benchmark) for methodology and full results.

## Standard Schema

valrs implements the [Standard Schema](https://standardschema.dev/) specification, enabling interoperability with any tool that supports the standard:

```typescript
import type { StandardSchemaV1 } from 'valrs';

// valrs schemas work with any Standard Schema consumer
function validate<T extends StandardSchemaV1>(schema: T, value: unknown) {
  return schema['~standard'].validate(value);
}
```

## Documentation

- [TypeScript API](packages/valrs/README.md) - Full API reference for the npm package
- [Rust API](https://docs.rs/valrs) - Documentation for the Rust crate
- [Standard Schema Spec](https://standardschema.dev/) - The underlying specification

## Development

### Prerequisites

- Rust 1.75+
- Node.js 18+
- wasm-pack

### Building

```bash
# Build Rust crates
cargo build

# Build WASM and TypeScript
cd packages/valrs
npm install
npm run build
```

### Testing

```bash
# Rust tests
cargo test

# TypeScript tests
cd packages/valrs
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT - see [LICENSE](LICENSE) for details.
