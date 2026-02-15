/**
 * Telemetry Service
 * Captures errors, events, and diagnostic data
 * Sends to Cloudflare Worker for storage in R2 and notifications
 */

import { isTauri } from './platform';

interface TelemetryEvent {
  type: 'error' | 'warning' | 'info' | 'provision_flow';
  timestamp: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
  userAgent?: string;
  platform?: string;
  appVersion?: string;
  sessionId?: string;
  tenantId?: string;
}

interface TelemetryConfig {
  endpoint: string;
  enabled: boolean;
  debugMode: boolean;
  batchSize: number;
  flushInterval: number;
}

class TelemetryService {
  private config: TelemetryConfig;
  private queue: TelemetryEvent[] = [];
  private sessionId: string;
  private installationId: string;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      endpoint: import.meta.env.VITE_TELEMETRY_ENDPOINT ||
        'https://handsfree-telemetry.suyesh.workers.dev',
      enabled: import.meta.env.PROD, // Only in production by default
      debugMode: import.meta.env.DEV,
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
    };

    this.sessionId = this.generateSessionId();
    this.installationId = this.getOrCreateInstallationId();

    // Start flush timer
    this.startFlushTimer();

    // Capture unhandled errors
    this.setupGlobalErrorHandlers();

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private getOrCreateInstallationId(): string {
    // Check if localStorage is available
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return `install-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }

    // Check localStorage for existing installation ID
    try {
      let installationId = localStorage.getItem('installation-id');

      if (!installationId) {
        // Generate new installation ID
        installationId = `install-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // IMPORTANT: Only persist the installation ID after tenant creation is complete
        // Check if tenant has been created by looking for tenant-storage in localStorage
        const hasTenant = this.hasTenantCreated();

        if (hasTenant) {
          // Tenant exists - safe to persist installation ID
          localStorage.setItem('installation-id', installationId);
        } else {
          // No tenant yet - store temporarily in memory only
          // Installation ID will be persisted when tenant is created
          console.debug('[Telemetry] Tenant not yet created - installation ID will be persisted after tenant creation');
        }
      }

      return installationId;
    } catch (e) {
      // Fallback if localStorage access fails
      return `install-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
  }

  private hasTenantCreated(): boolean {
    // Check if localStorage is available
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }

    try {
      // Check for tenant-storage (zustand persist)
      const tenantStorage = localStorage.getItem('tenant-storage');
      if (tenantStorage) {
        const parsed = JSON.parse(tenantStorage);
        // Tenant is created if we have a tenantId
        return !!parsed?.state?.tenant?.tenantId;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Persist installation ID to localStorage after tenant creation
   * This should be called after tenant is successfully created
   */
  public persistInstallationId(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      // Only persist if not already stored and we have a tenant
      const existingId = localStorage.getItem('installation-id');
      if (!existingId && this.hasTenantCreated()) {
        localStorage.setItem('installation-id', this.installationId);
        console.debug('[Telemetry] Installation ID persisted after tenant creation');
      }
    } catch (e) {
      console.error('[Telemetry] Failed to persist installation ID:', e);
    }
  }

  private getTenantId(): string | undefined {
    // Check if localStorage is available
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return undefined;
    }

    // Try to get tenant ID from tenant store
    try {
      const tenantStorage = localStorage.getItem('tenant-storage');
      if (tenantStorage) {
        const parsed = JSON.parse(tenantStorage);
        return parsed?.state?.tenant?.tenantId;
      }
    } catch (e) {
      // Ignore parse errors
    }
    return undefined;
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  private setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        type: 'unhandled_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          type: 'unhandled_rejection',
        }
      );
    });
  }

  /**
   * Capture an error with context
   */
  captureError(error: Error, context?: Record<string, any>) {
    const event: TelemetryEvent = {
      type: 'error',
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      ...this.getSystemInfo(),
    };

    this.addEvent(event);
  }

  /**
   * Capture a warning
   */
  captureWarning(message: string, context?: Record<string, any>) {
    const event: TelemetryEvent = {
      type: 'warning',
      timestamp: new Date().toISOString(),
      message,
      context,
      ...this.getSystemInfo(),
    };

    this.addEvent(event);
  }

  /**
   * Capture an info event
   */
  captureInfo(message: string, context?: Record<string, any>) {
    const event: TelemetryEvent = {
      type: 'info',
      timestamp: new Date().toISOString(),
      message,
      context,
      ...this.getSystemInfo(),
    };

    this.addEvent(event);
  }

  /**
   * Capture provisioning flow event (critical for debugging)
   */
  captureProvisioningEvent(step: string, data: Record<string, any>) {
    const event: TelemetryEvent = {
      type: 'provision_flow',
      timestamp: new Date().toISOString(),
      message: `Provisioning: ${step}`,
      context: {
        step,
        ...data,
      },
      ...this.getSystemInfo(),
    };

    this.addEvent(event);

    // Also log locally in dev
    if (this.config.debugMode) {
      console.log('[Telemetry]', step, data);
    }
  }

  private getSystemInfo() {
    return {
      sessionId: this.sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
      appVersion: this.getAppVersion(),
      isTauri: isTauri(),
    };
  }

  private getAppVersion(): string {
    // Try to get from build info
    try {
      return 'v1.0.0'; // Replace with actual version reading logic
    } catch {
      return 'unknown';
    }
  }

  private addEvent(event: TelemetryEvent) {
    this.queue.push(event);

    // Log locally in debug mode
    if (this.config.debugMode) {
      console.log('[Telemetry]', event.type, event.message, event.context);
    }

    // Flush if batch size reached
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush queued events to server
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || !this.config.enabled) {
      return;
    }

    const events = [...this.queue];
    this.queue = [];

    try {
      const response = await fetch(`${this.config.endpoint}/api/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events,
          sessionId: this.sessionId,
          installationId: this.installationId,
          tenantId: this.getTenantId(),
        }),
      });

      if (!response.ok) {
        console.error('[Telemetry] Failed to send events:', response.status);
        // Put events back in queue on failure
        this.queue.unshift(...events);
      }
    } catch (error) {
      console.error('[Telemetry] Failed to send events:', error);
      // Put events back in queue on failure
      this.queue.unshift(...events);
    }
  }

  /**
   * Enable/disable telemetry
   */
  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Singleton instance
export const telemetry = new TelemetryService();

// Convenience exports
export const captureError = (error: Error, context?: Record<string, any>) =>
  telemetry.captureError(error, context);

export const captureWarning = (message: string, context?: Record<string, any>) =>
  telemetry.captureWarning(message, context);

export const captureInfo = (message: string, context?: Record<string, any>) =>
  telemetry.captureInfo(message, context);

export const captureProvisioningEvent = (step: string, data: Record<string, any>) =>
  telemetry.captureProvisioningEvent(step, data);
