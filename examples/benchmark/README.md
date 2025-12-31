# Schema Validation Benchmark

Performance benchmarks comparing valrs against popular JavaScript/TypeScript validation libraries.

## Two Benchmark Modes

| Mode | Environment | valrs Implementation | Use For |
|------|-------------|---------------------|---------|
| **Node.js** | Terminal | JavaScript fallback | Quick testing, CI |
| **Browser** | Chrome/Firefox/Safari | **Actual WASM module** | Real performance measurement |

> **Important:** For accurate WASM performance, use the browser benchmark. The Node.js benchmark uses a JavaScript fallback since WASM requires browser APIs.

## Libraries Tested

| Library | Description |
|---------|-------------|
| **valrs** | Rust-powered schema validation (JS fallback in Node.js, WASM in browsers) |
| **zod** | Most popular TypeScript-first schema validation |
| **valibot** | Modular and tree-shakeable alternative |
| **yup** | Established validation library (Node.js only) |
| **@sinclair/typebox** | Fast JSON Schema based validator with JIT compilation |
| **arktype** | Modern TypeScript-first with syntax innovations |

## Schema Under Test

The benchmark validates a `User` object with various constraints:

```typescript
interface User {
  name: string;        // min length 2, max 100
  email: string;       // email format validation
  age: number;         // min 0, max 150
  isActive: boolean;
  tags: string[];      // array of strings
  address?: {          // optional nested object
    street: string;
    city: string;
    zip: string;
  };
}
```

## Test Cases

1. **Valid Simple Object** - User without optional address
2. **Valid Complex Object** - User with nested address
3. **Invalid - Wrong Type** - `name` is a number instead of string
4. **Invalid - Constraint Violation** - `age` is -5 (below minimum)
5. **Invalid - Nested Error** - `zip` is a number instead of string

## Prerequisites

1. Build the WASM module first (from repository root):

```bash
cd packages/valrs
npm run build:wasm
```

2. Install benchmark dependencies:

```bash
cd examples/benchmark
npm install
```

3. Link the WASM package (required for valrs to work):

```bash
cd ../../packages/valrs/node_modules
ln -sf ../wasm valrs-wasm
```

## Running the Benchmarks

### Browser Benchmark (WASM - Recommended)

The browser benchmark uses the **actual WASM module** for accurate performance measurement.

1. Start a local server from the repository root:

```bash
# Using Python
python3 -m http.server 8080

# Or using Node.js
npx serve .
```

2. Open the benchmark in your browser:

```
http://localhost:8080/examples/benchmark/browser-benchmark.html
```

3. Click "Run Benchmark" (10K iterations) or "Quick Run" (1K iterations)

The browser benchmark:
- Loads the actual WASM module from `pkg/`
- Loads competitor libraries from CDN (esm.sh)
- Shows live progress as benchmarks run
- Displays results in sortable tables with visual bars
- Verifies all validators produce correct results

### Node.js Benchmark (JavaScript Fallback)

**Note:** This uses a JavaScript fallback, not the WASM module.

#### Full Benchmark (10,000 iterations per test)

```bash
npm run benchmark
```

#### Quick Benchmark (1,000 iterations per test)

```bash
npm run benchmark:quick
```

## Example Output

