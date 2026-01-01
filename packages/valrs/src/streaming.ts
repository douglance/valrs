/**
 * Streaming validation for large JSON arrays and NDJSON data.
 *
 * Provides O(1) memory validation for arbitrarily large files by processing
 * items one at a time as they arrive from the stream.
 *
 * @example
 * ```typescript
 * import { v, stream, streamLines } from 'valrs';
 *
 * // Stream JSON array with validation
 * const response = await fetch('/users.json');
 * for await (const user of stream(v.array(User), response.body!)) {
 *   console.log(user); // Each user validated as it arrives
 * }
 *
 * // Stream NDJSON (newline-delimited JSON)
 * for await (const line of streamLines(User, ndjsonStream)) {
 *   process.send(line);
 * }
 * ```
 */

import type { ValSchema } from './schema';
import { ValArray } from './schema';
import { ValError } from './error';

// ============================================================================
// Stream Options and Result Types
// ============================================================================

/**
 * Options for streaming validation.
 */
export interface StreamOptions {
  /** Maximum number of items to process. Stops after N items. */
  readonly maxItems?: number;
  /** Maximum bytes to process. Accepts number or string like '100MB', '1GB'. */
  readonly maxBytes?: number | string;
  /** Timeout duration. Accepts number (ms) or string like '30s', '5m'. */
  readonly timeout?: number | string;
  /** Error handling strategy: 'throw' stops on first error, 'skip' continues, 'collect' gathers all errors. */
  readonly onError?: 'throw' | 'skip' | 'collect';
  /** High water mark for backpressure (default: 16 items). */
  readonly highWaterMark?: number;
}

/**
 * Result of streaming validation - an async iterable with utility methods.
 *
 * @template T - The validated item type
 */
export interface StreamResult<T> extends AsyncIterable<T> {
  /** Collects all validated items into an array. */
  toArray(): Promise<T[]>;
  /** Pipes validated items to a writable stream. */
  pipeTo(writable: WritableStream<T>): Promise<void>;
  /** Async iterator implementation. */
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

/**
 * Error information collected during streaming with 'collect' mode.
 */
export interface StreamError {
  /** The index of the item that failed validation. */
  readonly index: number;
  /** The validation error. */
  readonly error: ValError;
  /** The raw JSON value that failed validation (if available). */
  readonly rawValue?: unknown;
}

/**
 * Extended stream result with error collection.
 */
export interface StreamResultWithErrors<T> extends StreamResult<T> {
  /** Collected errors (only populated when onError: 'collect'). */
  readonly errors: StreamError[];
}

// ============================================================================
// Byte Size Parsing
// ============================================================================

/**
 * Parses a byte size string like '100MB' or '1GB' into bytes.
 */
function parseByteSize(size: number | string): number {
  if (typeof size === 'number') {
    return size;
  }

  const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) {
    throw new Error(`Invalid byte size format: ${size}`);
  }

  const value = parseFloat(match[1] ?? '0');
  const unit = (match[2] ?? 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] ?? 1);
}

/**
 * Parses a duration string like '30s' or '5m' into milliseconds.
 */
function parseDuration(duration: number | string): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/i);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseFloat(match[1] ?? '0');
  const unit = (match[2] ?? 'ms').toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
  };

  return value * (multipliers[unit] ?? 1);
}

// ============================================================================
// JSON Array Streaming Parser
// ============================================================================

/**
 * State for the JSON array parser state machine.
 */
const enum ParserState {
  /** Looking for opening bracket '['. */
  LOOKING_FOR_ARRAY_START = 0,
  /** Looking for first item or closing bracket. */
  LOOKING_FOR_ITEM_OR_END = 1,
  /** Parsing an item. */
  PARSING_ITEM = 2,
  /** Looking for comma or closing bracket. */
  LOOKING_FOR_COMMA_OR_END = 3,
  /** Array parsing complete. */
  DONE = 4,
}

/**
 * Incremental JSON array parser that yields complete items.
 *
 * Uses a state machine to detect array boundaries and item separators,
 * buffering partial JSON until complete items are detected.
 */
