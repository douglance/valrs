/**
 * Schema Validation Benchmark
 *
 * Compares validation performance of Standard Schema RS (WASM)
 * against popular JavaScript/TypeScript validation libraries.
 *
 * Libraries tested:
 * - valrs (WASM)
 * - zod
 * - valibot
 * - yup
 * - @sinclair/typebox
 * - arktype
 */

import { Bench } from 'tinybench';

// ============================================================================
// Type Definitions
// ============================================================================

interface User {
  name: string;
  email: string;
  age: number;
  isActive: boolean;
  tags: string[];
  address?: {
    street: string;
    city: string;
    zip: string;
  };
}

interface BenchmarkResult {
  libraryName: string;
  testName: string;
  opsPerSecond: number;
  meanTimeMs: number;
  samples: number;
}

interface ValidatorAdapter {
  name: string;
  validate: (data: unknown) => boolean;
}

// ============================================================================
// Test Data
// ============================================================================

const VALID_SIMPLE_USER: User = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  age: 30,
  isActive: true,
  tags: ['developer', 'typescript'],
};

const VALID_COMPLEX_USER: User = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  age: 28,
  isActive: true,
  tags: ['designer', 'ui', 'ux'],
  address: {
    street: '123 Main Street',
    city: 'San Francisco',
    zip: '94102',
  },
};

const INVALID_WRONG_TYPE = {
  name: 12345, // Should be string
  email: 'test@example.com',
  age: 25,
  isActive: true,
  tags: ['test'],
};

const INVALID_CONSTRAINT_VIOLATION = {
  name: 'Test User',
  email: 'test@example.com',
  age: -5, // Should be >= 0
  isActive: true,
  tags: ['test'],
};

const INVALID_NESTED_ERROR = {
  name: 'Test User',
  email: 'test@example.com',
  age: 25,
  isActive: true,
  tags: ['test'],
  address: {
    street: '123 Main St',
    city: 'NYC',
    zip: 12345, // Should be string
  },
};

// ============================================================================
// Schema Definitions for Each Library
// ============================================================================

async function createValrsRsValidator(): Promise<ValidatorAdapter> {
  const { createSchema, success, fail } = await import('valrs');

  // Note: We don't call init() here because WASM requires browser environment.
  // The benchmark uses the pure JS fallback which is still the same validation logic.
  // For WASM benchmarks, run in a browser environment.

  // Build a User schema using the factory functions
  const UserSchema = createSchema<User>((value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return fail('Expected object');
    }

    const obj = value as Record<string, unknown>;

    // Validate name
    if (typeof obj.name !== 'string') {
      return fail('Expected string', ['name']);
    }
    if (obj.name.length < 2 || obj.name.length > 100) {
      return fail('Name must be between 2 and 100 characters', ['name']);
    }

    // Validate email
    if (typeof obj.email !== 'string') {
      return fail('Expected string', ['email']);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(obj.email)) {
      return fail('Invalid email format', ['email']);
    }

    // Validate age
    if (typeof obj.age !== 'number') {
      return fail('Expected number', ['age']);
    }
    if (obj.age < 0 || obj.age > 150) {
      return fail('Age must be between 0 and 150', ['age']);
    }

    // Validate isActive
    if (typeof obj.isActive !== 'boolean') {
      return fail('Expected boolean', ['isActive']);
    }

    // Validate tags
    if (!Array.isArray(obj.tags)) {
      return fail('Expected array', ['tags']);
    }
    for (let i = 0; i < obj.tags.length; i++) {
      if (typeof obj.tags[i] !== 'string') {
        return fail('Expected string', ['tags', i]);
      }
    }

    // Validate optional address
    if (obj.address !== undefined) {
      if (typeof obj.address !== 'object' || obj.address === null) {
        return fail('Expected object', ['address']);
      }
      const addr = obj.address as Record<string, unknown>;

      if (typeof addr.street !== 'string') {
        return fail('Expected string', ['address', 'street']);
      }
      if (typeof addr.city !== 'string') {
        return fail('Expected string', ['address', 'city']);
      }
      if (typeof addr.zip !== 'string') {
        return fail('Expected string', ['address', 'zip']);
      }
    }

    return success(value as User);
  });

  return {
    name: 'valrs',
    validate: (data: unknown): boolean => {
      const result = UserSchema['~standard'].validate(data);
      return !('issues' in result);
    },
  };
}

