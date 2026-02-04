/**
 * Chain Sales Store
 * Manages real-time sales aggregation across multiple locations
 * For restaurant chains with multiple branches
 */

import { create } from 'zustand';
import { IncomingSaleTransaction } from './dailySalesStore';

export interface LocationData {
  locationId: string;
  locationName: string;
  tenantId: string;
  isActive: boolean;
  totalSales: number;
  totalOrders: number;
  lastUpdate: number | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

export interface AggregatedTotals {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  byLocation: Map<string, { sales: number; orders: number }>;
}

interface ChainSalesStore {
  // State
  locations: Map<string, LocationData>;
  realtimeSalesFeed: Array<IncomingSaleTransaction & { locationId: string }>; // Last 100 sales across all locations
  selectedLocationId: string | 'all';
  aggregatedTotals: AggregatedTotals;

  // Actions
  addLocation: (location: Omit<LocationData, 'totalSales' | 'totalOrders' | 'lastUpdate' | 'connectionStatus'>) => void;
  removeLocation: (locationId: string) => void;
  setSelectedLocation: (locationId: string | 'all') => void;

  // Real-time updates
  addSaleFromLocation: (locationId: string, transaction: IncomingSaleTransaction) => void;
  updateLocationStatus: (locationId: string, status: 'connected' | 'connecting' | 'disconnected') => void;

  // Utilities
  clearAllData: () => void;
  getLocationData: (locationId: string) => LocationData | undefined;
}

const calculateAggregatedTotals = (locations: Map<string, LocationData>): AggregatedTotals => {
  let totalSales = 0;
  let totalOrders = 0;
  const byLocation = new Map<string, { sales: number; orders: number }>();

  locations.forEach((location, locationId) => {
    totalSales += location.totalSales;
    totalOrders += location.totalOrders;
    byLocation.set(locationId, {
      sales: location.totalSales,
      orders: location.totalOrders,
    });
  });

  return {
    totalSales,
    totalOrders,
    averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
    byLocation,
  };
};

export const useChainSalesStore = create<ChainSalesStore>((set, get) => ({
  // Initial state
  locations: new Map(),
  realtimeSalesFeed: [],
  selectedLocationId: 'all',
  aggregatedTotals: {
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    byLocation: new Map(),
  },

  // Add a new location to track
  addLocation: (location) => {
    set((state) => {
      const newLocations = new Map(state.locations);
      newLocations.set(location.locationId, {
        ...location,
        totalSales: 0,
        totalOrders: 0,
        lastUpdate: null,
        connectionStatus: 'disconnected',
      });

      return {
        locations: newLocations,
        aggregatedTotals: calculateAggregatedTotals(newLocations),
      };
    });

    console.log('[ChainSalesStore] Added location:', location.locationName);
  },

  // Remove a location
  removeLocation: (locationId) => {
    set((state) => {
      const newLocations = new Map(state.locations);
      newLocations.delete(locationId);

      // Filter out sales from this location
      const newFeed = state.realtimeSalesFeed.filter((sale) => sale.locationId !== locationId);

      return {
        locations: newLocations,
        realtimeSalesFeed: newFeed,
        aggregatedTotals: calculateAggregatedTotals(newLocations),
      };
    });

    console.log('[ChainSalesStore] Removed location:', locationId);
  },

  // Set selected location filter
  setSelectedLocation: (locationId) => {
    set({ selectedLocationId: locationId });
    console.log('[ChainSalesStore] Selected location:', locationId);
  },

  // Add a sale from a specific location
  addSaleFromLocation: (locationId, transaction) => {
    set((state) => {
      const location = state.locations.get(locationId);
      if (!location) {
        console.warn('[ChainSalesStore] Sale from unknown location:', locationId);
        return state;
      }

      // Update location data
      const newLocations = new Map(state.locations);
      newLocations.set(locationId, {
        ...location,
        totalSales: location.totalSales + transaction.grandTotal,
        totalOrders: location.totalOrders + 1,
        lastUpdate: Date.now(),
      });

      // Add to real-time feed (with location tag)
      const taggedTransaction = { ...transaction, locationId };
      const newFeed = [taggedTransaction, ...state.realtimeSalesFeed].slice(0, 100); // Keep last 100

      console.log(
        `[ChainSalesStore] Sale from ${location.locationName}: ₹${transaction.grandTotal} (${newFeed.length} in feed)`
      );

      return {
        locations: newLocations,
        realtimeSalesFeed: newFeed,
        aggregatedTotals: calculateAggregatedTotals(newLocations),
      };
    });
  },

  // Update location connection status
  updateLocationStatus: (locationId, status) => {
    set((state) => {
      const location = state.locations.get(locationId);
      if (!location) return state;

      const newLocations = new Map(state.locations);
      newLocations.set(locationId, {
        ...location,
        connectionStatus: status,
      });

      return { locations: newLocations };
    });

    console.log(`[ChainSalesStore] Location ${locationId} status: ${status}`);
  },

  // Clear all data (for testing or reset)
  clearAllData: () => {
    set({
      locations: new Map(),
      realtimeSalesFeed: [],
      selectedLocationId: 'all',
      aggregatedTotals: {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        byLocation: new Map(),
      },
    });

    console.log('[ChainSalesStore] Cleared all data');
  },

  // Get location data by ID
  getLocationData: (locationId) => {
    return get().locations.get(locationId);
  },
}));
