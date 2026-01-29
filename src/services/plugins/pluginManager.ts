/**
 * Client-Side Plugin Manager
 *
 * Manages WASM plugins in the POS application (Tauri/Browser)
 * Handles loading, caching, and lifecycle management using SQLite
 */

import type {
  PluginManifest,
  PluginMetadata,
  InstalledPlugin,
  PluginContext,
  IPluginManager,
  PluginLoadingState,
} from '@/types/plugin';
import { resolvePluginClient } from './pluginResolver';
import { createPluginHostAPI } from '@/lib/pluginHost';
import Database from '@tauri-apps/plugin-sql';

/**
 * Loaded plugin instance
 */
interface LoadedPluginInstance {
  manifest: PluginManifest;
  instance: WebAssembly.Instance;
  context: PluginContext;
  enabled: boolean;
}

/**
 * Client-side plugin manager
 * Runs in the Tauri app, manages browser-side WASM plugins
 * Uses SQLite for caching
 */
export class PluginManager implements IPluginManager {
  private db: Database | null = null;
  private loadedPlugins = new Map<string, LoadedPluginInstance>();
  private loadingStates = new Map<string, PluginLoadingState>();
  private tenantId: string;
  private registryUrl: string;

  constructor(tenantId: string, registryUrl?: string) {
    this.tenantId = tenantId;
    this.registryUrl = registryUrl || import.meta.env.VITE_PLUGIN_REGISTRY_URL ||
      'https://handsfree-tenant-router.workers.dev/plugins';
  }

  /**
   * Initialize the plugin manager
   * Creates plugin cache tables in SQLite if they don't exist
   */
  async initialize(): Promise<void> {
    // Open SQLite database (same as main app DB)
    this.db = await Database.load('sqlite:handsfree.db');

    // Create plugin cache tables
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS plugin_cache (
        plugin_id TEXT PRIMARY KEY,
        manifest TEXT NOT NULL,
        wasm_bytes BLOB NOT NULL,
        installed_at TEXT NOT NULL,
        last_used TEXT NOT NULL,
        cache_size INTEGER NOT NULL
      )
    `);

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS plugin_metadata (
        plugin_id TEXT PRIMARY KEY,
        manifest TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        cached INTEGER NOT NULL DEFAULT 1,
        cache_size INTEGER,
        last_used TEXT
      )
    `);

