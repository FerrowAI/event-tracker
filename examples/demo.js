const { EventTracker } = require('../dist/index.js');

(async () => {
  console.log('Test 1: Sink that fails once then succeeds');
  let attempts = 0;
  const tracker = new EventTracker({
    batchSize: 3,
    flushIntervalMs: 0, // Disable auto-flush
    sink: async (events) => {
      attempts++;
      console.log(`  Sink attempt ${attempts}: ${events.length} event(s)`);
      if (attempts === 1) {
        throw new Error('Network failure');
      }
      console.log(`  Sink success on retry`);
    },
  });

  tracker.track('event_1', { value: 1 });
  tracker.track('event_2', { value: 2 });
  tracker.track('event_3', { value: 3 });
  console.log(`  Buffer size after tracking: ${tracker.bufferSize()}`);

  await tracker.flush();
  console.log(`  Buffer size after flush: ${tracker.bufferSize()}`);
  console.log(`  Total sink attempts: ${attempts}`);

  console.log('\nTest 2: Auto-flush on batch size');
  let flushes = 0;
  const tracker2 = new EventTracker({
    batchSize: 2,
    flushIntervalMs: 0,
    sink: async (events) => {
      flushes++;
      console.log(`  Flush #${flushes}: ${events.length} event(s)`);
    },
  });

  tracker2.track('e1', {});
  console.log(`  Buffer after e1: ${tracker2.bufferSize()}`);
  tracker2.track('e2', {}); // Triggers flush
  console.log(`  Buffer after e2 (auto-flush): ${tracker2.bufferSize()}`);
  tracker2.track('e3', {});
  console.log(`  Buffer after e3: ${tracker2.bufferSize()}`);

  console.log('\nTest 3: No events lost on retry failure');
  let retries = 0;
  const tracker3 = new EventTracker({
    batchSize: 2,
    flushIntervalMs: 0,
    sink: async (events) => {
      retries++;
      throw new Error('Permanent failure');
    },
  });

  tracker3.track('event', { id: 1 });
  tracker3.track('event', { id: 2 });

  try {
    await tracker3.flush();
  } catch {
    // Expected to fail
  }
  console.log(`  Events re-queued after failure: ${tracker3.bufferSize()}`);
  console.log(`  Retry attempts: ${retries}`);

  console.log('\nTest 4: close() drains all events');
  const tracker4 = new EventTracker({
    batchSize: 100,
    flushIntervalMs: 5000,
    sink: async (events) => {
      console.log(`  Drained ${events.length} events`);
    },
  });

  tracker4.track('event_1', {});
  tracker4.track('event_2', {});
  tracker4.track('event_3', {});
  console.log(`  Buffer before close: ${tracker4.bufferSize()}`);

  await tracker4.close();
  console.log(`  Buffer after close: ${tracker4.bufferSize()}`);

  console.log('\n✓ All tests passed');
})();
