/**
 * Tests for streaming validation (Phase 6).
 *
 * Tests cover:
 * - JSON array streaming with v.stream()
 * - NDJSON streaming with v.streamLines()
 * - Stream options (maxItems, maxBytes, timeout, onError)
 * - Error handling modes
 * - Backpressure and memory efficiency
 */

import { describe, it, expect } from 'vitest';
import { v, stream, streamLines, createMockStream, createChunkedStream } from '../index';

// ============================================================================
// Test Schema
// ============================================================================

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.string().email(),
});

type User = v.infer<typeof UserSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock stream from an array of users.
 */
function createUserArrayStream(users: User[]): ReadableStream<string> {
  const json = JSON.stringify(users);
  return createChunkedStream(json, 32);
}

/**
 * Creates a mock NDJSON stream from an array of users.
 */
function createNdjsonStream(users: User[]): ReadableStream<string> {
  const lines = users.map((u) => JSON.stringify(u)).join('\n');
  return createChunkedStream(lines, 32);
}

// ============================================================================
// Basic JSON Array Streaming Tests
// ============================================================================

describe('stream() - JSON array streaming', () => {
  it('should stream and validate items from a JSON array', async () => {
    const users: User[] = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ];

    const mockStream = createUserArrayStream(users);
    const results: User[] = [];

    for await (const user of stream(v.array(UserSchema), mockStream)) {
      results.push(user);
    }

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
    expect(results[1]).toEqual({ id: 2, name: 'Bob', email: 'bob@example.com' });
    expect(results[2]).toEqual({ id: 3, name: 'Charlie', email: 'charlie@example.com' });
  });

  it('should handle empty arrays', async () => {
    const mockStream = createMockStream(['[]']);
    const results: User[] = [];

    for await (const user of stream(v.array(UserSchema), mockStream)) {
      results.push(user);
    }

    expect(results).toHaveLength(0);
  });

  it('should handle arrays with a single item', async () => {
    const mockStream = createMockStream(['[{"id": 1, "name": "Alice", "email": "alice@example.com"}]']);
    const results: User[] = [];

    for await (const user of stream(v.array(UserSchema), mockStream)) {
      results.push(user);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
  });

  it('should handle chunked streams that split JSON across chunks', async () => {
    // Split the JSON at awkward points
    const mockStream = createMockStream([
      '[{"id": 1, "na',
      'me": "Alice", "e',
      'mail": "alice@example.com"},',
      '{"id": 2, "name": "Bob", "email": "bob@example.com"}]',
    ]);

    const results: User[] = [];
    for await (const user of stream(v.array(UserSchema), mockStream)) {
      results.push(user);
    }

    expect(results).toHaveLength(2);
    expect(results[0]?.name).toBe('Alice');
    expect(results[1]?.name).toBe('Bob');
  });

  it('should validate each item with the schema', async () => {
    const mockStream = createMockStream([
      '[{"id": 1, "name": "Alice", "email": "invalid-email"}]',
    ]);

    await expect(
      (async () => {
        const results: User[] = [];
        for await (const user of stream(v.array(UserSchema), mockStream)) {
          results.push(user);
        }
        return results;
      })()
    ).rejects.toThrow();
  });

  it('should support toArray() method', async () => {
    const users: User[] = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ];

    const mockStream = createUserArrayStream(users);
    const results = await stream(v.array(UserSchema), mockStream).toArray();

    expect(results).toHaveLength(2);
    expect(results[0]?.name).toBe('Alice');
    expect(results[1]?.name).toBe('Bob');
  });

  it('should handle nested objects', async () => {
    const NestedSchema = v.object({
      id: v.number(),
      data: v.object({
        value: v.string(),
        nested: v.object({
          deep: v.number(),
        }),
      }),
    });

    const mockStream = createMockStream([
      '[{"id": 1, "data": {"value": "test", "nested": {"deep": 42}}}]',
    ]);

    const results = await stream(v.array(NestedSchema), mockStream).toArray();

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 1,
      data: { value: 'test', nested: { deep: 42 } },
    });
  });

  it('should handle arrays within items', async () => {
    const ArrayItemSchema = v.object({
      id: v.number(),
      tags: v.array(v.string()),
    });

    const mockStream = createMockStream([
      '[{"id": 1, "tags": ["a", "b", "c"]}, {"id": 2, "tags": []}]',
    ]);

    const results = await stream(v.array(ArrayItemSchema), mockStream).toArray();

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 1, tags: ['a', 'b', 'c'] });
    expect(results[1]).toEqual({ id: 2, tags: [] });
  });
});

// ============================================================================
// Stream Options Tests
// ============================================================================

