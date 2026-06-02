/**
 * Report API (remote client)
 *
 * Fetches sales/analytics reports from the POS over the cloudflared tunnel
 * (GET /api/reports/*), reading the same local SQLite the POS writes — no D1.
 * Use this when the reporting UI runs in a remote browser (off the POS device);
 * on the POS device itself, `salesTransactionService` (Tauri SQL plugin) is used.
 *
 * Every call carries the static report key (X-Report-Key header). The key is
 * shown in the POS Settings (see reportAccessService) and entered once on the
 * remote device, where it is cached in localStorage.
 */

import type {
  SalesSummary,
  PaymentBreakdown,
  HourlySales,
  TopItem,
  OrderTypeBreakdown,
  SalesTransaction,
} from './salesTransactionService';
import type {
  SalesMetrics,
  OrderMetrics,
  PerformanceMetrics,
  PopularItem,
  AggregatorPerformance,
  DailySales,
} from '../stores/analyticsStore';

const REPORT_KEY_STORAGE = 'reportAccessKey';
const POS_URL_STORAGE = 'reportPosUrl';

/**
 * Base URL for report calls.
 * - Owner app (installed, remote): the POS's named-tunnel URL, set at runtime
 *   via setPosServerUrl() (e.g. https://<slug>.menu.handsfree.com).
 * - Served over the tunnel: same-origin ('') works without configuration.
 */
function reportBaseUrl(): string {
  const stored = localStorage.getItem(POS_URL_STORAGE);
  if (stored) return stored.replace(/\/$/, '');
  return (import.meta.env.VITE_REPORTS_BASE_URL || '').replace(/\/$/, '');
}

/** Point this (owner) device at a POS server (its tunnel URL). */
export function setPosServerUrl(url: string): void {
  localStorage.setItem(POS_URL_STORAGE, url.trim());
}

export function getPosServerUrl(): string | null {
  return localStorage.getItem(POS_URL_STORAGE);
}

/** True once this device has both a POS URL and a report key configured. */
export function isReportConnectionConfigured(): boolean {
  return !!getPosServerUrl() && !!getStoredReportKey();
}

/** Persist the report access key on this (remote) device. */
export function setReportKey(key: string): void {
  localStorage.setItem(REPORT_KEY_STORAGE, key);
}

export function getStoredReportKey(): string | null {
  return localStorage.getItem(REPORT_KEY_STORAGE);
}

