export class EventTracker {
  private events: Array<{ name: string; timestamp: number; data: any }> = [];
  
  track(name: string, data?: Record<string, any>): void {
    this.events.push({ name, timestamp: Date.now(), data: data || {} });
  }
  
  batch(limit = 100): any[] {
    return this.events.splice(0, limit);
  }
}
