# @handsfree/plugin-sdk

Official SDK for developing HandsFree POS plugins.

## Installation

```bash
npm install @handsfree/plugin-sdk
# or
bun add @handsfree/plugin-sdk
```

## Quick Start

### Client Plugin

```typescript
import { definePlugin } from '@handsfree/plugin-sdk';

export default definePlugin({
  async init(context, host) {
    console.log(`Plugin ${context.pluginId} initialized!`);

    // Register a new route
    host.ui.registerRoute('/my-feature', MyFeatureComponent);

    // Subscribe to events
    host.events.on('order.completed', (order) => {
      console.log('Order completed:', order);
    });
  },

  async destroy() {
    console.log('Plugin cleanup');
  }
});
```

### Worker Plugin

```typescript
import { defineWorkerPlugin } from '@handsfree/plugin-sdk';

export default defineWorkerPlugin({
  async init(context) {
    console.log(`Worker plugin ${context.pluginId} initialized`);
  },

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('OK');
    }

    return new Response('Not Found', { status: 404 });
  }
});
```

### Plugin Manifest

```typescript
import { defineManifest } from '@handsfree/plugin-sdk';

export const manifest = defineManifest({
  id: 'my-plugin',
  name: 'My Awesome Plugin',
  version: '1.0.0',
  description: 'Does something cool',
  author: 'Your Name',
  type: 'hybrid',
  visibility: 'public',
  target: {
    client: true,
    worker: true
  },
  requires_app_version: '>=3.0.0',
  requires_permissions: [
    'ui.mount.dashboard',
    'database.read.orders'
  ],
  frontend: {
    wasm: 'my-plugin-client.wasm',
    entry_point: 'init'
  },
  backend: {
    wasm: 'my-plugin-worker.wasm',
    entry_point: 'handle_request'
  },
  checksum: 'sha256:...',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
```

## API Reference

### `definePlugin(plugin: ClientPlugin)`

Define a client-side plugin with type safety.

### `defineWorkerPlugin(plugin: WorkerPlugin)`

Define a worker-side plugin with type safety.

### `defineManifest(manifest: PluginManifest)`

Define and validate a plugin manifest.

### Helper Functions

#### `createApiPath(pluginId, endpoint, version?)`

Create a versioned API endpoint path.

```typescript
import { createApiPath } from '@handsfree/plugin-sdk';

const path = createApiPath('my-plugin', '/data', 'v1');
// Result: "/api/plugin/my-plugin/v1/data"
```

#### `satisfiesVersion(version, range)`

Check if a version satisfies a semver range.

```typescript
import { satisfiesVersion } from '@handsfree/plugin-sdk';

satisfiesVersion('3.1.0', '>=3.0.0'); // true
satisfiesVersion('2.9.0', '>=3.0.0'); // false
```

#### `createLogger(pluginId)`

Create a scoped logger for your plugin.

```typescript
import { createLogger } from '@handsfree/plugin-sdk';

const logger = createLogger('my-plugin');
logger.info('Plugin started'); // [Plugin:my-plugin] Plugin started
```

#### `retry(fn, options?)`

Retry a function with exponential backoff.

```typescript
import { retry } from '@handsfree/plugin-sdk';

const data = await retry(
  () => fetch('/api/data'),
  { maxAttempts: 3, initialDelay: 1000 }
);
```

## Validation

### `validateManifest(manifest)`

Validate a plugin manifest. Throws `ValidationError` if invalid.

```typescript
import { validateManifest, ValidationError } from '@handsfree/plugin-sdk';

try {
  validateManifest(myManifest);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Invalid field: ${error.field}`);
  }
}
```

### `validatePermission(permission)`

Validate a single permission string.

## Types

All TypeScript types are exported from `@handsfree/plugin-sdk/types`:

```typescript
import type {
  PluginManifest,
  PluginContext,
  PluginHostAPI,
  ClientPlugin,
  WorkerPlugin
} from '@handsfree/plugin-sdk/types';
```

## License

MIT

## Support

- Documentation: https://docs.handsfree.com/plugins
- Issues: https://github.com/handsfree/restaurant-pos-ai/issues
- Discord: https://discord.gg/handsfree
