/**
 * JSON Schema to JavaScript Compiler
 *
 * Compiles JSON Schema definitions into optimized JavaScript validation functions.
 * This approach generates direct property checks similar to TypeBox's TypeCompiler,
 * providing high-performance validation without WASM overhead.
 *
 * @packageDocumentation
 */

/**
 * JSON Schema type definition for compiler input.
 * Supports a subset of JSON Schema draft-07/2020-12 features.
 */
export interface JsonSchema {
  readonly type?: string;
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly pattern?: string;
  readonly format?: string;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly multipleOf?: number;
  readonly uniqueItems?: boolean;
  readonly additionalProperties?: boolean | JsonSchema;
  readonly allOf?: readonly JsonSchema[];
  readonly anyOf?: readonly JsonSchema[];
  readonly oneOf?: readonly JsonSchema[];
  readonly not?: JsonSchema;
  readonly $ref?: string;
  readonly [key: string]: unknown;
}

/**
 * Compiled validator function type.
 * Returns true if data is valid, false otherwise.
 */
export type CompiledValidator = (data: unknown) => boolean;

/**
 * Generates JavaScript validation code from a JSON Schema.
 *
 * This function recursively traverses the schema and generates a string
 * of JavaScript code that performs direct property checks.
 *
 * @param schema - The JSON Schema to compile
 * @param path - The current path expression (e.g., 'data', 'data["name"]')
 * @returns A JavaScript expression string that evaluates to boolean
 *
 * @internal
 */
