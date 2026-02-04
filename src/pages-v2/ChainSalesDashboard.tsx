/**
 * Chain Sales Dashboard
 * Real-time sales aggregation across multiple restaurant locations
 * For multi-location restaurant chains
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChainSalesStore } from '../stores/chainSalesStore';
import { useDeviceStore } from '../stores/deviceStore';
import { cn } from '../lib/utils';
import { Radio, AlertCircle } from 'lucide-react';

export default function ChainSalesDashboard() {
  const navigate = useNavigate();
  const { shouldReceiveRealtimeSales } = useDeviceStore();
  const {
    locations,
    realtimeSalesFeed,
    selectedLocationId,
    aggregatedTotals,
    setSelectedLocation,
  } = useChainSalesStore();

  const [autoRefresh, setAutoRefresh] = useState(true);

  const isOwnerDevice = shouldReceiveRealtimeSales();

  // Convert locations Map to array for rendering
  const locationsArray = useMemo(() => Array.from(locations.values()), [locations]);

  // Filter sales feed by selected location
  const filteredSales = useMemo(() => {
    if (selectedLocationId === 'all') return realtimeSalesFeed;
    return realtimeSalesFeed.filter((sale) => sale.locationId === selectedLocationId);
  }, [realtimeSalesFeed, selectedLocationId]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get location badge color
  const getLocationBadgeColor = (locationId: string) => {
    const colors = [
      'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'bg-green-500/20 text-green-400 border-green-500/30',
      'bg-pink-500/20 text-pink-400 border-pink-500/30',
    ];
    const index = Array.from(locations.keys()).indexOf(locationId);
    return colors[index % colors.length];
  };

  if (!isOwnerDevice) {
    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex items-center justify-center">
        <div className="glass-panel-dark p-8 rounded-2xl border border-red-500/30 bg-red-500/10 max-w-md text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-400">
            Chain Sales Dashboard is only available on owner devices.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-6 py-2 bg-slate-700 hover:bg-slate-600 transition-colors rounded-lg font-bold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-700 hover:bg-slate-600 transition-colors rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold">CHAIN SALES DASHBOARD</h1>
            <p className="text-xs text-slate-400">{locationsArray.length} Locations</p>
          </div>
        </div>

        {/* Auto-refresh toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-bold">Auto-refresh</span>
        </label>
      </div>

      {/* Location Tabs */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-2 overflow-x-auto">
        <div className="flex gap-2">
          {/* All Locations Tab */}
          <button
            onClick={() => setSelectedLocation('all')}
            className={cn(
              'px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2',
              selectedLocationId === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white'
            )}
          >
            All Locations
            <span className="text-xs opacity-70">({locationsArray.length})</span>
          </button>

          {/* Individual Location Tabs */}
          {locationsArray.map((location) => (
            <button
              key={location.locationId}
              onClick={() => setSelectedLocation(location.locationId)}
              className={cn(
                'px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap flex items-center gap-2',
                selectedLocationId === location.locationId
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              )}
            >
              {/* Connection indicator */}
              <span className="relative flex h-2 w-2">
                {location.connectionStatus === 'connected' && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </>
                )}
                {location.connectionStatus === 'connecting' && (
                  <span className="inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                )}
                {location.connectionStatus === 'disconnected' && (
                  <span className="inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                )}
              </span>
              {location.locationName}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Aggregated Metrics Card */}
        <div className="glass-panel-dark p-6 rounded-2xl border border-slate-700 bg-gradient-to-br from-blue-900/20 to-purple-900/20">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">
              {selectedLocationId === 'all' ? 'All Locations Combined' : locations.get(selectedLocationId)?.locationName}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Sales</p>
              <p className="text-2xl font-black text-green-400">
                {formatCurrency(
                  selectedLocationId === 'all'
                    ? aggregatedTotals.totalSales
                    : locations.get(selectedLocationId)?.totalSales || 0
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Orders</p>
              <p className="text-2xl font-black text-blue-400">
                {selectedLocationId === 'all'
                  ? aggregatedTotals.totalOrders
                  : locations.get(selectedLocationId)?.totalOrders || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Average</p>
              <p className="text-2xl font-black text-purple-400">
                {formatCurrency(
                  selectedLocationId === 'all'
                    ? aggregatedTotals.averageOrderValue
                    : (locations.get(selectedLocationId)?.totalOrders || 0) > 0
                    ? (locations.get(selectedLocationId)?.totalSales || 0) / (locations.get(selectedLocationId)?.totalOrders || 1)
                    : 0
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Real-Time Sales Feed */}
          <div className="glass-panel-dark p-4 rounded-2xl border border-slate-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
              Real-Time Sales Feed ({filteredSales.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredSales.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No sales yet</p>
              ) : (
                filteredSales.map((sale, idx) => {
                  const location = locations.get(sale.locationId);
                  return (
                    <div
                      key={`${sale.id}-${idx}`}
                      className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('px-2 py-0.5 rounded text-xs font-bold border', getLocationBadgeColor(sale.locationId))}>
                            {location?.locationName || 'Unknown'}
                          </span>
                          <span className="text-xs text-slate-400">{sale.invoiceNumber}</span>
                        </div>
                        <span className="text-xs text-slate-500">{formatTimeAgo(sale.completedAt || sale.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-green-400">{formatCurrency(sale.grandTotal)}</span>
                        <span className="text-xs text-slate-400">{sale.orderType}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Location Breakdown */}
          <div className="glass-panel-dark p-4 rounded-2xl border border-slate-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">
              Location Breakdown
            </h3>
            <div className="space-y-3">
              {locationsArray.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No locations configured</p>
              ) : (
                locationsArray.map((location) => (
                  <div
                    key={location.locationId}
                    className={cn(
                      'p-4 rounded-lg border transition-colors cursor-pointer',
                      selectedLocationId === location.locationId
                        ? 'bg-blue-900/30 border-blue-500/50'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    )}
                    onClick={() => setSelectedLocation(location.locationId)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-bold border', getLocationBadgeColor(location.locationId))}>
                          {location.locationName}
                        </span>
                        {location.connectionStatus === 'connected' && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                        )}
                      </div>
                      {location.lastUpdate && (
                        <span className="text-xs text-slate-500">
                          {Math.floor((Date.now() - location.lastUpdate) / 1000)}s ago
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Sales</p>
                        <p className="font-bold text-green-400">{formatCurrency(location.totalSales)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Orders</p>
                        <p className="font-bold text-blue-400">{location.totalOrders}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
