/**
 * Plugin definition helpers
 */

import type { ClientPlugin, WorkerPlugin, PluginManifest } from './types';

/**
 * Define a client plugin
 * This is a helper to ensure type safety
 *
 * @example
 * ```typescript
 * export default definePlugin({
 *   async init(context, host) {
 *     // Initialize your plugin
 *     host.ui.registerRoute('/my-feature', MyComponent);
 *   }
 * });
 * ```
 */
export function definePlugin(plugin: ClientPlugin): ClientPlugin {
  return plugin;
}

/**
 * Define a worker plugin
 *
 * @example
 * ```typescript
 * export default defineWorkerPlugin({
 *   async init(context) {
 *     console.log('Worker plugin initialized');
 *   },
 *   async fetch(request) {
 *     return new Response('Hello from plugin!');
 *   }
 * });
 * ```
 */
export function defineWorkerPlugin(plugin: WorkerPlugin): WorkerPlugin {
  return plugin;
}

/**
 * Define a plugin manifest
 * Helper with validation
 *
 * @example
 * ```typescript
 * export const manifest = defineManifest({
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *   description: 'A cool plugin',
 *   author: 'Me',
 *   type: 'client',
 *   visibility: 'public',
 *   target: { client: true, worker: false },
 *   requires_app_version: '>=3.0.0',
 *   requires_permissions: ['ui.mount.dashboard'],
 *   frontend: {
 *     wasm: 'my-plugin.wasm',
 *     entry_point: 'init'
 *   }
 * });
 * ```
 */
export function defineManifest(manifest: PluginManifest): PluginManifest {
  // Validate manifest
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error('Plugin manifest must have id, name, and version');
  }

  if (!manifest.type) {
    throw new Error('Plugin manifest must specify type');
  }

  if (!manifest.target || (!manifest.target.client && !manifest.target.worker)) {
    throw new Error('Plugin must target either client or worker (or both)');
  }

  return manifest;
}