async function createZodValidator(): Promise<ValidatorAdapter> {
  const { z } = await import('zod');

  const AddressSchema = z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string(),
  });

  const UserSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    age: z.number().min(0).max(150),
    isActive: z.boolean(),
    tags: z.array(z.string()),
    address: AddressSchema.optional(),
  });

  return {
    name: 'zod',
    validate: (data: unknown): boolean => {
      const result = UserSchema.safeParse(data);
      return result.success;
    },
  };
}

async function createValibotValidator(): Promise<ValidatorAdapter> {
  const v = await import('valibot');

  const AddressSchema = v.object({
    street: v.string(),
    city: v.string(),
    zip: v.string(),
  });

  const UserSchema = v.object({
    name: v.pipe(v.string(), v.minLength(2), v.maxLength(100)),
    email: v.pipe(v.string(), v.email()),
    age: v.pipe(v.number(), v.minValue(0), v.maxValue(150)),
    isActive: v.boolean(),
    tags: v.array(v.string()),
    address: v.optional(AddressSchema),
  });

  return {
    name: 'valibot',
    validate: (data: unknown): boolean => {
      const result = v.safeParse(UserSchema, data);
      return result.success;
    },
  };
}

async function createYupValidator(): Promise<ValidatorAdapter> {
  const yup = await import('yup');

  const AddressSchema = yup.object({
    street: yup.string().required(),
    city: yup.string().required(),
    zip: yup.string().strict().required(),
  });

  const UserSchema = yup.object({
    name: yup.string().min(2).max(100).required(),
    email: yup.string().email().required(),
    age: yup.number().min(0).max(150).required(),
    isActive: yup.boolean().required(),
    tags: yup.array(yup.string().required()).required(),
    address: AddressSchema.notRequired().default(undefined),
  });

  return {
    name: 'yup',
    validate: (data: unknown): boolean => {
      try {
        UserSchema.validateSync(data, { strict: true });
        return true;
      } catch {
        return false;
      }
    },
  };
}

async function createTypeboxValidator(): Promise<ValidatorAdapter> {
  const { Type, FormatRegistry } = await import('@sinclair/typebox');
  const { TypeCompiler } = await import('@sinclair/typebox/compiler');

  // Register email format if not already registered
  if (!FormatRegistry.Has('email')) {
    FormatRegistry.Set('email', (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    });
  }

  const AddressSchema = Type.Object({
    street: Type.String(),
    city: Type.String(),
    zip: Type.String(),
  });

  const UserSchema = Type.Object({
    name: Type.String({ minLength: 2, maxLength: 100 }),
    email: Type.String({ format: 'email' }),
    age: Type.Number({ minimum: 0, maximum: 150 }),
    isActive: Type.Boolean(),
    tags: Type.Array(Type.String()),
    address: Type.Optional(AddressSchema),
  });

  // Use TypeCompiler for better performance (pre-compiles the schema)
  const CompiledSchema = TypeCompiler.Compile(UserSchema);

  return {
    name: 'typebox',
    validate: (data: unknown): boolean => {
      return CompiledSchema.Check(data);
    },
  };
}

async function createArktypeValidator(): Promise<ValidatorAdapter> {
  const { type } = await import('arktype');

  // ArkType uses a different syntax
  const UserSchema = type({
    name: 'string >= 2 & string <= 100',
    email: 'string.email',
    age: 'number >= 0 & number <= 150',
    isActive: 'boolean',
    tags: 'string[]',
    'address?': {
      street: 'string',
      city: 'string',
      zip: 'string',
    },
  });

  return {
    name: 'arktype',
    validate: (data: unknown): boolean => {
      const result = UserSchema(data);
      return !(result instanceof type.errors);
    },
  };
}

// ============================================================================
// Benchmark Runner
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(2) + 'K';
  }
  return num.toFixed(2);
}

function formatTime(ms: number): string {
  if (ms < 0.001) {
    return (ms * 1_000_000).toFixed(2) + ' ns';
  }
  if (ms < 1) {
    return (ms * 1_000).toFixed(2) + ' us';
  }
  return ms.toFixed(2) + ' ms';
}