class JsonArrayParser {
  private state: ParserState = ParserState.LOOKING_FOR_ARRAY_START;
  private buffer: string = '';
  private depth: number = 0;
  private inString: boolean = false;
  private escapeNext: boolean = false;
  private itemStartIndex: number = 0;
  /** Where to continue parsing from (to avoid reprocessing) */
  private continuationIndex: number = 0;
  private items: string[] = [];

  /**
   * Feeds a chunk of text to the parser and returns any complete items.
   *
   * @param chunk - A chunk of JSON text
   * @returns Array of complete JSON item strings
   */
  feed(chunk: string): string[] {
    this.buffer += chunk;
    this.items = [];
    this.parse();
    return this.items;
  }

  /**
   * Returns true if the parser has finished processing the array.
   */
  isDone(): boolean {
    return this.state === ParserState.DONE;
  }

  /**
   * Returns any remaining buffer content (for error reporting).
   */
  getRemainingBuffer(): string {
    return this.buffer;
  }

  private parse(): void {
    // Start from where we left off, not from 0
    let i = this.continuationIndex;
    const len = this.buffer.length;

    while (i < len && this.state !== ParserState.DONE) {
      const char = this.buffer[i];

      switch (this.state) {
        case ParserState.LOOKING_FOR_ARRAY_START:
          if (char === '[') {
            this.state = ParserState.LOOKING_FOR_ITEM_OR_END;
          } else if (char !== undefined && !/\s/.test(char)) {
            throw new Error(`Expected '[' at position ${i}, got '${char}'`);
          }
          i++;
          break;

        case ParserState.LOOKING_FOR_ITEM_OR_END:
          if (char === ']') {
            this.state = ParserState.DONE;
            i++;
          } else if (char !== undefined && !/\s/.test(char)) {
            this.state = ParserState.PARSING_ITEM;
            this.itemStartIndex = i;
            this.depth = 0;
            this.inString = false;
            this.escapeNext = false;
            // Don't increment i, we need to process this character
          } else {
            i++;
          }
          break;

        case ParserState.PARSING_ITEM:
          i = this.parseItemCharacters(i, len);
          break;

        case ParserState.LOOKING_FOR_COMMA_OR_END:
          if (char === ',') {
            this.state = ParserState.LOOKING_FOR_ITEM_OR_END;
            i++;
          } else if (char === ']') {
            this.state = ParserState.DONE;
            i++;
          } else if (char !== undefined && !/\s/.test(char)) {
            throw new Error(`Expected ',' or ']' at position ${i}, got '${char}'`);
          } else {
            i++;
          }
          break;
      }
    }

    // Trim processed content from buffer, keeping any remaining item content
    if (this.state === ParserState.PARSING_ITEM) {
      // Keep from itemStartIndex onwards, adjust continuation index
      const offset = this.itemStartIndex;
      this.buffer = this.buffer.slice(offset);
      this.itemStartIndex = 0;
      // Continue from where we left off, adjusted for the slice
      this.continuationIndex = i - offset;
    } else if (this.state === ParserState.DONE) {
      // Parsing complete
      this.buffer = '';
      this.continuationIndex = 0;
    } else {
      // Discard processed content
      this.buffer = this.buffer.slice(i);
      this.continuationIndex = 0;
    }
  }

