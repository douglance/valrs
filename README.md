<div align="center">
  <br />
  <h1>valrs</h1>
  <p><strong>The fastest schema validation library for TypeScript.</strong></p>
  <p>Rust-powered. Standard Schema compliant. Zero dependencies.</p>
  <br />

  [![npm version](https://img.shields.io/npm/v/valrs?style=flat-square&color=cb3837)](https://www.npmjs.com/package/valrs)
  [![crates.io](https://img.shields.io/crates/v/valrs?style=flat-square&color=fc8d62)](https://crates.io/crates/valrs)
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?style=flat-square)](https://www.typescriptlang.org/)
  [![Standard Schema](https://img.shields.io/badge/Standard%20Schema-v1-7c3aed?style=flat-square)](https://standardschema.dev/)

  <br />

  [Getting Started](#getting-started) · [Documentation](packages/valrs/README.md) · [Benchmarks](#performance) · [Why valrs?](#why-valrs)

</div>

<br />

## Performance

**18 million validations per second.** Powered by Rust and WebAssembly.

```
┌─────────────────────────────────────────────────────────────────┐
│ valrs      ████████████████████████████████████████████  21.8M  │
│ TypeBox    █████████████████████████████████████████████ 22.7M  │
│ ArkType    ███████████████                                7.7M  │
│ Valibot    ████                                           2.1M  │
│ Zod        ███                                            1.4M  │
│ Yup        ▏                                             65.2K  │
└─────────────────────────────────────────────────────────────────┘
                         operations per second →
```

|  | Library | ops/sec | vs Zod | vs Valibot |
|--|---------|--------:|-------:|-----------:|
| 🥇 | **TypeBox** | 22.75M | **15.7x faster** | 10.8x faster |
| 🥈 | **valrs** | 21.84M | **15.1x faster** | 10.4x faster |
| 🥉 | ArkType | 7.73M | 5.3x faster | 3.7x faster |
| | Valibot | 2.11M | 1.5x faster | — |
| | Zod | 1.45M | — | 0.7x slower |
| | Yup | 65.2K | 22x slower | 32x slower |

<sup>Benchmarked on Apple M1 Pro. See [examples/benchmark](examples/benchmark) for methodology.</sup>

---

## Why valrs?

### 🦀 Rust-Powered Performance

The only validation library with a **Rust core compiled to WebAssembly**. Get near-native performance in the browser with an automatic JavaScript fallback for Node.js and edge environments.

### 📐 Standard Schema Compliant

First-class implementation of [Standard Schema v1](https://standardschema.dev/). Your schemas work seamlessly with any tool in the ecosystem—tRPC, React Hook Form, TanStack Form, and beyond.

### 🔄 Zod-Compatible API

Migrate from Zod in minutes. The API you already know, but **15x faster**:

```typescript
// Zod                          // valrs
import { z } from 'zod';        import { v } from 'valrs';

const User = z.object({         const User = v.object({
  name: z.string(),               name: v.string(),
  email: z.string().email(),      email: v.string().email(),
  age: z.number().positive(),     age: v.number().positive(),
});                             });
```

### 🌊 Streaming Validation

Validate **gigabytes of JSON** with O(1) memory. No other library can do this:

```typescript
import { stream, v } from 'valrs';

const schema = v.object({ id: v.number(), name: v.string() });

for await (const record of stream(schema, massiveJsonArrayStream)) {
  // Process millions of records without running out of memory
}
```

### 📄 JSON Schema Generation

Generate JSON Schema for OpenAPI, documentation, or form builders:

```typescript
const schema = v.object({
  email: v.string().email(),
  age: v.number().int().min(0).max(150),
});

schema.toJsonSchema('openapi-3.0');
// { type: 'object', properties: { email: { type: 'string', format: 'email' }, ... } }
```

---

## Getting Started

```bash
npm install valrs
```

```typescript
import { init, v } from 'valrs';

// Initialize WASM (one-time, optional for Node.js)
await init();

// Define your schema
const User = v.object({
  name: v.string().min(2).max(100),
  email: v.string().email(),
  age: v.number().int().positive(),
  tags: v.array(v.string()).optional(),
});

// Validate data
const result = User.safeParse(userData);

if (result.success) {
  console.log(result.data); // Fully typed!
} else {
  console.log(result.error.issues);
}

// Or throw on invalid data
const user = User.parse(userData); // throws if invalid
```

---

## Features

### Complete Type Coverage

```typescript
// Primitives
v.string()    v.number()    v.boolean()
v.bigint()    v.date()      v.symbol()

// Literals & Enums
v.literal('active')
v.enum(['pending', 'active', 'done'])

// Objects & Arrays
v.object({ name: v.string() })
v.array(v.number())
v.tuple([v.string(), v.number()])
v.record(v.string(), v.number())

// Unions & Intersections
v.union([v.string(), v.number()])
v.discriminatedUnion('type', [...])
v.intersection(schemaA, schemaB)

// Special Types
v.any()       v.unknown()   v.never()
v.null()      v.undefined() v.void()
```

### String Validations

```typescript
v.string()
  .min(1)                    // Minimum length
  .max(100)                  // Maximum length
  .email()                   // Email format
  .url()                     // URL format
  .uuid()                    // UUID format
  .regex(/^[A-Z]+$/)         // Custom pattern
  .trim()                    // Transform: trim whitespace
  .toLowerCase()             // Transform: lowercase
```

### Number Validations

```typescript
v.number()
  .int()                     // Integer only
  .positive()                // > 0
  .negative()                // < 0
  .min(0)                    // >= 0
  .max(100)                  // <= 100
  .multipleOf(5)             // Divisible by 5
  .finite()                  // No Infinity
  .safe()                    // Safe integer range
```

### Transforms & Refinements

```typescript
// Transform the output type
const toNumber = v.string().transform(s => parseInt(s, 10));

// Custom validation logic
const password = v.string().refine(
  (val) => val.length >= 8 && /[A-Z]/.test(val),
  'Password must be 8+ chars with uppercase'
);

// Type coercion
const coercedNumber = v.coerce.number(); // "42" → 42
const coercedDate = v.coerce.date();     // "2024-01-01" → Date
```

### Object Manipulation

```typescript
const User = v.object({
  id: v.number(),
  name: v.string(),
  email: v.string().email(),
});

User.pick({ name: true, email: true })  // Only name & email
User.omit({ id: true })                 // Everything except id
User.partial()                          // All properties optional
User.required()                         // All properties required
User.extend({ role: v.string() })       // Add properties
User.merge(OtherSchema)                 // Combine schemas
User.strict()                           // Reject extra properties
```

### Optional & Nullable

```typescript
v.string().optional()        // string | undefined
v.string().nullable()        // string | null
v.string().nullish()         // string | null | undefined
v.string().default('hello')  // Use default if undefined
v.string().catch('fallback') // Use fallback on parse error
```

---

## Advanced Usage

### Async Validation

```typescript
const schema = v.string().refine(async (email) => {
  return await checkEmailUnique(email);
}, 'Email already exists');

const result = await schema.safeParseAsync('test@example.com');
```

### Streaming Large Files

Process massive JSON files with constant memory:

```typescript
import { stream, streamLines, v } from 'valrs';

// Stream JSON arrays
const records = stream(RecordSchema, jsonArrayStream, {
  maxItems: 1_000_000,
  maxBytes: '1GB',
  timeout: '5m',
  onError: 'skip', // 'throw' | 'skip' | 'collect'
});

for await (const record of records) {
  await processRecord(record);
}

// Stream newline-delimited JSON (NDJSON)
for await (const line of streamLines(LineSchema, ndjsonStream)) {
  await processLine(line);
}
```

### Compiled Validators

Generate optimized JavaScript for maximum performance:

```typescript
import { compileSchema, compileSchemaToCode } from 'valrs';

const schema = v.object({ name: v.string(), age: v.number() });

// Compile for runtime use
const validate = compileSchema(schema);
const isValid = validate({ name: 'Alice', age: 30 }); // true

// Generate source code for bundling
const code = compileSchemaToCode(schema);
// → function validate(value) { return typeof value?.name === 'string' && ... }
```

### Standard Schema Integration

Works with any Standard Schema consumer:

```typescript
import { v } from 'valrs';
import type { StandardSchemaV1 } from '@standard-schema/spec';

function validate<T extends StandardSchemaV1>(schema: T, value: unknown) {
  return schema['~standard'].validate(value);
}

// valrs schemas are Standard Schema compliant
const result = validate(v.string().email(), 'test@example.com');
```

### Custom Error Messages

```typescript
import { setErrorMap, v } from 'valrs';

// Global error customization
setErrorMap((issue) => {
  if (issue.code === 'invalid_type') {
    return `Expected ${issue.expected}, got ${issue.received}`;
  }
  return issue.message;
});

// Per-schema error messages
v.string().min(5, 'Name is too short');
v.number().max(100, { message: 'Value exceeds limit' });
```

---

## Type Inference

Extract TypeScript types from any schema:

```typescript
import { v } from 'valrs';

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.string().email(),
  role: v.enum(['admin', 'user']),
  createdAt: v.date(),
});

// Infer the type
type User = v.infer<typeof UserSchema>;
// {
//   id: number;
//   name: string;
//   email: string;
//   role: 'admin' | 'user';
//   createdAt: Date;
// }

// Input vs Output types (for transforms)
type UserInput = v.input<typeof UserSchema>;
type UserOutput = v.output<typeof UserSchema>;
```

---

## Ecosystem

valrs is designed to work with the tools you already use:

| Integration | Status |
|-------------|--------|
| [tRPC](https://trpc.io) | ✅ via Standard Schema |
| [React Hook Form](https://react-hook-form.com) | ✅ via Standard Schema |
| [TanStack Form](https://tanstack.com/form) | ✅ via Standard Schema |
| [Hono](https://hono.dev) | ✅ via Standard Schema |
| OpenAPI / Swagger | ✅ JSON Schema generation |
| JSON Schema validators | ✅ JSON Schema generation |

---

## Packages

| Package | Description |
|---------|-------------|
| [`valrs`](packages/valrs) | TypeScript/JavaScript API with WASM bindings |
| [`valrs`](https://crates.io/crates/valrs) | Core Rust validation library |
| [`valrs-derive`](crates/valrs-derive) | Procedural macros for deriving schemas |
| [`valrs-json`](crates/valrs-json) | JSON Schema generation |
| [`valrs-wasm`](crates/valrs-wasm) | WebAssembly bindings |

---

## Comparison

| Feature | valrs | Zod | Valibot | ArkType | TypeBox |
|---------|:-----:|:---:|:-------:|:-------:|:-------:|
| Performance | 🥇 | ⚡ | ⚡⚡ | ⚡⚡⚡ | 🥇 |
| Bundle Size | Small | Medium | 🥇 Tiny | Medium | Small |
| Standard Schema | ✅ | ✅ | ✅ | ✅ | ❌ |
| Streaming | ✅ | ❌ | ❌ | ❌ | ❌ |
| WASM Acceleration | ✅ | ❌ | ❌ | ❌ | ❌ |
| JSON Schema Gen | ✅ | Plugin | Plugin | ❌ | ✅ Native |
| Zod-Compatible API | ✅ | ✅ | Similar | Different | Different |
| Async Validation | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Philosophy

**Performance without compromise.** We believe validation should be:

1. **Fast** — Rust and WASM push the boundaries of what's possible
2. **Portable** — Run anywhere: browsers, Node.js, Deno, edge functions
3. **Interoperable** — Standard Schema compliance means your schemas work everywhere
4. **Familiar** — Zod-compatible API for zero learning curve
5. **Complete** — Streaming, transforms, coercion, JSON Schema—all built in

---

## Contributing

Contributions are welcome! See our [contributing guide](CONTRIBUTING.md) for details.

```bash
# Clone and setup
git clone https://github.com/douglance/valrs.git
cd valrs

# Build everything
cargo build
cd packages/valrs && npm install && npm run build

# Run tests
cargo test
npm test
```

---

## License

MIT © [Doug Lance](https://github.com/douglance)

---

<div align="center">
  <br />
  <p>
    <sub>Built with 🦀 Rust and ❤️ TypeScript</sub>
  </p>
</div>
