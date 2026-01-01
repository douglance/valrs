/**
 * valrs Streaming Validation Example
 *
 * Demonstrates O(1) memory validation of large JSON files using v.stream()
 *
 * Run with:
 *   npm start              # Run all demos
 *   npm run demo:array     # Stream JSON array
 *   npm run demo:ndjson    # Stream NDJSON (newline-delimited JSON)
 *   npm run demo:fetch     # Stream from HTTP response
 */

import { v } from 'valrs';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

// =============================================================================
// Schema Definitions
// =============================================================================

const UserSchema = v.object({
  id: v.number().int().positive(),
  name: v.string().min(1).max(100),
  email: v.string().email(),
  age: v.number().int().nonnegative().optional(),
  role: v.enum(['admin', 'user', 'guest']),
  createdAt: v.string().datetime(),
});

type User = v.infer<typeof UserSchema>;

const ProductSchema = v.object({
  sku: v.string().min(1),
  name: v.string().min(1),
  price: v.number().nonnegative(),
  inStock: v.boolean(),
  tags: v.array(v.string()).optional(),
});

type Product = v.infer<typeof ProductSchema>;

// =============================================================================
// Demo: Stream JSON Array
// =============================================================================

async function demoStreamArray() {
  console.log('\n=== Demo: Stream JSON Array ===\n');

  // Create a mock stream of JSON array data
  const jsonArray = JSON.stringify([
    { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', createdAt: '2024-01-15T10:30:00Z' },
    { id: 2, name: 'Bob', email: 'bob@example.com', age: 30, role: 'user', createdAt: '2024-01-16T14:20:00Z' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'guest', createdAt: '2024-01-17T09:00:00Z' },
    { id: 4, name: 'Diana', email: 'invalid-email', role: 'user', createdAt: '2024-01-18T16:45:00Z' }, // Invalid!
    { id: 5, name: 'Eve', email: 'eve@example.com', age: 25, role: 'user', createdAt: '2024-01-19T11:30:00Z' },
  ]);

  // Convert string to ReadableStream (simulating fetch response)
  const stream = new ReadableStream({
    start(controller) {
      // Simulate chunked transfer by splitting into smaller pieces
      const chunkSize = 50;
      for (let i = 0; i < jsonArray.length; i += chunkSize) {
        controller.enqueue(new TextEncoder().encode(jsonArray.slice(i, i + chunkSize)));
      }
      controller.close();
    },
  });

  console.log('Streaming and validating users (skipping invalid entries):\n');

  let validCount = 0;
  let invalidCount = 0;

  // Stream with error handling - skip invalid items
  for await (const user of v.stream(v.array(UserSchema), stream, { onError: 'skip' })) {
    validCount++;
    console.log(`  [${user.id}] ${user.name} <${user.email}> (${user.role})`);
  }

  console.log(`\nProcessed ${validCount} valid users`);

  // Now demonstrate collecting errors
  console.log('\n--- With error collection ---\n');

  const stream2 = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(jsonArray));
      controller.close();
    },
  });

  const errors: Array<{ index: number; error: unknown }> = [];

  for await (const user of v.stream(v.array(UserSchema), stream2, {
    onError: 'skip',
  })) {
    // Items are yielded as they pass validation
  }

  console.log('Streaming complete!');
}

// =============================================================================
// Demo: Stream NDJSON (Newline-Delimited JSON)
// =============================================================================

