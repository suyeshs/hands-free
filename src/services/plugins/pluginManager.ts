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
  DependencyResolution,
  DependencyConflict,
  PluginSnapshot,
  UninstallOptions,
  PluginSearchFilters,
  PluginReview,
} from '@/types/plugin';
import * as semver from 'semver';
import { createPluginHostAPI } from '@/lib/pluginHost';
import Database from '@tauri-apps/plugin-sql';
import { DB_NAME } from '@/lib/database';

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
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

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
    // Prevent multiple concurrent initializations
    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
    this.isInitialized = true;
  }

  private async _doInitialize(): Promise<void> {
    // Open SQLite database (same as main app DB)
    this.db = await Database.load(DB_NAME);
    console.log(`[PluginManager] Using database: ${DB_NAME}`);

    // Configure database for better concurrency (set once per connection)
    // Increase timeout to 30 seconds to handle concurrent operations better
    await this.db.execute('PRAGMA busy_timeout = 30000');
    await this.db.execute('PRAGMA journal_mode = WAL');

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
        last_used TEXT,
        has_snapshot INTEGER DEFAULT 0,
        snapshot_expires_at TEXT,
        previous_version TEXT
      )
    `);

    // Manifest v2: Rollback snapshots table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS plugin_snapshots (
        id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        manifest TEXT NOT NULL,
        wasm_bytes BLOB NOT NULL,
        data_backup TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        snapshot_reason TEXT NOT NULL,
        FOREIGN KEY (plugin_id) REFERENCES plugin_metadata(plugin_id) ON DELETE CASCADE
      )
    `);

    // Manifest v2: Dependency resolution cache
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS plugin_dependencies (
        plugin_id TEXT NOT NULL,
        depends_on TEXT NOT NULL,
        version_constraint TEXT NOT NULL,
        resolved_version TEXT,
        optional INTEGER DEFAULT 0,
        PRIMARY KEY (plugin_id, depends_on)
      )
    `);

    // Manifest v2: Permission revocations
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS plugin_permission_revocations (
        plugin_id TEXT NOT NULL,
        permission TEXT NOT NULL,
        revoked_at TEXT NOT NULL,
        PRIMARY KEY (plugin_id, permission)
      )
    `);

    // Manifest v2: Plugin migrations tracking
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS plugin_migrations (
        plugin_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        PRIMARY KEY (plugin_id, version)
      )
    `);

    // Theme Plugin System: Theme cache table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS theme_cache (
        theme_id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        light_css TEXT,
        dark_css TEXT,
        common_css TEXT,
        components_css TEXT,
        cached_at TEXT NOT NULL,
        last_used TEXT NOT NULL
      )
    `);

    // Theme Plugin System: Tenant theme configuration
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tenant_theme_config (
        tenant_id TEXT PRIMARY KEY,
        active_theme_id TEXT NOT NULL,
        theme_mode TEXT NOT NULL,
        custom_variables TEXT,
        updated_at TEXT NOT NULL
      )
    `);

    // Theme Plugin System: Screen-specific theme overrides
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS screen_theme_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        screen_type TEXT NOT NULL,
        override_variables TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(tenant_id, screen_type)
      )
    `);

    // Clean up expired snapshots on init
    await this.cleanupExpiredSnapshots();

    console.log('Plugin manager initialized with SQLite backend (Manifest v2)');
  }

  /**
   * List all available plugins from registry
   */
  async listAvailable(): Promise<PluginMetadata[]> {
    console.log('[PluginManager] Using production registry:', this.registryUrl);

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
   * Search plugins by query and filters (Manifest v2)
   */
  async searchPlugins(query: string, filters?: PluginSearchFilters): Promise<PluginMetadata[]> {
    const params = new URLSearchParams({ query });

    if (filters?.tags) {
      params.append('tags', filters.tags.join(','));
    }
    if (filters?.category) {
      params.append('category', filters.category);
    }
    if (filters?.verified !== undefined) {
      params.append('verified', filters.verified.toString());
    }
    if (filters?.minRating) {
      params.append('minRating', filters.minRating.toString());
    }
    if (filters?.sortBy) {
      params.append('sortBy', filters.sortBy);
    }
    if (filters?.sortOrder) {
      params.append('sortOrder', filters.sortOrder);
    }

    const response = await fetch(`${this.registryUrl}/search?${params}`);
    return await response.json();
  }

  /**
   * Install a plugin
   * Downloads WASM and caches it in SQLite
   */
  async install(pluginId: string, _version?: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    this.loadingStates.set(pluginId, 'loading');

    try {
      // Get plugin info from registry
      const manifest = await this.getInfo(pluginId);

      if (!manifest) {
        throw new Error(`Plugin ${pluginId} not found in registry`);
      }

      // Check if plugin has client WASM
      if (!manifest.frontend || !manifest.frontend.wasm) {
        throw new Error(`Plugin ${pluginId} does not have client WASM`);
      }

      // Construct WASM download URL
      const version = _version || manifest.version;
      const wasmDownloadUrl = `${this.registryUrl}/download/${pluginId}/${version}/client`;

      // Download WASM
      console.log(`[PluginManager] Downloading WASM from: ${wasmDownloadUrl}`);
      const wasmResponse = await fetch(wasmDownloadUrl);
      if (!wasmResponse.ok) {
        if (wasmResponse.status === 503) {
          throw new Error(`Plugin registry is unavailable. Please try again later.`);
        }
        if (wasmResponse.status === 404) {
          throw new Error(`Plugin file not found in registry (${pluginId} v${version})`);
        }
        throw new Error(`Failed to download WASM: ${wasmResponse.statusText}`);
      }

      const wasmBytes = await wasmResponse.arrayBuffer();

      // Verify checksum
      await this.verifyChecksum(wasmBytes, manifest.checksum);

      const now = new Date().toISOString();

      // Store WASM in cache (as base64 since SQLite BLOB handling varies)
      const wasmBase64 = this.arrayBufferToBase64(wasmBytes);

      // Apply plugin migrations FIRST (R2-based)
      // If migrations fail, we won't mark the plugin as installed
      await this.applyPluginMigrations(pluginId, manifest);

      // Only after migrations succeed, store the plugin data
      await this.db.execute(
        `INSERT OR REPLACE INTO plugin_cache
         (plugin_id, manifest, wasm_bytes, installed_at, last_used, cache_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pluginId, JSON.stringify(manifest), wasmBase64, now, now, wasmBytes.byteLength]
      );

      // Store metadata (marks plugin as installed)
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
   * Uninstall a plugin (Manifest v2: with snapshot and data handling)
   * Removes from cache and unloads from memory
   */
  async uninstall(pluginId: string, options?: UninstallOptions): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    const installed = await this.getInstalled(pluginId);
    if (!installed) {
      throw new Error(`Plugin ${pluginId} not installed`);
    }

    // Prevent uninstalling required plugins
    if (installed.manifest.required) {
      throw new Error(
        `Cannot uninstall required plugin: ${pluginId}. ` +
        `Reason: ${installed.manifest.required_reason || 'This plugin is essential for POS operations'}`
      );
    }

    // Default options
    const opts: UninstallOptions = {
      dataHandling: options?.dataHandling || installed.manifest.data?.uninstall_behavior || 'archive',
      createSnapshot: options?.createSnapshot !== false,  // Default true
      force: options?.force || false,
    };

    // Create snapshot before uninstalling (unless opted out)
    if (opts.createSnapshot) {
      await this.createSnapshot(pluginId, 'uninstall');
      console.log(`Created rollback snapshot for ${pluginId}`);
    }

    // Call lifecycle hook if exists
    if (installed.manifest.lifecycle?.onUninstall) {
      const plugin = this.loadedPlugins.get(pluginId);
      if (plugin) {
        const hookFn = plugin.instance.exports[installed.manifest.lifecycle.onUninstall];
        if (typeof hookFn === 'function') {
          try {
            await (hookFn as CallableFunction)();
          } catch (error) {
            console.error(`Error calling onUninstall hook for ${pluginId}:`, error);
          }
        }
      }
    }

    // Handle plugin data based on manifest/options
    await this.handlePluginDataOnUninstall(pluginId, installed.manifest, opts.dataHandling!);

    // Unload if loaded
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId);
    }

    // Remove from database
    await this.db.execute('DELETE FROM plugin_cache WHERE plugin_id = ?', [pluginId]);
    await this.db.execute('DELETE FROM plugin_metadata WHERE plugin_id = ?', [pluginId]);
    await this.db.execute('DELETE FROM plugin_dependencies WHERE plugin_id = ?', [pluginId]);
    await this.db.execute('DELETE FROM plugin_permission_revocations WHERE plugin_id = ?', [pluginId]);

    this.loadingStates.delete(pluginId);

    console.log(`Plugin ${pluginId} uninstalled (data: ${opts.dataHandling})`);
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
        env: hostAPI as any,
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
   * Resolve plugin dependencies (Manifest v2)
   */
  async resolveDependencies(pluginId: string): Promise<DependencyResolution[]> {
    const info = await this.getInfo(pluginId);
    if (!info || !info.dependencies || info.dependencies.length === 0) {
      return [];
    }

    const resolutions: DependencyResolution[] = [];
    const installed = await this.listInstalled();

    for (const dep of info.dependencies) {
      // Check if dependency is already installed
      const installedDep = installed.find(p => p.manifest.id === dep.plugin_id);

      if (installedDep) {
        // Check version compatibility
        if (semver.satisfies(installedDep.manifest.version, dep.version)) {
          resolutions.push({
            plugin_id: dep.plugin_id,
            requested_version: dep.version,
            resolved_version: installedDep.manifest.version,
            source: 'installed',
          });
        } else {
          // Version conflict
          resolutions.push({
            plugin_id: dep.plugin_id,
            requested_version: dep.version,
            resolved_version: installedDep.manifest.version,
            source: 'installed',
            conflicts: [{
              plugin_id: dep.plugin_id,
              required_by: [pluginId],
              conflicting_versions: [
                { plugin: pluginId, version: dep.version },
                { plugin: 'installed', version: installedDep.manifest.version },
              ],
              resolution: 'use-highest',  // Default to highest version
            }],
          });
        }
      } else {
        // Need to fetch from registry
        const depInfo = await this.getInfo(dep.plugin_id);
        if (depInfo) {
          resolutions.push({
            plugin_id: dep.plugin_id,
            requested_version: dep.version,
            resolved_version: depInfo.version,
            source: 'registry',
          });
        } else if (!dep.optional) {
          throw new Error(`Required dependency ${dep.plugin_id} not found in registry`);
        }
      }
    }

    return resolutions;
  }

  /**
   * Check for dependency conflicts (Manifest v2)
   */
  async checkDependencyConflicts(pluginId: string): Promise<DependencyConflict[]> {
    const resolutions = await this.resolveDependencies(pluginId);
    return resolutions.flatMap(r => r.conflicts || []);
  }

  /**
   * Create a rollback snapshot (Manifest v2)
   */
  async createSnapshot(pluginId: string, reason: 'uninstall' | 'update' | 'manual'): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    const installed = await this.getInstalled(pluginId);
    if (!installed) {
      throw new Error(`Plugin ${pluginId} not installed`);
    }

    // Get WASM bytes from cache
    const wasmBytes = await this.getCachedWasm(pluginId);
    if (!wasmBytes) {
      throw new Error(`WASM for plugin ${pluginId} not found in cache`);
    }

    // Backup plugin data if needed
    let dataBackup: string | null = null;
    if (installed.manifest.data?.tables && installed.manifest.data.tables.length > 0) {
      const data: Record<string, any[]> = {};
      for (const table of installed.manifest.data.tables) {
        try {
          const rows = await this.db.select(`SELECT * FROM ${table}`) as any[];
          data[table] = rows;
        } catch (error) {
          console.warn(`Table ${table} does not exist, skipping backup for snapshot`);
          data[table] = [];
        }
      }
      dataBackup = JSON.stringify(data);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);  // 30 days

    const snapshotId = `${pluginId}-${now.getTime()}`;
    const wasmBase64 = this.arrayBufferToBase64(wasmBytes);

    // Store snapshot
    await this.db.execute(
      `INSERT INTO plugin_snapshots
       (id, plugin_id, manifest, wasm_bytes, data_backup, created_at, expires_at, snapshot_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshotId,
        pluginId,
        JSON.stringify(installed.manifest),
        wasmBase64,
        dataBackup,
        now.toISOString(),
        expiresAt.toISOString(),
        reason,
      ]
    );

    // Update metadata
    await this.db.execute(
      `UPDATE plugin_metadata
       SET has_snapshot = 1, snapshot_expires_at = ?, previous_version = ?
       WHERE plugin_id = ?`,
      [expiresAt.toISOString(), installed.manifest.version, pluginId]
    );

    console.log(`Snapshot created for ${pluginId} (expires: ${expiresAt.toISOString()})`);
  }

  /**
   * Rollback to previous snapshot (Manifest v2)
   */
  async rollback(pluginId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    // Get latest snapshot
    const rows = await this.db.select<Array<{
      id: string;
      manifest: string;
      wasm_bytes: string;
      data_backup: string | null;
      created_at: string;
      expires_at: string;
    }>>(
      `SELECT * FROM plugin_snapshots
       WHERE plugin_id = ? AND datetime(expires_at) > datetime('now')
       ORDER BY created_at DESC LIMIT 1`,
      [pluginId]
    );

    if (rows.length === 0) {
      throw new Error(`No valid snapshot found for ${pluginId}`);
    }

    const snapshot = rows[0];
    const manifest = JSON.parse(snapshot.manifest) as PluginManifest;

    // Unload current plugin
    if (this.loadedPlugins.has(pluginId)) {
      await this.unloadPlugin(pluginId);
    }

    // Restore WASM
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT OR REPLACE INTO plugin_cache
       (plugin_id, manifest, wasm_bytes, installed_at, last_used, cache_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pluginId,
        JSON.stringify(manifest),
        snapshot.wasm_bytes,
        now,
        now,
        this.base64ToArrayBuffer(snapshot.wasm_bytes).byteLength,
      ]
    );

    // Restore data if backup exists
    if (snapshot.data_backup && manifest.data?.tables) {
      const data = JSON.parse(snapshot.data_backup);
      for (const [table, rows] of Object.entries(data)) {
        // Clear table
        await this.db.execute(`DELETE FROM ${table} WHERE 1=1`);

        // Restore rows
        if (Array.isArray(rows) && rows.length > 0) {
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(', ');
          const insertSql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

          for (const row of rows) {
            const values = columns.map(col => row[col]);
            await this.db.execute(insertSql, values);
          }
        }
      }
    }

    // Update metadata
    await this.db.execute(
      `UPDATE plugin_metadata
       SET manifest = ?, cached = 1, enabled = 1, previous_version = NULL
       WHERE plugin_id = ?`,
      [JSON.stringify(manifest), pluginId]
    );

    console.log(`Rolled back ${pluginId} to version ${manifest.version}`);
  }

  /**
   * List snapshots for a plugin (Manifest v2)
   */
  async listSnapshots(pluginId: string): Promise<PluginSnapshot[]> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    const rows = await this.db.select<Array<{
      id: string;
      manifest: string;
      wasm_bytes: string;
      data_backup: string | null;
      created_at: string;
      expires_at: string;
      snapshot_reason: string;
    }>>(
      `SELECT * FROM plugin_snapshots
       WHERE plugin_id = ? AND datetime(expires_at) > datetime('now')
       ORDER BY created_at DESC`,
      [pluginId]
    );

    return rows.map(row => ({
      plugin_id: pluginId,
      manifest: JSON.parse(row.manifest),
      wasm_bytes: this.base64ToArrayBuffer(row.wasm_bytes),
      data_backup: row.data_backup || undefined,
      created_at: row.created_at,
      expires_at: row.expires_at,
      snapshot_reason: row.snapshot_reason as 'uninstall' | 'update' | 'manual',
    }));
  }

  /**
   * Delete a specific snapshot (Manifest v2)
   */
  async deleteSnapshot(pluginId: string, snapshotId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    await this.db.execute(
      'DELETE FROM plugin_snapshots WHERE id = ? AND plugin_id = ?',
      [snapshotId, pluginId]
    );

    console.log(`Deleted snapshot ${snapshotId} for ${pluginId}`);
  }

  /**
   * Install plugin from offline bundle (.hfpb file) (Manifest v2)
   */
  async installFromFile(filePath: string): Promise<void> {
    // TODO: Implement offline bundle installation
    // 1. Read .hfpb file (ZIP or custom binary format)
    // 2. Parse manifest.json
    // 3. Extract WASM files
    // 4. Verify checksums
    // 5. Install dependencies recursively
    // 6. Cache WASM and metadata
    console.warn('Offline installation not yet implemented:', filePath);
    throw new Error('Offline installation not yet implemented');
  }

  /**
   * Export plugin to offline bundle (.hfpb file) (Manifest v2)
   */
  async exportPlugin(pluginId: string, outputPath: string): Promise<void> {
    // TODO: Implement plugin export
    // 1. Get plugin from cache
    // 2. Resolve dependencies
    // 3. Create .hfpb bundle (ZIP or custom binary)
    // 4. Include manifest, WASM, and dependencies
    // 5. Write to outputPath
    console.warn('Plugin export not yet implemented:', pluginId, outputPath);
    throw new Error('Plugin export not yet implemented');
  }

  /**
   * Submit a review for a plugin (Manifest v2)
   */
  async submitReview(pluginId: string, rating: number, comment?: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const response = await fetch(`${this.registryUrl}/${pluginId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: this.tenantId,
        rating,
        comment,
        plugin_version: (await this.getInstalled(pluginId))?.manifest.version,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit review: ${response.statusText}`);
    }

    console.log(`Submitted review for ${pluginId}: ${rating} stars`);
  }

  /**
   * Get reviews for a plugin (Manifest v2)
   */
  async getReviews(pluginId: string, limit: number = 10): Promise<PluginReview[]> {
    const response = await fetch(`${this.registryUrl}/${pluginId}/reviews?limit=${limit}`);

    if (!response.ok) {
      return [];
    }

    return await response.json();
  }

  /**
   * Revoke a permission from a plugin (Manifest v2)
   */
  async revokePermission(pluginId: string, permission: string): Promise<void> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    // Store revocation
    await this.db.execute(
      `INSERT OR REPLACE INTO plugin_permission_revocations
       (plugin_id, permission, revoked_at)
       VALUES (?, ?, ?)`,
      [pluginId, permission, new Date().toISOString()]
    );

    // Call lifecycle hook if plugin is loaded
    const plugin = this.loadedPlugins.get(pluginId);
    if (plugin && plugin.manifest.lifecycle?.onPermissionRevoked) {
      const hookFn = plugin.instance.exports[plugin.manifest.lifecycle.onPermissionRevoked];
      if (typeof hookFn === 'function') {
        try {
          await (hookFn as CallableFunction)(permission);
        } catch (error) {
          console.error(`Error calling onPermissionRevoked hook for ${pluginId}:`, error);
        }
      }
    }

    console.log(`Revoked permission "${permission}" from ${pluginId}`);
  }

  /**
   * Request a permission for a plugin (Manifest v2)
   */
  async requestPermission(pluginId: string, permission: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    // Check if permission was previously revoked
    const rows = await this.db.select<Array<{ permission: string }>>(
      `SELECT permission FROM plugin_permission_revocations
       WHERE plugin_id = ? AND permission = ?`,
      [pluginId, permission]
    );

    if (rows.length > 0) {
      // Permission was revoked, need user consent to re-grant
      // TODO: Show permission request dialog
      console.warn(`Permission "${permission}" was previously revoked for ${pluginId}`);
      return false;
    }

    // Permission not revoked, grant it
    return true;
  }

  /**
   * Handle plugin data on uninstall (Manifest v2)
   */
  private async handlePluginDataOnUninstall(
    pluginId: string,
    manifest: PluginManifest,
    behavior: 'archive' | 'export' | 'delete' | 'delete_all'
  ): Promise<void> {
    if (!this.db || !manifest.data?.tables || manifest.data.tables.length === 0) {
      return;
    }

    switch (behavior) {
      case 'archive':
        // Create snapshot (already done in uninstall)
        console.log(`Plugin data archived in snapshot for ${pluginId}`);
        break;

      case 'export':
        // Export to JSON/CSV file
        const data: Record<string, any[]> = {};
        for (const table of manifest.data.tables) {
          try {
            const rows = await this.db.select(`SELECT * FROM ${table}`) as any[];
            data[table] = rows;
          } catch (error) {
            console.warn(`Table ${table} does not exist, skipping export`);
            data[table] = [];
          }
        }

        // TODO: Save to file system (use Tauri save dialog)
        console.log(`Plugin data exported for ${pluginId}:`, data);
        break;

      case 'delete':
        // Delete data rows but keep table structure
        for (const table of manifest.data.tables) {
          try {
            await this.db.execute(`DELETE FROM ${table} WHERE 1=1`);
          } catch (error) {
            console.warn(`Table ${table} does not exist, skipping deletion`);
          }
        }
        console.log(`Plugin data deleted for ${pluginId}`);
        break;

      case 'delete_all':
        // Drop tables entirely (including structure)
        for (const table of manifest.data.tables) {
          try {
            await this.db.execute(`DROP TABLE IF EXISTS ${table}`);
            console.log(`Dropped table ${table}`);
          } catch (error) {
            console.error(`Failed to drop table ${table}:`, error);
          }
        }
        // Also delete migration records for this plugin
        try {
          await this.db.execute('DELETE FROM plugin_migrations WHERE plugin_id = ?', [pluginId]);
          console.log(`Deleted migration records for ${pluginId}`);
        } catch (error) {
          console.error(`Failed to delete migration records for ${pluginId}:`, error);
        }

        // Sync DROP TABLE statements to D1 (disabled - endpoint not implemented yet)
        // await this.dropPluginTablesInD1(pluginId, manifest.data.tables);

        console.log(`Plugin tables and data completely removed for ${pluginId}`);
        break;
    }
  }

  /**
   * SHA256 hash utility (used for migration checksum verification)
   */
  private async sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Apply plugin migrations from R2 (called during installation)
   * Uses existing R2-based dynamic migration system
   */
  private async applyPluginMigrations(pluginId: string, manifest: PluginManifest): Promise<void> {
    if (!this.db || !manifest.data?.migration_path) {
      console.log(`[PluginManager] Plugin ${pluginId} has no migrations`);
      return;
    }

    console.log(`[PluginManager] Applying migrations for ${pluginId}...`);

    // Download migration manifest via worker proxy
    const migrationManifestUrl = `${this.registryUrl}/plugins/${pluginId}/migrations/manifest.json`;
    console.log(`[PluginManager] Downloading migration manifest from: ${migrationManifestUrl}`);

    const migrationManifestResponse = await fetch(migrationManifestUrl);

    if (!migrationManifestResponse.ok) {
      throw new Error(`Failed to download migration manifest from ${migrationManifestUrl}: ${migrationManifestResponse.statusText}`);
    }

    const migrationManifest = await migrationManifestResponse.json();

    if (!migrationManifest.migrations || migrationManifest.migrations.length === 0) {
      console.log(`[PluginManager] No migrations defined for ${pluginId}`);
      return;
    }

    // Get applied migrations for this plugin
    const appliedRows = await this.db.select<Array<{ version: number }>>(
      `SELECT version FROM plugin_migrations WHERE plugin_id = ? ORDER BY version`,
      [pluginId]
    );
    const appliedVersions = new Set(appliedRows.map(r => r.version));

    console.log(`[PluginManager] Found ${migrationManifest.migrations.length} migrations, ${appliedVersions.size} already applied`);

    // Apply unapplied migrations in order
    for (const migration of migrationManifest.migrations) {
      if (appliedVersions.has(migration.version)) {
        console.log(`[PluginManager] Migration v${migration.version} already applied, skipping`);
        continue;
      }

      console.log(`[PluginManager] Applying migration v${migration.version}: ${migration.description}`);

      // Download SQL file via worker proxy
      const sqlUrl = `${this.registryUrl}/plugins/${pluginId}/migrations/${migration.file}`;
      console.log(`[PluginManager] Downloading SQL from: ${sqlUrl}`);

      const sqlResponse = await fetch(sqlUrl);

      if (!sqlResponse.ok) {
        throw new Error(`Failed to download migration SQL from ${sqlUrl}: ${sqlResponse.statusText}`);
      }

      const sqlContent = await sqlResponse.text();

      // Verify checksum
      const computedChecksum = `sha256:${await this.sha256(sqlContent)}`;
      if (migration.checksum && computedChecksum !== migration.checksum) {
        throw new Error(
          `Checksum mismatch for ${pluginId} migration v${migration.version}: ` +
          `expected ${migration.checksum}, got ${computedChecksum}`
        );
      }

      // Execute migration statements (without transaction for better concurrency)
      // All statements use IF NOT EXISTS, so they're idempotent
      try {
        // Disable foreign key checks during migration
        await this.db.execute('PRAGMA foreign_keys = OFF');

        // Remove comment-only lines first, then split by semicolon
        const cleanedSql = sqlContent
          .split('\n')
          .filter(line => {
            const trimmed = line.trim();
            // Keep the line if it's not empty and not a comment-only line
            return trimmed.length > 0 && !trimmed.startsWith('--');
          })
          .join('\n');

        // Split by semicolon and execute each statement
        const statements = cleanedSql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        console.log(`[PluginManager] Executing ${statements.length} SQL statements...`);
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          console.log(`[PluginManager] Executing statement ${i + 1}/${statements.length}:`, stmt.substring(0, 100) + '...');
          try {
            await this.db.execute(stmt);
          } catch (error) {
            console.error(`[PluginManager] Failed to execute statement ${i + 1}:`, stmt);
            await this.db.execute('PRAGMA foreign_keys = ON');
            throw error;
          }
        }

        // Record applied migration with retry logic
        let recordSuccess = false;
        let lastError: any = null;
        const maxRetries = 5;

        for (let attempt = 0; attempt < maxRetries && !recordSuccess; attempt++) {
          try {
            if (attempt > 0) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff: 1s, 2s, 4s, 5s
              console.log(`[PluginManager] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Use INSERT OR IGNORE instead of transaction for better concurrency
            await this.db.execute(
              `INSERT OR IGNORE INTO plugin_migrations
               (plugin_id, version, name, description, checksum, applied_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                pluginId,
                migration.version,
                migration.name,
                migration.description,
                migration.checksum,
                Date.now()
              ]
            );
            recordSuccess = true;
          } catch (error: any) {
            lastError = error;

            if (error?.message?.includes('database is locked')) {
              console.log(`[PluginManager] Database locked on attempt ${attempt + 1}, will retry...`);
              continue;
            } else {
              // Non-lock error, don't retry
              await this.db.execute('PRAGMA foreign_keys = ON');
              throw error;
            }
          }
        }

        if (!recordSuccess) {
          await this.db.execute('PRAGMA foreign_keys = ON');
          throw lastError || new Error('Failed to record migration after retries');
        }

        // Re-enable foreign keys after migration
        await this.db.execute('PRAGMA foreign_keys = ON');

        console.log(`[PluginManager] ✅ Migration v${migration.version} applied successfully`);
      } catch (error) {
        console.error(`[PluginManager] ❌ Migration v${migration.version} failed:`, error);
        throw new Error(`Migration v${migration.version} failed: ${error}`);
      }
    }

    console.log(`[PluginManager] ✅ All migrations for ${pluginId} applied successfully`);

    // Sync new plugin tables to D1 (disabled - endpoint not implemented yet)
    // await this.syncPluginTablesToD1(pluginId, manifest);
  }

  /**
   * Sync plugin tables to D1 database
   * Extracts schema for plugin tables and sends to D1
   */
  // @ts-expect-error - Unused method, kept for future use
  private async _syncPluginTablesToD1(pluginId: string, manifest: PluginManifest): Promise<void> {
    try {
      if (!manifest.data?.tables || manifest.data.tables.length === 0) {
        console.log(`[PluginManager] No tables to sync for ${pluginId}`);
        return;
      }

      console.log(`[PluginManager] Syncing ${manifest.data.tables.length} plugin tables to D1...`);

      // Import d1ProvisioningService dynamically to avoid circular deps
      const { getD1ProvisioningService } = await import('@/services/d1ProvisioningService');
      const d1Service = getD1ProvisioningService();

      // Extract schema for plugin tables only
      const fullSchema = await d1Service.extractSchema('handsfree.db');

      // Filter to only include plugin tables
      const pluginTableSchemas = fullSchema.filter(stmt => {
        return manifest.data!.tables!.some(table =>
          stmt.includes(`CREATE TABLE ${table}`) ||
          stmt.includes(`CREATE TABLE IF NOT EXISTS ${table}`)
        );
      });

      if (pluginTableSchemas.length === 0) {
        console.warn(`[PluginManager] No schema statements found for plugin tables`);
        return;
      }

      console.log(`[PluginManager] Found ${pluginTableSchemas.length} CREATE TABLE statements for plugin`);

      // Send to D1 via worker using fetch
      const workerUrl = import.meta.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-orders.suyesh.workers.dev';
      const tenantId = this.tenantId || 'default';

      const response = await fetch(`${workerUrl}/d1/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          sql: pluginTableSchemas.join('\n'),
          pluginId,
          operationType: 'install',
        }),
      });

      if (response.ok) {
        console.log(`[PluginManager] ✅ Plugin tables synced to D1 successfully`);
      } else {
        const error = await response.text();
        console.error(`[PluginManager] ❌ Failed to sync plugin tables to D1:`, error);
      }
    } catch (error) {
      // Don't fail plugin installation if D1 sync fails
      console.error(`[PluginManager] D1 sync error (non-fatal):`, error);
    }
  }

  /**
   * Drop plugin tables in D1 database
   * Sends DROP TABLE statements to D1
   */
  // @ts-expect-error - Unused method, kept for future use
  private async _dropPluginTablesInD1(pluginId: string, tables: string[]): Promise<void> {
    try {
      if (!tables || tables.length === 0) {
        return;
      }

      console.log(`[PluginManager] Dropping ${tables.length} plugin tables in D1...`);

      // Build DROP TABLE statements
      const dropStatements = tables.map(table => `DROP TABLE IF EXISTS ${table};`);

      // Send to D1 via worker using fetch
      const workerUrl = import.meta.env.VITE_ORDERS_ENDPOINT || 'https://handsfree-orders.suyesh.workers.dev';
      const tenantId = this.tenantId || 'default';

      const response = await fetch(`${workerUrl}/d1/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          sql: dropStatements.join('\n'),
          pluginId,
          operationType: 'uninstall',
        }),
      });

      if (response.ok) {
        console.log(`[PluginManager] ✅ Plugin tables dropped in D1 successfully`);
      } else {
        const error = await response.text();
        console.error(`[PluginManager] ❌ Failed to drop plugin tables in D1:`, error);
      }
    } catch (error) {
      // Don't fail plugin uninstallation if D1 sync fails
      console.error(`[PluginManager] D1 drop tables error (non-fatal):`, error);
    }
  }

  /**
   * Auto-install required plugins if missing
   * Called during app initialization - installs from registry at runtime
   * Supports regional menu variants based on tenant config and restaurant type
   *
   * If region is not provided, it will be auto-detected from address (state, city, pincode)
   */
  async autoInstallRequiredPlugins(tenantConfig?: {
    region?: 'global' | 'india' | 'asia' | 'middle-east' | 'western';
    restaurantType?: string; // RestaurantType enum value (full-service, cafe-bakery, etc.)
    menuVariant?: string;
    // Address info for auto-detection
    address?: {
      state?: string;
      city?: string;
      pincode?: string;
    };
  }): Promise<void> {
    // Auto-detect region if not provided
    let region = tenantConfig?.region;

    // Try address-based detection first
    if (!region && tenantConfig?.address) {
      region = this.detectRegionFromAddress(
        tenantConfig.address.state,
        tenantConfig.address.city,
        tenantConfig.address.pincode
      );
      console.log(`[PluginManager] Auto-detected region from address: ${region}`);
    }

    // Fallback to Cloudflare geo data if still no region
    if (!region) {
      console.log(`[PluginManager] No address provided, trying Cloudflare geo detection...`);
      const geoData = await this.fetchCloudflareGeoData();
      const detectedRegion = this.detectRegionFromCloudflare(geoData);
      if (detectedRegion) {
        region = detectedRegion;
        console.log(`[PluginManager] Auto-detected region from Cloudflare: ${region} (country: ${geoData?.country})`);
      }
    }

    // Determine menu plugin based on region + restaurant type
    const menuPlugin = tenantConfig?.menuVariant ||
      this.getRegionalMenuPlugin(
        region || 'global',
        tenantConfig?.restaurantType || 'full-service'
      );

    const REQUIRED_PLUGINS = [
      menuPlugin,  // Regional + type-specific menu variant
      '@guanix/plugin-billing-payments',
    ];

    console.log(`[PluginManager] Auto-installing required plugins`);
    console.log(`[PluginManager]   Region: ${region || 'global'}`);
    console.log(`[PluginManager]   Restaurant Type: ${tenantConfig?.restaurantType || 'full-service'}`);
    console.log(`[PluginManager]   Selected menu plugin: ${menuPlugin}`);

    const installed = await this.listInstalled();
    const installedIds = new Set(installed.map(p => p.manifest.id));

    for (const pluginId of REQUIRED_PLUGINS) {
      if (!installedIds.has(pluginId)) {
        console.log(`[PluginManager] Downloading and installing required plugin from registry: ${pluginId}`);
        try {
          // Install from R2 registry at runtime
          await this.install(pluginId);
          console.log(`[PluginManager] ✅ Required plugin installed: ${pluginId}`);
        } catch (error) {
          console.error(`[PluginManager] ❌ Failed to install required plugin ${pluginId}:`, error);
          throw new Error(`Required plugin ${pluginId} installation failed. App cannot start.`);
        }
      }
    }

    console.log(`[PluginManager] ✅ All required plugins installed`);
  }

  /**
   * Fetch geographical data from Cloudflare CDN
   * Returns country code and other geo information
   */
  private async fetchCloudflareGeoData(): Promise<{ country?: string; region?: string; city?: string } | null> {
    try {
      console.log('[PluginManager] Fetching geo data from Cloudflare...');
      const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
      const text = await response.text();

      // Parse trace data (format: key=value\n)
      const data: Record<string, string> = {};
      text.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          data[key.trim()] = value.trim();
        }
      });

      console.log('[PluginManager] Cloudflare geo data:', data);

      return {
        country: data.loc, // Country code (e.g., 'IN', 'US')
        region: data.colo, // Cloudflare colo/region
        city: data.colo, // Approximation from colo
      };
    } catch (error) {
      console.warn('[PluginManager] Failed to fetch Cloudflare geo data:', error);
      return null;
    }
  }

  /**
   * Detect region from Cloudflare geo data
   */
  private detectRegionFromCloudflare(geoData: { country?: string } | null): 'global' | 'india' | 'asia' | 'middle-east' | 'western' | null {
    if (!geoData?.country) {
      return null;
    }

    const country = geoData.country.toUpperCase();

    // India
    if (country === 'IN') {
      return 'india';
    }

    // Western countries (US, Canada, UK, EU, Australia, New Zealand)
    const westernCountries = [
      // North America
      'US', 'CA',
      // UK & Ireland
      'GB', 'UK', 'IE',
      // EU Member States (27 countries)
      'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'PT', 'GR', 'PL', 'CZ',
      'RO', 'HU', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY',
      // EFTA (non-EU but Western)
      'CH', 'NO', 'IS', 'LI',
      // Oceania
      'AU', 'NZ'
    ];
    if (westernCountries.includes(country)) {
      return 'western';
    }

    // Asian countries
    const asianCountries = ['CN', 'JP', 'KR', 'TH', 'VN', 'MY', 'SG', 'ID', 'PH', 'TW', 'HK', 'MO'];
    if (asianCountries.includes(country)) {
      return 'asia';
    }

    // Middle Eastern countries
    const middleEastCountries = ['SA', 'AE', 'QA', 'KW', 'OM', 'BH', 'JO', 'LB', 'EG', 'TR', 'IQ', 'SY', 'YE', 'PS', 'IL'];
    if (middleEastCountries.includes(country)) {
      return 'middle-east';
    }

    return 'global';
  }

  /**
   * Detect region based on restaurant address
   * Uses state/city/pincode to determine regional menu variant
   * Can also use Cloudflare geo data if available
   */
  private detectRegionFromAddress(state?: string, city?: string, pincode?: string): 'global' | 'india' | 'asia' | 'middle-east' | 'western' {
    // Check pincode first (most specific)
    if (pincode) {
      const pincodeClean = pincode.trim().toUpperCase().replace(/\s+/g, '');

      // Indian pincodes are 6 digits and start with 1-8
      const pincodeNum = parseInt(pincodeClean);
      if (!isNaN(pincodeNum) && pincodeClean.length === 6 && pincodeNum >= 100000 && pincodeNum <= 899999) {
        return 'india';
      }

      // US zip codes are 5 digits
      if (!isNaN(pincodeNum) && pincodeClean.length === 5 && pincodeNum >= 501 && pincodeNum <= 99950) {
        return 'western';
      }

      // UK postcodes (various formats: SW1A1AA, M11AE, B338TH, etc.)
      const ukPostcodePattern = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/;
      if (ukPostcodePattern.test(pincodeClean)) {
        return 'western';
      }

      // EU postal codes (generally 4-5 digits)
      // Germany: 5 digits (01067-99998)
      if (!isNaN(pincodeNum) && pincodeClean.length === 5 && pincodeNum >= 1000 && pincodeNum <= 99999) {
        return 'western';
      }
      // France: 5 digits (01000-99999)
      if (pincodeClean.match(/^\d{5}$/)) {
        return 'western';
      }
    }

    // Check city for specific regions
    if (city) {
      const cityLower = city.toLowerCase();

      // Major Indian cities
      const indianCities = [
        'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata',
        'pune', 'ahmedabad', 'jaipur', 'surat', 'lucknow', 'kanpur', 'nagpur',
        'indore', 'thane', 'bhopal', 'visakhapatnam', 'pimpri', 'patna', 'vadodara',
        'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot',
        'kalyan', 'vasai', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar',
        'navi mumbai', 'allahabad', 'ranchi', 'howrah', 'coimbatore', 'jabalpur'
      ];

      if (indianCities.some(c => cityLower.includes(c) || c.includes(cityLower))) {
        return 'india';
      }

      // Major US cities
      const usCities = [
        'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
        'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
        'fort worth', 'columbus', 'charlotte', 'francisco', 'seattle', 'denver',
        'boston', 'washington', 'nashville', 'oklahoma', 'portland', 'las vegas',
        'detroit', 'memphis', 'louisville', 'baltimore', 'milwaukee', 'albuquerque'
      ];

      if (usCities.some(c => cityLower.includes(c) || c.includes(cityLower))) {
        return 'western';
      }

      // Major UK cities
      const ukCities = [
        'london', 'birmingham', 'manchester', 'glasgow', 'liverpool', 'leeds',
        'sheffield', 'edinburgh', 'bristol', 'cardiff', 'belfast', 'leicester',
        'nottingham', 'coventry', 'bradford', 'newcastle', 'brighton', 'southampton',
        'oxford', 'cambridge', 'aberdeen', 'plymouth', 'york', 'portsmouth',
        'reading', 'derby', 'wolverhampton', 'dundee', 'norwich', 'swansea'
      ];

      if (ukCities.some(c => cityLower.includes(c) || c.includes(cityLower))) {
        return 'western';
      }

      // Major EU cities
      const euCities = [
        // Germany
        'berlin', 'munich', 'hamburg', 'frankfurt', 'cologne', 'stuttgart', 'dusseldorf', 'dortmund', 'essen', 'leipzig',
        // France
        'paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'strasbourg', 'montpellier', 'bordeaux', 'lille',
        // Spain
        'madrid', 'barcelona', 'valencia', 'seville', 'zaragoza', 'malaga', 'bilbao', 'alicante', 'cordoba', 'granada',
        // Italy
        'rome', 'milan', 'naples', 'turin', 'florence', 'venice', 'bologna', 'verona', 'genoa', 'palermo',
        // Netherlands
        'amsterdam', 'rotterdam', 'utrecht', 'the hague', 'eindhoven', 'groningen', 'tilburg',
        // Belgium
        'brussels', 'antwerp', 'ghent', 'bruges', 'liege', 'charleroi',
        // Other EU capitals & major cities
        'vienna', 'prague', 'warsaw', 'budapest', 'lisbon', 'athens', 'stockholm', 'copenhagen',
        'oslo', 'helsinki', 'dublin', 'zurich', 'geneva', 'krakow', 'porto', 'valencia',
        'bucharest', 'sofia', 'bratislava', 'luxembourg', 'tallinn', 'riga', 'vilnius',
        // Australia & New Zealand (Western region)
        'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'auckland', 'wellington'
      ];

      if (euCities.some(c => cityLower.includes(c) || c.includes(cityLower))) {
        return 'western';
      }

      // Asian cities
      const asianCities = [
        'tokyo', 'beijing', 'shanghai', 'bangkok', 'hong kong', 'singapore',
        'seoul', 'taipei', 'kuala lumpur', 'jakarta', 'manila', 'ho chi minh',
        'osaka', 'guangzhou', 'shenzhen', 'hanoi'
      ];

      if (asianCities.some(c => cityLower.includes(c) || c.includes(cityLower))) {
        return 'asia';
      }

      // Middle Eastern cities
      const middleEastCities = [
        'dubai', 'abu dhabi', 'riyadh', 'doha', 'jeddah', 'kuwait',
        'muscat', 'manama', 'sharjah', 'mecca', 'medina', 'amman',
        'beirut', 'cairo', 'istanbul', 'baghdad', 'damascus'
      ];

      if (middleEastCities.some(c => cityLower.includes(c) || c.includes(cityLower))) {
        return 'middle-east';
      }
    }

    // Check state as fallback
    if (!state) {
      return 'global';
    }

    const stateLower = state.toLowerCase();

    // Indian states
    const indianStates = [
      'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh',
      'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka',
      'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
      'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu',
      'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal',
      'andaman and nicobar', 'chandigarh', 'dadra and nagar haveli', 'daman and diu',
      'delhi', 'lakshadweep', 'puducherry'
    ];

    if (indianStates.some(s => stateLower.includes(s) || s.includes(stateLower))) {
      return 'india';
    }

    // US states
    const usStates = [
      'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
      'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
      'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
      'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
      'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey',
      'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
      'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina',
      'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia',
      'washington', 'west virginia', 'wisconsin', 'wyoming'
    ];

    if (usStates.some(s => stateLower.includes(s) || s.includes(stateLower))) {
      return 'western';
    }

    // UK Counties and Regions
    const ukRegions = [
      // England
      'england', 'london', 'greater london', 'essex', 'kent', 'surrey', 'hampshire',
      'west midlands', 'greater manchester', 'west yorkshire', 'merseyside', 'south yorkshire',
      'tyne and wear', 'lancashire', 'berkshire', 'hertfordshire', 'buckinghamshire',
      'oxfordshire', 'cambridgeshire', 'suffolk', 'norfolk', 'cornwall', 'devon', 'somerset',
      'dorset', 'wiltshire', 'gloucestershire', 'worcestershire', 'warwickshire', 'staffordshire',
      'derbyshire', 'nottinghamshire', 'leicestershire', 'northamptonshire', 'lincolnshire',
      'east riding', 'north yorkshire', 'cumbria', 'northumberland', 'durham',
      // Scotland
      'scotland', 'lothian', 'strathclyde', 'grampian', 'highland', 'tayside', 'fife',
      // Wales
      'wales', 'glamorgan', 'gwent', 'dyfed', 'powys', 'gwynedd', 'clwyd',
      // Northern Ireland
      'northern ireland', 'antrim', 'down', 'armagh', 'londonderry', 'tyrone', 'fermanagh'
    ];

    if (ukRegions.some(s => stateLower.includes(s) || s.includes(stateLower))) {
      return 'western';
    }

    // EU Countries and Regions
    const euRegions = [
      'germany', 'france', 'italy', 'spain', 'netherlands', 'belgium', 'austria',
      'sweden', 'denmark', 'finland', 'portugal', 'greece', 'poland', 'czech',
      'romania', 'hungary', 'bulgaria', 'croatia', 'slovakia', 'slovenia',
      'lithuania', 'latvia', 'estonia', 'luxembourg', 'malta', 'cyprus',
      'ireland', 'switzerland', 'norway', 'iceland',
      // Australian States
      'new south wales', 'victoria', 'queensland', 'south australia',
      'western australia', 'tasmania', 'northern territory',
      // New Zealand Regions
      'auckland', 'wellington', 'canterbury', 'otago', 'waikato'
    ];

    if (euRegions.some(s => stateLower.includes(s) || s.includes(stateLower))) {
      return 'western';
    }

    // Asian countries/regions
    const asianRegions = [
      'china', 'japan', 'korea', 'thailand', 'vietnam', 'malaysia', 'singapore',
      'indonesia', 'philippines', 'taiwan', 'hong kong', 'macau'
    ];

    if (asianRegions.some(r => stateLower.includes(r) || r.includes(stateLower))) {
      return 'asia';
    }

    // Middle Eastern countries/regions
    const middleEastRegions = [
      'saudi', 'uae', 'dubai', 'qatar', 'kuwait', 'oman', 'bahrain',
      'jordan', 'lebanon', 'egypt', 'turkey'
    ];

    if (middleEastRegions.some(r => stateLower.includes(r) || r.includes(stateLower))) {
      return 'middle-east';
    }

    // Default to global
    return 'global';
  }

  /**
   * Get regional menu plugin based on market and restaurant type
   * Aligns with RestaurantType enum values from src/types/restaurantTypes.ts
   */
  private getRegionalMenuPlugin(region: string, restaurantType: string): string {
    // Map RestaurantType enum values to plugin names
    const MENU_VARIANTS: Record<string, Record<string, string>> = {
      'global': {
        'full-service': '@guanix/plugin-menu-management', // Backward compatible default
        'cafe-bakery': '@guanix/plugin-menu-cafe-bakery',
        'dark-kitchen': '@guanix/plugin-menu-dark-kitchen',
        'bar-lounge': '@guanix/plugin-menu-bar-lounge',
        'qsr-fast-food': '@guanix/plugin-menu-qsr-fast-food',
        'food-truck': '@guanix/plugin-menu-food-truck',
        'multi-brand': '@guanix/plugin-menu-management', // Uses full-service plugin
        'large-chain': '@guanix/plugin-menu-management', // Uses full-service plugin
      },
      'india': {
        'full-service': '@guanix/plugin-menu-indian', // Backward compatible Indian variant
        'cafe-bakery': '@guanix/plugin-menu-india-cafe-bakery',
        'dark-kitchen': '@guanix/plugin-menu-india-dark-kitchen',
        'bar-lounge': '@guanix/plugin-menu-india-bar-lounge',
        'qsr-fast-food': '@guanix/plugin-menu-india-qsr-fast-food',
        'food-truck': '@guanix/plugin-menu-india-food-truck',
        'multi-brand': '@guanix/plugin-menu-indian',
        'large-chain': '@guanix/plugin-menu-indian',
      },
      'asia': {
        'full-service': '@guanix/plugin-menu-asian',
        'cafe-bakery': '@guanix/plugin-menu-asia-cafe-bakery',
        'dark-kitchen': '@guanix/plugin-menu-asia-dark-kitchen',
        'bar-lounge': '@guanix/plugin-menu-asia-bar-lounge',
        'qsr-fast-food': '@guanix/plugin-menu-asia-qsr-fast-food',
        'food-truck': '@guanix/plugin-menu-asia-food-truck',
        'multi-brand': '@guanix/plugin-menu-asian',
        'large-chain': '@guanix/plugin-menu-asian',
      },
      'middle-east': {
        'full-service': '@guanix/plugin-menu-middle-east',
        'cafe-bakery': '@guanix/plugin-menu-middle-east-cafe-bakery',
        'dark-kitchen': '@guanix/plugin-menu-middle-east-dark-kitchen',
        'bar-lounge': '@guanix/plugin-menu-middle-east-bar-lounge',
        'qsr-fast-food': '@guanix/plugin-menu-middle-east-qsr-fast-food',
        'food-truck': '@guanix/plugin-menu-middle-east-food-truck',
        'multi-brand': '@guanix/plugin-menu-middle-east',
        'large-chain': '@guanix/plugin-menu-middle-east',
      },
      'western': {
        'full-service': '@guanix/plugin-menu-western',
        'cafe-bakery': '@guanix/plugin-menu-western-cafe-bakery',
        'dark-kitchen': '@guanix/plugin-menu-western-dark-kitchen',
        'bar-lounge': '@guanix/plugin-menu-western-bar-lounge',
        'qsr-fast-food': '@guanix/plugin-menu-western-qsr-fast-food',
        'food-truck': '@guanix/plugin-menu-western-food-truck',
        'multi-brand': '@guanix/plugin-menu-western',
        'large-chain': '@guanix/plugin-menu-western',
      },
    };

    const regionVariants = MENU_VARIANTS[region] || MENU_VARIANTS['global'];
    return regionVariants[restaurantType] || regionVariants['full-service'];
  }

  /**
   * Check if existing installation needs plugin migration
   * Returns true if core features are in base but should be plugins
   */
  async needsPluginMigration(): Promise<boolean> {
    if (!this.db) {
      throw new Error('Plugin manager not initialized');
    }

    // Check if menu tables exist in base (not from plugin)
    const menuInstalled = await this.getInstalled('@guanix/plugin-menu-management');
    if (menuInstalled) {
      return false; // Already migrated
    }

    // Check if menu_items table exists (indicates monolithic install)
    try {
      const result = await this.db.select(
        'SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="menu_items"'
      );
      return result[0]?.count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Clean up expired snapshots (Manifest v2)
   */
  private async cleanupExpiredSnapshots(): Promise<void> {
    if (!this.db) return;

    const result = await this.db.execute(
      `DELETE FROM plugin_snapshots WHERE datetime(expires_at) <= datetime('now')`
    ) as { rowsAffected?: number };

    console.log(`Cleaned up expired snapshots: ${result?.rowsAffected || 0} deleted`);
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
