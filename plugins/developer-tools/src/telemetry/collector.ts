/**
 * Telemetry Collector
 * Captures errors, performance metrics, and usage data for debugging
 * All data stored locally - privacy-first approach
 */

interface TelemetryConfig {
  collectErrors: boolean;
  collectPerformance: boolean;
  retentionDays: number;
}

interface TelemetryEvent {
  id: string;
  timestamp: number;
  type: 'error' | 'performance' | 'user_action' | 'api_call';
  data: any;
}

class TelemetryCollector {
  private config: TelemetryConfig | null = null;
  private events: TelemetryEvent[] = [];
  private maxEvents = 1000;
  private storageKey = 'developer-tools-telemetry';

  init(config: TelemetryConfig) {
    this.config = config;
    this.loadFromStorage();

    // Capture unhandled errors
    if (config.collectErrors) {
      window.addEventListener('error', this.handleError.bind(this));
      window.addEventListener('unhandledrejection', this.handleRejection.bind(this));
    }

    // Capture performance metrics
    if (config.collectPerformance) {
      this.startPerformanceMonitoring();
    }

    console.log('[Telemetry] Collector initialized');
  }

  stop() {
    window.removeEventListener('error', this.handleError.bind(this));
    window.removeEventListener('unhandledrejection', this.handleRejection.bind(this));
    this.saveToStorage();
    console.log('[Telemetry] Collector stopped');
  }

  private handleError(event: ErrorEvent) {
    this.recordEvent({
      type: 'error',
      data: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      },
    });
  }

  private handleRejection(event: PromiseRejectionEvent) {
    this.recordEvent({
      type: 'error',
      data: {
        message: 'Unhandled Promise Rejection',
        reason: String(event.reason),
        stack: event.reason?.stack,
      },
    });
  }

  private startPerformanceMonitoring() {
    // Monitor page load performance
    if (performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;

      this.recordEvent({
        type: 'performance',
        data: {
          metric: 'page_load',
          duration: loadTime,
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: timing.responseEnd - timing.requestStart,
        },
      });
    }

    // Monitor long tasks (performance observer)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Only log slow tasks
              this.recordEvent({
                type: 'performance',
                data: {
                  metric: 'long_task',
                  name: entry.name,
                  duration: entry.duration,
                  startTime: entry.startTime,
                },
              });
            }
          }
        });

        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (e) {
        console.warn('[Telemetry] Performance observer not supported');
      }
    }
  }

  recordEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>) {
    const telemetryEvent: TelemetryEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      ...event,
    };

    this.events.push(telemetryEvent);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Auto-save periodically
    if (this.events.length % 10 === 0) {
      this.saveToStorage();
    }
  }

  // Public API for manual event recording
  recordUserAction(action: string, data?: any) {
    this.recordEvent({
      type: 'user_action',
      data: { action, ...data },
    });
  }

  recordApiCall(endpoint: string, duration: number, status: number, error?: string) {
    this.recordEvent({
      type: 'api_call',
      data: { endpoint, duration, status, error },
    });
  }

  // Retrieve events for analysis
  getEvents(filter?: { type?: string; since?: number }): TelemetryEvent[] {
    let filtered = [...this.events];

    if (filter?.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    if (filter?.since) {
      filtered = filtered.filter(e => e.timestamp >= filter.since);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getErrorSummary(): { message: string; count: number; lastSeen: number }[] {
    const errors = this.getEvents({ type: 'error' });
    const grouped = new Map<string, { count: number; lastSeen: number }>();

    errors.forEach(event => {
      const message = event.data.message || 'Unknown error';
      const existing = grouped.get(message);

      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, event.timestamp);
      } else {
        grouped.set(message, { count: 1, lastSeen: event.timestamp });
      }
    });

    return Array.from(grouped.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count);
  }

  getPerformanceMetrics(): { metric: string; avgDuration: number; count: number }[] {
    const perfEvents = this.getEvents({ type: 'performance' });
    const grouped = new Map<string, { total: number; count: number }>();

    perfEvents.forEach(event => {
      const metric = event.data.metric;
      const duration = event.data.duration || 0;
      const existing = grouped.get(metric);

      if (existing) {
        existing.total += duration;
        existing.count++;
      } else {
        grouped.set(metric, { total: duration, count: 1 });
      }
    });

    return Array.from(grouped.entries())
      .map(([metric, data]) => ({
        metric,
        avgDuration: Math.round(data.total / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration);
  }

  clearEvents() {
    this.events = [];
    this.saveToStorage();
    console.log('[Telemetry] Events cleared');
  }

  exportEvents(): string {
    return JSON.stringify({
      exported_at: new Date().toISOString(),
      total_events: this.events.length,
      events: this.events,
      error_summary: this.getErrorSummary(),
      performance_metrics: this.getPerformanceMetrics(),
    }, null, 2);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.events = data.events || [];

        // Clean up old events based on retention
        if (this.config?.retentionDays) {
          const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
          this.events = this.events.filter(e => e.timestamp >= cutoff);
        }
      }
    } catch (e) {
      console.warn('[Telemetry] Failed to load from storage:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        saved_at: Date.now(),
        events: this.events,
      }));
    } catch (e) {
      console.warn('[Telemetry] Failed to save to storage:', e);
    }
  }
}

export const telemetryCollector = new TelemetryCollector();

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).telemetry = telemetryCollector;
}
