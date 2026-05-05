/**
 * Menu Context - Provides menu data from D1 to all components
 *
 * Performance optimizations:
 * - Client-side caching in sessionStorage (instant load on navigation)
 * - Show cached data immediately while fetching fresh data in background
 * - Stale-while-revalidate pattern for best UX
 */

'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { getTenantId } from '../lib/restaurant-config-loader';

export interface MenuItem {
  id: string;
  name: string;
  nameHindi?: string;
  category: string;
  description: string;
  price: number;
  photoUrl?: string;
  imageUrl?: string; // Alias for photoUrl, used by MenuItemCard
  isVegetarian: boolean;
  isVegan: boolean;
  spiceLevel?: number | string; // 0-3 scale or string
  allergens?: string;
  tags?: any;
  displayOrder?: number;
  type?: 'veg' | 'non-veg';
  rating?: number;
  reviews?: number;
}

interface MenuContextValue {
  items: MenuItem[];
  categories: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

// Cache configuration
const MENU_CACHE_KEY = 'menu_cache';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface CachedMenuData {
  items: MenuItem[];
  categories: string[];
  timestamp: number;
  tenantId: string;
}

// Get cached menu from sessionStorage
function getCachedMenu(tenantId: string): CachedMenuData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = sessionStorage.getItem(MENU_CACHE_KEY);
    if (!cached) return null;

    const data: CachedMenuData = JSON.parse(cached);

    // Check if cache is for the same tenant and not expired
    if (data.tenantId === tenantId && Date.now() - data.timestamp < CACHE_DURATION_MS) {
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

// Save menu to sessionStorage cache
function setCachedMenu(tenantId: string, items: MenuItem[], categories: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    const data: CachedMenuData = {
      items,
      categories,
      timestamp: Date.now(),
      tenantId,
    };
    sessionStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within MenuProvider');
  }
  return context;
}

interface MenuProviderProps {
  children: ReactNode;
}

export function MenuProvider({ children }: MenuProviderProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processMenuItems = useCallback((rawItems: any[]): MenuItem[] => {
    return rawItems.map((item: any) => {
      // Map image URL from any available source for MenuItemCard compatibility
      const imageUrl = item.image_url || item.photoUrl || item.imageUrl || null;
      return {
        ...item,
        type: item.isVegetarian ? 'veg' : 'non-veg',
        imageUrl,
        // Also set photoUrl for components that use that field
        photoUrl: imageUrl
      };
    });
  }, []);

  const extractCategories = useCallback((allItems: MenuItem[]): string[] => {
    const categorySet = new Set<string>();
    allItems.forEach((item: MenuItem) => categorySet.add(item.category));
    return ['all', ...Array.from(categorySet)];
  }, []);

  const fetchMenu = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setIsLoading(true);
      }
      setError(null);

      // Ensure we're on the client side before getting tenant ID
      if (typeof window === 'undefined') {
        console.log('[MenuContext] Skipping fetch on server-side');
        setIsLoading(false);
        return;
      }

      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('Tenant ID not found');
      }

      // Fetch all menu items via Restaurant Worker
      // Tenant ID is extracted from hostname, not URL path
      const response = await fetch(`/api/menu?limit=500`);

      if (!response.ok) {
        throw new Error(`Failed to fetch menu: ${response.status}`);
      }

      const data: any = await response.json();
      const processedItems = processMenuItems(data.items || []);
      const uniqueCategories = extractCategories(processedItems);

      setItems(processedItems);
      setCategories(uniqueCategories);
      setHasMore(false); // All items loaded

      // Cache the fresh data
      setCachedMenu(tenantId, processedItems, uniqueCategories);

      console.log(`[MenuContext] Loaded ${processedItems.length} menu items, ${uniqueCategories.length - 1} categories`);
    } catch (err) {
      console.error('[MenuContext] Failed to fetch menu:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch menu');
      if (items.length === 0) {
        setItems([]);
        setCategories(['all']);
      }
    } finally {
      setIsLoading(false);
    }
  }, [processMenuItems, extractCategories, items.length]);

  // Placeholder for future category-based lazy loading
  const loadMore = useCallback(async () => {
    // Currently all items are loaded at once
    // This can be extended to load by category if needed
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tenantId = getTenantId();
    if (!tenantId) {
      setIsLoading(false);
      return;
    }

    // Check cache first for instant display
    const cached = getCachedMenu(tenantId);

    if (cached) {
      // Show cached data immediately (instant load!)
      console.log('[MenuContext] Using cached menu data (instant load)');
      setItems(cached.items);
      setCategories(cached.categories);
      setIsLoading(false);

      // Refresh in background (stale-while-revalidate)
      fetchMenu(false);
    } else {
      // No cache, fetch fresh (show loading state)
      fetchMenu(true);
    }
  }, []);

  const value: MenuContextValue = {
    items,
    categories,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refetch: fetchMenu,
    loadMore,
  };

  return (
    <MenuContext.Provider value={value}>
      {children}
    </MenuContext.Provider>
  );
}
