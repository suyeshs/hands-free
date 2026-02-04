/**
 * Chain Configuration Store
 * Manages multi-location/brand configuration for restaurant chains
 * Stores location tenant mappings and connection settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Database from '@tauri-apps/plugin-sql';

export interface ChainLocation {
  id: string;
  locationName: string;
  tenantId: string;
  locationId: string;
  isActive: boolean;
  isPrimary: boolean; // The main/HQ location
  createdAt: string;
  updatedAt: string;
}

interface ChainConfigStore {
  // State
  locations: ChainLocation[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadLocations: (parentTenantId: string) => Promise<void>;
  addLocation: (location: Omit<ChainLocation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateLocation: (id: string, updates: Partial<ChainLocation>) => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
  toggleLocationActive: (id: string) => Promise<void>;

  // Utilities
  getActiveLocations: () => ChainLocation[];
  getPrimaryLocation: () => ChainLocation | undefined;
  clearError: () => void;
}

const DB_NAME = 'sqlite:handsfree.db';

const getDb = async () => {
  return await Database.load(DB_NAME);
};

// Initialize database table
const initializeTable = async () => {
  const db = await getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chain_locations (
      id TEXT PRIMARY KEY,
      parent_tenant_id TEXT NOT NULL,
      location_name TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  console.log('[ChainConfigStore] Database table initialized');
};

// Initialize on module load
initializeTable().catch(console.error);

export const useChainConfigStore = create<ChainConfigStore>()(
  persist(
    (set, get) => ({
      // Initial state
      locations: [],
      isLoading: false,
      error: null,

      // Load locations from database
      loadLocations: async (parentTenantId: string) => {
        set({ isLoading: true, error: null });

        try {
          const db = await getDb();
          const rows = await db.select<any[]>(
            'SELECT * FROM chain_locations WHERE parent_tenant_id = $1 ORDER BY is_primary DESC, location_name ASC',
            [parentTenantId]
          );

          const locations: ChainLocation[] = rows.map((row) => ({
            id: row.id,
            locationName: row.location_name,
            tenantId: row.tenant_id,
            locationId: row.location_id,
            isActive: row.is_active === 1,
            isPrimary: row.is_primary === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          set({ locations, isLoading: false });
          console.log(`[ChainConfigStore] Loaded ${locations.length} locations`);
        } catch (error) {
          console.error('[ChainConfigStore] Failed to load locations:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to load locations',
            isLoading: false,
          });
        }
      },

      // Add a new location
      addLocation: async (location) => {
        set({ isLoading: true, error: null });

        try {
          const db = await getDb();
          const now = new Date().toISOString();
          const id = `chain-loc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Get parent tenant ID from first location or current tenant
          const parentTenantId = get().locations[0]?.tenantId || location.tenantId;

          await db.execute(
            `INSERT INTO chain_locations (
              id, parent_tenant_id, location_name, tenant_id, location_id,
              is_active, is_primary, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              id,
              parentTenantId,
              location.locationName,
              location.tenantId,
              location.locationId,
              location.isActive ? 1 : 0,
              location.isPrimary ? 1 : 0,
              now,
              now,
            ]
          );

          const newLocation: ChainLocation = {
            id,
            ...location,
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            locations: [...state.locations, newLocation],
            isLoading: false,
          }));

          console.log('[ChainConfigStore] Added location:', location.locationName);
        } catch (error) {
          console.error('[ChainConfigStore] Failed to add location:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to add location',
            isLoading: false,
          });
          throw error;
        }
      },

      // Update a location
      updateLocation: async (id, updates) => {
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
            `UPDATE chain_locations SET
              location_name = $1, tenant_id = $2, location_id = $3,
              is_active = $4, is_primary = $5, updated_at = $6
            WHERE id = $7`,
            [
              updatedLocation.locationName,
              updatedLocation.tenantId,
              updatedLocation.locationId,
              updatedLocation.isActive ? 1 : 0,
              updatedLocation.isPrimary ? 1 : 0,
              now,
              id,
            ]
          );

          set((state) => ({
            locations: state.locations.map((loc) =>
              loc.id === id ? updatedLocation : loc
            ),
            isLoading: false,
          }));

          console.log('[ChainConfigStore] Updated location:', id);
        } catch (error) {
          console.error('[ChainConfigStore] Failed to update location:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to update location',
            isLoading: false,
          });
          throw error;
        }
      },

      // Remove a location
      removeLocation: async (id) => {
        set({ isLoading: true, error: null });

        try {
          const db = await getDb();

          await db.execute('DELETE FROM chain_locations WHERE id = $1', [id]);

          set((state) => ({
            locations: state.locations.filter((loc) => loc.id !== id),
            isLoading: false,
          }));

          console.log('[ChainConfigStore] Removed location:', id);
        } catch (error) {
          console.error('[ChainConfigStore] Failed to remove location:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to remove location',
            isLoading: false,
          });
          throw error;
        }
      },

      // Toggle location active status
      toggleLocationActive: async (id) => {
        const location = get().locations.find((loc) => loc.id === id);
        if (!location) return;

        await get().updateLocation(id, { isActive: !location.isActive });
      },

      // Get only active locations
      getActiveLocations: () => {
        return get().locations.filter((loc) => loc.isActive);
      },

      // Get primary location
      getPrimaryLocation: () => {
        return get().locations.find((loc) => loc.isPrimary);
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'chain-config-storage',
      partialize: (state) => ({
        locations: state.locations,
      }),
    }
  )
);