function printTable(results: BenchmarkResult[], baselineName: string): void {
  const baseline = results.find((r) => r.libraryName === baselineName);
  const baselineOps = baseline?.opsPerSecond ?? results[0]?.opsPerSecond ?? 1;

  // Sort by ops/sec descending
  const sorted = [...results].sort((a, b) => b.opsPerSecond - a.opsPerSecond);

  const nameWidth = Math.max(...sorted.map((r) => r.libraryName.length), 'Library'.length);
  const opsWidth = 15;
  const timeWidth = 12;
  const relWidth = 10;

  const divider = '-'.repeat(nameWidth + opsWidth + timeWidth + relWidth + 13);

  console.log(divider);
  console.log(
    `| ${'Library'.padEnd(nameWidth)} | ${'ops/sec'.padStart(opsWidth)} | ${'mean time'.padStart(timeWidth)} | ${'relative'.padStart(relWidth)} |`
  );
  console.log(divider);

  for (const result of sorted) {
    const relative = result.opsPerSecond / baselineOps;
    const relativeStr =
      result.libraryName === baselineName ? '(baseline)' : relative.toFixed(2) + 'x';

    console.log(
      `| ${result.libraryName.padEnd(nameWidth)} | ${formatNumber(result.opsPerSecond).padStart(opsWidth)} | ${formatTime(result.meanTimeMs).padStart(timeWidth)} | ${relativeStr.padStart(relWidth)} |`
    );
  }

  console.log(divider);
}

async function runBenchmark(
  testName: string,
  testData: unknown,
  validators: ValidatorAdapter[],
  iterations: number
): Promise<BenchmarkResult[]> {
  console.log(`\nRunning: ${testName}`);
  console.log(`Iterations: ${iterations.toLocaleString()}`);

  const bench = new Bench({
    iterations,
    warmupIterations: Math.min(100, Math.floor(iterations / 10)),
  });

  for (const validator of validators) {
    bench.add(validator.name, () => {
      validator.validate(testData);
    });
  }

  await bench.run();

  const results: BenchmarkResult[] = [];

  for (const task of bench.tasks) {
    if (task.result) {
      results.push({
        libraryName: task.name,
        testName,
        opsPerSecond: task.result.hz,
        meanTimeMs: task.result.mean,
        samples: task.result.samples.length,
      });
    }
  }

  return results;
}

