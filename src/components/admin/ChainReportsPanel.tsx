/**
 * Chain Reports Panel Component
 * Consolidated reporting dashboard for restaurant chains
 */

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  Store,
  Calendar,
  DollarSign,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
// import backendApi from '../../lib/backendApi';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

interface ChainReportsPanelProps {
  chainId: string;
}

interface KPIData {
  totalSales: number;
  avgPerLocation: number;
  topLocationName: string;
  topLocationSales: number;
  totalOrders: number;
  avgOrderValue: number;
}

interface LocationSales {
  locationName: string;
  sales: number;
  orders: number;
}

interface TopItem {
  itemName: string;
  quantitySold: number;
  totalRevenue: number;
}

export function ChainReportsPanel({ chainId }: ChainReportsPanelProps) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [locationSales, setLocationSales] = useState<LocationSales[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);

  // Load report data
  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Since chainReport methods don't exist yet, we'll use mock data
      // In production, these would call actual backend endpoints

      // Mock KPI data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      setKpiData({
        totalSales: 1250000,
        avgPerLocation: 312500,
        topLocationName: 'Downtown Branch',
        topLocationSales: 450000,
        totalOrders: 3420,
        avgOrderValue: 365.50,
      });

      setLocationSales([
        { locationName: 'Downtown Branch', sales: 450000, orders: 1200 },
        { locationName: 'Airport Location', sales: 380000, orders: 950 },
        { locationName: 'Mall Branch', sales: 290000, orders: 850 },
        { locationName: 'Suburban Outlet', sales: 130000, orders: 420 },
      ]);

      setTopItems([
        { itemName: 'Butter Chicken', quantitySold: 450, totalRevenue: 180000 },
        { itemName: 'Biryani', quantitySold: 380, totalRevenue: 152000 },
        { itemName: 'Paneer Tikka', quantitySold: 320, totalRevenue: 96000 },
        { itemName: 'Dal Makhani', quantitySold: 280, totalRevenue: 56000 },
        { itemName: 'Gulab Jamun', quantitySold: 250, totalRevenue: 25000 },
      ]);

      toast.success('Report loaded successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load report';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Load report on mount and when dates change
  useEffect(() => {
    if (chainId) {
      loadReportData();
    }
  }, [chainId, startDate, endDate]);

  // Calculate max sales for chart scaling
  const maxSales = Math.max(...locationSales.map(l => l.sales), 1);

  if (error) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-border">
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range */}
      <div className="glass-panel p-6 rounded-2xl border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Chain Reports</h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Performance Analytics
              </p>
            </div>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 rounded-2xl border border-border text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading report data...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          {kpiData && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Total Sales */}
              <div className="glass-panel p-6 rounded-2xl border border-border">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-bold">
                    +12.5%
                  </span>
                </div>
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                  Total Sales
                </h3>
                <p className="text-3xl font-black text-foreground">
                  ₹{(kpiData.totalSales / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpiData.totalOrders.toLocaleString()} orders
                </p>
              </div>

              {/* Average per Location */}
              <div className="glass-panel p-6 rounded-2xl border border-border">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-blue-500/20 flex items-center justify-center">
                    <Store className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold">
                    AVG
                  </span>
                </div>
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                  Avg per Location
                </h3>
                <p className="text-3xl font-black text-foreground">
                  ₹{(kpiData.avgPerLocation / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{kpiData.avgOrderValue.toFixed(2)} avg order value
                </p>
              </div>

              {/* Top Location */}
              <div className="glass-panel p-6 rounded-2xl border border-border">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-yellow-500/20 flex items-center justify-center">
                    <Award className="w-5 h-5 text-yellow-400" />
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">
                    TOP
                  </span>
                </div>
                <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-2">
                  Top Location
                </h3>
                <p className="text-xl font-bold text-foreground truncate">
                  {kpiData.topLocationName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ₹{(kpiData.topLocationSales / 1000).toFixed(0)}K sales
                </p>
              </div>
            </div>
          )}

          {/* Sales by Location Chart */}
          <div className="glass-panel p-6 rounded-2xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-black uppercase tracking-tight">Sales by Location</h3>
            </div>

            <div className="space-y-4">
              {locationSales.map((location, index) => {
                const percentage = (location.sales / maxSales) * 100;

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{location.locationName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">
                          {location.orders} orders
                        </span>
                        <span className="font-mono font-bold">
                          ₹{(location.sales / 1000).toFixed(0)}K
                        </span>
                      </div>
                    </div>
                    <div className="h-8 bg-white/5 overflow-hidden border border-white/10">
                      <div
                        className={cn(
                          "h-full flex items-center justify-end px-3 text-xs font-bold transition-all duration-500",
                          index === 0 && "bg-gradient-to-r from-green-500/40 to-green-500/60",
                          index === 1 && "bg-gradient-to-r from-blue-500/40 to-blue-500/60",
                          index === 2 && "bg-gradient-to-r from-purple-500/40 to-purple-500/60",
                          index === 3 && "bg-gradient-to-r from-orange-500/40 to-orange-500/60"
                        )}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 20 && `${percentage.toFixed(0)}%`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Selling Items */}
          <div className="glass-panel p-6 rounded-2xl border border-border">
            <div className="flex items-center gap-3 mb-6">
              <Award className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-black uppercase tracking-tight">Top Selling Items</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent font-bold ml-auto">
                Across Chain
              </span>
            </div>

            <div className="overflow-hidden border border-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/5 border-b border-border">
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Rank
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Item
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Qty Sold
                    </th>
                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item, index) => (
                    <tr key={index} className="border-b border-border hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className={cn(
                          "w-8 h-8  flex items-center justify-center font-black text-sm",
                          index === 0 && "bg-yellow-500/20 text-yellow-400",
                          index === 1 && "bg-muted/20 text-muted-foreground",
                          index === 2 && "bg-orange-500/20 text-orange-400",
                          index > 2 && "bg-white/5 text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{item.itemName}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {item.quantitySold.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        ₹{(item.totalRevenue / 1000).toFixed(1)}K
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info */}
          <div className="glass-panel p-4 border border-blue-500/30 bg-blue-500/5">
            <p className="text-xs text-blue-300">
              <strong>Note:</strong> This is a preview with mock data. Real-time chain reporting will be available once backend endpoints are deployed.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
