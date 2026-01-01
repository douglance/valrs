# valrs Streaming Validation Example

This example demonstrates valrs' unique streaming validation feature, which allows you to validate arbitrarily large JSON files with **O(1) memory** usage.

## Why Streaming?

Traditional validation libraries load the entire JSON into memory before validating. For a 1GB JSON file, you need at least 1GB of RAM just to parse it.

With valrs streaming:
- Parse and validate incrementally as data arrives
- Constant memory usage regardless of file size
- Process data as it streams (no waiting for full download)
- Handle errors per-item without stopping the entire stream

## Quick Start

```bash
# Install dependencies
npm install

# Run all demos
npm start

# Run specific demos
npm run demo:array    # Stream JSON array
npm run demo:ndjson   # Stream NDJSON
```

## API Overview

### Stream JSON Array

```typescript
import { v } from 'valrs';

const UserSchema = v.object({
  id: v.number(),
  name: v.string(),
  email: v.string().email(),
});

// Stream from fetch response
const response = await fetch('https://api.example.com/users.json');
for await (const user of v.stream(v.array(UserSchema), response.body)) {
  console.log(user); // Each user validated as it arrives
}
```

### Stream NDJSON (Newline-Delimited JSON)

```typescript
// Each line is a separate JSON object
for await (const item of v.streamLines(ItemSchema, stream)) {
  process.stdout.write(`Processed: ${item.id}\n`);
}
```

### Stream Options

```typescript
for await (const user of v.stream(v.array(UserSchema), stream, {
  maxItems: 10000,     // Stop after N items
  maxBytes: '100MB',   // Memory limit
  timeout: '30s',      // Time limit
  onError: 'skip',     // 'throw' | 'skip' | 'collect'
})) {
  // Process user
}
```

### Collect to Array

```typescript
// If you do need all items in memory
const users = await v.stream(v.array(UserSchema), stream).toArray();
```

### Error Handling

```typescript
// Default: throw on first error
try {
  for await (const user of v.stream(v.array(UserSchema), stream)) {
    // ...
  }
} catch (error) {
  console.error('Validation failed:', error);
}

// Skip invalid items
for await (const user of v.stream(v.array(UserSchema), stream, {
  onError: 'skip',
})) {
  // Only valid users yielded
}

// Collect errors for later
const errors: ValError[] = [];
for await (const user of v.stream(v.array(UserSchema), stream, {
  onError: 'collect',
})) {
  // Valid users yielded, errors collected
}
// Access errors after streaming
```

## Real-World Use Cases

### 1. Processing Large API Responses

```typescript
const response = await fetch('https://api.example.com/export/all-users');

for await (const user of v.stream(v.array(UserSchema), response.body)) {
  await database.upsert('users', user);
}
```

### 2. Log File Processing

```typescript
import { createReadStream } from 'fs';
import { Readable } from 'stream';

const fileStream = createReadStream('logs.ndjson');
const webStream = Readable.toWeb(fileStream);

for await (const entry of v.streamLines(LogEntrySchema, webStream)) {
  if (entry.level === 'error') {
    await alerting.notify(entry);
  }
}
```

### 3. ETL Pipelines

```typescript
// Transform as you stream
const transform = new TransformStream<User, NormalizedUser>({
  transform(user, controller) {
    controller.enqueue({
      ...user,
      email: user.email.toLowerCase(),
      createdAt: new Date(user.createdAt),
    });
  },
});

const validated = v.stream(v.array(UserSchema), inputStream);
await validated.pipeTo(transform.writable);
```

## Performance

Streaming validation is ideal when:
- File size > available memory
- You want to start processing before download completes
- You need to handle partial failures gracefully
- Processing time per item is significant

For small files that fit in memory, regular `parse()` is simpler and has less overhead.
