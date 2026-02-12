import { create } from "zustand";
import { MenuItem, MenuCategory, ComboGroup, ComboGroupItem, DineInPricingOverride } from "../types";
import { getCurrentPlatform } from "../lib/platform";
// import { backendApi } from "../lib/backendApi"; // Commented out - cloud sync not implemented yet
import Database from "@tauri-apps/plugin-sql";
import { dineInPricingService } from "../lib/dineInPricingService";

// Determine database name based on environment
const DB_NAME = import.meta.env.DEV ? "sqlite:pos-dev.db" : "sqlite:guanix.db";

interface MenuStore {
  categories: MenuCategory[];
  items: MenuItem[];
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSyncedAt: string | null;

  // Dine-in pricing overrides
  dineInOverrides: Map<string, DineInPricingOverride>;
  dineInOverridesLoaded: boolean;

  // Actions
  setCategories: (categories: MenuCategory[]) => void;
  setItems: (items: MenuItem[]) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // API Actions
  loadMenuFromAPI: (tenantId: string) => Promise<void>;
  loadMenuFromDatabase: () => Promise<void>;
  refreshMenu: (tenantId: string) => Promise<void>;

  // Cloud Sync Actions
  syncFromCloud: (tenantId: string) => Promise<void>;
  syncToCloud: (tenantId: string) => Promise<void>;

  // Dine-in pricing actions
  loadDineInOverrides: (tenantId: string) => Promise<void>;
  saveDineInOverride: (tenantId: string, menuItemId: string, price: number | null, available: boolean) => Promise<void>;
  deleteDineInOverride: (tenantId: string, menuItemId: string) => Promise<void>;
  resetAllDineInOverrides: (tenantId: string) => Promise<number>;
  getDineInOverride: (menuItemId: string) => DineInPricingOverride | undefined;
  getEffectivePrice: (menuItemId: string, isDineIn: boolean) => number;
  isDineInAvailable: (menuItemId: string) => boolean;

  // Computed
  getFilteredItems: () => MenuItem[];
  getCategoryById: (id: string) => MenuCategory | undefined;
}

