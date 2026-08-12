export interface TrackedEvent {
  name: string;
  timestamp: number;
  props: Record<string, any>;
}

export type EventSink = (events: TrackedEvent[]) => Promise<void>;

export interface EventTrackerOptions {
  /**
   * Number of events to buffer before auto-flushing. Default: 100
   */
  batchSize?: number;
  /**
   * Milliseconds between auto-flushes. Default: 5000
   */
  flushIntervalMs?: number;
  /**
   * Async sink to send batches to.
   * Default: no-op (events buffered but not sent).
   */
  sink?: EventSink;
}

export class EventTracker {
  private buffer: TrackedEvent[] = [];
  private batchSize: number;
  private flushIntervalMs: number;
  private sink: EventSink;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;
  private closed = false;

  constructor(options: EventTrackerOptions = {}) {
    this.batchSize = options.batchSize || 100;
    this.flushIntervalMs = options.flushIntervalMs || 5000;
    this.sink = options.sink || (() => Promise.resolve());

    // Start interval-based flushing
    if (this.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(() => {
          // Silently ignore errors
        });
      }, this.flushIntervalMs);

      // Unref the timer so it doesn't keep the process alive
      if (this.flushTimer.unref) {
        this.flushTimer.unref();
      }
    }
  }

  /**
   * Track an event. Auto-flushes if buffer reaches batchSize.
   */
  track(name: string, props: Record<string, any> = {}): void {
    if (this.closed) {
      throw new Error('EventTracker has been closed');
    }

    this.buffer.push({
      name,
      timestamp: Date.now(),
      props,
    });

    // Auto-flush if buffer reaches batchSize
    if (this.buffer.length >= this.batchSize) {
      this.flush().catch(() => {
        // Silently ignore errors
      });
    }
  }

  /**
   * Manually flush buffered events to the sink.
   * Retries once on failure; failed events are re-queued.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) {
      return;
    }

    this.flushing = true;

    try {
      // Take a batch from the buffer
      const batch = this.buffer.splice(0, this.batchSize);

      if (batch.length === 0) {
        this.flushing = false;
        return;
      }

      try {
        // Try to send the batch
        await this.sink(batch);
      } catch (firstError) {
        // Retry once
        try {
          await this.sink(batch);
        } catch (retryError) {
          // Both attempts failed; re-queue the events at the front of the buffer
          this.buffer.unshift(...batch);
          throw retryError;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Close the tracker and flush any remaining events.
   * No more events can be tracked after this.
   */
  async close(): Promise<void> {
    this.closed = true;

    // Stop the auto-flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    while (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Get the current buffer size.
   */
  bufferSize(): number {
    return this.buffer.length;
  }
}
