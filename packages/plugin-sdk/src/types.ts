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
  };

  // Backend plugin details
  backend?: {
    wasm: string;  // Path to worker WASM file
    entry_point: string;  // WASM function to call on load
    endpoints?: PluginEndpoint[];
    event_handlers?: PluginEventHandler[];
    durable_objects?: PluginDurableObject[];
  };

  // Dependencies
  dependencies?: PluginDependency[];

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
 * Plugin dependency
 */
export interface PluginDependency {
  plugin_id: string;
  version: string;  // SemVer range
  optional?: boolean;
}

/**
 * Plugin metadata (stored in registry)
 */
export interface PluginMetadata extends PluginManifest {
  // Registry-specific fields
  download_count: number;
  rating: number;
  reviews_count: number;
  tags: string[];
  screenshots?: string[];
  readme?: string;
  changelog?: string;
}

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
  };

  // Storage
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };

  // HTTP (with allowed origins)
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Plugin manager interface
 */
export interface IPluginManager {
  // Discovery
  listAvailable(): Promise<PluginMetadata[]>;
  listInstalled(): Promise<InstalledPlugin[]>;
  searchPlugins(query: string, tags?: string[]): Promise<PluginMetadata[]>;

  // Installation
  install(pluginId: string, version?: string): Promise<void>;
  uninstall(pluginId: string): Promise<void>;
  update(pluginId: string, version?: string): Promise<void>;

  // Lifecycle
  enable(pluginId: string): Promise<void>;
  disable(pluginId: string): Promise<void>;
  reload(pluginId: string): Promise<void>;

  // Info
  getInfo(pluginId: string): Promise<PluginMetadata | null>;
  getInstalled(pluginId: string): Promise<InstalledPlugin | null>;
  checkUpdates(): Promise<Array<{ pluginId: string; currentVersion: string; latestVersion: string }>>;

  // WASM loading (client-side)
  loadWasm(pluginId: string): Promise<WebAssembly.Instance>;
  getCachedWasm(pluginId: string): Promise<ArrayBuffer | null>;
  preloadWasm(pluginIds: string[]): Promise<void>;
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
