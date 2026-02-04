/**
 * @handsfree/plugin-sdk/types
 *
 * Complete type definitions for plugin development
 */

export type PluginType = 'client' | 'worker' | 'hybrid';
export type PluginVisibility = 'public' | 'private' | 'tenant-specific';

/**
 * Plugin Manifest - Metadata for a plugin
 */
export interface PluginManifest {
  // Basic metadata
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  icon?: string;

  // Plugin type
  type: PluginType;
  visibility: PluginVisibility;

  // Tenant restrictions
  tenant_whitelist?: string[];  // Empty = all tenants

  // Target platforms
  target: {
    client: boolean;
    worker: boolean;
  };

  // Version requirements
  requires_app_version: string;  // SemVer range (e.g., ">=3.0.0")
  requires_worker_version?: string;

  // Permissions
  requires_permissions: string[];

  // Frontend plugin details
  frontend?: {
    wasm: string;  // Path to client WASM file
    entry_point: string;  // WASM function to call on load
    routes?: PluginRoute[];
    menu_items?: PluginMenuItem[];
    components?: Record<string, string>;  // Component name → export name
    hub_card?: PluginHubCard;  // Dashboard card for hub page
  };

  // Backend plugin details
  backend?: {
    wasm: string;  // Path to worker WASM file
    entry_point: string;  // WASM function to call on load
    endpoints?: PluginEndpoint[];
    event_handlers?: PluginEventHandler[];
    durable_objects?: PluginDurableObject[];
  };

  // Dependencies (Manifest v2)
  dependencies?: PluginDependency[];

  // Compatibility matrix (Manifest v2)
  compatibility?: {
    min_app_version: string;  // SemVer
    max_app_version?: string;  // SemVer
    min_worker_version?: string;
    max_worker_version?: string;
    platforms?: Array<'desktop' | 'web' | 'mobile' | 'android' | 'ios'>;
  };

  // Data handling (Manifest v2)
  data?: {
    tables?: string[];  // DB tables created by plugin
    storage_keys?: string[];  // Storage keys used
    uninstall_behavior: 'archive' | 'export' | 'delete';  // What to do with data on uninstall
    export_format?: 'json' | 'csv' | 'sql';
    migration_path?: string;  // Path to migration files in R2
  };

  // Analytics opt-in (Manifest v2)
  analytics?: {
    enabled: boolean;
    endpoint?: string;
    events?: string[];  // Events to track (e.g., "feature_used", "error_occurred")
  };

  // Lifecycle hooks (Manifest v2)
  lifecycle?: {
    onPermissionRevoked?: string;  // WASM function name
    onUpdate?: string;  // Called before update
    onUninstall?: string;  // Called before uninstall
  };

  // Theme support (Manifest v2)
  theme_aware?: boolean;  // Does plugin support dark/light mode?

  // Security
  checksum: string;  // SHA-256 of WASM files
  signature?: string;  // Developer signature

  // Timestamps
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}

/**
 * Frontend plugin route
 */
export interface PluginRoute {
  path: string;  // e.g., "/loyalty"
  component: string;  // Component name from WASM
  title?: string;
  icon?: string;
  protected?: boolean;  // Requires authentication
}

/**
 * Frontend plugin menu item
 */
export interface PluginMenuItem {
  label: string;
  icon?: string;
  path: string;
  order?: number;  // Display order in menu
  parent?: string;  // Parent menu item ID
}

/**
 * Hub dashboard card for plugin
 */
export interface PluginHubCard {
  title: string;
  description: string;
  icon: string;  // Lucide icon name or emoji
  path: string;  // Route to navigate to
  accent_color: 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'cyan' | 'amber';
  roles?: string[];  // User roles that can see this card (empty = all roles)
  show_stats?: boolean;  // Whether to show dynamic stats
  stats_endpoint?: string;  // API endpoint to fetch stats from
  badge_endpoint?: string;  // API endpoint to fetch badge count
  urgent_endpoint?: string;  // API endpoint to check if urgent
  order?: number;  // Display order (lower = earlier)
}

/**
 * Backend plugin endpoint
 */
export interface PluginEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;  // e.g., "/api/loyalty/points"
  handler: string;  // WASM function name
  auth_required?: boolean;
}

/**
 * Backend plugin event handler
 */
export interface PluginEventHandler {
  event: string;  // e.g., "order.completed"
  handler: string;  // WASM function name
}

/**
 * Backend plugin Durable Object
 */
export interface PluginDurableObject {
  name: string;
  class_name: string;
  script_name?: string;
}

/**
 * Plugin dependency (Manifest v2)
 */
export interface PluginDependency {
  plugin_id: string;
  version: string;  // SemVer range (e.g., "^1.2.0", ">=2.0.0 <3.0.0")
  optional?: boolean;
  fallback_behavior?: string;  // What happens if dependency missing (e.g., "disable-feature", "show-warning")
}

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
  plugin_id: string;
  requested_version: string;
  resolved_version: string;
  source: 'installed' | 'registry';
  conflicts?: DependencyConflict[];
}