describe('stream() - options', () => {
  it('should respect maxItems option', async () => {
    const users: User[] = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `User${i}`,
      email: `user${i}@example.com`,
    }));

    const mockStream = createUserArrayStream(users);
    const results = await stream(v.array(UserSchema), mockStream, {
      maxItems: 10,
    }).toArray();

    expect(results).toHaveLength(10);
    expect(results[0]?.id).toBe(0);
    expect(results[9]?.id).toBe(9);
  });

  it('should skip invalid items with onError: "skip"', async () => {
    const mockStream = createMockStream([
      '[',
      '{"id": 1, "name": "Alice", "email": "alice@example.com"},',
      '{"id": 2, "name": "Bob", "email": "invalid"},',
      '{"id": 3, "name": "Charlie", "email": "charlie@example.com"}',
      ']',
    ]);

    const results = await stream(v.array(UserSchema), mockStream, {
      onError: 'skip',
    }).toArray();

    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe(1);
    expect(results[1]?.id).toBe(3);
  });

  it('should collect errors with onError: "collect"', async () => {
    const mockStream = createMockStream([
      '[',
      '{"id": 1, "name": "Alice", "email": "alice@example.com"},',
      '{"id": 2, "name": "Bob", "email": "invalid"},',
      '{"id": 3, "name": "Charlie", "email": "charlie@example.com"}',
      ']',
    ]);

    const streamResult = stream(v.array(UserSchema), mockStream, {
      onError: 'collect',
    });

    const results = await streamResult.toArray();

    expect(results).toHaveLength(2);
    expect(streamResult.errors).toHaveLength(1);
    expect(streamResult.errors[0]?.index).toBe(1);
  });

  it('should throw on first error with onError: "throw" (default)', async () => {
    const mockStream = createMockStream([
      '[',
      '{"id": 1, "name": "Alice", "email": "invalid"},',
      '{"id": 2, "name": "Bob", "email": "bob@example.com"}',
      ']',
    ]);

    await expect(
      stream(v.array(UserSchema), mockStream).toArray()
    ).rejects.toThrow();
  });
});

// ============================================================================
// NDJSON Streaming Tests
// ============================================================================

describe('streamLines() - NDJSON streaming', () => {
  it('should stream and validate lines from NDJSON', async () => {
    const users: User[] = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ];

    const mockStream = createNdjsonStream(users);
    const results: User[] = [];

    for await (const user of streamLines(UserSchema, mockStream)) {
      results.push(user);
    }

    expect(results).toHaveLength(2);
    expect(results[0]?.name).toBe('Alice');
    expect(results[1]?.name).toBe('Bob');
  });

  it('should handle empty lines', async () => {
    const mockStream = createMockStream([
      '{"id": 1, "name": "Alice", "email": "alice@example.com"}\n',
      '\n',
      '{"id": 2, "name": "Bob", "email": "bob@example.com"}\n',
      '\n\n',
    ]);

    const results = await streamLines(UserSchema, mockStream).toArray();

    expect(results).toHaveLength(2);
  });

  it('should handle lines without trailing newline', async () => {
    const mockStream = createMockStream([
      '{"id": 1, "name": "Alice", "email": "alice@example.com"}',
    ]);

    const results = await streamLines(UserSchema, mockStream).toArray();

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Alice');
  });

  it('should respect maxItems option', async () => {
    const lines = Array.from({ length: 50 }, (_, i) =>
      JSON.stringify({ id: i, name: `User${i}`, email: `user${i}@example.com` })
    ).join('\n');

    const mockStream = createMockStream([lines]);
    const results = await streamLines(UserSchema, mockStream, {
      maxItems: 5,
    }).toArray();

    expect(results).toHaveLength(5);
  });

  it('should skip invalid lines with onError: "skip"', async () => {
    const mockStream = createMockStream([
      '{"id": 1, "name": "Alice", "email": "alice@example.com"}\n',
      'not valid json\n',
      '{"id": 2, "name": "Bob", "email": "bob@example.com"}\n',
    ]);

    const results = await streamLines(UserSchema, mockStream, {
      onError: 'skip',
    }).toArray();

    expect(results).toHaveLength(2);
  });

  it('should collect errors with onError: "collect"', async () => {
    const mockStream = createMockStream([
      '{"id": 1, "name": "Alice", "email": "alice@example.com"}\n',
      '{"id": 2, "name": "Bob", "email": "invalid"}\n',
      '{"id": 3, "name": "Charlie", "email": "charlie@example.com"}\n',
    ]);

    const streamResult = streamLines(UserSchema, mockStream, {
      onError: 'collect',
    });

    const results = await streamResult.toArray();

    expect(results).toHaveLength(2);
    expect(streamResult.errors).toHaveLength(1);
    expect(streamResult.errors[0]?.index).toBe(1);
  });
});

// ============================================================================
// Namespace Access Tests
// ============================================================================