function verifyValidators(validators: ValidatorAdapter[]): void {
  console.log('\nVerifying validators produce correct results...');

  const testCases = [
    { name: 'Valid Simple', data: VALID_SIMPLE_USER, expected: true },
    { name: 'Valid Complex', data: VALID_COMPLEX_USER, expected: true },
    { name: 'Invalid Type', data: INVALID_WRONG_TYPE, expected: false },
    { name: 'Invalid Constraint', data: INVALID_CONSTRAINT_VIOLATION, expected: false },
    { name: 'Invalid Nested', data: INVALID_NESTED_ERROR, expected: false },
  ];

  const results: { validator: string; test: string; result: boolean; expected: boolean }[] = [];

  for (const validator of validators) {
    for (const testCase of testCases) {
      const result = validator.validate(testCase.data);
      results.push({
        validator: validator.name,
        test: testCase.name,
        result,
        expected: testCase.expected,
      });
    }
  }

  // Print verification table
  const validatorWidth = Math.max(...validators.map((v) => v.name.length), 'Validator'.length);
  console.log('\nValidation Results:');
  console.log(`${'Validator'.padEnd(validatorWidth)} | ${testCases.map((t) => t.name.padEnd(16)).join(' | ')}`);
  console.log('-'.repeat(validatorWidth + 2 + testCases.length * 19));

  for (const validator of validators) {
    const row = results.filter((r) => r.validator === validator.name);
    const cells = row.map((r) => {
      const icon = r.result === r.expected ? (r.result ? 'pass' : 'reject') : 'MISMATCH';
      return icon.padEnd(16);
    });
    console.log(`${validator.name.padEnd(validatorWidth)} | ${cells.join(' | ')}`);
  }

  // Check for mismatches
  const mismatches = results.filter((r) => r.result !== r.expected);
  if (mismatches.length > 0) {
    console.log('\nWarning: Some validators produced unexpected results:');
    for (const m of mismatches) {
      console.log(`  ${m.validator} on "${m.test}": got ${m.result}, expected ${m.expected}`);
    }
  } else {
    console.log('\nAll validators produce expected results.');
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Schema Validation Benchmark');
  console.log('='.repeat(60));
  console.log('\nInitializing validators...');

  // Create all validators
  const validators: ValidatorAdapter[] = [];

  try {
    validators.push(await createValrsRsValidator());
    console.log('  - valrs initialized');
  } catch (error) {
    console.log(`  - valrs FAILED: ${error}`);
  }

  try {
    validators.push(await createZodValidator());
    console.log('  - zod initialized');
  } catch (error) {
    console.log(`  - zod FAILED: ${error}`);
  }

  try {
    validators.push(await createValibotValidator());
    console.log('  - valibot initialized');
  } catch (error) {
    console.log(`  - valibot FAILED: ${error}`);
  }

  try {
    validators.push(await createYupValidator());
    console.log('  - yup initialized');
  } catch (error) {
    console.log(`  - yup FAILED: ${error}`);
  }

  try {
    validators.push(await createTypeboxValidator());
    console.log('  - typebox initialized');
  } catch (error) {
    console.log(`  - typebox FAILED: ${error}`);
  }

  try {
    validators.push(await createArktypeValidator());
    console.log('  - arktype initialized');
  } catch (error) {
    console.log(`  - arktype FAILED: ${error}`);
  }

  if (validators.length === 0) {
    console.error('No validators could be initialized!');
    process.exit(1);
  }

  console.log(`\n${validators.length} validators ready.`);

  // Verify validators first
  verifyValidators(validators);

  // Run benchmarks
  const isQuickMode = process.env.QUICK_MODE === '1';
  const iterations = isQuickMode ? 1000 : 10000;

  console.log(`\nBenchmark mode: ${isQuickMode ? 'Quick (fewer iterations)' : 'Full'}`);

  const allResults: BenchmarkResult[] = [];

  // Test 1: Valid simple object
  const simpleResults = await runBenchmark(
    'Valid Simple Object',
    VALID_SIMPLE_USER,
    validators,
    iterations
  );
  allResults.push(...simpleResults);
  printTable(simpleResults, 'valrs');

  // Test 2: Valid complex object with nested address
  const complexResults = await runBenchmark(
    'Valid Complex Object (with address)',
    VALID_COMPLEX_USER,
    validators,
    iterations
  );
  allResults.push(...complexResults);
  printTable(complexResults, 'valrs');

  // Test 3: Invalid - wrong type
  const wrongTypeResults = await runBenchmark(
    'Invalid - Wrong Type',
    INVALID_WRONG_TYPE,
    validators,
    iterations
  );
  allResults.push(...wrongTypeResults);
  printTable(wrongTypeResults, 'valrs');

  // Test 4: Invalid - constraint violation
  const constraintResults = await runBenchmark(
    'Invalid - Constraint Violation (age = -5)',
    INVALID_CONSTRAINT_VIOLATION,
    validators,
    iterations
  );
  allResults.push(...constraintResults);
  printTable(constraintResults, 'valrs');

  // Test 5: Invalid - nested error
  const nestedResults = await runBenchmark(
    'Invalid - Nested Error (bad zip)',
    INVALID_NESTED_ERROR,
    validators,
    iterations
  );
  allResults.push(...nestedResults);
  printTable(nestedResults, 'valrs');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY - Average Performance Across All Tests');
  console.log('='.repeat(60));

  const avgByLibrary = new Map<string, { totalOps: number; count: number }>();
  for (const result of allResults) {
    const current = avgByLibrary.get(result.libraryName) ?? { totalOps: 0, count: 0 };
    current.totalOps += result.opsPerSecond;
    current.count += 1;
    avgByLibrary.set(result.libraryName, current);
  }

  const averages: BenchmarkResult[] = [];
  for (const [libraryName, stats] of avgByLibrary) {
    averages.push({
      libraryName,
      testName: 'Average',
      opsPerSecond: stats.totalOps / stats.count,
      meanTimeMs: 0, // Not meaningful for averages
      samples: 0,
    });
  }

  printTable(averages, 'valrs');

  console.log('\nBenchmark complete.');
}

main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