async function demoStreamNdjson() {
  console.log('\n=== Demo: Stream NDJSON ===\n');

  // NDJSON format - one JSON object per line
  const ndjsonData = `{"sku":"PROD-001","name":"Widget","price":9.99,"inStock":true,"tags":["electronics"]}
{"sku":"PROD-002","name":"Gadget","price":19.99,"inStock":false}
{"sku":"PROD-003","name":"Gizmo","price":29.99,"inStock":true,"tags":["electronics","sale"]}
{"sku":"PROD-004","name":"Invalid","price":-5,"inStock":true}
{"sku":"PROD-005","name":"Thingamajig","price":49.99,"inStock":true}`;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(ndjsonData));
      controller.close();
    },
  });

  console.log('Streaming NDJSON products:\n');

  let count = 0;
  for await (const product of v.streamLines(ProductSchema, stream, { onError: 'skip' })) {
    count++;
    const stock = product.inStock ? 'In Stock' : 'Out of Stock';
    const tags = product.tags?.join(', ') || 'none';
    console.log(`  [${product.sku}] ${product.name} - $${product.price.toFixed(2)} (${stock}) [${tags}]`);
  }

  console.log(`\nProcessed ${count} valid products`);
}

// =============================================================================
// Demo: Stream with Options
// =============================================================================

async function demoStreamOptions() {
  console.log('\n=== Demo: Stream Options ===\n');

  // Generate a larger dataset
  const users = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: ['admin', 'user', 'guest'][i % 3],
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(users)));
      controller.close();
    },
  });

  console.log('Streaming with maxItems: 5\n');

  let count = 0;
  for await (const user of v.stream(v.array(UserSchema), stream, {
    maxItems: 5, // Stop after 5 items
  })) {
    count++;
    console.log(`  [${user.id}] ${user.name}`);
  }

  console.log(`\nStopped after ${count} items (maxItems limit)`);
}

// =============================================================================
// Demo: Collect to Array
// =============================================================================

async function demoCollectToArray() {
  console.log('\n=== Demo: Collect to Array ===\n');

  const jsonArray = JSON.stringify([
    { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', createdAt: '2024-01-15T10:30:00Z' },
    { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', createdAt: '2024-01-16T14:20:00Z' },
  ]);

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(jsonArray));
      controller.close();
    },
  });

  // Collect all items to an array
  const users = await v.stream(v.array(UserSchema), stream).toArray();

  console.log(`Collected ${users.length} users:`);
  users.forEach((user) => {
    console.log(`  - ${user.name} (${user.role})`);
  });
}

// =============================================================================
// Demo: Stream from File (Node.js)
// =============================================================================

async function demoStreamFromFile() {
  console.log('\n=== Demo: Stream from File ===\n');

  // Create a temporary file with JSON data
  const fs = await import('fs/promises');
  const path = await import('path');
  const tmpFile = path.join(process.cwd(), 'tmp-users.json');

  const users = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: ['admin', 'user', 'guest'][i % 3],
    createdAt: new Date().toISOString(),
  }));

  await fs.writeFile(tmpFile, JSON.stringify(users));
  console.log(`Created temp file: ${tmpFile}\n`);

  // Stream from file using Node.js readable stream
  const fileStream = createReadStream(tmpFile);

  // Convert Node.js stream to Web ReadableStream
  const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;

  console.log('Streaming from file:\n');

  let count = 0;
  for await (const user of v.stream(v.array(UserSchema), webStream)) {
    count++;
    if (count <= 5) {
      console.log(`  [${user.id}] ${user.name} <${user.email}>`);
    } else if (count === 6) {
      console.log('  ... (truncating output)');
    }
  }

  console.log(`\nProcessed ${count} users from file`);

  // Cleanup
  await fs.unlink(tmpFile);
  console.log('Cleaned up temp file');
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const demo = process.argv[2];

  console.log('='.repeat(60));
  console.log('  valrs Streaming Validation Demo');
  console.log('='.repeat(60));

  switch (demo) {
    case 'array':
      await demoStreamArray();
      break;
    case 'ndjson':
      await demoStreamNdjson();
      break;
    case 'options':
      await demoStreamOptions();
      break;
    case 'collect':
      await demoCollectToArray();
      break;
    case 'file':
      await demoStreamFromFile();
      break;
    default:
      // Run all demos
      await demoStreamArray();
      await demoStreamNdjson();
      await demoStreamOptions();
      await demoCollectToArray();
      await demoStreamFromFile();
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Demo Complete!');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