    console.log('Plugin manager initialized with SQLite backend');
  }

  /**
   * List all available plugins from registry
   */
  async listAvailable(): Promise<PluginMetadata[]> {
    const response = await fetch(`${this.registryUrl}/list`);

    if (!response.ok) {
      throw new Error(`Failed to fetch plugin list: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * List installed plugins
   */
  async listInstalled(): Promise<InstalledPlugin[]> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    const rows = await this.db.select<Array<{
      plugin_id: string;
      manifest: string;
      installed_at: string;
      enabled: number;
      cached: number;
      cache_size: number | null;
      last_used: string | null;
    }>>('SELECT * FROM plugin_metadata');

    return rows.map(row => ({
      manifest: JSON.parse(row.manifest),
      installed_at: row.installed_at,
      enabled: row.enabled === 1,
      cached: row.cached === 1,
      cache_size: row.cache_size || undefined,
      last_used: row.last_used || undefined,
    }));
  }

  /**
   * Search plugins by query and tags
   */
  async searchPlugins(query: string, tags?: string[]): Promise<PluginMetadata[]> {
    const params = new URLSearchParams({ query });
    if (tags) {
      params.append('tags', tags.join(','));
    }

    const response = await fetch(`${this.registryUrl}/search?${params}`);
    return await response.json();
  }

  /**
   * Install a plugin
   * Downloads WASM and caches it in SQLite
   */
  async install(pluginId: string, version?: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    this.loadingStates.set(pluginId, 'loading');

    try {
      // Resolve plugin from registry
      const resolution = await resolvePluginClient(pluginId, this.tenantId);

      if (!resolution || !resolution.client_wasm_url) {
        throw new Error(`Plugin ${pluginId} not found or does not have client WASM`);
      }

      const manifest = resolution.manifest;

      // Download WASM
      const wasmResponse = await fetch(resolution.client_wasm_url);
      if (!wasmResponse.ok) {
        throw new Error(`Failed to download WASM: ${wasmResponse.statusText}`);
      }

      const wasmBytes = await wasmResponse.arrayBuffer();

      // Verify checksum
      await this.verifyChecksum(wasmBytes, manifest.checksum);

      const now = new Date().toISOString();

      // Store WASM in cache (as base64 since SQLite BLOB handling varies)
      const wasmBase64 = this.arrayBufferToBase64(wasmBytes);

      await this.db.execute(
        `INSERT OR REPLACE INTO plugin_cache
         (plugin_id, manifest, wasm_bytes, installed_at, last_used, cache_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pluginId, JSON.stringify(manifest), wasmBase64, now, now, wasmBytes.byteLength]
      );

      // Store metadata
      await this.db.execute(
        `INSERT OR REPLACE INTO plugin_metadata
         (plugin_id, manifest, installed_at, enabled, cached, cache_size, last_used)
         VALUES (?, ?, ?, 1, 1, ?, ?)`,
        [pluginId, JSON.stringify(manifest), now, wasmBytes.byteLength, now]
      );

      this.loadingStates.set(pluginId, 'loaded');

      console.log(`Plugin ${pluginId} installed successfully (${(wasmBytes.byteLength / 1024).toFixed(2)} KB)`);
    } catch (error) {
      this.loadingStates.set(pluginId, 'error');
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   * Removes from cache and unloads from memory
   */
  async uninstall(pluginId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    // Unload if loaded
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId);
    }

    // Remove from database
    await this.db.execute('DELETE FROM plugin_cache WHERE plugin_id = ?', [pluginId]);
    await this.db.execute('DELETE FROM plugin_metadata WHERE plugin_id = ?', [pluginId]);

    this.loadingStates.delete(pluginId);

    console.log(`Plugin ${pluginId} uninstalled`);
  }

  /**
   * Update a plugin to latest version
   */
  async update(pluginId: string, version?: string): Promise<void> {
    // Uninstall old version
    await this.uninstall(pluginId);

    // Install new version
    await this.install(pluginId, version);
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    await this.db.execute(
      'UPDATE plugin_metadata SET enabled = 1 WHERE plugin_id = ?',
      [pluginId]
    );

    // Load the plugin
    await this.loadWasm(pluginId);

    console.log(`Plugin ${pluginId} enabled`);
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    await this.db.execute(
      'UPDATE plugin_metadata SET enabled = 0 WHERE plugin_id = ?',
      [pluginId]
    );

    // Unload from memory
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId);
    }

    console.log(`Plugin ${pluginId} disabled`);
  }

  /**
   * Reload a plugin
   */
  async reload(pluginId: string): Promise<void> {
    await this.unloadPlugin(pluginId);
    await this.loadWasm(pluginId);
  }

  /**
   * Get plugin info from registry
   */
  async getInfo(pluginId: string): Promise<PluginMetadata | null> {
    const response = await fetch(`${this.registryUrl}/info/${pluginId}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  }

  /**
   * Get installed plugin info
   */
  async getInstalled(pluginId: string): Promise<InstalledPlugin | null> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    const rows = await this.db.select<Array<{
      manifest: string;
      installed_at: string;
      enabled: number;
      cached: number;
      cache_size: number | null;
      last_used: string | null;
    }>>('SELECT * FROM plugin_metadata WHERE plugin_id = ?', [pluginId]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      manifest: JSON.parse(row.manifest),
      installed_at: row.installed_at,
      enabled: row.enabled === 1,
      cached: row.cached === 1,
      cache_size: row.cache_size || undefined,
      last_used: row.last_used || undefined,
    };
  }

  /**
   * Check for plugin updates
   */
  async checkUpdates(): Promise<Array<{ pluginId: string; currentVersion: string; latestVersion: string }>> {
    const installed = await this.listInstalled();
    const updates: Array<{ pluginId: string; currentVersion: string; latestVersion: string }> = [];

    for (const plugin of installed) {
      const info = await this.getInfo(plugin.manifest.id);

      if (info && info.version !== plugin.manifest.version) {
        updates.push({
          pluginId: plugin.manifest.id,
          currentVersion: plugin.manifest.version,
          latestVersion: info.version,
        });
      }
    }

    return updates;
  }

  /**
   * Load WASM plugin into memory
   */
  async loadWasm(pluginId: string): Promise<WebAssembly.Instance> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    // Check if already loaded
    if (this.loadedPlugins.has(pluginId)) {
      return this.loadedPlugins.get(pluginId)!.instance;
    }

    this.loadingStates.set(pluginId, 'loading');

    try {
      // Get from cache
      const rows = await this.db.select<Array<{
        manifest: string;
        wasm_bytes: string;
      }>>('SELECT manifest, wasm_bytes FROM plugin_cache WHERE plugin_id = ?', [pluginId]);

      if (rows.length === 0) {
        throw new Error(`Plugin ${pluginId} not found in cache`);
      }

      const cached = rows[0];
      const manifest = JSON.parse(cached.manifest) as PluginManifest;

      // Convert base64 back to ArrayBuffer
      const wasmBytes = this.base64ToArrayBuffer(cached.wasm_bytes);

      // Create plugin context
      const context: PluginContext = {
        pluginId: manifest.id,
        tenantId: this.tenantId,
        version: manifest.version,
        manifest,
      };

      // Create host API
      const hostAPI = createPluginHostAPI(context);

      // Compile and instantiate WASM
      const module = await WebAssembly.compile(wasmBytes);
      const instance = await WebAssembly.instantiate(module, {
        env: hostAPI,
      });

      // Call init function
      const entryPoint = manifest.frontend?.entry_point || 'init';
      if (typeof instance.exports[entryPoint] === 'function') {
        await (instance.exports[entryPoint] as CallableFunction)(
          JSON.stringify(context),
          JSON.stringify(hostAPI)
        );
      }

      // Store loaded instance
      const loadedPlugin: LoadedPluginInstance = {
        manifest,
        instance,
        context,
        enabled: true,
      };

      this.loadedPlugins.set(pluginId, loadedPlugin);
      this.loadingStates.set(pluginId, 'loaded');

      // Update last used
      await this.db.execute(
        'UPDATE plugin_cache SET last_used = ? WHERE plugin_id = ?',
        [new Date().toISOString(), pluginId]
      );

      return instance;
    } catch (error) {
      this.loadingStates.set(pluginId, 'error');
      throw error;
    }
  }

  /**
   * Get cached WASM bytes
   */
  async getCachedWasm(pluginId: string): Promise<ArrayBuffer | null> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    const rows = await this.db.select<Array<{ wasm_bytes: string }>>(
      'SELECT wasm_bytes FROM plugin_cache WHERE plugin_id = ?',
      [pluginId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.base64ToArrayBuffer(rows[0].wasm_bytes);
  }

  /**
   * Preload multiple plugins
   */
  async preloadWasm(pluginIds: string[]): Promise<void> {
    await Promise.all(pluginIds.map(id => this.loadWasm(id)));
  }

  /**
   * Get loaded plugin instance
   */
  getLoadedPlugin(pluginId: string): LoadedPluginInstance | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Get plugin loading state
   */
  getLoadingState(pluginId: string): PluginLoadingState {
    return this.loadingStates.get(pluginId) || 'idle';
  }

  /**
   * Verify WASM checksum
   */
  private async verifyChecksum(wasmBytes: ArrayBuffer, expectedChecksum: string): Promise<void> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', wasmBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const actualChecksum = `sha256:${hashHex}`;

    if (actualChecksum !== expectedChecksum) {
      throw new Error(
        `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`
      );
    }
  }

  /**
   * Convert ArrayBuffer to base64 for SQLite storage
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Unload a plugin from memory
   */
  private async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);

    if (plugin) {
      // Call destroy if it exists
      const destroyFn = plugin.instance.exports.destroy;
      if (typeof destroyFn === 'function') {
        await (destroyFn as CallableFunction)();
      }

      this.loadedPlugins.delete(pluginId);
      this.loadingStates.set(pluginId, 'idle');
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    // Unload all plugins
    for (const pluginId of this.loadedPlugins.keys()) {
      await this.unloadPlugin(pluginId);
    }

    // Close DB (if needed)
    if (this.db) {
      // Tauri SQL plugin doesn't have explicit close
      this.db = null;
    }
  }
}

/**
 * Global plugin manager instance
 * Initialize once per tenant
 */
let globalPluginManager: PluginManager | null = null;

export function getPluginManager(tenantId: string): PluginManager {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager(tenantId);
  }
  return globalPluginManager;
}

export async function initializePluginManager(tenantId: string): Promise<PluginManager> {
  const manager = getPluginManager(tenantId);
  await manager.initialize();
  return manager;
}