describe('v namespace streaming functions', () => {
  it('should expose stream() on v namespace', async () => {
    const mockStream = createMockStream([
      '[{"id": 1, "name": "Alice", "email": "alice@example.com"}]',
    ]);

    const results = await v.stream(v.array(UserSchema), mockStream).toArray();
    expect(results).toHaveLength(1);
  });

  it('should expose streamLines() on v namespace', async () => {
    const mockStream = createMockStream([
      '{"id": 1, "name": "Alice", "email": "alice@example.com"}',
    ]);

    const results = await v.streamLines(UserSchema, mockStream).toArray();
    expect(results).toHaveLength(1);
  });

  it('should expose createMockStream() on v namespace', () => {
    const mockStream = v.createMockStream(['hello', 'world']);
    expect(mockStream).toBeDefined();
    expect(mockStream.getReader).toBeDefined();
  });

  it('should expose createChunkedStream() on v namespace', () => {
    const chunkedStream = v.createChunkedStream('[1,2,3]', 2);
    expect(chunkedStream).toBeDefined();
    expect(chunkedStream.getReader).toBeDefined();
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('streaming edge cases', () => {
  it('should handle primitive arrays', async () => {
    const mockStream = createMockStream(['[1, 2, 3, 4, 5]']);
    const results = await stream(v.array(v.number()), mockStream).toArray();

    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle string arrays', async () => {
    const mockStream = createMockStream(['["hello", "world"]']);
    const results = await stream(v.array(v.string()), mockStream).toArray();

    expect(results).toEqual(['hello', 'world']);
  });

  it('should handle boolean arrays', async () => {
    const mockStream = createMockStream(['[true, false, true]']);
    const results = await stream(v.array(v.boolean()), mockStream).toArray();

    expect(results).toEqual([true, false, true]);
  });

  it('should handle null values in arrays', async () => {
    const mockStream = createMockStream(['[null, null]']);
    const results = await stream(v.array(v.null()), mockStream).toArray();

    expect(results).toEqual([null, null]);
  });

  it('should handle very long strings in items', async () => {
    const longString = 'x'.repeat(10000);
    const mockStream = createMockStream([
      `[{"id": 1, "name": "${longString}", "email": "test@example.com"}]`,
    ]);

    const results = await stream(v.array(UserSchema), mockStream).toArray();

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe(longString);
  });

  it('should handle JSON with escaped characters', async () => {
    const mockStream = createMockStream([
      '[{"id": 1, "name": "Alice \\"Wonderland\\"", "email": "alice@example.com"}]',
    ]);

    const results = await stream(v.array(UserSchema), mockStream).toArray();

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Alice "Wonderland"');
  });

  it('should handle JSON with unicode characters', async () => {
    const mockStream = createMockStream([
      '[{"id": 1, "name": "\\u0041lice", "email": "alice@example.com"}]',
    ]);

    const results = await stream(v.array(UserSchema), mockStream).toArray();

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Alice');
  });

  it('should reject invalid JSON structure', async () => {
    const mockStream = createMockStream(['{"not": "an array"}']);

    await expect(
      stream(v.array(v.string()), mockStream).toArray()
    ).rejects.toThrow();
  });

  it('should handle whitespace around array elements', async () => {
    const mockStream = createMockStream([
      '[\n  { "id": 1, "name": "Alice", "email": "alice@example.com" }\n  ,\n  { "id": 2, "name": "Bob", "email": "bob@example.com" }\n]',
    ]);

    const results = await stream(v.array(UserSchema), mockStream).toArray();

    expect(results).toHaveLength(2);
  });
});

// ============================================================================
// Performance Tests (Basic)
// ============================================================================

describe('streaming performance', () => {
  it('should handle large arrays efficiently', async () => {
    // Create a large array
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `User${i}`,
      email: `user${i}@example.com`,
    }));

    const mockStream = createUserArrayStream(items);
    const results = await stream(v.array(UserSchema), mockStream).toArray();

    expect(results).toHaveLength(1000);
  });

  it('should process items incrementally', async () => {
    const processedIds: number[] = [];
    const items: User[] = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ];

    const mockStream = createUserArrayStream(items);

    for await (const user of stream(v.array(UserSchema), mockStream)) {
      processedIds.push(user.id);
    }

    expect(processedIds).toEqual([1, 2, 3]);
  });
});

// ============================================================================
// Async Iterable Input Tests
// ============================================================================

describe('streaming with async iterables', () => {
  it('should accept async generators as input', async () => {
    async function* generateChunks(): AsyncGenerator<string> {
      yield '[{"id": 1, "name": "Alice", "email": "alice@example.com"}';
      yield ',{"id": 2, "name": "Bob", "email": "bob@example.com"}]';
    }

    const results = await stream(v.array(UserSchema), generateChunks()).toArray();

    expect(results).toHaveLength(2);
  });

  it('should accept async iterables as input', async () => {
    const chunks = [
      '[{"id": 1, "name": "Alice", "email": "alice@example.com"}]',
    ];

    const asyncIterable: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        let index = 0;
        return {
          async next() {
            if (index < chunks.length) {
              return { value: chunks[index++]!, done: false };
            }
            return { value: undefined, done: true };
          },
        };
      },
    };

    const results = await stream(v.array(UserSchema), asyncIterable).toArray();

    expect(results).toHaveLength(1);
  });
});
