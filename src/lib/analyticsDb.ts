/**
 * Analytics Database Service
 * Queries aggregator_orders table to generate real analytics data
 */

import Database from "@tauri-apps/plugin-sql";
import type {
  SalesMetrics,
  OrderMetrics,
  PerformanceMetrics,
  PopularItem,
  AggregatorPerformance,
  DailySales,
} from "../stores/analyticsStore";

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:pos.db");
  }
  return db;
}

/**
 * Get date string for N days ago
 */
function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Get start of today
 */
function getStartOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Get start of week (Monday)
 */
function getStartOfWeek(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Get start of month
 */
function getStartOfMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

interface SalesRow {
  revenue: number;
  orders: number;
}

interface OrderCountRow {
  status: string;
  count: number;
}

interface PrepTimeRow {
  avg_prep_time: number | null;
}

interface AggregatorRow {
  aggregator: string;
  orders: number;
  revenue: number;
  accepted: number;
  total: number;
}

interface DailySalesRow {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * Fetch sales metrics from database
 */
export async function fetchSalesMetricsFromDb(): Promise<SalesMetrics> {
  const database = await getDatabase();

  const todayStart = getStartOfToday();
  const weekStart = getStartOfWeek();
  const monthStart = getStartOfMonth();

  // Get today's sales
  const todayRows = await database.select<SalesRow[]>(
    `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
     FROM aggregator_orders
     WHERE created_at >= $1 AND status NOT IN ('cancelled')`,
    [todayStart]
  );

  // Get week's sales
  const weekRows = await database.select<SalesRow[]>(
    `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
     FROM aggregator_orders
     WHERE created_at >= $1 AND status NOT IN ('cancelled')`,
    [weekStart]
  );

  // Get month's sales
  const monthRows = await database.select<SalesRow[]>(
    `SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
     FROM aggregator_orders
     WHERE created_at >= $1 AND status NOT IN ('cancelled')`,
    [monthStart]
  );

  const today = todayRows[0] || { revenue: 0, orders: 0 };
  const week = weekRows[0] || { revenue: 0, orders: 0 };
  const month = monthRows[0] || { revenue: 0, orders: 0 };

  return {
    today: {
      revenue: today.revenue,
      orders: today.orders,
      averageOrderValue: today.orders > 0 ? today.revenue / today.orders : 0,
    },
    week: {
      revenue: week.revenue,
      orders: week.orders,
      averageOrderValue: week.orders > 0 ? week.revenue / week.orders : 0,
    },
    month: {
      revenue: month.revenue,
      orders: month.orders,
      averageOrderValue: month.orders > 0 ? month.revenue / month.orders : 0,
    },
  };
}

/**
 * Fetch order metrics from database
 */
export async function fetchOrderMetricsFromDb(): Promise<OrderMetrics> {
  const database = await getDatabase();

  // Get order counts by status
  const rows = await database.select<OrderCountRow[]>(
    `SELECT status, COUNT(*) as count
     FROM aggregator_orders
     GROUP BY status`
  );

  const statusCounts: Record<string, number> = {};
  rows.forEach((row) => {
    statusCounts[row.status] = row.count;
  });

  const pending = statusCounts['pending'] || 0;
  const confirmed = statusCounts['confirmed'] || 0;
  const preparing = statusCounts['preparing'] || 0;
  const ready = statusCounts['ready'] || 0;
  const outForDelivery = statusCounts['out_for_delivery'] || 0;
  const delivered = statusCounts['delivered'] || 0;
  const completed = statusCounts['completed'] || 0;
  const cancelled = statusCounts['cancelled'] || 0;

  const inProgress = confirmed + preparing + ready + outForDelivery;
  const completedTotal = delivered + completed;
  const total = pending + inProgress + completedTotal + cancelled;
  const completionRate = total > 0 ? (completedTotal / (total - cancelled)) * 100 : 0;

  return {
    total,
    pending,
    inProgress,
    completed: completedTotal,
    cancelled,
    completionRate: Math.round(completionRate * 10) / 10,
  };
}

/**
 * Fetch performance metrics from database
 */
export async function fetchPerformanceMetricsFromDb(): Promise<PerformanceMetrics> {
  const database = await getDatabase();
  const monthStart = getStartOfMonth();

  // Calculate average prep time (time from accepted_at to ready_at)
  const prepTimeRows = await database.select<PrepTimeRow[]>(
    `SELECT AVG(
       (julianday(ready_at) - julianday(accepted_at)) * 24 * 60
     ) as avg_prep_time
     FROM aggregator_orders
     WHERE accepted_at IS NOT NULL
       AND ready_at IS NOT NULL
       AND created_at >= $1`,
    [monthStart]
  );

  const avgPrepTime = prepTimeRows[0]?.avg_prep_time || 0;

  // Calculate on-time delivery (orders ready within 30 mins of acceptance)
  const onTimeRows = await database.select<{ on_time: number; total: number }[]>(
    `SELECT
       SUM(CASE WHEN (julianday(ready_at) - julianday(accepted_at)) * 24 * 60 <= 30 THEN 1 ELSE 0 END) as on_time,
       COUNT(*) as total
     FROM aggregator_orders
     WHERE accepted_at IS NOT NULL
       AND ready_at IS NOT NULL
       AND created_at >= $1`,
    [monthStart]
  );

  const onTimeRate = onTimeRows[0]?.total > 0
    ? (onTimeRows[0].on_time / onTimeRows[0].total) * 100
    : 100;

  // For order accuracy and customer satisfaction, we don't have that data yet
  // These would need to be tracked separately
  return {
    averagePrepTime: Math.round(avgPrepTime * 10) / 10,
    orderAccuracy: 98.0, // Placeholder - would need rejection/remake tracking
    onTimeDelivery: Math.round(onTimeRate * 10) / 10,
    customerSatisfaction: 4.5, // Placeholder - would need rating tracking
  };
}

/**
 * Fetch popular items from order items
 */
export async function fetchPopularItemsFromDb(limit: number = 10): Promise<PopularItem[]> {
  const database = await getDatabase();
  const monthStart = getStartOfMonth();

  // Get all orders from this month
  const orders = await database.select<{ items_json: string }[]>(
    `SELECT items_json FROM aggregator_orders
     WHERE created_at >= $1 AND status NOT IN ('cancelled')`,
    [monthStart]
  );

  // Aggregate item sales
  const itemSales: Record<string, { quantity: number; revenue: number }> = {};

  orders.forEach((order) => {
    try {
      const items = JSON.parse(order.items_json || '[]');
      items.forEach((item: { name: string; quantity: number; price?: number; total?: number }) => {
        const name = item.name || 'Unknown Item';
        const quantity = item.quantity || 1;
        const revenue = item.total || (item.price || 0) * quantity;

        if (!itemSales[name]) {
          itemSales[name] = { quantity: 0, revenue: 0 };
        }
        itemSales[name].quantity += quantity;
        itemSales[name].revenue += revenue;
      });
    } catch (e) {
      // Skip invalid JSON
    }
  });

  // Convert to array and sort by quantity
  const sortedItems: PopularItem[] = Object.entries(itemSales)
    .map(([name, data], index) => ({
      id: `item-${index}`,
      name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);

  return sortedItems;
}

/**
 * Fetch aggregator performance from database
 */
export async function fetchAggregatorPerformanceFromDb(): Promise<AggregatorPerformance[]> {
  const database = await getDatabase();
  const monthStart = getStartOfMonth();

  // Get stats by aggregator
  const rows = await database.select<AggregatorRow[]>(
    `SELECT
       aggregator,
       COUNT(*) as orders,
       COALESCE(SUM(total), 0) as revenue,
       SUM(CASE WHEN status NOT IN ('cancelled', 'pending') THEN 1 ELSE 0 END) as accepted,
       COUNT(*) as total
     FROM aggregator_orders
     WHERE created_at >= $1
     GROUP BY aggregator`,
    [monthStart]
  );

  return rows
    .filter((row) => row.aggregator === 'swiggy' || row.aggregator === 'zomato')
    .map((row) => ({
      aggregator: row.aggregator as 'swiggy' | 'zomato',
      orders: row.orders,
      revenue: row.revenue,
      averageOrderValue: row.orders > 0 ? row.revenue / row.orders : 0,
      acceptanceRate: row.total > 0 ? (row.accepted / row.total) * 100 : 100,
    }));
}

/**
 * Fetch daily sales for the last N days
 */
export async function fetchDailySalesFromDb(days: number = 30): Promise<DailySales[]> {
  const database = await getDatabase();
  const startDate = getDateNDaysAgo(days);

  // Get daily aggregated sales
  const rows = await database.select<DailySalesRow[]>(
    `SELECT
       DATE(created_at) as date,
       COALESCE(SUM(total), 0) as revenue,
       COUNT(*) as orders
     FROM aggregator_orders
     WHERE created_at >= $1 AND status NOT IN ('cancelled')
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [startDate]
  );

  // Fill in missing days with zero values
  const salesMap = new Map<string, DailySales>();
  rows.forEach((row) => {
    salesMap.set(row.date, {
      date: row.date,
      revenue: row.revenue,
      orders: row.orders,
    });
  });

  // Create array with all days
  const result: DailySales[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    result.push(
      salesMap.get(dateStr) || {
        date: dateStr,
        revenue: 0,
        orders: 0,
      }
    );
  }

  return result;
}

export const analyticsDb = {
  fetchSalesMetrics: fetchSalesMetricsFromDb,
  fetchOrderMetrics: fetchOrderMetricsFromDb,
  fetchPerformanceMetrics: fetchPerformanceMetricsFromDb,
  fetchPopularItems: fetchPopularItemsFromDb,
  fetchAggregatorPerformance: fetchAggregatorPerformanceFromDb,
  fetchDailySales: fetchDailySalesFromDb,
};

export default analyticsDb;
