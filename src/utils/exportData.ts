/**
 * Data Export Utilities
 * Export analytics and reports to CSV/JSON
 */

import type {
  SalesMetrics,
  OrderMetrics,
  PerformanceMetrics,
  PopularItem,
  StationPerformance,
  AggregatorPerformance,
  DailySales,
} from '../stores/analyticsStore';

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any[], headers: string[]): string {
  const rows = [headers.join(',')];

  data.forEach((item) => {
    const values = headers.map((header) => {
      const value = item[header];
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    rows.push(values.join(','));
  });

  return rows.join('\n');
}

/**
 * Download file
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export sales metrics to CSV
 */
export function exportSalesMetrics(metrics: SalesMetrics) {
  const data = [
    {
      period: 'Today',
      revenue: metrics.today.revenue,
      orders: metrics.today.orders,
      averageOrderValue: metrics.today.averageOrderValue,
    },
    {
      period: 'This Week',
      revenue: metrics.week.revenue,
      orders: metrics.week.orders,
      averageOrderValue: metrics.week.averageOrderValue,
    },
    {
      period: 'This Month',
      revenue: metrics.month.revenue,
      orders: metrics.month.orders,
      averageOrderValue: metrics.month.averageOrderValue,
    },
  ];

  const csv = convertToCSV(data, ['period', 'revenue', 'orders', 'averageOrderValue']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `sales-metrics-${timestamp}.csv`, 'text/csv');
}

/**
 * Export popular items to CSV
 */
export function exportPopularItems(items: PopularItem[]) {
  const csv = convertToCSV(items, ['name', 'quantity', 'revenue']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `popular-items-${timestamp}.csv`, 'text/csv');
}

/**
 * Export station performance to CSV
 */
export function exportStationPerformance(stations: StationPerformance[]) {
  const csv = convertToCSV(stations, ['station', 'ordersProcessed', 'averagePrepTime', 'onTimeRate']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `station-performance-${timestamp}.csv`, 'text/csv');
}

/**
 * Export aggregator performance to CSV
 */
export function exportAggregatorPerformance(aggregators: AggregatorPerformance[]) {
  const csv = convertToCSV(aggregators, ['aggregator', 'orders', 'revenue', 'averageOrderValue', 'acceptanceRate']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `aggregator-performance-${timestamp}.csv`, 'text/csv');
}

/**
 * Export daily sales to CSV
 */
export function exportDailySales(sales: DailySales[]) {
  const csv = convertToCSV(sales, ['date', 'revenue', 'orders']);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(csv, `daily-sales-${timestamp}.csv`, 'text/csv');
}

/**
 * Export all metrics to JSON
 */
export function exportAllMetricsJSON(data: {
  salesMetrics: SalesMetrics | null;
  orderMetrics: OrderMetrics | null;
  performanceMetrics: PerformanceMetrics | null;
  popularItems: PopularItem[];
  stationPerformance: StationPerformance[];
  aggregatorPerformance: AggregatorPerformance[];
  dailySales: DailySales[];
}) {
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadFile(json, `analytics-report-${timestamp}.json`, 'application/json');
}

/**
 * Print report (opens print dialog)
 */
export function printReport() {
  window.print();
}