  private parseItemCharacters(startIndex: number, len: number): number {
    let i = startIndex;

    while (i < len) {
      const char = this.buffer[i];
      if (char === undefined) break;

      if (this.escapeNext) {
        this.escapeNext = false;
        i++;
        continue;
      }

      if (this.inString) {
        if (char === '\\') {
          this.escapeNext = true;
        } else if (char === '"') {
          this.inString = false;
        }
        i++;
        continue;
      }

      // Not in string
      if (char === '"') {
        this.inString = true;
        i++;
        continue;
      }

      if (char === '{' || char === '[') {
        this.depth++;
        i++;
        continue;
      }

      if (char === '}' || char === ']') {
        this.depth--;
        i++;
        // Check if we've closed all nested structures
        if (this.depth < 0) {
          // This is the array's closing bracket - we went too far
          // The item ended before this character
          const itemJson = this.buffer.slice(this.itemStartIndex, i - 1).trim();
          if (itemJson.length > 0) {
            this.items.push(itemJson);
          }
          this.state = ParserState.DONE;
          return i;
        }
        if (this.depth === 0) {
          // Completed a nested structure, but might have more primitive content
          continue;
        }
        continue;
      }

      if (char === ',' && this.depth === 0) {
        // End of current item
        const itemJson = this.buffer.slice(this.itemStartIndex, i).trim();
        if (itemJson.length > 0) {
          this.items.push(itemJson);
        }
        this.state = ParserState.LOOKING_FOR_ITEM_OR_END;
        return i + 1;
      }

      i++;
    }

    return i;
  }
}

// ============================================================================
// Stream Conversion Utilities
// ============================================================================

/**
 * Input stream types supported by the streaming API.
 */
export type StreamInput =
  | ReadableStream<Uint8Array>
  | ReadableStream<string>
  | AsyncIterable<Uint8Array>
  | AsyncIterable<string>;

/**
 * Converts various stream types to an async iterable of strings.
 */
