/**
 * Plugin Registry Service
 *
 * Manages plugin discovery, updates, and version checking against R2 storage.
 */

import Database from '@tauri-apps/plugin-sql';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  type: string;
  category: string;
  tags: string[];
  verified: boolean;
  featured: boolean;
  rating: number;
  changelog?: string;
  migration?: {
    from: string[];
    automatic: boolean;
    requires_restart: boolean;
  };
  requires_permissions: string[];
  dependencies: string[];
  checksum: string;
  created_at: string;
  updated_at: string;
}

export interface InstalledPlugin {
  plugin_id: string;
  manifest: string; // JSON string of PluginManifest
  enabled: number; // 1 or 0
  installed_at: string;
}

export interface PluginUpdate {
  id: string;
  name: string;
  currentVersion: string;
  latestVersion: string;
  changelog?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  breaking_changes?: boolean;
  security_patch?: boolean;
}

// Use the Cloudflare Worker as a proxy to R2 (production-ready approach)
const R2_BASE_URL = 'https://handsfree-plugin-registry.suyesh.workers.dev';

/**
 * Fetch plugin manifest from R2 storage
 */
export async function fetchPluginManifest(
  pluginId: string,
  version: 'latest' | string = 'latest'
): Promise<PluginManifest> {
  const url = `${R2_BASE_URL}/global/plugins/${pluginId}/${version}/manifest.json`;

  console.log(`[PluginRegistry] Fetching manifest: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Plugin ${pluginId} not found (${response.status})`);
  }

  return response.json();
}

/**
 * Get all installed plugins
 */
export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  try {
    const db = await Database.load('sqlite:handsfree.db');

    const plugins = await db.select<InstalledPlugin[]>(
      `SELECT plugin_id, manifest, enabled, installed_at
       FROM plugin_metadata
       ORDER BY installed_at DESC`
    );

    return plugins;
  } catch (error) {
    console.error('[PluginRegistry] Failed to get installed plugins:', error);
    return [];
  }
}

/**
 * Check for updates for all installed plugins
 */
export async function checkForUpdates(): Promise<PluginUpdate[]> {
  console.log('[PluginRegistry] Checking for plugin updates...');

  const installed = await getInstalledPlugins();
  const updates: PluginUpdate[] = [];

  for (const plugin of installed) {
    try {
      // Parse the manifest JSON string
      const currentManifest = JSON.parse(plugin.manifest) as PluginManifest;
      const latest = await fetchPluginManifest(plugin.plugin_id, 'latest');

      const comparison = compareVersions(latest.version, currentManifest.version);

      if (comparison > 0) {
        console.log(`[PluginRegistry] Update available: ${plugin.plugin_id} ${currentManifest.version} → ${latest.version}`);

        updates.push({
          id: plugin.plugin_id,
          name: currentManifest.name,
          currentVersion: currentManifest.version,
          latestVersion: latest.version,
          changelog: latest.changelog,
          urgency: determineUrgency(latest, comparison),
          breaking_changes: latest.migration?.requires_restart || false,
          security_patch: false, // TODO: Add security_patch field to manifest
        });
      }
    } catch (error) {
      console.error(`[PluginRegistry] Failed to check updates for ${plugin.plugin_id}:`, error);
    }
  }

  console.log(`[PluginRegistry] Found ${updates.length} updates`);
  return updates;
}

/**
 * Compare semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Determine update urgency based on version jump and manifest flags
 */
function determineUrgency(
  manifest: PluginManifest,
  versionJump: number
): 'low' | 'medium' | 'high' | 'critical' {
  // Critical: Security patches (if we add this field)
  // if (manifest.security_patch) return 'critical';

  // High: Breaking changes or migration required
  if (manifest.migration?.requires_restart) return 'high';

  // Medium: Minor version bump (1.0.0 → 1.1.0)
  if (versionJump === 1) return 'medium';

  // Low: Patch version bump (1.0.0 → 1.0.1)
  return 'low';
}

/**
 * Update a plugin to latest version
 */
