/**
 * Multi-Location Sync Service
 * Polls each location's SQLite database for new sales and aggregates them
 * Uses simple polling approach (5s interval) instead of complex WebSocket pooling
 */

import Database from '@tauri-apps/plugin-sql';
import { useMultiLocationStore, Location } from '../stores/multiLocationStore';
import { useChainSalesStore } from '../stores/chainSalesStore';
// import type { SalesTransaction } from '../lib/salesTransactionService';

interface SalesTransactionRow {
  id: string;
  tenant_id: string;
  invoice_number: string;
  order_number: string | null;
  order_type: string;
  table_number: number | null;
  source: string;
  subtotal: number;
  service_charge: number;
  cgst: number;
  sgst: number;
  discount: number;
  round_off: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  items_json: string;
  cashier_name: string | null;
  staff_id: string | null;
  created_at: string;
  completed_at: string;
}

class MultiLocationSyncService {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastSyncTimes: Map<string, string> = new Map();
  private isActive = false;
  private readonly POLL_INTERVAL = 5000; // 5 seconds

  /**
   * Start polling all active locations
   */
  async startPolling() {
    if (this.isActive) {
      console.log('[MultiLocationSyncService] Already polling');
      return;
    }

    const locations = useMultiLocationStore.getState().getActiveLocations();
    if (locations.length === 0) {
      console.log('[MultiLocationSyncService] No active locations to poll');
      return;
    }

    this.isActive = true;
    console.log(`[MultiLocationSyncService] Starting polling for ${locations.length} locations`);

    locations.forEach((location) => {
      this.startLocationPolling(location);
    });
  }

  /**
   * Stop polling all locations
   */
  stopPolling() {
    console.log('[MultiLocationSyncService] Stopping all polling');
    this.isActive = false;

    this.pollingIntervals.forEach((interval, locationId) => {
      clearInterval(interval);
      console.log(`[MultiLocationSyncService] Stopped polling ${locationId}`);
    });

    this.pollingIntervals.clear();
  }

  /**
   * Start polling a specific location
   */
  private startLocationPolling(location: Location) {
    if (this.pollingIntervals.has(location.id)) {
      console.log(`[MultiLocationSyncService] Already polling ${location.name}`);
      return;
    }

    console.log(`[MultiLocationSyncService] Starting polling for ${location.name}`);

    // Initialize last sync time to now (avoid pulling all historical data)
    if (!this.lastSyncTimes.has(location.id)) {
      this.lastSyncTimes.set(location.id, new Date().toISOString());
    }

    // Immediate first poll
    this.pollLocation(location);

    // Set up interval polling
    const interval = setInterval(() => {
      this.pollLocation(location);
    }, this.POLL_INTERVAL);

    this.pollingIntervals.set(location.id, interval);
  }

  /**
   * Stop polling a specific location
   */
  stopLocationPolling(locationId: string) {
    const interval = this.pollingIntervals.get(locationId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(locationId);
      console.log(`[MultiLocationSyncService] Stopped polling ${locationId}`);
    }
  }

  /**
   * Poll a location's database for new sales
   */
  private async pollLocation(location: Location) {
    try {
      const newSales = await this.fetchNewSales(location);

      if (newSales.length > 0) {
        console.log(
          `[MultiLocationSyncService] Found ${newSales.length} new sales from ${location.name}`
        );

        // Broadcast each sale to chain sales store
        newSales.forEach((sale) => {
          useChainSalesStore.getState().addSaleFromLocation(location.id, {
            id: sale.id,
            invoiceNumber: sale.invoice_number,
            orderNumber: sale.order_number || '',
            orderType: sale.order_type,
            tableNumber: sale.table_number ?? undefined,
            source: sale.source,
            subtotal: sale.subtotal,
            serviceCharge: sale.service_charge,
            cgst: sale.cgst,
            sgst: sale.sgst,
            discount: sale.discount,
            roundOff: sale.round_off,
            grandTotal: sale.grand_total,
            paymentMethod: sale.payment_method as any,
            paymentStatus: sale.payment_status,
            items: JSON.parse(sale.items_json),
            cashierName: sale.cashier_name ?? undefined,
            staffId: sale.staff_id ?? undefined,
            createdAt: sale.created_at,
            completedAt: sale.completed_at,
          });
        });

        // Update last sync time to the latest sale's completed_at
        const latestSale = newSales[newSales.length - 1];
        this.lastSyncTimes.set(location.id, latestSale.completed_at);
      }

      // Update connection status to connected
      useChainSalesStore.getState().updateLocationStatus(location.id, 'connected');
    } catch (error) {
      console.error(`[MultiLocationSyncService] Failed to poll ${location.name}:`, error);
      useChainSalesStore.getState().updateLocationStatus(location.id, 'disconnected');
    }
  }

  /**
   * Fetch new sales from a location's database
   */
  private async fetchNewSales(location: Location): Promise<SalesTransactionRow[]> {
    try {
      const db = await Database.load(`sqlite:${location.dbPath}`);
      const lastSync = this.lastSyncTimes.get(location.id) || new Date(0).toISOString();

      const rows = await db.select<SalesTransactionRow[]>(
        `SELECT * FROM sales_transactions
         WHERE completed_at > $1
         ORDER BY completed_at ASC
         LIMIT 100`,
        [lastSync]
      );

      return rows;
    } catch (error) {
      console.error(
        `[MultiLocationSyncService] Failed to fetch sales from ${location.name}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger a sync for a specific location (for testing)
   */
  async syncLocation(locationId: string) {
    const location = useMultiLocationStore.getState().getLocationById(locationId);
    if (!location) {
      console.warn(`[MultiLocationSyncService] Location not found: ${locationId}`);
      return;
    }

    console.log(`[MultiLocationSyncService] Manual sync for ${location.name}`);
    await this.pollLocation(location);
  }

  /**
   * Get last sync time for a location
   */
  getLastSyncTime(locationId: string): string | undefined {
    return this.lastSyncTimes.get(locationId);
  }

  /**
   * Check if polling is active
   */
  isPolling(): boolean {
    return this.isActive;
  }

  /**
   * Get list of currently polling location IDs
   */
  getPollingLocations(): string[] {
    return Array.from(this.pollingIntervals.keys());
  }
}

// Singleton instance
export const multiLocationSyncService = new MultiLocationSyncService();

// Helper hook for React components
export const useMultiLocationSync = () => {
  const startPolling = () => multiLocationSyncService.startPolling();
  const stopPolling = () => multiLocationSyncService.stopPolling();
  const syncLocation = (locationId: string) => multiLocationSyncService.syncLocation(locationId);
  const isPolling = () => multiLocationSyncService.isPolling();
  const getPollingLocations = () => multiLocationSyncService.getPollingLocations();

  return {
    startPolling,
    stopPolling,
    syncLocation,
    isPolling,
    getPollingLocations,
  };
};