async function* streamToAsyncIterable(input: StreamInput): AsyncGenerator<string> {
  const decoder = new TextDecoder();

  // Handle ReadableStream
  if ('getReader' in input) {
    const reader = input.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (typeof value === 'string') {
          yield value;
        } else {
          yield decoder.decode(value, { stream: true });
        }
      }
      // Flush any remaining bytes
      const remaining = decoder.decode();
      if (remaining) {
        yield remaining;
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  // Handle AsyncIterable (Node.js Readable streams, generators, etc.)
  for await (const chunk of input) {
    if (typeof chunk === 'string') {
      yield chunk;
    } else {
      yield decoder.decode(chunk, { stream: true });
    }
  }

  // Flush any remaining bytes
  const remaining = decoder.decode();
  if (remaining) {
    yield remaining;
  }
}

// ============================================================================
// Main Streaming Functions
// ============================================================================

/**
 * Streams a JSON array and validates each item with the provided schema.
 *
 * Processes items with O(1) memory regardless of array size. Items are
 * validated and yielded as they arrive from the stream.
 *
 * @template T - The validated item type
 * @param schema - Array schema with element schema for validation
 * @param input - Input stream (Web ReadableStream, Node.js stream, or async iterable)
 * @param options - Streaming options for limits and error handling
 * @returns Async iterable of validated items
 *
 * @example
 * ```typescript
 * // Stream from fetch response
 * const response = await fetch('/users.json');
 * for await (const user of stream(v.array(User), response.body!)) {
 *   console.log(user);
 * }
 *
 * // Stream with options
 * for await (const user of stream(v.array(User), stream, {
 *   maxItems: 10000,
 *   maxBytes: '100MB',
 *   onError: 'skip',
 * })) {
 *   process.send(user);
 * }
 *
 * // Collect to array
 * const users = await stream(v.array(User), response.body!).toArray();
 * ```
 */
export function stream<T>(
  schema: ValArray<ValSchema<unknown, T>>,
  input: StreamInput,
  options: StreamOptions = {}
): StreamResultWithErrors<T> {
  const elementSchema = schema.element;
  const maxItems = options.maxItems ?? Infinity;
  const maxBytes = options.maxBytes !== undefined ? parseByteSize(options.maxBytes) : Infinity;
  const timeout = options.timeout !== undefined ? parseDuration(options.timeout) : Infinity;
  const onError = options.onError ?? 'throw';
  const errors: StreamError[] = [];

  let itemCount = 0;
  let byteCount = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  async function* generateItems(): AsyncGenerator<T> {
    const parser = new JsonArrayParser();
    const startTime = Date.now();

    // Set up timeout if specified
    if (timeout !== Infinity) {
      timeoutId = setTimeout(() => {
        timedOut = true;
      }, timeout);
    }

    try {
      for await (const chunk of streamToAsyncIterable(input)) {
        // Check timeout
        if (timedOut) {
          throw new Error(`Stream processing timed out after ${Date.now() - startTime}ms`);
        }

        // Track bytes
        byteCount += new TextEncoder().encode(chunk).length;
        if (byteCount > maxBytes) {
          throw new Error(`Stream exceeded maximum byte limit of ${maxBytes} bytes`);
        }

        // Feed chunk to parser
        const items = parser.feed(chunk);

        // Validate and yield each complete item
        for (const itemJson of items) {
          if (itemCount >= maxItems) {
            return;
          }

          try {
            const parsed = JSON.parse(itemJson) as unknown;
            const result = elementSchema['~standard'].validate(parsed);

            if (result.issues !== undefined) {
              const error = new ValError(result.issues);
              if (onError === 'throw') {
                throw error;
              } else if (onError === 'collect') {
                errors.push({ index: itemCount, error, rawValue: parsed });
              }
              // 'skip' - just don't yield
            } else {
              yield result.value as T;
            }
          } catch (err) {
            if (err instanceof SyntaxError) {
              const valError = new ValError([
                { message: `Invalid JSON at index ${itemCount}: ${err.message}` },
              ]);
              if (onError === 'throw') {
                throw valError;
              } else if (onError === 'collect') {
                errors.push({ index: itemCount, error: valError });
              }
            } else {
              throw err;
            }
          }

          itemCount++;
        }

        // Check if parser is done
        if (parser.isDone()) {
          break;
        }
      }

      // Check for incomplete parsing
      const remaining = parser.getRemainingBuffer().trim();
      if (!parser.isDone() && remaining.length > 0) {
        throw new Error(`Incomplete JSON array. Remaining buffer: "${remaining.slice(0, 100)}..."`);
      }
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  const iterator = generateItems();

  const result: StreamResultWithErrors<T> = {
    errors,

    async toArray(): Promise<T[]> {
      const items: T[] = [];
      for await (const item of this) {
        items.push(item);
      }
      return items;
    },

    async pipeTo(writable: WritableStream<T>): Promise<void> {
      const writer = writable.getWriter();
      try {
        for await (const item of this) {
          await writer.write(item);
        }
        await writer.close();
      } catch (err) {
        await writer.abort(err);
        throw err;
      }
    },

    [Symbol.asyncIterator](): AsyncIterator<T> {
      return iterator;
    },
  };

  return result;
}

/**
 * Streams NDJSON (newline-delimited JSON) and validates each line.
 *
 * Each line is parsed as a separate JSON value and validated against
 * the provided schema.
 *
 * @template T - The validated item type
 * @param schema - Schema for validating each line
 * @param input - Input stream
 * @param options - Streaming options
 * @returns Async iterable of validated items
 *
 * @example
 * ```typescript
 * for await (const event of streamLines(EventSchema, logStream)) {
 *   processEvent(event);
 * }
 * ```
 */
export function streamLines<T>(
  schema: ValSchema<unknown, T>,
  input: StreamInput,
  options: StreamOptions = {}
): StreamResultWithErrors<T> {
  const maxItems = options.maxItems ?? Infinity;
  const maxBytes = options.maxBytes !== undefined ? parseByteSize(options.maxBytes) : Infinity;
  const timeout = options.timeout !== undefined ? parseDuration(options.timeout) : Infinity;
  const onError = options.onError ?? 'throw';
  const errors: StreamError[] = [];

  let itemCount = 0;
  let byteCount = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  async function* generateItems(): AsyncGenerator<T> {
    let buffer = '';
    const startTime = Date.now();

    // Set up timeout if specified
    if (timeout !== Infinity) {
      timeoutId = setTimeout(() => {
        timedOut = true;
      }, timeout);
    }

    try {
      for await (const chunk of streamToAsyncIterable(input)) {
        // Check timeout
        if (timedOut) {
          throw new Error(`Stream processing timed out after ${Date.now() - startTime}ms`);
        }

        // Track bytes
        byteCount += new TextEncoder().encode(chunk).length;
        if (byteCount > maxBytes) {
          throw new Error(`Stream exceeded maximum byte limit of ${maxBytes} bytes`);
        }

        buffer += chunk;

        // Process complete lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          if (itemCount >= maxItems) {
            return;
          }

          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          // Skip empty lines
          if (line.length === 0) {
            continue;
          }

          try {
            const parsed = JSON.parse(line) as unknown;
            const result = schema['~standard'].validate(parsed);

            if (result.issues !== undefined) {
              const error = new ValError(result.issues);
              if (onError === 'throw') {
                throw error;
              } else if (onError === 'collect') {
                errors.push({ index: itemCount, error, rawValue: parsed });
              }
              // 'skip' - just don't yield
            } else {
              yield result.value as T;
            }
          } catch (err) {
            if (err instanceof SyntaxError) {
              const valError = new ValError([
                { message: `Invalid JSON at line ${itemCount}: ${err.message}` },
              ]);
              if (onError === 'throw') {
                throw valError;
              } else if (onError === 'collect') {
                errors.push({ index: itemCount, error: valError });
              }
            } else {
              throw err;
            }
          }

          itemCount++;
        }
      }

      // Process any remaining content
      const remaining = buffer.trim();
      if (remaining.length > 0 && itemCount < maxItems) {
        try {
          const parsed = JSON.parse(remaining) as unknown;
          const result = schema['~standard'].validate(parsed);

          if (result.issues !== undefined) {
            const error = new ValError(result.issues);
            if (onError === 'throw') {
              throw error;
            } else if (onError === 'collect') {
              errors.push({ index: itemCount, error, rawValue: parsed });
            }
          } else {
            yield result.value as T;
          }
        } catch (err) {
          if (err instanceof SyntaxError) {
            const valError = new ValError([
              { message: `Invalid JSON at line ${itemCount}: ${err.message}` },
            ]);
            if (onError === 'throw') {
              throw valError;
            } else if (onError === 'collect') {
              errors.push({ index: itemCount, error: valError });
            }
          } else {
            throw err;
          }
        }
      }
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  const iterator = generateItems();

  const result: StreamResultWithErrors<T> = {
    errors,

    async toArray(): Promise<T[]> {
      const items: T[] = [];
      for await (const item of this) {
        items.push(item);
      }
      return items;
    },

    async pipeTo(writable: WritableStream<T>): Promise<void> {
      const writer = writable.getWriter();
      try {
        for await (const item of this) {
          await writer.write(item);
        }
        await writer.close();
      } catch (err) {
        await writer.abort(err);
        throw err;
      }
    },

    [Symbol.asyncIterator](): AsyncIterator<T> {
      return iterator;
    },
  };

  return result;
}

// ============================================================================
// Convenience Helpers
// ============================================================================

/**
 * Creates a mock readable stream from an array of chunks.
 *
 * Useful for testing streaming functionality.
 *
 * @param chunks - Array of string chunks
 * @returns A ReadableStream that yields the chunks
 *
 * @example
 * ```typescript
 * const mockStream = createMockStream([
 *   '[{"id": 1},',
 *   '{"id": 2}]',
 * ]);
 *
 * for await (const item of stream(v.array(schema), mockStream)) {
 *   console.log(item);
 * }
 * ```
 */
export function createMockStream(chunks: readonly string[]): ReadableStream<string> {
  let index = 0;
  return new ReadableStream<string>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]!);
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Creates a mock readable stream from a complete JSON string, split into chunks.
 *
 * @param json - Complete JSON string
 * @param chunkSize - Size of each chunk in characters (default: 64)
 * @returns A ReadableStream that yields the chunks
 */
export function createChunkedStream(json: string, chunkSize: number = 64): ReadableStream<string> {
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += chunkSize) {
    chunks.push(json.slice(i, i + chunkSize));
  }
  return createMockStream(chunks);
}