```
============================================================
Schema Validation Benchmark
============================================================

Initializing validators...
  - valrs initialized
  - zod initialized
  - valibot initialized
  - yup initialized
  - typebox initialized
  - arktype initialized

6 validators ready.

Verifying validators produce correct results...

Validation Results:
Validator | Valid Simple     | Valid Complex    | Invalid Type     | Invalid Constraint | Invalid Nested
----------------------------------------------------------------------------------------------------------
valrs     | pass             | pass             | reject           | reject           | reject
zod       | pass             | pass             | reject           | reject           | reject
valibot   | pass             | pass             | reject           | reject           | reject
yup       | pass             | pass             | reject           | reject           | reject
typebox   | pass             | pass             | reject           | reject           | reject
arktype   | pass             | pass             | reject           | reject           | reject

All validators produce expected results.

Benchmark mode: Quick (fewer iterations)

Running: Valid Simple Object
Iterations: 1,000
---------------------------------------------------------
| Library |         ops/sec |    mean time |   relative |
---------------------------------------------------------
| valrs   |          20.92M |     54.12 ns | (baseline) |
| arktype |          20.64M |     53.79 ns |      0.99x |
| typebox |          20.24M |     55.71 ns |      0.97x |
| valibot |           2.47M |    429.57 ns |      0.12x |
| zod     |           1.92M |    564.87 ns |      0.09x |
| yup     |         101.62K |     10.18 us |      0.00x |
---------------------------------------------------------

...

============================================================
SUMMARY - Average Performance Across All Tests
============================================================
---------------------------------------------------------
| Library |         ops/sec |    mean time |   relative |
---------------------------------------------------------
| typebox |          22.75M |      0.00 ns |      1.04x |
| valrs   |          21.84M |      0.00 ns | (baseline) |
| arktype |           7.73M |      0.00 ns |      0.35x |
| valibot |           2.11M |      0.00 ns |      0.10x |
| zod     |           1.45M |      0.00 ns |      0.07x |
| yup     |          65.23K |      0.00 ns |      0.00x |
---------------------------------------------------------

Benchmark complete.
```

## Methodology

- **Warmup**: Each library is warmed up before measurement (10% of iterations)
- **Measurement**: Uses `tinybench` for accurate timing with high-resolution timers
- **Fairness**: All libraries validate equivalent schemas with identical validation logic
- **Verification**: Each validator is tested against known valid/invalid inputs before benchmarking
- **Reporting**: Results show operations per second, mean time, and relative performance

## Important Notes

### Node.js vs Browser Performance

**Node.js benchmark** runs using valrs's pure JavaScript validation fallback. The WASM module requires browser APIs (`fetch()`) to load the `.wasm` binary.

**Browser benchmark** runs the actual WASM module, giving you accurate Rust/WASM performance numbers. This is the recommended way to measure valrs performance.

Performance characteristics differ significantly between the two:
- WASM validation in browsers may be faster due to Rust's optimizations
- JavaScript engines in different browsers have varying performance
- JIT warmup behavior differs between Node.js and browsers

### TypeBox Compiled Mode

TypeBox uses `TypeCompiler.Compile()` which pre-compiles the schema to optimized JavaScript. This is the fastest mode for TypeBox and represents real-world usage.

### What This Benchmark Measures

- Raw validation speed (operations per second)
- Performance across different scenarios (valid, invalid, nested)

### What This Benchmark Does NOT Measure

- Type inference quality
- Bundle size
- Developer experience
- Feature completeness
- Memory usage
- Error message quality
- Schema composition ergonomics

## Interpreting Results

- **Higher ops/sec is better** - More validations per second
- **Relative** shows performance compared to valrs baseline
- Values > 1.0x mean faster than valrs
- Values < 1.0x mean slower than valrs

## Troubleshooting

### Browser Benchmark Issues

**WASM fails to load**

The WASM module must be served over HTTP (not `file://`). Start a local server:

```bash
python3 -m http.server 8080
# Then open http://localhost:8080/examples/benchmark/browser-benchmark.html
```

**CORS errors**

If you see CORS errors, ensure you're running from the repository root:

```bash
cd /path/to/standard
python3 -m http.server 8080
```

**Library loading fails**

The browser benchmark loads competitor libraries from esm.sh CDN. Ensure you have internet access.

### Node.js Benchmark Issues

**valrs fails to initialize**

Ensure the WASM module is linked:

```bash
cd packages/valrs/node_modules
ln -sf ../wasm valrs-wasm
```

**Missing dependencies**

```bash
cd examples/benchmark
npm install
```

**TypeScript errors**

The benchmark uses `tsx` to run TypeScript directly:

```bash
npm install
```
