/**
 * Analytics Store
 * Manages business metrics, reports, and analytics data
 */

import { create } from 'zustand';
// import { backendApi } // For future use from '../lib/backendApi';

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

      // Mock data - replace with actual API call
      // const { metrics } = await backendApi.getSalesMetrics(tenantId);

      const metrics: SalesMetrics = {
        today: {
          revenue: 15420.50,
          orders: 47,
          averageOrderValue: 328.09,
        },
        week: {
          revenue: 89340.75,
          orders: 312,
          averageOrderValue: 286.35,
        },
        month: {
          revenue: 342180.25,
          orders: 1247,
          averageOrderValue: 274.44,
        },
      };

      set({ salesMetrics: metrics, isLoading: false, lastUpdated: new Date().toISOString() });
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

      // Mock data - replace with actual API call
      const metrics: OrderMetrics = {
        total: 1247,
        pending: 8,
        inProgress: 15,
        completed: 1198,
        cancelled: 26,
        completionRate: 96.1,
      };

      set({ orderMetrics: metrics, isLoading: false });
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

      // Mock data - replace with actual API call
      const metrics: PerformanceMetrics = {
        averagePrepTime: 18.5,
        orderAccuracy: 97.8,
        onTimeDelivery: 94.2,
        customerSatisfaction: 4.6,
      };

      set({ performanceMetrics: metrics, isLoading: false });
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

      // Mock data - replace with actual API call
      const items: PopularItem[] = [
        { id: '1', name: 'Grilled Chicken', quantity: 156, revenue: 23400 },
        { id: '2', name: 'Margherita Pizza', quantity: 142, revenue: 19880 },
        { id: '3', name: 'Caesar Salad', quantity: 128, revenue: 12800 },
        { id: '4', name: 'Pasta Carbonara', quantity: 115, revenue: 17250 },
        { id: '5', name: 'Chicken Burger', quantity: 98, revenue: 13720 },
        { id: '6', name: 'French Fries', quantity: 87, revenue: 4350 },
        { id: '7', name: 'Iced Tea', quantity: 76, revenue: 3800 },
        { id: '8', name: 'Chocolate Cake', quantity: 64, revenue: 9600 },
        { id: '9', name: 'Fish & Chips', quantity: 58, revenue: 10440 },
        { id: '10', name: 'Vegetable Stir Fry', quantity: 52, revenue: 7280 },
      ].slice(0, limit);

      set({ popularItems: items, isLoading: false });
    } catch (error) {
      console.error('[AnalyticsStore] Failed to fetch popular items:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch popular items',
        isLoading: false,
      });
    }
  },

  // Fetch station performance
  fetchStationPerformance: async (_tenantId) => {
    try {
      set({ isLoading: true, error: null });

      // Mock data - replace with actual API call
      const performance: StationPerformance[] = [
        { station: 'Grill', ordersProcessed: 342, averagePrepTime: 22.3, onTimeRate: 91.5 },
        { station: 'Wok', ordersProcessed: 298, averagePrepTime: 15.8, onTimeRate: 95.3 },
        { station: 'Fryer', ordersProcessed: 256, averagePrepTime: 12.5, onTimeRate: 97.2 },
        { station: 'Salad', ordersProcessed: 187, averagePrepTime: 8.2, onTimeRate: 98.9 },
        { station: 'Dessert', ordersProcessed: 142, averagePrepTime: 10.5, onTimeRate: 96.5 },
        { station: 'Drinks', ordersProcessed: 421, averagePrepTime: 3.5, onTimeRate: 99.1 },
      ];

      set({ stationPerformance: performance, isLoading: false });
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

      // Mock data - replace with actual API call
      const performance: AggregatorPerformance[] = [
        {
          aggregator: 'zomato',
          orders: 187,
          revenue: 52360,
          averageOrderValue: 280.00,
          acceptanceRate: 94.5,
        },
        {
          aggregator: 'swiggy',
          orders: 156,
          revenue: 43680,
          averageOrderValue: 280.00,
          acceptanceRate: 92.8,
        },
      ];

      set({ aggregatorPerformance: performance, isLoading: false });
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

      // Mock data - replace with actual API call
      const sales: DailySales[] = [];
      const today = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        sales.push({
          date: date.toISOString().split('T')[0],
          revenue: Math.floor(Math.random() * 20000) + 10000,
          orders: Math.floor(Math.random() * 60) + 30,
        });
      }

      set({ dailySales: sales, isLoading: false });
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
