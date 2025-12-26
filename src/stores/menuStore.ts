import { create } from "zustand";
import { MenuItem, MenuCategory, ComboGroup, ComboGroupItem } from "../types";
import { getCurrentPlatform } from "../lib/platform";
import { backendApi } from "../lib/backendApi";
import Database from "@tauri-apps/plugin-sql";

interface MenuStore {
  categories: MenuCategory[];
  items: MenuItem[];
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;

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
  error: null,

  setCategories: (categories: MenuCategory[]) => set({ categories }),
  setItems: (items: MenuItem[]) => set({ items }),
  setSelectedCategory: (categoryId: string | null) =>
    set({ selectedCategory: categoryId }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),

  // Load menu from backend API (for web platform)
  loadMenuFromAPI: async (tenantId: string) => {
    const platform = getCurrentPlatform();

    // Only use API on web platform
    if (platform !== 'web') {
      console.log('[MenuStore] Not on web platform, skipping API load');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      console.log('[MenuStore] Loading menu from API for tenant:', tenantId);

      const { items: apiItems } = await backendApi.getMenu(tenantId);

      // Convert API items to MenuItem format and extract categories
      const items: MenuItem[] = apiItems.map((item) => ({
        id: item.id || crypto.randomUUID(),
        name: item.name,
        description: item.description,
        price: item.price,
        category_id: item.category,
        dietary_tags: item.dietaryTags || [],
        allergens: item.allergens || [],
        spice_level: item.spiceLevel || 0,
        is_veg: item.isVeg,
        is_vegan: item.isVegan || false,
        preparation_time: parseInt(item.preparationTime) || 15,
        available: item.available,
        active: item.available,
        image: item.imageUrl || undefined,
        imageUrl: item.imageUrl || undefined,
        imageId: item.imageId || undefined,
        variants: (item.variants || []).map((v: any) => ({
          name: v.name,
          price_adjustment: v.priceAdjustment || v.price_adjustment || 0,
        })),
        addons: item.addons || [],
        is_popular: item.isPopular || false,
      }));

      // Extract unique categories
      const categoryMap = new Map<string, MenuCategory>();
      items.forEach((item, index) => {
        if (item.category_id && !categoryMap.has(item.category_id)) {
          categoryMap.set(item.category_id, {
            id: item.category_id,
            name: item.category_id,
            sort_order: index,
            icon: "utensils",
            active: true,
          });
        }
      });

      const categories = Array.from(categoryMap.values());

      set({
        items,
        categories,
        isLoading: false,
        error: null,
      });

      console.log(`[MenuStore] Loaded ${items.length} items, ${categories.length} categories`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load menu';
      console.error('[MenuStore] Failed to load menu from API:', error);
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
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

      const db = await Database.load("sqlite:pos.db");

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
          is_combo: row.is_combo === 1 || (comboGroups && comboGroups.length > 0),
          combo_groups: comboGroups,
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
      console.error('[MenuStore] Failed to load menu from database:', error);
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  // Refresh menu data
  refreshMenu: async (tenantId: string) => {
    const platform = getCurrentPlatform();

    if (platform === 'web') {
      await get().loadMenuFromAPI(tenantId);
    } else {
      // For Tauri, reload from SQLite database
      await get().loadMenuFromDatabase();
    }
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

