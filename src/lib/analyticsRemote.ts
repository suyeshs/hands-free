/**
 * Remote Analytics Provider
 *
 * Drop-in replacement for `analyticsDb` (same interface) that fetches owner
 * analytics from the POS over the cloudflared tunnel instead of the local
 * SQLite. Used by `analyticsStore` when this device is a remotely-connected
 * owner device (POS tunnel URL + report key configured). Numbers combine POS
 * sales_transactions + aggregator_orders (computed server-side on the POS).
 */

import {
  fetchAnalyticsSalesMetrics,
  fetchAnalyticsOrderMetrics,
  fetchAnalyticsPerformance,
  fetchAnalyticsPopularItems,
  fetchAnalyticsAggregatorPerformance,
  fetchAnalyticsDailySales,
} from './reportApi';

export const analyticsRemote = {
  fetchSalesMetrics: () => fetchAnalyticsSalesMetrics(),
  fetchOrderMetrics: () => fetchAnalyticsOrderMetrics(),
  fetchPerformanceMetrics: () => fetchAnalyticsPerformance(),
  fetchPopularItems: (limit: number = 10) => fetchAnalyticsPopularItems(limit),
  fetchAggregatorPerformance: () => fetchAnalyticsAggregatorPerformance(),
  fetchDailySales: (days: number = 30) => fetchAnalyticsDailySales(days),
};

export default analyticsRemote;
