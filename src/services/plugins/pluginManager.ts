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
        const rows = await this.db.select(`SELECT * FROM ${table}`) as any[];
        data[table] = rows;
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
    behavior: 'archive' | 'export' | 'delete'
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
          const rows = await this.db.select(`SELECT * FROM ${table}`) as any[];
          data[table] = rows;
        }

        // TODO: Save to file system (use Tauri save dialog)
        console.log(`Plugin data exported for ${pluginId}:`, data);
        break;

      case 'delete':
        // Permanently delete data
        for (const table of manifest.data.tables) {
          await this.db.execute(`DELETE FROM ${table} WHERE 1=1`);
        }
        console.log(`Plugin data deleted for ${pluginId}`);
        break;
    }
  }

  /**
   * Clean up expired snapshots (Manifest v2)
   */
  private async cleanupExpiredSnapshots(): Promise<void> {
    if (!this.db) return;

    const result = await this.db.execute(
      `DELETE FROM plugin_snapshots WHERE datetime(expires_at) <= datetime('now')`
    );

    console.log(`Cleaned up expired snapshots: ${result.rowsAffected || 0} deleted`);
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
