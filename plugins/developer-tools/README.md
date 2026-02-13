# Developer Tools Plugin 🔧

Debug utilities, telemetry collection, and diagnostic tools for development and troubleshooting.

## Overview

This plugin provides comprehensive debugging and diagnostic capabilities without bloating the core application. It includes:

- **Debug Utilities**: KDS debugging, KOT diagnostics, activation code viewer
- **Mock Data**: Generate test orders for Swiggy/Zomato
- **Telemetry**: Error tracking, performance monitoring, usage analytics
- **Diagnostics Page**: Visual dashboard for all collected data

## Installation

This plugin is **optional** and designed for:
- Development and testing
- Troubleshooting production issues
- Collecting usage data for improvements

Enable via: **Settings → Plugins → Developer Tools**

## Features

### Console Utilities

When enabled, the following utilities are available in the browser console:

```javascript
// KDS Debugging
window.kdsDebug.getOrders()      // View all KDS orders
window.kdsDebug.getStats()        // Get kitchen statistics
window.kdsDebug.simulateOrder()   // Create test order
window.kdsDebug.clearOrders()     // Clear all orders

// KOT Diagnostics
window.kotDiag()                  // Run diagnostic check
window.kotDiag.checkStatus()      // Check KOT status
window.kotDiag.testPrint()        // Test printer
window.kotDiag.viewQueue()        // View print queue

// Mock Orders
window.mockOrders.addSwiggy()     // Add Swiggy test order
window.mockOrders.addZomato()     // Add Zomato test order
window.mockOrders.addBoth()       // Add both
window.mockOrders.clearAll()      // Clear mock orders

// Activation
window.getActivationCode()        // View activation code

// Telemetry
window.telemetry.getEvents()      // Get all events
window.telemetry.getErrorSummary() // Get error summary
window.telemetry.exportEvents()    // Export to JSON
```

### Telemetry Collection

Automatically captures:
- **Errors**: JavaScript errors, unhandled rejections, API failures
- **Performance**: Page load times, component render times, long tasks
- **User Actions**: Button clicks, navigation, form submissions
- **API Calls**: Endpoint, duration, status, errors

All data is stored **locally** in browser storage - nothing is sent to external servers.

### Diagnostics Page

Access via: **Hub → Dev Tools** or `/diagnostics`

Features:
- Error summary with occurrence counts
- Performance metrics with average durations
- Recent events timeline
- Export to JSON for analysis
- Clear all data

## Settings

Configure the plugin via **Settings → Plugins → Developer Tools**:

- **Enable Console Debug Logs**: Show debug messages in console (default: on)
- **Enable Telemetry Collection**: Capture errors and metrics (default: on)
- **Enable Mock Order Generation**: Allow test order creation (default: on)
- **Enable Performance Monitoring**: Track render times and latency (default: off)

## Data Privacy

- All data is stored **locally** in browser localStorage
- No data is transmitted to external servers
- Data retention: 30 days (configurable)
- Export and clear data anytime

## Use Cases

### 1. Development
- Test KDS/KOT workflows with mock orders
- Debug state management issues
- Profile performance bottlenecks

### 2. Troubleshooting
- Review error logs from customer issues
- Export telemetry for bug reports
- Verify API call patterns

### 3. Performance Optimization
- Identify slow components
- Track page load times
- Monitor long tasks

### 4. User Support
- Collect diagnostic data from users
- Reproduce reported issues
- Verify fix effectiveness

## Architecture

```
plugins/developer-tools/
├── manifest.json           # Plugin configuration
├── src/
│   ├── index.ts           # Main entry point
│   ├── components/
│   │   └── DiagnosticsPage.tsx  # UI dashboard
│   ├── telemetry/
│   │   └── collector.ts   # Telemetry collector
│   └── utils/
│       ├── kdsDebugUtils.ts
│       ├── kotDiagnostic.ts
│       ├── getActivationCode.ts
│       └── mockOrders.ts
└── README.md
```

## Development

### Adding New Utilities

1. Create utility file in `src/utils/`
2. Export from `src/index.ts`
3. Add to `manifest.json` window_globals
4. Document in README

### Custom Telemetry Events

```javascript
// Record custom event
window.telemetry.recordUserAction('button_click', {
  button: 'checkout',
  context: 'pos'
});

// Record API call
window.telemetry.recordApiCall(
  '/api/orders',
  1200,  // duration ms
  200,   // status
  null   // error
);
```

## Future Enhancements

- [ ] Network request logging
- [ ] WebSocket message inspector
- [ ] Redux DevTools integration
- [ ] Memory profiler
- [ ] Screenshot on error
- [ ] Session replay
- [ ] Remote telemetry (opt-in)

## Support

For issues or feature requests, visit:
- GitHub: [restaurant-pos-ai/issues](https://github.com/restaurant-pos-ai/issues)
- Tag: `plugin:developer-tools`

## License

Part of the Guanix Restaurant POS system.
