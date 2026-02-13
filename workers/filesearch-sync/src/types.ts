/**
 * Type definitions for FileSearch Sync Worker
 */

export interface Env {
  // Bindings
  TENANT_METADATA: KVNamespace;

  // Service bindings to fetch menu from tenant workers
  TENANT_DISPATCH: Fetcher;

  // Environment variables
  BACKEND_URL: string;
  GEMINI_API_KEY?: string;
  ENVIRONMENT?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category: string;
  category_id?: string;
  is_vegetarian?: number;
  is_vegan?: number;
  is_gluten_free?: number;
  is_dairy_free?: number;
  spice_level?: string;
  allergens?: string;
  tags?: string;
  preparation_time?: number;
  image_url?: string;
  available?: number;
  display_order?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  display_order: number;
}

export interface MenuData {
  items: MenuItem[];
  categories: MenuCategory[];
}

export interface SyncStatus {
  inSync: boolean;
  lastSyncTime: string | null;
  d1ItemCount: number;
  fileSearchItemCount: number | null;
  errors: string[];
  needsSync: boolean;
  tenantId: string;
}

export interface SyncResult {
  success: boolean;
  itemCount: number;
  storeName: string;
  syncTime: string;
  errors?: string[];
}

export interface FileSearchUploadResponse {
  storeName: string;
  filename?: string;
  size?: number;
}