/**
 * Dependency conflict
 */
export interface DependencyConflict {
  plugin_id: string;
  required_by: string[];
  conflicting_versions: { plugin: string; version: string }[];
  resolution?: 'use-highest' | 'use-lowest' | 'manual';
}

/**
 * Plugin metadata (stored in registry)
 */
export interface PluginMetadata extends PluginManifest {
  // Registry-specific fields
  download_count: number;
  rating: number;  // Average rating (1-5)
  reviews_count: number;
  tags: string[];
  category?: string;  // Primary category (e.g., "Analytics", "Integrations", "Operations")
  screenshots?: string[];
  readme?: string;
  changelog?: string;

  // Trust signals (Manifest v2)
  verified?: boolean;  // Verified by HandsFree
  featured?: boolean;  // Featured plugin
  install_count?: number;  // Total installations
  active_installations?: number;  // Currently active
}

/**
 * Plugin review (Manifest v2)
 */
export interface PluginReview {
  id: string;
  plugin_id: string;
  tenant_id: string;
  rating: number;  // 1-5 stars
  comment?: string;
  created_at: string;
  updated_at?: string;

  // Metadata
  app_version?: string;
  plugin_version: string;
  helpful_count?: number;  // How many found this helpful
}

/**
 * Plugin category (Manifest v2)
 */
export type PluginCategory =
  | 'Analytics'
  | 'Integrations'
  | 'Operations'
  | 'Payments'
  | 'Marketing'
  | 'Inventory'
  | 'Staff'
  | 'Reporting'
  | 'Other';

/**
 * Installed plugin info (local to app)
 */
export interface InstalledPlugin {
  manifest: PluginManifest;
  installed_at: string;
  enabled: boolean;
  cached: boolean;  // Whether WASM is cached locally
  cache_size?: number;  // Bytes
  last_used?: string;

  // Rollback support (Manifest v2)
  has_snapshot?: boolean;  // Whether rollback snapshot exists
  snapshot_expires_at?: string;  // When snapshot is deleted (30 days)
  previous_version?: string;  // Version before last update
}

/**
 * Plugin snapshot for rollback (Manifest v2)
 */
export interface PluginSnapshot {
  plugin_id: string;
  manifest: PluginManifest;
  wasm_bytes: ArrayBuffer;
  data_backup?: string;  // JSON string of plugin data
  created_at: string;
  expires_at: string;  // 30 days from creation
  snapshot_reason: 'uninstall' | 'update' | 'manual';
}

/**
 * Offline plugin bundle (.hfpb format) (Manifest v2)
 */
export interface OfflinePluginBundle {
  version: '1.0';
  plugin_id: string;
  manifest: PluginManifest;
  client_wasm?: ArrayBuffer;
  worker_wasm?: ArrayBuffer;
  dependencies: OfflinePluginBundle[];  // Bundled dependencies
  checksum: string;
  created_at: string;
}

/**
 * Plugin registry entry (KV storage)
 */
export interface PluginRegistryEntry {
  manifest: PluginManifest;

  // File URLs
  client_wasm_url?: string;
  worker_wasm_url?: string;
  assets_url?: string;

  // Registry metadata
  published_at: string;
  updated_at: string;
  publisher: string;
  verified: boolean;

  // Stats
  download_count: number;
  active_installations: number;
}

/**
 * Tenant-specific plugin override
 */
export interface TenantPluginOverride {
  tenant_id: string;
  plugin_id: string;

  // Custom version or configuration
  override_version?: string;
  override_config?: Record<string, unknown>;

  // Custom WASM files
  custom_client_wasm_url?: string;
  custom_worker_wasm_url?: string;

  created_at: string;
  updated_at: string;
}

/**
 * Plugin permissions
 */
export type PluginPermission =
  | `database.read.${string}`
  | `database.write.${string}`
  | `ui.mount.${string}`
  | `events.subscribe.${string}`
  | `events.emit.${string}`
  | `network.fetch.${string}`
  | `storage.${string}`
  | `files.read.${string}`
  | `files.write.${string}`;

/**
 * Plugin host API interface
 * This is exposed to WASM plugins via imports
 */
export interface PluginHostAPI {
  // Database operations (permission-gated)
  db: {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
  };

  // State management
  store: {
    getState<T = unknown>(storeName: string): T;
    subscribe<T = unknown>(
      storeName: string,
      selector: (state: T) => unknown,
      callback: (value: unknown) => void
    ): () => void;
  };

  // Event bus
  events: {
    on(event: string, handler: (data: unknown) => void): () => void;
    emit(event: string, data: unknown): void;
  };

  // UI registration
  ui: {
    registerRoute(path: string, component: unknown): void;
    registerMenuItem(item: PluginMenuItem): void;
    showNotification(message: string, type?: 'info' | 'success' | 'error'): void;
    getTheme(): 'light' | 'dark';  // Manifest v2: Theme support
  };

