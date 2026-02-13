/**
 * Developer Diagnostics Page
 * Displays telemetry data, error logs, and performance metrics
 */

import { useState, useEffect } from 'react';
import { telemetryCollector } from '../telemetry/collector';
import { Download, Trash2, AlertTriangle, Activity, Clock, TrendingUp } from 'lucide-react';

export function DiagnosticsPage() {
  const [errors, setErrors] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const loadData = () => {
    setErrors(telemetryCollector.getErrorSummary());
    setPerformance(telemetryCollector.getPerformanceMetrics());
    setRecentEvents(telemetryCollector.getEvents().slice(0, 50));
  };

  const handleExport = () => {
    const data = telemetryCollector.exportEvents();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Clear all telemetry data?')) {
      telemetryCollector.clearEvents();
      setRefreshKey(k => k + 1);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Developer Diagnostics</h1>
          <p className="text-muted-foreground mt-1">
            Error logs, performance metrics, and telemetry data
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="px-4 py-2 bg-surface-2 text-foreground rounded-lg hover:bg-surface-3 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            Clear
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-destructive" size={24} />
            <h3 className="text-lg font-semibold text-foreground">Errors</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{errors.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Unique error types</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="text-info" size={24} />
            <h3 className="text-lg font-semibold text-foreground">Events</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{recentEvents.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Total events captured</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="text-success" size={24} />
            <h3 className="text-lg font-semibold text-foreground">Performance</h3>
          </div>
          <p className="text-3xl font-bold text-foreground">{performance.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Metrics tracked</p>
        </div>
      </div>

      {/* Error Summary */}
      {errors.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="text-destructive" size={20} />
            Error Summary
          </h2>
          <div className="space-y-2">
            {errors.map((error, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-surface-2 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{error.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last seen: {new Date(error.lastSeen).toLocaleString()}
                  </p>
                </div>
                <div className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-sm font-medium">
                  {error.count}x
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {performance.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="text-info" size={20} />
            Performance Metrics
          </h2>
          <div className="space-y-2">
            {performance.map((metric, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-surface-2 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{metric.metric}</p>
                  <p className="text-xs text-muted-foreground">
                    {metric.count} samples
                  </p>
                </div>
                <div className="px-3 py-1 bg-info/10 text-info rounded-full text-sm font-medium">
                  {metric.avgDuration}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Recent Events</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentEvents.map((event) => (
            <div
              key={event.id}
              className="p-3 bg-surface-2 rounded-lg text-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  event.type === 'error' ? 'bg-destructive/10 text-destructive' :
                  event.type === 'performance' ? 'bg-info/10 text-info' :
                  event.type === 'user_action' ? 'bg-success/10 text-success' :
                  'bg-warning/10 text-warning'
                }`}>
                  {event.type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
              <pre className="text-xs text-muted-foreground mt-2 overflow-x-auto">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {/* Console Commands */}
      <div className="bg-info/10 border border-info/30 rounded-lg p-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Console Commands</h2>
        <div className="space-y-2 text-sm font-mono">
          <p className="text-foreground">
            <span className="text-info">window.kdsDebug</span> - KDS debugging utilities
          </p>
          <p className="text-foreground">
            <span className="text-info">window.kotDiag()</span> - KOT diagnostic check
          </p>
          <p className="text-foreground">
            <span className="text-info">window.mockOrders</span> - Generate test orders
          </p>
          <p className="text-foreground">
            <span className="text-info">window.getActivationCode()</span> - View activation code
          </p>
          <p className="text-foreground">
            <span className="text-info">window.telemetry</span> - Access telemetry collector
          </p>
        </div>
      </div>
    </div>
  );
}