export async function updatePlugin(pluginId: string): Promise<void> {
  console.log(`[PluginRegistry] Updating plugin: ${pluginId}`);

  const db = await Database.load('sqlite:handsfree.db');

  // Fetch latest manifest
  const latestManifest = await fetchPluginManifest(pluginId, 'latest');

  // Get current manifest
  const current = await db.select<Array<{ manifest: string }>>(
    `SELECT manifest FROM plugin_metadata WHERE plugin_id = ?`,
    [pluginId]
  );

  if (current.length === 0) {
    throw new Error(`Plugin ${pluginId} not installed`);
  }

  const currentManifest = JSON.parse(current[0].manifest) as PluginManifest;

  // Check if migration needed
  if (latestManifest.migration?.from.includes(currentManifest.version)) {
    console.log(`[PluginRegistry] Migration available from ${currentManifest.version} to ${latestManifest.version}`);

    if (latestManifest.migration.automatic) {
      // TODO: Run migration script
      console.log('[PluginRegistry] Running automatic migration...');
    } else {
      console.warn('[PluginRegistry] Manual migration required');
    }
  }

  // Update plugin_metadata table with new manifest
  await db.execute(
    `UPDATE plugin_metadata
     SET manifest = ?, previous_version = ?
     WHERE plugin_id = ?`,
    [JSON.stringify(latestManifest), currentManifest.version, pluginId]
  );

  console.log(`[PluginRegistry] ✅ Updated ${pluginId} to v${latestManifest.version}`);
}

/**
 * Install a plugin from R2
 */
export async function installPlugin(pluginId: string): Promise<void> {
  console.log(`[PluginRegistry] Installing plugin: ${pluginId}`);

  const db = await Database.load('sqlite:handsfree.db');

  // Fetch latest manifest
  const manifest = await fetchPluginManifest(pluginId, 'latest');

  // Check if already installed
  const existing = await db.select<Array<{ plugin_id: string }>>(
    `SELECT plugin_id FROM plugin_installed WHERE plugin_id = ?`,
    [pluginId]
  );

  if (existing.length > 0) {
    throw new Error(`Plugin ${pluginId} is already installed`);
  }

  // Check dependencies
  for (const dep of manifest.dependencies) {
    const [depId] = dep.split('@');
    const depInstalled = await db.select<Array<{ plugin_id: string }>>(
      `SELECT plugin_id FROM plugin_installed WHERE plugin_id = ?`,
      [depId]
    );

    if (depInstalled.length === 0) {
      throw new Error(`Missing dependency: ${depId}`);
    }
  }

  // Insert into plugin_installed
  const now = Math.floor(Date.now() / 1000);

  await db.execute(
    `INSERT INTO plugin_installed (plugin_id, name, version, enabled, installed_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    [pluginId, manifest.name, manifest.version, now, now]
  );

  console.log(`[PluginRegistry] ✅ Installed ${pluginId} v${manifest.version}`);
}

/**
 * Uninstall a plugin
 */
export async function uninstallPlugin(pluginId: string): Promise<void> {
  console.log(`[PluginRegistry] Uninstalling plugin: ${pluginId}`);

  const db = await Database.load('sqlite:handsfree.db');

  // Check if other plugins depend on this
  const installed = await getInstalledPlugins();

  for (const plugin of installed) {
    if (plugin.plugin_id === pluginId) continue;

    try {
      const manifest = await fetchPluginManifest(plugin.plugin_id, 'latest');
      const dependencies = manifest.dependencies.map(d => d.split('@')[0]);

      if (dependencies.includes(pluginId)) {
        throw new Error(`Cannot uninstall: ${plugin.plugin_id} depends on this plugin`);
      }
    } catch (error) {
      console.warn(`[PluginRegistry] Could not check dependencies for ${plugin.plugin_id}`);
    }
  }

  // Remove from plugin_installed
  await db.execute(
    `DELETE FROM plugin_installed WHERE plugin_id = ?`,
    [pluginId]
  );

  console.log(`[PluginRegistry] ✅ Uninstalled ${pluginId}`);
}

/**
 * Enable/disable a plugin
 */
export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
  const db = await Database.load('sqlite:handsfree.db');

  await db.execute(
    `UPDATE plugin_installed SET enabled = ? WHERE plugin_id = ?`,
    [enabled ? 1 : 0, pluginId]
  );

  console.log(`[PluginRegistry] ${enabled ? 'Enabled' : 'Disabled'} ${pluginId}`);
}

/**
 * Get plugin statistics
 */
export async function getPluginStats(): Promise<{
  total: number;
  enabled: number;
  disabled: number;
  updates_available: number;
}> {
  const installed = await getInstalledPlugins();
  const updates = await checkForUpdates();

  return {
    total: installed.length,
    enabled: installed.filter(p => p.enabled).length,
    disabled: installed.filter(p => !p.enabled).length,
    updates_available: updates.length,
  };
}