function generateValidatorCode(schema: JsonSchema, path: string): string {
  const checks: string[] = [];

  // Type check
  const type = schema.type;
  if (type !== undefined) {
    switch (type) {
      case 'string':
        checks.push(`typeof ${path} === 'string'`);
        break;
      case 'number':
        checks.push(`typeof ${path} === 'number' && !Number.isNaN(${path})`);
        break;
      case 'integer':
        checks.push(`typeof ${path} === 'number' && Number.isInteger(${path})`);
        break;
      case 'boolean':
        checks.push(`typeof ${path} === 'boolean'`);
        break;
      case 'null':
        checks.push(`${path} === null`);
        break;
      case 'object':
        checks.push(`typeof ${path} === 'object' && ${path} !== null && !Array.isArray(${path})`);
        break;
      case 'array':
        checks.push(`Array.isArray(${path})`);
        break;
    }
  }

  // String constraints
  if (typeof schema.minLength === 'number') {
    checks.push(`${path}.length >= ${schema.minLength}`);
  }
  if (typeof schema.maxLength === 'number') {
    checks.push(`${path}.length <= ${schema.maxLength}`);
  }
  if (typeof schema.pattern === 'string') {
    // Escape the pattern for use in a RegExp constructor call
    const escapedPattern = schema.pattern.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    checks.push(`new RegExp('${escapedPattern}').test(${path})`);
  }

  // Number constraints
  if (typeof schema.minimum === 'number') {
    checks.push(`${path} >= ${schema.minimum}`);
  }
  if (typeof schema.maximum === 'number') {
    checks.push(`${path} <= ${schema.maximum}`);
  }
  if (typeof schema.exclusiveMinimum === 'number') {
    checks.push(`${path} > ${schema.exclusiveMinimum}`);
  }
  if (typeof schema.exclusiveMaximum === 'number') {
    checks.push(`${path} < ${schema.exclusiveMaximum}`);
  }
  if (typeof schema.multipleOf === 'number') {
    checks.push(`${path} % ${schema.multipleOf} === 0`);
  }

  // Array constraints
  if (typeof schema.minItems === 'number') {
    checks.push(`${path}.length >= ${schema.minItems}`);
  }
  if (typeof schema.maxItems === 'number') {
    checks.push(`${path}.length <= ${schema.maxItems}`);
  }

  // Array items validation
  const items = schema.items;
  if (items !== undefined) {
    const itemCheck = generateValidatorCode(items, 'item');
    checks.push(`${path}.every(item => ${itemCheck})`);
  }

  // Unique items check
  if (schema.uniqueItems === true) {
    // For primitive types, use Set comparison; for objects, use JSON.stringify
    checks.push(`new Set(${path}.map(v => typeof v === 'object' ? JSON.stringify(v) : v)).size === ${path}.length`);
  }

  // Enum check
  if (schema.enum !== undefined) {
    const enumValues = JSON.stringify(schema.enum);
    checks.push(`${enumValues}.includes(${path})`);
  }

  // Const check
  if (schema.const !== undefined) {
    const constValue = JSON.stringify(schema.const);
    checks.push(`${path} === ${constValue}`);
  }

  // Object properties validation
  const properties = schema.properties;
  const required = schema.required ?? [];

  if (properties !== undefined) {
    for (const [key, propSchema] of Object.entries(properties)) {
      // Escape the key for use in property access
      const escapedKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const propPath = `${path}["${escapedKey}"]`;
      const propCheck = generateValidatorCode(propSchema, propPath);

      if (required.includes(key)) {
        // Required property - must exist and validate
        checks.push(`(${propPath} !== undefined && ${propCheck})`);
      } else {
        // Optional property - if exists, must validate
        checks.push(`(${propPath} === undefined || ${propCheck})`);
      }
    }
  }

  // Additional properties validation
  if (schema.additionalProperties === false && properties !== undefined) {
    const allowedKeys = JSON.stringify(Object.keys(properties));
    checks.push(`Object.keys(${path}).every(k => ${allowedKeys}.includes(k))`);
  } else if (
    typeof schema.additionalProperties === 'object' &&
    schema.additionalProperties !== null
  ) {
    const propKeys = properties !== undefined ? Object.keys(properties) : [];
    const propKeysJson = JSON.stringify(propKeys);
    const additionalCheck = generateValidatorCode(schema.additionalProperties, 'v');
    checks.push(
      `Object.entries(${path}).every(([k, v]) => ${propKeysJson}.includes(k) || (${additionalCheck}))`
    );
  }

  // Composition keywords
  if (schema.allOf !== undefined) {
    const allOfChecks = schema.allOf.map((s) => generateValidatorCode(s, path));
    checks.push(`(${allOfChecks.join(' && ')})`);
  }

  if (schema.anyOf !== undefined) {
    const anyOfChecks = schema.anyOf.map((s) => generateValidatorCode(s, path));
    checks.push(`(${anyOfChecks.join(' || ')})`);
  }

  if (schema.oneOf !== undefined) {
    const oneOfChecks = schema.oneOf.map((s) => `(${generateValidatorCode(s, path)} ? 1 : 0)`);
    checks.push(`([${oneOfChecks.join(', ')}].reduce((a, b) => a + b, 0) === 1)`);
  }

  if (schema.not !== undefined) {
    const notCheck = generateValidatorCode(schema.not, path);
    checks.push(`!(${notCheck})`);
  }

  if (checks.length === 0) {
    return 'true';
  }

  return `(${checks.join(' && ')})`;
}

/**
 * Compiles a JSON Schema into an optimized JavaScript validation function.
 *
 * This generates direct property checks like TypeBox's TypeCompiler,
 * creating highly efficient validators without the overhead of schema
 * interpretation at runtime.
 *
 * @param schema - The JSON Schema to compile
 * @returns A compiled validation function
 *
 * @example
 * ```typescript
 * import { compileSchema } from 'valrs';
 *
 * const userSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string', minLength: 1 },
 *     age: { type: 'integer', minimum: 0 },
 *   },
 *   required: ['name', 'age'],
 * };
 *
 * const validate = compileSchema(userSchema);
 *
 * validate({ name: 'John', age: 30 }); // true
 * validate({ name: '', age: 30 });     // false (minLength violation)
 * validate({ name: 'John', age: -1 }); // false (minimum violation)
 * ```
 */
export function compileSchema(schema: JsonSchema): CompiledValidator {
  const code = generateValidatorCode(schema, 'data');
  // Use Function constructor to create the validator
  // This is safe as we control the generated code entirely
  return new Function('data', `return ${code}`) as CompiledValidator;
}