  // Storage
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
    export(): Promise<Record<string, unknown>>;  // Manifest v2: Export all plugin data
  };

  // HTTP (with allowed origins)
  fetch(url: string, options?: RequestInit): Promise<Response>;

  // Permission management (Manifest v2)
  permissions: {
    has(permission: string): boolean;
    request(permission: string): Promise<boolean>;
    onRevoked(permission: string, handler: () => void): () => void;  // Lifecycle hook
  };

  // Analytics (Manifest v2)
  analytics?: {
    track(event: string, properties?: Record<string, unknown>): Promise<void>;
    error(error: Error, context?: Record<string, unknown>): Promise<void>;
  };
}

/**
 * Plugin manager interface
 */
export interface IPluginManager {
  // Discovery
  listAvailable(): Promise<PluginMetadata[]>;
  listInstalled(): Promise<InstalledPlugin[]>;
  searchPlugins(query: string, filters?: PluginSearchFilters): Promise<PluginMetadata[]>;

  // Installation
  install(pluginId: string, version?: string): Promise<void>;
  uninstall(pluginId: string, options?: UninstallOptions): Promise<void>;
  update(pluginId: string, version?: string): Promise<void>;

  // Lifecycle
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  reload(pluginId: string): Promise<void>;

  // Info
  getInfo(pluginId: string): Promise<PluginMetadata | null>;
  getInstalled(pluginId: string): Promise<InstalledPlugin | null>;
  checkUpdates(options?: { offline?: boolean }): Promise<Array<{ pluginId: string; currentVersion: string; latestVersion: string }>>;

  // WASM loading (client-side)
  loadWasm(pluginId: string): Promise<WebAssembly.Instance>;
  getCachedWasm(pluginId: string): Promise<ArrayBuffer | null>;
  preloadWasm(pluginIds: string[]): Promise<void>;

  // Dependency management (Manifest v2)
  resolveDependencies(pluginId: string): Promise<DependencyResolution[]>;
  checkDependencyConflicts(pluginId: string): Promise<DependencyConflict[]>;

  // Rollback support (Manifest v2)
  createSnapshot(pluginId: string, reason: 'uninstall' | 'update' | 'manual'): Promise<void>;
  rollback(pluginId: string): Promise<void>;
  listSnapshots(pluginId: string): Promise<PluginSnapshot[]>;
  deleteSnapshot(pluginId: string, snapshotId: string): Promise<void>;

  // Offline updates (Manifest v2)
  installFromFile(filePath: string): Promise<void>;
  exportPlugin(pluginId: string, outputPath: string): Promise<void>;

  // Reviews & ratings (Manifest v2)
  submitReview(pluginId: string, rating: number, comment?: string): Promise<void>;
  getReviews(pluginId: string, limit?: number): Promise<PluginReview[]>;

  // Permission management (Manifest v2)
  revokePermission(pluginId: string, permission: string): Promise<void>;
  requestPermission(pluginId: string, permission: string): Promise<boolean>;
}

/**
 * Plugin search filters (Manifest v2)
 */
export interface PluginSearchFilters {
  tags?: string[];
  category?: PluginCategory;
  verified?: boolean;
  minRating?: number;
  sortBy?: 'rating' | 'downloads' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Uninstall options (Manifest v2)
 */
export interface UninstallOptions {
  dataHandling?: 'archive' | 'export' | 'delete' | 'delete_all';  // Override plugin manifest default
  createSnapshot?: boolean;  // Default true
  force?: boolean;  // Skip confirmation dialogs
}

/**
 * Plugin resolution result
 */
export interface PluginResolution {
  source: 'tenant-override' | 'tenant-custom' | 'global';
  manifest: PluginManifest;
  client_wasm_url?: string;
  worker_wasm_url?: string;
  assets_url?: string;
}

/**
 * Plugin loading state
 */
export type PluginLoadingState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Plugin error types
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public pluginId: string,
    public code: PluginErrorCode
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export enum PluginErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  LOAD_FAILED = 'LOAD_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
}

/**
 * Plugin development utilities
 */
export interface PluginContext {
  pluginId: string;
  tenantId: string;
  version: string;
  manifest: PluginManifest;
}

/**
 * Client plugin interface
 * Plugins must implement this interface
 */
export interface ClientPlugin {
  /**
   * Initialize the plugin
   * Called when plugin is loaded
   */
  init(context: PluginContext, host: PluginHostAPI): Promise<void>;

  /**
   * Cleanup when plugin is unloaded
   */
  destroy?(): Promise<void>;

  /**
   * Called when plugin is enabled
   */
  onEnable?(): Promise<void>;

  /**
   * Called when plugin is disabled
   */
  onDisable?(): Promise<void>;
}

/**
 * Worker plugin interface
 */
export interface WorkerPlugin {
  /**
   * Initialize the worker plugin
   */
  init(context: PluginContext): Promise<void>;

  /**
   * Handle HTTP request
   */
  fetch?(request: Request): Promise<Response>;

  /**
   * Handle scheduled event
   */
  scheduled?(controller: ScheduledController): Promise<void>;

  /**
   * Cleanup
   */
  destroy?(): Promise<void>;
}