function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function reportFetch<T>(path: string, key?: string): Promise<T> {
  const accessKey = key ?? getStoredReportKey();
  if (!accessKey) {
    throw new Error('Report access key not set. Enter the key from POS Settings.');
  }

  const response = await fetch(`${reportBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Report-Key': accessKey,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid or missing report access key.');
    }
    const text = await response.text();
    throw new Error(`Report request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (data && data.success === false) {
    throw new Error(data.error || 'Report request failed');
  }
  return data as T;
}

export interface DailyReport {
  date: string;
  summary: SalesSummary;
  paymentBreakdown: PaymentBreakdown;
  orderTypeBreakdown: OrderTypeBreakdown;
  hourly: HourlySales[];
  topItems: TopItem[];
}

/** Consolidated daily report (summary + breakdowns + hourly + top items). */
export async function getDailyReport(date: string = todayLocal(), key?: string): Promise<DailyReport> {
  const data = await reportFetch<{
    date: string;
    summary: SalesSummary;
    paymentBreakdown: PaymentBreakdown;
    orderTypeBreakdown: OrderTypeBreakdown;
    hourly: HourlySales[];
    topItems: TopItem[];
  }>(`/api/reports/daily?date=${encodeURIComponent(date)}`, key);
  return {
    date: data.date,
    summary: data.summary,
    paymentBreakdown: data.paymentBreakdown,
    orderTypeBreakdown: data.orderTypeBreakdown,
    hourly: data.hourly,
    topItems: data.topItems,
  };
}

export async function getSalesSummary(date: string = todayLocal(), key?: string): Promise<SalesSummary> {
  const data = await reportFetch<{ summary: SalesSummary }>(
    `/api/reports/summary?date=${encodeURIComponent(date)}`,
    key
  );
  return data.summary;
}

export async function getPaymentBreakdown(date: string = todayLocal(), key?: string): Promise<PaymentBreakdown> {
  const data = await reportFetch<{ paymentBreakdown: PaymentBreakdown }>(
    `/api/reports/payment-breakdown?date=${encodeURIComponent(date)}`,
    key
  );
  return data.paymentBreakdown;
}

export async function getHourlySales(date: string = todayLocal(), key?: string): Promise<HourlySales[]> {
  const data = await reportFetch<{ hourly: HourlySales[] }>(
    `/api/reports/hourly?date=${encodeURIComponent(date)}`,
    key
  );
  return data.hourly;
}

export async function getTopItems(date: string = todayLocal(), limit = 10, key?: string): Promise<TopItem[]> {
  const data = await reportFetch<{ topItems: TopItem[] }>(
    `/api/reports/top-items?date=${encodeURIComponent(date)}&limit=${limit}`,
    key
  );
  return data.topItems;
}

export async function getOrderTypeBreakdown(date: string = todayLocal(), key?: string): Promise<OrderTypeBreakdown> {
  const data = await reportFetch<{ orderTypeBreakdown: OrderTypeBreakdown }>(
    `/api/reports/order-type-breakdown?date=${encodeURIComponent(date)}`,
    key
  );
  return data.orderTypeBreakdown;
}

export async function getSalesByDate(date: string = todayLocal(), key?: string): Promise<SalesTransaction[]> {
  const data = await reportFetch<{ transactions: SalesTransaction[] }>(
    `/api/reports/sales-by-date?date=${encodeURIComponent(date)}`,
    key
  );
  return data.transactions;
}

export async function getSalesForDateRange(
  startDate: string,
  endDate: string,
  key?: string
): Promise<SalesTransaction[]> {
  const data = await reportFetch<{ transactions: SalesTransaction[] }>(
    `/api/reports/date-range?from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(endDate)}`,
    key
  );
  return data.transactions;
}

export async function getTransactionByInvoice(invoiceNumber: string, key?: string): Promise<SalesTransaction | null> {
  try {
    const data = await reportFetch<{ transaction: SalesTransaction }>(
      `/api/reports/transaction?invoice=${encodeURIComponent(invoiceNumber)}`,
      key
    );
    return data.transaction;
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}

export async function saleExists(invoiceNumber: string, key?: string): Promise<boolean> {
  const data = await reportFetch<{ exists: boolean }>(
    `/api/reports/sale-exists?invoice=${encodeURIComponent(invoiceNumber)}`,
    key
  );
  return data.exists;
}

export async function getRecentDineInOrders(limit = 20, key?: string): Promise<SalesTransaction[]> {
  const data = await reportFetch<{ transactions: SalesTransaction[] }>(
    `/api/reports/recent-dine-in?limit=${limit}`,
    key
  );
  return data.transactions;
}

export async function searchTransactions(
  query: string,
  orderType?: string,
  key?: string
): Promise<SalesTransaction[]> {
  const params = new URLSearchParams({ q: query });
  if (orderType) params.set('order_type', orderType);
  const data = await reportFetch<{ transactions: SalesTransaction[] }>(
    `/api/reports/search?${params.toString()}`,
    key
  );
  return data.transactions;
}

export interface AggregatorSalesSummary {
  totalSales: number;
  totalOrders: number;
  totalTax: number;
  totalDiscount: number;
  byAggregator: { [key: string]: { orders: number; sales: number } };
}

export async function getAggregatorSalesSummary(
  date: string = todayLocal(),
  key?: string
): Promise<AggregatorSalesSummary> {
  const data = await reportFetch<{ summary: AggregatorSalesSummary }>(
    `/api/reports/aggregator-summary?date=${encodeURIComponent(date)}`,
    key
  );
  return data.summary;
}

export async function getAggregatorTransactions(
  date: string = todayLocal(),
  key?: string
): Promise<SalesTransaction[]> {
  const data = await reportFetch<{ transactions: SalesTransaction[] }>(
    `/api/reports/aggregator-transactions?date=${encodeURIComponent(date)}`,
    key
  );
  return data.transactions;
}

// ---------------------------------------------------------------------------
// Owner-app analytics (analyticsStore shapes; POS sales + aggregator combined).
// Consumed by analyticsRemote.ts to back analyticsStore over the tunnel.
// ---------------------------------------------------------------------------

export async function fetchAnalyticsSalesMetrics(key?: string): Promise<SalesMetrics> {
  const data = await reportFetch<{ salesMetrics: SalesMetrics }>('/api/reports/analytics/sales-metrics', key);
  return data.salesMetrics;
}

export async function fetchAnalyticsOrderMetrics(key?: string): Promise<OrderMetrics> {
  const data = await reportFetch<{ orderMetrics: OrderMetrics }>('/api/reports/analytics/order-metrics', key);
  return data.orderMetrics;
}

export async function fetchAnalyticsPerformance(key?: string): Promise<PerformanceMetrics> {
  const data = await reportFetch<{ performanceMetrics: PerformanceMetrics }>('/api/reports/analytics/performance', key);
  return data.performanceMetrics;
}

export async function fetchAnalyticsPopularItems(limit = 10, key?: string): Promise<PopularItem[]> {
  const data = await reportFetch<{ popularItems: PopularItem[] }>(
    `/api/reports/analytics/popular-items?limit=${limit}`,
    key
  );
  return data.popularItems;
}

export async function fetchAnalyticsAggregatorPerformance(key?: string): Promise<AggregatorPerformance[]> {
  const data = await reportFetch<{ aggregatorPerformance: AggregatorPerformance[] }>(
    '/api/reports/analytics/aggregator-performance',
    key
  );
  return data.aggregatorPerformance;
}

export async function fetchAnalyticsDailySales(days = 30, key?: string): Promise<DailySales[]> {
  const data = await reportFetch<{ dailySales: DailySales[] }>(
    `/api/reports/analytics/daily-sales?limit=${days}`,
    key
  );
  return data.dailySales;
}
