# event-tracker

Event buffer with batched flush to a pluggable async sink. Triggers on batch size or flush interval (unref'd timer). Retries failed flushes once; failed events are re-queued. Manual flush and graceful close (drain).

## Installation

```bash
npm install event-tracker
```

## Quick Start

```javascript
import { EventTracker } from 'event-tracker';

const tracker = new EventTracker({
  batchSize: 50,
  flushIntervalMs: 3000,
  sink: async (events) => {
    await sendToAnalytics(events);
  },
});

tracker.track('user_login', { userId: 123, timestamp: Date.now() });
tracker.track('feature_used', { featureName: 'export', duration: 120 });

// Flush manually
await tracker.flush();

// Close and drain remaining events
await tracker.close();
```

## API

### `new EventTracker(options?): EventTracker`

Create an event tracker.

**Options:**
- `batchSize` (number, default: 100): Trigger flush when buffer reaches this size
- `flushIntervalMs` (number, default: 5000): Interval for periodic auto-flush (in milliseconds)
- `sink` (EventSink, default: no-op): Async function to send event batches

### `tracker.track(name, props?): void`

Add an event to the buffer. Auto-flushes if buffer reaches `batchSize`.

```javascript
tracker.track('button_clicked', { buttonId: 'submit', x: 100, y: 200 });
tracker.track('api_call', { endpoint: '/users', statusCode: 200, ms: 45 });
```

Each event is timestamped at track time.

### `tracker.flush(): Promise<void>`

Manually flush the buffer to the sink. Re-queues events if both attempts fail.

```javascript
await tracker.flush(); // Send accumulated events
```

### `tracker.close(): Promise<void>`

Close the tracker and drain all remaining events. No more events can be tracked.

```javascript
await tracker.close(); // Flushes remaining events and stops auto-flush timer
```

### `tracker.bufferSize(): number`

Get current buffer size (number of events waiting to be flushed).

```javascript
console.log(tracker.bufferSize()); // e.g., 42
```

## Event Format

Each tracked event has:

```typescript
{
  name: string;        // Event name
  timestamp: number;   // Unix milliseconds when tracked
  props: Record<string, any>; // Custom properties
}
```

## Sink Behavior

The sink receives an array of up to `batchSize` events. If the sink throws:

1. One automatic retry is attempted
2. If both fail, events are re-queued at the front of the buffer
3. Errors are silently ignored during auto-flush (only manual `flush()` propagates errors)

```javascript
const sink = async (events) => {
  console.log(`Sending ${events.length} events`);
  const response = await fetch('https://api.example.com/events', {
    method: 'POST',
    body: JSON.stringify(events),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
};

const tracker = new EventTracker({ sink });
```

## Auto-Flush Timer

The auto-flush timer is `unref()`'d so it doesn't keep the Node process alive. Close the tracker or the process will exit even if events are pending.

```javascript
const tracker = new EventTracker({ flushIntervalMs: 2000 });
tracker.track('event_1');
// Process can exit here if no other timers are active
// Pending events will not be flushed unless close() is called
```

## Examples

### Batch on size or interval

```javascript
const tracker = new EventTracker({
  batchSize: 50,
  flushIntervalMs: 10000,
  sink: async (events) => {
    console.log(`Flushing ${events.length} events`);
  },
});

// Fills buffer; flushes when either:
for (let i = 0; i < 150; i++) {
  tracker.track(`event_${i}`, { index: i });
  // Flush 1: at event 50 (size reached)
  // Flush 2: at event 100 (size reached)
  // Remaining: event 150 flushes on interval or close()
}
```

### Sink with retry

```javascript
let attemptCount = 0;
const tracker = new EventTracker({
  batchSize: 10,
  sink: async (events) => {
    attemptCount++;
    console.log(`Attempt ${attemptCount}: sending ${events.length} events`);
    if (attemptCount === 1) {
      throw new Error('Network error'); // Triggers retry
    }
    console.log('Success!');
  },
});

tracker.track('test', {});
await tracker.flush();
// Output:
// Attempt 1: sending 1 events
// Attempt 2: sending 1 events
// Success!
```

### Graceful shutdown

```javascript
const tracker = new EventTracker({
  batchSize: 100,
  flushIntervalMs: 5000,
  sink: async (events) => {
    await saveToDatabase(events);
  },
});

// ... track events ...

process.on('SIGTERM', async () => {
  console.log('Shutting down, flushing events...');
  await tracker.close(); // Drains all remaining events
  process.exit(0);
});
```

## Limits

- No event deduplication or ordering guarantees across retries.
- Sink failures are logged nowhere; implement logging in the sink if needed.
- Buffer size is limited by memory; very high `batchSize` or long `flushIntervalMs` can cause OOM.
- Timer auto-flush uses `unref()` and will not prevent process exit; call `close()` for graceful shutdown.
- No support for priority or event filtering; implement in the sink.

## License: MIT

Sponsored by [Ferrow](https://ferrow.ai)

---
Part of the [ferrow-toolkit](https://github.com/Ruzylo-cloud/ferrow-toolkit) collection · Sponsored by [Ferrow](https://ferrow.ai)
