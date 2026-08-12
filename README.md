# Event Tracker

Track user/system events for analytics. Monitor Ferrow agent activity.

```javascript
const tracker = new EventTracker();
tracker.track('agent_run', { agentId: 'xyz', duration: 234 });
```

## Features
- ✓ Event batching
- ✓ Custom dimensions
- ✓ Warehouse export
- ✓ Ferrow analytics

## License: MIT
