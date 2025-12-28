/**
 * Analytics Store
 * Manages business metrics, reports, and analytics data
 * Wired to aggregator_orders database for real data
 */

import { create } from 'zustand';
import { isTauri } from '../lib/platform';

export interface SalesMetrics {
  today: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
  };
  week: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
  };
  month: {
    revenue: number;
    orders: number;
    averageOrderValue: number;
  };
}

export interface OrderMetrics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  completionRate: number; // Percentage
}

export interface PerformanceMetrics {
  averagePrepTime: number; // Minutes
  orderAccuracy: number; // Percentage
  onTimeDelivery: number; // Percentage
  customerSatisfaction: number; // 1-5 rating
}

export interface PopularItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface StationPerformance {
  station: string;
  ordersProcessed: number;
  averagePrepTime: number;
  onTimeRate: number; // Percentage
}

export interface AggregatorPerformance {
  aggregator: 'zomato' | 'swiggy';
  orders: number;
  revenue: number;
  averageOrderValue: number;
  acceptanceRate: number; // Percentage
}

export interface DailySales {
  date: string;
  revenue: number;
  orders: number;
}

interface AnalyticsStore {
  // State
  salesMetrics: SalesMetrics | null;
  orderMetrics: OrderMetrics | null;
  performanceMetrics: PerformanceMetrics | null;
  popularItems: PopularItem[];
  stationPerformance: StationPerformance[];
  aggregatorPerformance: AggregatorPerformance[];
  dailySales: DailySales[]; // Last 30 days
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;

  // Actions
  fetchSalesMetrics: (tenantId: string) => Promise<void>;
  fetchOrderMetrics: (tenantId: string) => Promise<void>;
  fetchPerformanceMetrics: (tenantId: string) => Promise<void>;
  fetchPopularItems: (tenantId: string, limit?: number) => Promise<void>;
  fetchStationPerformance: (tenantId: string) => Promise<void>;
  fetchAggregatorPerformance: (tenantId: string) => Promise<void>;
  fetchDailySales: (tenantId: string, days?: number) => Promise<void>;
  fetchAllMetrics: (tenantId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Dynamically import analytics database functions (only in Tauri)
async function getAnalyticsDb() {
  if (!isTauri()) {
    return null;
  }
  const { analyticsDb } = await import('../lib/analyticsDb');
  return analyticsDb;
}

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  // Initial state
  salesMetrics: null,
  orderMetrics: null,
  performanceMetrics: null,
  popularItems: [],
  stationPerformance: [],
  aggregatorPerformance: [],
  dailySales: [],
  isLoading: false,
  error: null,
  lastUpdated: null,

  // Fetch sales metrics
  fetchSalesMetrics: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });

      const analyticsDb = await getAnalyticsDb();

      if (analyticsDb) {
        // Use real database data
        const metrics = await analyticsDb.fetchSalesMetrics();
        set({ salesMetrics: metrics, isLoading: false, lastUpdated: new Date().toISOString() });
      } else {
        // Fallback mock data for web/non-Tauri
        const metrics: SalesMetrics = {
          today: { revenue: 0, orders: 0, averageOrderValue: 0 },
          week: { revenue: 0, orders: 0, averageOrderValue: 0 },
          month: { revenue: 0, orders: 0, averageOrderValue: 0 },
        };
        set({ salesMetrics: metrics, isLoading: false, lastUpdated: new Date().toISOString() });
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch sales metrics:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch sales metrics',
        isLoading: false,
      });
    }
  },

  // Fetch order metrics
  fetchOrderMetrics: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });

      const analyticsDb = await getAnalyticsDb();

      if (analyticsDb) {
        const metrics = await analyticsDb.fetchOrderMetrics();
        set({ orderMetrics: metrics, isLoading: false });
      } else {
        // Fallback for non-Tauri
        const metrics: OrderMetrics = {
          total: 0,
          pending: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          completionRate: 0,
        };
        set({ orderMetrics: metrics, isLoading: false });
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch order metrics:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch order metrics',
        isLoading: false,
      });
    }
  },

  // Fetch performance metrics
  fetchPerformanceMetrics: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });

      const analyticsDb = await getAnalyticsDb();

      if (analyticsDb) {
        const metrics = await analyticsDb.fetchPerformanceMetrics();
        set({ performanceMetrics: metrics, isLoading: false });
      } else {
        // Fallback for non-Tauri
        const metrics: PerformanceMetrics = {
          averagePrepTime: 0,
          orderAccuracy: 0,
          onTimeDelivery: 0,
          customerSatisfaction: 0,
        };
        set({ performanceMetrics: metrics, isLoading: false });
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch performance metrics:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch performance metrics',
        isLoading: false,
      });
    }
  },

  // Fetch popular items
  fetchPopularItems: async (_tenantId, limit = 10) => {
    try {
      set({ isLoading: true, error: null });

      const analyticsDb = await getAnalyticsDb();

      if (analyticsDb) {
        const items = await analyticsDb.fetchPopularItems(limit);
        set({ popularItems: items, isLoading: false });
      } else {
        // Fallback for non-Tauri
        set({ popularItems: [], isLoading: false });
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch popular items:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch popular items',
        isLoading: false,
      });
    }
  },

  // Fetch station performance (not yet tracked in DB - placeholder)
  fetchStationPerformance: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });

      // Station performance would need KDS data with station tracking
      // For now, return empty array
      set({ stationPerformance: [], isLoading: false });
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch station performance:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch station performance',
        isLoading: false,
      });
    }
  },

  // Fetch aggregator performance
  fetchAggregatorPerformance: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });

      const analyticsDb = await getAnalyticsDb();

      if (analyticsDb) {
        const performance = await analyticsDb.fetchAggregatorPerformance();
        set({ aggregatorPerformance: performance, isLoading: false });
      } else {
        // Fallback for non-Tauri
        set({ aggregatorPerformance: [], isLoading: false });
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch aggregator performance:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch aggregator performance',
        isLoading: false,
      });
    }
  },

  // Fetch daily sales (last N days)
  fetchDailySales: async (_tenantId, days = 30) => {
    try {
      set({ isLoading: true, error: null });

      const analyticsDb = await getAnalyticsDb();

      if (analyticsDb) {
        const sales = await analyticsDb.fetchDailySales(days);
        set({ dailySales: sales, isLoading: false });
      } else {
        // Fallback for non-Tauri - empty data
        const sales: DailySales[] = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          sales.push({
            date: date.toISOString().split('T')[0],
            revenue: 0,
            orders: 0,
          });
        }
        set({ dailySales: sales, isLoading: false });
      }
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch daily sales:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch daily sales',
        isLoading: false,
      });
    }
  },

  // Fetch all metrics at once
  fetchAllMetrics: async (tenantId) => {
    try {
      set({ isLoading: true, error: null });

      await Promise.all([
        get().fetchSalesMetrics(tenantId),
        get().fetchOrderMetrics(tenantId),
        get().fetchPerformanceMetrics(tenantId),
        get().fetchPopularItems(tenantId),
        get().fetchStationPerformance(tenantId),
        get().fetchAggregatorPerformance(tenantId),
        get().fetchDailySales(tenantId),
      ]);

      set({ isLoading: false, lastUpdated: new Date().toISOString() });
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch all metrics:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        isLoading: false,
      });
    }
  },

  // Set loading state
  setLoading: (loading) => set({ isLoading: loading }),

  // Set error
  setError: (error) => set({ error }),
}));
