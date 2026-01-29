/**
 * Plugin System Type Definitions
 *
 * Re-exports all types from the plugin-sdk package
 */

// Re-export everything from plugin-sdk
export * from '@handsfree/plugin-sdk';

// Backward compatibility aliases (if needed)
export type { PluginManifest, PluginMetadata, InstalledPlugin } from '@handsfree/plugin-sdk';