/**
 * Generates the JavaScript source code for a validator function.
 *
 * Useful for debugging or generating static validator files.
 *
 * @param schema - The JSON Schema to compile
 * @returns The JavaScript function body as a string
 *
 * @example
 * ```typescript
 * import { compileSchemaToCode } from 'valrs';
 *
 * const code = compileSchemaToCode({
 *   type: 'string',
 *   minLength: 1,
 * });
 * // Returns: "return (typeof data === 'string' && data.length >= 1)"
 * ```
 */
export function compileSchemaToCode(schema: JsonSchema): string {
  const code = generateValidatorCode(schema, 'data');
  return `return ${code}`;
}

/**
 * Schema registry with pre-compiled validators.
 *
 * Provides a convenient way to register schemas by name and validate
 * data against them. All schemas are compiled on registration for
 * optimal validation performance.
 *
 * @example
 * ```typescript
 * import { CompiledRegistry } from 'valrs';
 *
 * const registry = new CompiledRegistry();
 *
 * registry.register('User', {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     email: { type: 'string' },
 *   },
 *   required: ['name', 'email'],
 * });
 *
 * registry.validate('User', { name: 'John', email: 'john@example.com' }); // true
 * registry.validate('User', { name: 'John' }); // false (missing email)
 * ```
 */
export class CompiledRegistry {
  private readonly validators: Map<string, CompiledValidator> = new Map();
  private readonly schemas: Map<string, JsonSchema> = new Map();
  private readonly generatedCode: Map<string, string> = new Map();

  /**
   * Registers a schema with the registry.
   *
   * The schema is immediately compiled for optimal validation performance.
   *
   * @param name - The name to register the schema under
   * @param schema - The JSON Schema to register
   */
  register(name: string, schema: JsonSchema): void {
    this.schemas.set(name, schema);
    this.validators.set(name, compileSchema(schema));
    this.generatedCode.set(name, compileSchemaToCode(schema));
  }

  /**
   * Validates data against a registered schema.
   *
   * @param name - The name of the registered schema
   * @param data - The data to validate
   * @returns true if valid, false otherwise
   * @throws Error if schema is not registered
   */
  validate(name: string, data: unknown): boolean {
    const validator = this.validators.get(name);
    if (validator === undefined) {
      throw new Error(`Schema '${name}' not found in registry`);
    }
    return validator(data);
  }

  /**
   * Gets a registered schema by name.
   *
   * @param name - The name of the schema
   * @returns The schema, or undefined if not registered
   */
  getSchema(name: string): JsonSchema | undefined {
    return this.schemas.get(name);
  }

  /**
   * Gets the compiled validator function for a schema.
   *
   * @param name - The name of the schema
   * @returns The compiled validator, or undefined if not registered
   */
  getValidator(name: string): CompiledValidator | undefined {
    return this.validators.get(name);
  }

  /**
   * Gets the generated JavaScript code for a schema.
   *
   * Useful for debugging or static code generation.
   *
   * @param name - The name of the schema
   * @returns The generated code, or undefined if not registered
   */
  getGeneratedCode(name: string): string | undefined {
    return this.generatedCode.get(name);
  }

  /**
   * Checks if a schema is registered.
   *
   * @param name - The name to check
   * @returns true if registered, false otherwise
   */
  has(name: string): boolean {
    return this.validators.has(name);
  }

  /**
   * Removes a schema from the registry.
   *
   * @param name - The name of the schema to remove
   * @returns true if removed, false if not found
   */
  delete(name: string): boolean {
    const existed = this.validators.has(name);
    this.validators.delete(name);
    this.schemas.delete(name);
    this.generatedCode.delete(name);
    return existed;
  }

  /**
   * Removes all schemas from the registry.
   */
  clear(): void {
    this.validators.clear();
    this.schemas.clear();
    this.generatedCode.clear();
  }

  /**
   * Gets the names of all registered schemas.
   */
  get names(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Gets the number of registered schemas.
   */
  get size(): number {
    return this.validators.size;
  }
}