export const useMenuStore = create<MenuStore>((set, get) => ({
  categories: [],
  items: [],
  selectedCategory: null,
  searchQuery: "",
  isLoading: false,
  isSyncing: false,
  error: null,
  lastSyncedAt: null,

  // Dine-in pricing state
  dineInOverrides: new Map(),
  dineInOverridesLoaded: false,

  setCategories: (categories: MenuCategory[]) => set({ categories }),
  setItems: (items: MenuItem[]) => set({ items }),
  setSelectedCategory: (categoryId: string | null) =>
    set({ selectedCategory: categoryId }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),

  // Load menu from backend API (DEPRECATED - POS is the source of truth)
  // The POS should always load from its local SQLite database
  // Menu is synced TO cloud, not FROM cloud
  loadMenuFromAPI: async (_tenantId: string) => {
    console.log('[MenuStore] loadMenuFromAPI deprecated - POS loads menu from local SQLite only');
    console.log('[MenuStore] Use loadMenuFromDatabase() instead');
    return;
  },

  // Load menu from SQLite database (for Tauri platform)
  loadMenuFromDatabase: async () => {
    const platform = getCurrentPlatform();

    // Only use database on Tauri platform
    if (platform !== 'tauri') {
      console.log('[MenuStore] Not on Tauri platform, skipping database load');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      console.log('[MenuStore] Loading menu from SQLite database');

      const db = await Database.load(DB_NAME);

      // Create combo tables if they don't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS menu_combo_groups (
          id TEXT PRIMARY KEY,
          menu_item_id TEXT NOT NULL,
          name TEXT NOT NULL,
          required INTEGER DEFAULT 1,
          min_selections INTEGER DEFAULT 1,
          max_selections INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS menu_combo_group_items (
          id TEXT PRIMARY KEY,
          combo_group_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          image TEXT,
          price_adjustment REAL DEFAULT 0,
          available INTEGER DEFAULT 1,
          tags TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (combo_group_id) REFERENCES menu_combo_groups(id) ON DELETE CASCADE
        )
      `);

      // Add is_combo column to menu_items if it doesn't exist
      try {
        await db.execute(`ALTER TABLE menu_items ADD COLUMN is_combo INTEGER DEFAULT 0`);
      } catch {
        // Column might already exist, ignore error
      }

      // Load categories
      const categoryRows = await db.select<Array<{
        id: string;
        name: string;
        sort_order: number;
        icon: string | null;
        active: number;
      }>>("SELECT * FROM menu_categories WHERE active = 1 ORDER BY sort_order");

      const categories: MenuCategory[] = categoryRows.map((row) => ({
        id: row.id,
        name: row.name,
        sort_order: row.sort_order,
        icon: row.icon || "utensils",
        active: row.active === 1,
      }));

      // Load menu items (removed active filter to load all items)
      const itemRows = await db.select<Array<{
        id: string;
        category_id: string;
        name: string;
        description: string;
        price: number;
        image: string | null;
        active: number;
        preparation_time: number;
        allergens: string;
        dietary_tags: string;
        is_combo: number | null;
      }>>("SELECT * FROM menu_items");

      // Load combo groups
      const comboGroupRows = await db.select<Array<{
        id: string;
        menu_item_id: string;
        name: string;
        required: number;
        min_selections: number;
        max_selections: number;
        sort_order: number;
      }>>("SELECT * FROM menu_combo_groups ORDER BY sort_order");

      // Load combo group items
      const comboGroupItemRows = await db.select<Array<{
        id: string;
        combo_group_id: string;
        name: string;
        description: string | null;
        image: string | null;
        price_adjustment: number;
        available: number;
        tags: string | null;
        sort_order: number;
      }>>("SELECT * FROM menu_combo_group_items ORDER BY sort_order");

      // Build combo groups map for each menu item
      const comboGroupsMap = new Map<string, ComboGroup[]>();
      comboGroupRows.forEach((groupRow) => {
        const groupItems: ComboGroupItem[] = comboGroupItemRows
          .filter((itemRow) => itemRow.combo_group_id === groupRow.id)
          .map((itemRow) => ({
            id: itemRow.id,
            name: itemRow.name,
            description: itemRow.description || undefined,
            image: itemRow.image || undefined,
            price_adjustment: itemRow.price_adjustment,
            available: itemRow.available === 1,
            tags: itemRow.tags ? JSON.parse(itemRow.tags) : undefined,
          }));

        const comboGroup: ComboGroup = {
          id: groupRow.id,
          name: groupRow.name,
          required: groupRow.required === 1,
          min_selections: groupRow.min_selections,
          max_selections: groupRow.max_selections,
          items: groupItems,
        };

        const existing = comboGroupsMap.get(groupRow.menu_item_id) || [];
        existing.push(comboGroup);
        comboGroupsMap.set(groupRow.menu_item_id, existing);
      });

      const items: MenuItem[] = itemRows.map((row) => {
        const allergens = row.allergens ? JSON.parse(row.allergens) : [];
        const dietaryTags = row.dietary_tags ? JSON.parse(row.dietary_tags) : [];
        const comboGroups = comboGroupsMap.get(row.id);

        return {
          id: row.id,
          category_id: row.category_id,
          name: row.name,
          description: row.description,
          price: row.price,
          image: row.image || undefined,
          imageUrl: row.image || undefined,
          active: row.active === 1,
          preparation_time: row.preparation_time,
          allergens,
          dietary_tags: dietaryTags,
          spice_level: 0,
          is_veg: dietaryTags.includes('vegetarian'),
          is_vegan: dietaryTags.includes('vegan'),
          available: row.active === 1,
          variants: [],
          addons: [],
          is_popular: dietaryTags.includes('popular'),
          // Combo support - use camelCase for POS compatibility
          isCombo: row.is_combo === 1 || (comboGroups && comboGroups.length > 0),
          comboGroups: comboGroups,
        };
      });

      set({
        items,
        categories,
        isLoading: false,
        error: null,
      });

      console.log(`[MenuStore] Loaded ${items.length} items, ${categories.length} categories from database`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load menu from database';

      // Silently handle "table doesn't exist" errors (plugin not installed yet)
      if (String(error).includes('no such table')) {
        console.log('[MenuStore] ℹ️  Menu tables not found - plugin may not be installed yet');
        set({
          items: [],
          categories: [],
          isLoading: false,
          error: null, // Don't set error for expected missing tables
        });
      } else {
        console.error('[MenuStore] Failed to load menu from database:', error);
        set({
          error: errorMessage,
          isLoading: false,
        });
      }
    }
  },

  // Refresh menu data
  // Always loads from local SQLite database (POS is the source of truth)
  refreshMenu: async (_tenantId: string) => {
    await get().loadMenuFromDatabase();
  },

  // ==================== Cloud Sync Actions ====================

  // Cloud Sync: Fetch menu from cloud (DISABLED - POS is the source of truth)
  // The POS initiates all menu changes and pushes to cloud
  // This method is kept for interface compatibility but does nothing
  syncFromCloud: async (_tenantId: string) => {
    console.log('[MenuStore] syncFromCloud disabled - POS is the source of truth for menu data');
    console.log('[MenuStore] Menu changes should be made on POS and will sync TO cloud');
    return;
  },

  // Cloud Sync: Push local menu to cloud D1 database
  syncToCloud: async (tenantId: string) => {
    if (!tenantId) {
      console.warn('[MenuStore] No tenantId provided for cloud sync');
      return;
    }

    // GUARD: MASTER TOGGLE - Don't sync if online features are disabled
    const { useRestaurantSettingsStore } = await import('./restaurantSettingsStore');
    const settings = useRestaurantSettingsStore.getState().settings;
    const onlineEnabled = settings.posSettings?.activateOnline ?? false;
    if (!onlineEnabled) {
      console.log('[MenuStore] Online features disabled, skipping cloud sync');
      return;
    }

    if (get().isSyncing) {
      console.log('[MenuStore] Sync already in progress, skipping');
      return;
    }

    const platform = getCurrentPlatform();
    if (platform !== 'tauri') {
      console.warn('[MenuStore] Cloud sync only available on Tauri platform');
      return;
    }

    set({ isSyncing: true });

    try {
      const { items, categories } = get();
      console.log(`[MenuStore] Pushing menu to cloud D1: ${items.length} items, ${categories.length} categories`);

      // Use Tauri invoke to call Rust D1 sync command
      const { invoke } = await import('@tauri-apps/api/core');

      const dbPath = DB_NAME;
      const workerUrl = import.meta.env.VITE_WORKER_URL || 'https://handsfree-pos-worker.stonepot-tech.workers.dev';

      console.log('[MenuStore] Syncing menu to D1 via worker:', workerUrl);

      const result = await invoke<{
        success: boolean;
        synced: number;
        failed: number;
        errors: string[];
        duration_ms: number;
      }>('sync_to_d1', {
        tenantId,
        dbPath,
        workerUrl,
        dataType: 'menu',
      });

      if (result.success) {
        console.log(`[MenuStore] ✅ Menu synced successfully: ${result.synced} records in ${result.duration_ms}ms`);
        set({
          lastSyncedAt: new Date().toISOString(),
          isSyncing: false,
        });
      } else {
        console.error('[MenuStore] ❌ Menu sync failed:', result.errors);
        set({ isSyncing: false, error: result.errors.join(', ') });
      }
    } catch (error) {
      console.error('[MenuStore] Failed to sync menu to cloud:', error);
      set({
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Failed to sync menu',
      });
    }
  },

  // ==================== Dine-In Pricing Actions ====================

  loadDineInOverrides: async (tenantId: string) => {
    const platform = getCurrentPlatform();
    if (platform !== 'tauri') {
      console.log('[MenuStore] Dine-in overrides only available on Tauri platform');
      return;
    }

    try {
      const overrides = await dineInPricingService.getOverrides(tenantId);
      const overrideMap = new Map<string, DineInPricingOverride>();
      overrides.forEach(override => {
        overrideMap.set(override.menuItemId, override);
      });
      set({ dineInOverrides: overrideMap, dineInOverridesLoaded: true });
      console.log(`[MenuStore] Loaded ${overrides.length} dine-in pricing overrides`);
    } catch (error) {
      console.error('[MenuStore] Failed to load dine-in overrides:', error);
    }
  },

  saveDineInOverride: async (tenantId: string, menuItemId: string, price: number | null, available: boolean) => {
    const platform = getCurrentPlatform();
    if (platform !== 'tauri') return;

    try {
      await dineInPricingService.saveOverride(tenantId, menuItemId, price, available);
      // Reload overrides to update state
      await get().loadDineInOverrides(tenantId);
    } catch (error) {
      console.error('[MenuStore] Failed to save dine-in override:', error);
      throw error;
    }
  },

  deleteDineInOverride: async (tenantId: string, menuItemId: string) => {
    const platform = getCurrentPlatform();
    if (platform !== 'tauri') return;

    try {
      await dineInPricingService.deleteOverride(tenantId, menuItemId);
      await get().loadDineInOverrides(tenantId);
    } catch (error) {
      console.error('[MenuStore] Failed to delete dine-in override:', error);
      throw error;
    }
  },

  resetAllDineInOverrides: async (tenantId: string) => {
    const platform = getCurrentPlatform();
    if (platform !== 'tauri') return 0;

    try {
      const count = await dineInPricingService.resetAllOverrides(tenantId);
      set({ dineInOverrides: new Map(), dineInOverridesLoaded: true });
      return count;
    } catch (error) {
      console.error('[MenuStore] Failed to reset dine-in overrides:', error);
      throw error;
    }
  },

  getDineInOverride: (menuItemId: string) => {
    return get().dineInOverrides.get(menuItemId);
  },

  getEffectivePrice: (menuItemId: string, isDineIn: boolean) => {
    const item = get().items.find(i => i.id === menuItemId);
    if (!item) return 0;

    if (isDineIn) {
      const override = get().dineInOverrides.get(menuItemId);
      if (override?.dineInPrice !== null && override?.dineInPrice !== undefined) {
        return override.dineInPrice;
      }
    }
    return item.price;
  },

  isDineInAvailable: (menuItemId: string) => {
    const override = get().dineInOverrides.get(menuItemId);
    // If no override exists, item is available
    // If override exists, check dineInAvailable flag
    return override?.dineInAvailable ?? true;
  },

  getFilteredItems: () => {
    const { items, selectedCategory, searchQuery } = get();
    // Temporarily show all items regardless of active status
    let filtered = items;

    if (selectedCategory) {
      filtered = filtered.filter(
        (item) => item.category_id === selectedCategory
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.dietary_tags?.some((tag) =>
            tag.toLowerCase().includes(query)
          )
      );
    }

    return filtered;
  },

  getCategoryById: (id: string) => {
    return get().categories.find((cat) => cat.id === id);
  },
}));

