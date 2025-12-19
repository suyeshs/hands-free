/**
 * Reports Panel Component
 * Comprehensive analytics and reports display
 */

import { useEffect } from 'react';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import SalesChart from './SalesChart';

interface ReportsPanelProps {
  tenantId: string;
}

export default function ReportsPanel({ tenantId }: ReportsPanelProps) {
  const {
    salesMetrics,
    orderMetrics,
    performanceMetrics,
    popularItems,
    stationPerformance,
    aggregatorPerformance,
    dailySales,
    isLoading,
    error,
    lastUpdated,
    fetchAllMetrics,
  } = useAnalyticsStore();

  useEffect(() => {
    if (tenantId) {
      fetchAllMetrics(tenantId);
    }
  }, [tenantId, fetchAllMetrics]);

  if (isLoading && !salesMetrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-xs text-gray-500 text-right">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </div>
      )}

      {/* Sales Metrics */}
      {salesMetrics && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Today</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {formatCurrency(salesMetrics.today.revenue)}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {salesMetrics.today.orders} orders • Avg: {formatCurrency(salesMetrics.today.averageOrderValue)}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">This Week</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {formatCurrency(salesMetrics.week.revenue)}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {salesMetrics.week.orders} orders • Avg: {formatCurrency(salesMetrics.week.averageOrderValue)}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">This Month</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">
                {formatCurrency(salesMetrics.month.revenue)}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {salesMetrics.month.orders} orders • Avg: {formatCurrency(salesMetrics.month.averageOrderValue)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Trend Chart */}
      {dailySales.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend (Last 30 Days)</h3>
          <SalesChart data={dailySales} height={250} />
        </div>
      )}

      {/* Order & Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Metrics */}
        {orderMetrics && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Orders</span>
                <span className="font-semibold text-gray-900">{orderMetrics.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Completed</span>
                <span className="font-semibold text-green-600">{orderMetrics.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">In Progress</span>
                <span className="font-semibold text-blue-600">{orderMetrics.inProgress}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending</span>
                <span className="font-semibold text-yellow-600">{orderMetrics.pending}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cancelled</span>
                <span className="font-semibold text-red-600">{orderMetrics.cancelled}</span>
              </div>
              <div className="pt-3 border-t flex justify-between items-center">
                <span className="text-gray-900 font-medium">Completion Rate</span>
                <span className="font-bold text-green-600">{formatPercent(orderMetrics.completionRate)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {performanceMetrics && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Prep Time</span>
                <span className="font-semibold text-gray-900">{performanceMetrics.averagePrepTime} min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Order Accuracy</span>
                <span className="font-semibold text-green-600">{formatPercent(performanceMetrics.orderAccuracy)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">On-Time Delivery</span>
                <span className="font-semibold text-green-600">{formatPercent(performanceMetrics.onTimeDelivery)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Customer Satisfaction</span>
                <span className="font-semibold text-blue-600">{performanceMetrics.customerSatisfaction} / 5</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Popular Items & Station Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Popular Items */}
        {popularItems.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Items</h3>
            <div className="space-y-3">
              {popularItems.slice(0, 5).map((item, index) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                    <div>
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.quantity} sold</div>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Station Performance */}
        {stationPerformance.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Station Performance</h3>
            <div className="space-y-3">
              {stationPerformance.map((station) => (
                <div key={station.station} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{station.station}</span>
                    <span className="text-sm text-gray-600">{station.ordersProcessed} orders</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Avg: {station.averagePrepTime} min</span>
                    <span className={`font-medium ${station.onTimeRate >= 95 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {formatPercent(station.onTimeRate)} on-time
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Aggregator Performance */}
      {aggregatorPerformance.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Aggregator Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aggregatorPerformance.map((agg) => (
              <div key={agg.aggregator} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold text-gray-900 capitalize">{agg.aggregator}</span>
                  <span className="text-sm text-gray-500">{agg.orders} orders</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue</span>
                    <span className="font-semibold">{formatCurrency(agg.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Order Value</span>
                    <span className="font-semibold">{formatCurrency(agg.averageOrderValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Acceptance Rate</span>
                    <span className={`font-semibold ${agg.acceptanceRate >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {formatPercent(agg.acceptanceRate)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
