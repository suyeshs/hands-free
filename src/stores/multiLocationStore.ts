/**
 * Multi-Location Store (Simplified Architecture)
 * Manages location configuration for restaurant chains
 * Each location has its own SQLite database that syncs in real-time
 * Same menu across all locations, no complex tenant provisioning
 */

import { create } from 'zustand';
import Database from '@tauri-apps/plugin-sql';
import { DB_NAME } from '../lib/database';

export interface Location {
  id: string;
  name: string;
  dbPath: string; // Path to location's SQLite DB
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MultiLocationStore {
  // State
  locations: Location[];
  selectedLocationId: string | 'all';
  isLoading: boolean;
  error: string | null;

  // Real-time aggregation
  aggregatedSales: {
    totalSales: number;
    totalOrders: number;
    byLocation: Record<string, { sales: number; orders: number }>;
  };

  // Actions
  loadLocations: () => Promise<void>;
  addLocation: (name: string, dbPath: string) => Promise<void>;
  updateLocation: (id: string, updates: Partial<Omit<Location, 'id' | 'createdAt'>>) => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  setSelected: (id: string | 'all') => void;

  // Real-time aggregation updates
  updateLocationSales: (locationId: string, sales: number, orders: number) => void;
  clearAggregatedSales: () => void;

  // Utilities
  getActiveLocations: () => Location[];
  getLocationById: (id: string) => Location | undefined;
  clearError: () => void;
}

// DB_NAME imported from lib/database

const getDb = async () => {
  return await Database.load(DB_NAME);
};

// Initialize database table
const initializeTable = async () => {
  const db = await getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      db_path TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  console.log('[MultiLocationStore] Database table initialized');
};

// Initialize on module load
initializeTable().catch(console.error);

export const useMultiLocationStore = create<MultiLocationStore>()((set, get) => ({
      // Initial state
      locations: [],
      selectedLocationId: 'all',
      isLoading: false,
      error: null,
      aggregatedSales: {
        totalSales: 0,
        totalOrders: 0,
        byLocation: {},
      },

      // Load locations from database
      loadLocations: async () => {
        set({ isLoading: true, error: null });

        try {
          const db = await getDb();
          const rows = await db.select<any[]>(
            'SELECT * FROM locations ORDER BY name ASC'
          );

          const locations: Location[] = rows.map((row) => ({
            id: row.id,
            name: row.name,
            dbPath: row.db_path,
            isActive: row.is_active === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          set({ locations, isLoading: false });
          console.log(`[MultiLocationStore] Loaded ${locations.length} locations`);
        } catch (error) {
          console.error('[MultiLocationStore] Failed to load locations:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load locations',
            isLoading: false,
          });
        }
      },

      // Add a new location
      addLocation: async (name: string, dbPath: string) => {
        set({ isLoading: true, error: null });

        try {
          const db = await getDb();
          const now = new Date().toISOString();
          const id = `loc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          await db.execute(
            `INSERT INTO locations (id, name, db_path, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, name, dbPath, 1, now, now]
          );

          const newLocation: Location = {
            id,
            name,
            dbPath,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            locations: [...state.locations, newLocation],
            isLoading: false,
          }));

          console.log('[MultiLocationStore] Added location:', name);
        } catch (error) {
          console.error('[MultiLocationStore] Failed to add location:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to add location',
            isLoading: false,
          });
          throw error;
        }
      },

      // Update a location
      updateLocation: async (id: string, updates: Partial<Omit<Location, 'id' | 'createdAt'>>) => {
        set({ isLoading: true, error: null });

        try {
          const db = await getDb();
          const now = new Date().toISOString();
          const location = get().locations.find((loc) => loc.id === id);

          if (!location) {
            throw new Error('Location not found');
          }

          const updatedLocation = { ...location, ...updates, updatedAt: now };

          await db.execute(
            `UPDATE locations SET name = $1, db_path = $2, is_active = $3, updated_at = $4
             WHERE id = $5`,
            [
              updatedLocation.name,
              updatedLocation.dbPath,
              updatedLocation.isActive ? 1 : 0,
              now,
              id,
            ]
          );

          set((state) => ({
            locations: state.locations.map((loc) => (loc.id === id ? updatedLocation : loc)),
            isLoading: false,
          }));

          console.log('[MultiLocationStore] Updated location:', id);
        } catch (error) {
          console.error('[MultiLocationStore] Failed to update location:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to update location',
            isLoading: false,
          });
          throw error;
        }
      },

      // Remove a location
      removeLocation: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const db = await getDb();
          await db.execute('DELETE FROM locations WHERE id = $1', [id]);

          set((state) => ({
            locations: state.locations.filter((loc) => loc.id !== id),
            isLoading: false,
          }));

          console.log('[MultiLocationStore] Removed location:', id);
        } catch (error) {
          console.error('[MultiLocationStore] Failed to remove location:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to remove location',
            isLoading: false,
          });
          throw error;
        }
      },

      // Toggle location active status
      toggleActive: async (id: string) => {
        const location = get().locations.find((loc) => loc.id === id);
        if (!location) return;

        await get().updateLocation(id, { isActive: !location.isActive });
      },

      // Set selected location
      setSelected: (id: string | 'all') => {
        set({ selectedLocationId: id });
        console.log('[MultiLocationStore] Selected location:', id);
      },

      // Update location sales (from sync service)
      updateLocationSales: (locationId: string, sales: number, orders: number) => {
        set((state) => {
          const byLocation = { ...state.aggregatedSales.byLocation };
          byLocation[locationId] = { sales, orders };

          // Recalculate totals
          let totalSales = 0;
          let totalOrders = 0;
          Object.values(byLocation).forEach(({ sales, orders }) => {
            totalSales += sales;
            totalOrders += orders;
          });

          return {
            aggregatedSales: {
              totalSales,
              totalOrders,
              byLocation,
            },
          };
        });
      },

      // Clear aggregated sales (for daily reset)
      clearAggregatedSales: () => {
        set({
          aggregatedSales: {
            totalSales: 0,
            totalOrders: 0,
            byLocation: {},
          },
        });
      },

      // Get only active locations
      getActiveLocations: () => {
        return get().locations.filter((loc) => loc.isActive);
      },

      // Get location by ID
      getLocationById: (id: string) => {
        return get().locations.find((loc) => loc.id === id);
      },

      // Clear error
      clearError: () => set({ error: null }),
    }));
