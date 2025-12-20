/**
 * Reports Panel Component
 * Comprehensive analytics and reports display
 */

import { useEffect } from 'react';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import SalesChart from './SalesChart';
import { cn } from '../../lib/utils';

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
        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="glass-panel p-6 rounded-2xl border border-red-500/30 bg-red-500/10">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-2xl">
            📈
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Analytics & Reports</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {lastUpdated ? `Last updated: ${new Date(lastUpdated).toLocaleString()}` : 'Real-time insights'}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchAllMetrics(tenantId)}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold uppercase tracking-wider hover:bg-white/10 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
              Loading...
            </>
          ) : (
            <>↻ Refresh</>
          )}
        </button>
      </div>

      {/* Sales Metrics */}
      {salesMetrics && (
        <div>
          <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest mb-4">Sales Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="Today"
              value={formatCurrency(salesMetrics.today.revenue)}
              subtext={`${salesMetrics.today.orders} orders`}
              detail={`Avg: ${formatCurrency(salesMetrics.today.averageOrderValue)}`}
              color="accent"
            />
            <MetricCard
              label="This Week"
              value={formatCurrency(salesMetrics.week.revenue)}
              subtext={`${salesMetrics.week.orders} orders`}
              detail={`Avg: ${formatCurrency(salesMetrics.week.averageOrderValue)}`}
              color="blue"
            />
            <MetricCard
              label="This Month"
              value={formatCurrency(salesMetrics.month.revenue)}
              subtext={`${salesMetrics.month.orders} orders`}
              detail={`Avg: ${formatCurrency(salesMetrics.month.averageOrderValue)}`}
              color="green"
            />
          </div>
        </div>
      )}

      {/* Sales Trend Chart */}
      {dailySales.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-border">
          <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest mb-4">
            Sales Trend (Last 30 Days)
          </h3>
          <SalesChart data={dailySales} height={250} />
        </div>
      )}

      {/* Order & Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Metrics */}
        {orderMetrics && (
          <div className="glass-panel p-6 rounded-2xl border border-border">
            <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest mb-4">Order Statistics</h3>
            <div className="space-y-3">
              <StatRow label="Total Orders" value={orderMetrics.total.toString()} />
              <StatRow label="Completed" value={orderMetrics.completed.toString()} color="green" />
              <StatRow label="In Progress" value={orderMetrics.inProgress.toString()} color="blue" />
              <StatRow label="Pending" value={orderMetrics.pending.toString()} color="amber" />
              <StatRow label="Cancelled" value={orderMetrics.cancelled.toString()} color="red" />
              <div className="pt-3 border-t border-border">
                <StatRow label="Completion Rate" value={formatPercent(orderMetrics.completionRate)} color="green" bold />
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {performanceMetrics && (
          <div className="glass-panel p-6 rounded-2xl border border-border">
            <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest mb-4">Performance</h3>
            <div className="space-y-3">
              <StatRow label="Avg Prep Time" value={`${performanceMetrics.averagePrepTime} min`} />
              <StatRow label="Order Accuracy" value={formatPercent(performanceMetrics.orderAccuracy)} color="green" />
              <StatRow label="On-Time Delivery" value={formatPercent(performanceMetrics.onTimeDelivery)} color="green" />
              <StatRow label="Customer Satisfaction" value={`${performanceMetrics.customerSatisfaction} / 5`} color="blue" />
            </div>
          </div>
        )}
      </div>

      {/* Popular Items & Station Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Popular Items */}
        {popularItems.length > 0 && (
          <div className="glass-panel p-6 rounded-2xl border border-border">
            <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest mb-4">Top Selling Items</h3>
            <div className="space-y-3">
              {popularItems.slice(0, 5).map((item, index) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black",
                      index === 0 && "bg-amber-500/20 text-amber-400",
                      index === 1 && "bg-slate-400/20 text-slate-400",
                      index === 2 && "bg-orange-700/20 text-orange-600",
                      index > 2 && "bg-white/10 text-muted-foreground"
                    )}>
                      #{index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-sm">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">{item.quantity} sold</div>
                    </div>
                  </div>
                  <span className="font-bold text-accent">{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Station Performance */}
        {stationPerformance.length > 0 && (
          <div className="glass-panel p-6 rounded-2xl border border-border">
            <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest mb-4">Station Performance</h3>
            <div className="space-y-3">
              {stationPerformance.map((station) => (
                <div key={station.station} className="p-3 bg-white/5 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{station.station}</span>
                    <span className="text-xs text-muted-foreground">{station.ordersProcessed} orders</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg: {station.averagePrepTime} min</span>
                    <span className={cn(
                      "font-bold",
                      station.onTimeRate >= 95 ? "text-green-400" : "text-amber-400"
                    )}>
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
        <div className="glass-panel p-6 rounded-2xl border border-border">
          <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest mb-4">Aggregator Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aggregatorPerformance.map((agg) => (
              <div
                key={agg.aggregator}
                className={cn(
                  "p-4 rounded-xl border",
                  agg.aggregator === 'zomato' && "bg-red-500/10 border-red-500/30",
                  agg.aggregator === 'swiggy' && "bg-orange-500/10 border-orange-500/30",
                  !['zomato', 'swiggy'].includes(agg.aggregator) && "bg-white/5 border-border"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-black uppercase">{agg.aggregator}</span>
                  <span className="text-xs text-muted-foreground">{agg.orders} orders</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-bold">{formatCurrency(agg.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Order Value</span>
                    <span className="font-bold">{formatCurrency(agg.averageOrderValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Acceptance Rate</span>
                    <span className={cn(
                      "font-bold",
                      agg.acceptanceRate >= 90 ? "text-green-400" : "text-amber-400"
                    )}>
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

// Helper component for metric cards
function MetricCard({
  label,
  value,
  subtext,
  detail,
  color = 'accent'
}: {
  label: string;
  value: string;
  subtext: string;
  detail: string;
  color?: 'accent' | 'blue' | 'green';
}) {
  return (
    <div className="glass-panel p-6 rounded-2xl border border-border relative overflow-hidden group">
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20",
        color === 'accent' && "bg-accent",
        color === 'blue' && "bg-blue-500",
        color === 'green' && "bg-green-500"
      )} />
      <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</div>
      <div className={cn(
        "mt-2 text-3xl font-black",
        color === 'accent' && "text-accent",
        color === 'blue' && "text-blue-400",
        color === 'green' && "text-green-400"
      )}>
        {value}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        {subtext}
      </div>
      <div className="text-xs text-muted-foreground/70 mt-1">
        {detail}
      </div>
    </div>
  );
}

// Helper component for stat rows
function StatRow({
  label,
  value,
  color,
  bold
}: {
  label: string;
  value: string;
  color?: 'green' | 'blue' | 'amber' | 'red';
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={cn("text-muted-foreground", bold && "font-bold text-foreground")}>{label}</span>
      <span className={cn(
        "font-bold",
        !color && "text-foreground",
        color === 'green' && "text-green-400",
        color === 'blue' && "text-blue-400",
        color === 'amber' && "text-amber-400",
        color === 'red' && "text-red-400"
      )}>
        {value}
      </span>
    </div>
  );
}
