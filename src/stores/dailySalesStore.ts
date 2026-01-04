/**
 * Daily Sales Store
 * Manages state for daily sales reports and cash register
 * Fetches from D1 cloud as primary source with local SQLite fallback
 */

import { create } from 'zustand';
import {
  salesTransactionService,
  SalesTransaction,
  SalesSummary,
  PaymentBreakdown,
  HourlySales,
  TopItem,
  OrderTypeBreakdown,
  SourceBreakdown,
} from '../lib/salesTransactionService';
import { cashRegisterService, CashRegister } from '../lib/cashRegisterService';
import {
  cashPayoutService,
  CashPayout,
  PayoutType,
  PayoutCategory,
  PayoutSummary,
} from '../lib/cashPayoutService';
import {
  getCombinedSalesFromCloud,
  getSalesBreakdownFromCloud,
  getTopItemsFromCloud,
} from '../lib/handsfreeApi';

export interface DailySalesReport {
  date: string;
  summary: SalesSummary;
  sourceBreakdown: SourceBreakdown;
  paymentBreakdown: PaymentBreakdown;
  hourlySales: HourlySales[];
  topItems: TopItem[];
  orderTypeBreakdown: OrderTypeBreakdown;
  transactions: SalesTransaction[];
}

// Type for incoming WebSocket sale transaction (from orderSyncService)
export interface IncomingSaleTransaction {
  id: string;
  invoiceNumber: string;
  orderNumber: string;
  orderType: string;
  tableNumber?: number;
  source: string;
  subtotal: number;
  serviceCharge: number;
  cgst: number;
  sgst: number;
  discount: number;
  roundOff: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    modifiers?: string[];
  }>;
  cashierName?: string;
  staffId?: string;
  createdAt: string;
  completedAt?: string;
}

interface DailySalesStore {
  // State
  selectedDate: string;
  report: DailySalesReport | null;
  cashRegister: CashRegister | null;
  payouts: CashPayout[];
  payoutSummary: PayoutSummary | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedDate: (date: string) => void;
  fetchReport: (tenantId: string, date?: string) => Promise<void>;
  fetchCashRegister: (tenantId: string, date?: string) => Promise<void>;

  // Real-time update (from WebSocket)
  addSale: (transaction: IncomingSaleTransaction) => void;

  // Cash register actions
  openCashRegister: (tenantId: string, openingCash: number, staffName?: string) => Promise<void>;
  closeCashRegister: (tenantId: string, actualCash: number, staffName?: string, notes?: string) => Promise<void>;
  isRegisterOpen: (tenantId: string) => Promise<boolean>;

  // Payout actions
  fetchPayouts: (tenantId: string, date?: string) => Promise<void>;
  recordPayout: (
    tenantId: string,
    amount: number,
    payoutType: PayoutType,
    recordedBy: string,
    options?: {
      category?: PayoutCategory;
      description?: string;
      referenceNumber?: string;
      authorizedBy?: string;
    }
  ) => Promise<CashPayout>;
  cancelPayout: (payoutId: string, tenantId: string) => Promise<void>;

  // Utilities
  getTodayDate: () => string;
  clearError: () => void;
}

const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const useDailySalesStore = create<DailySalesStore>((set, get) => ({
  // Initial state
  selectedDate: getTodayDate(),
  report: null,
  cashRegister: null,
  payouts: [],
  payoutSummary: null,
  isLoading: false,
  error: null,

  // Set selected date and optionally fetch report
  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
  },

  // Add a single sale to current report (called when WebSocket receives sale_completed)
  // This enables real-time dashboard updates across all connected devices
  addSale: (transaction: IncomingSaleTransaction) => {
    const report = get().report;
    const selectedDate = get().selectedDate;

    // Only update if we have a report and the transaction is for the selected date
    if (!report) {
      console.log('[DailySalesStore] No report loaded, skipping real-time update');
      return;
    }

    // Check if transaction is for the selected date
    const transactionDate = (transaction.completedAt || transaction.createdAt).split('T')[0];
    if (transactionDate !== selectedDate) {
      console.log('[DailySalesStore] Transaction date mismatch, skipping:', transactionDate, 'vs', selectedDate);
      return;
    }

    console.log('[DailySalesStore] Adding sale in real-time:', transaction.invoiceNumber, transaction.grandTotal);

    // Update summary
    const newSummary: SalesSummary = {
      totalSales: report.summary.totalSales + transaction.grandTotal,
      totalOrders: report.summary.totalOrders + 1,
      averageOrderValue: (report.summary.totalSales + transaction.grandTotal) / (report.summary.totalOrders + 1),
      totalTax: report.summary.totalTax + transaction.cgst + transaction.sgst,
      totalDiscount: report.summary.totalDiscount + transaction.discount,
      totalServiceCharge: report.summary.totalServiceCharge + transaction.serviceCharge,
    };

    // Update source breakdown
    const source = transaction.source.toLowerCase();
    const newSourceBreakdown: SourceBreakdown = { ...report.sourceBreakdown };
    if (source === 'pos' || source === 'dine-in' || source === 'takeout' || source === 'delivery') {
      newSourceBreakdown.pos = {
        orders: (newSourceBreakdown.pos?.orders || 0) + 1,
        sales: (newSourceBreakdown.pos?.sales || 0) + transaction.grandTotal,
      };
    } else if (source === 'zomato') {
      newSourceBreakdown.zomato = {
        orders: (newSourceBreakdown.zomato?.orders || 0) + 1,
        sales: (newSourceBreakdown.zomato?.sales || 0) + transaction.grandTotal,
      };
    } else if (source === 'swiggy') {
      newSourceBreakdown.swiggy = {
        orders: (newSourceBreakdown.swiggy?.orders || 0) + 1,
        sales: (newSourceBreakdown.swiggy?.sales || 0) + transaction.grandTotal,
      };
    } else if (source === 'website' || source === 'direct') {
      newSourceBreakdown.website = {
        orders: (newSourceBreakdown.website?.orders || 0) + 1,
        sales: (newSourceBreakdown.website?.sales || 0) + transaction.grandTotal,
      };
    }

    // Update payment breakdown
    const paymentMethod = transaction.paymentMethod.toLowerCase() as keyof PaymentBreakdown;
    const newPaymentBreakdown: PaymentBreakdown = { ...report.paymentBreakdown };
    if (paymentMethod in newPaymentBreakdown) {
      newPaymentBreakdown[paymentMethod] = (newPaymentBreakdown[paymentMethod] || 0) + transaction.grandTotal;
    }

    // Update hourly sales
    const completedAt = transaction.completedAt || transaction.createdAt;
    const hour = new Date(completedAt).getHours();
    const newHourlySales: HourlySales[] = [...report.hourlySales];
    if (newHourlySales[hour]) {
      newHourlySales[hour] = {
        ...newHourlySales[hour],
        sales: newHourlySales[hour].sales + transaction.grandTotal,
        orders: newHourlySales[hour].orders + 1,
      };
    }

    // Update order type breakdown
    const orderType = transaction.orderType.toLowerCase() as 'dine-in' | 'takeout' | 'delivery';
    const newOrderTypeBreakdown: OrderTypeBreakdown = { ...report.orderTypeBreakdown };
    if (orderType in newOrderTypeBreakdown) {
      newOrderTypeBreakdown[orderType] = {
        count: (newOrderTypeBreakdown[orderType]?.count || 0) + 1,
        sales: (newOrderTypeBreakdown[orderType]?.sales || 0) + transaction.grandTotal,
      };
    }

    // Update top items (just add to existing, proper re-ranking would need backend)
    const newTopItems = [...report.topItems];
    transaction.items.forEach(item => {
      const existingIdx = newTopItems.findIndex(t => t.name === item.name);
      if (existingIdx >= 0) {
        newTopItems[existingIdx] = {
          ...newTopItems[existingIdx],
          quantity: newTopItems[existingIdx].quantity + item.quantity,
          revenue: newTopItems[existingIdx].revenue + item.subtotal,
        };
      }
      // Don't add new items to top list in real-time to avoid UI jumps
    });

    // Re-sort top items by revenue
    newTopItems.sort((a, b) => b.revenue - a.revenue);

    // Note: We don't add to transactions array since we don't have the full SalesTransaction type
    // The transactions list will be refreshed on next full fetch

    set({
      report: {
        ...report,
        summary: newSummary,
        sourceBreakdown: newSourceBreakdown,
        paymentBreakdown: newPaymentBreakdown,
        hourlySales: newHourlySales,
        orderTypeBreakdown: newOrderTypeBreakdown,
        topItems: newTopItems,
      },
    });

    console.log('[DailySalesStore] Real-time update applied successfully');
  },

  // Fetch complete daily sales report (including aggregator/online orders)
  // Tries D1 cloud first, falls back to local SQLite if cloud fails
  fetchReport: async (tenantId: string, date?: string) => {
    const targetDate = date || get().selectedDate;
    set({ isLoading: true, error: null });

    try {
      // Try to fetch from D1 cloud first for consolidated view
      console.log('[DailySalesStore] Fetching from D1 cloud...');

      const [cloudCombined, cloudBreakdown, cloudTopItems] = await Promise.all([
        getCombinedSalesFromCloud(tenantId, { from: targetDate, to: targetDate }),
        getSalesBreakdownFromCloud(tenantId, { from: targetDate, to: targetDate }),
        getTopItemsFromCloud(tenantId, { from: targetDate, to: targetDate, limit: 10 }),
      ]);

      console.log('[DailySalesStore] Cloud data received:', cloudCombined);

      // Build report from cloud data
      const summary: SalesSummary = {
        totalSales: cloudCombined.total.totalSales,
        totalOrders: cloudCombined.total.totalOrders,
        averageOrderValue: cloudCombined.total.averageOrderValue,
        totalTax: cloudCombined.pos.totalTax || 0,
        totalDiscount: cloudCombined.pos.totalDiscount || 0,
        totalServiceCharge: cloudCombined.pos.totalServiceCharge || 0,
      };

      const sourceBreakdown: SourceBreakdown = {
        pos: cloudCombined.pos.bySource?.['pos'] || { orders: cloudCombined.pos.totalOrders, sales: cloudCombined.pos.totalSales },
        zomato: cloudCombined.aggregator.byAggregator['zomato'] || { orders: 0, sales: 0 },
        swiggy: cloudCombined.aggregator.byAggregator['swiggy'] || { orders: 0, sales: 0 },
        website: cloudCombined.aggregator.byAggregator['direct'] || cloudCombined.aggregator.byAggregator['website'] || { orders: 0, sales: 0 },
      };

      const paymentBreakdown: PaymentBreakdown = {
        cash: cloudBreakdown.byPaymentMethod['cash'] || 0,
        card: cloudBreakdown.byPaymentMethod['card'] || 0,
        upi: cloudBreakdown.byPaymentMethod['upi'] || 0,
        wallet: cloudBreakdown.byPaymentMethod['wallet'] || 0,
        pending: cloudBreakdown.byPaymentMethod['pending'] || 0,
      };

      const hourlySales: HourlySales[] = (cloudBreakdown.byHour || []).map(h => ({
        hour: h.hour,
        sales: h.sales,
        orders: h.orders,
      }));

      // Fill in missing hours
      const hourlyMap = new Map(hourlySales.map(h => [h.hour, h]));
      const fullHourlySales: HourlySales[] = [];
      for (let h = 0; h < 24; h++) {
        fullHourlySales.push(hourlyMap.get(h) || { hour: h, sales: 0, orders: 0 });
      }

      const orderTypeBreakdown: OrderTypeBreakdown = {
        'dine-in': cloudBreakdown.byOrderType['dine-in'] || { count: 0, sales: 0 },
        'takeout': cloudBreakdown.byOrderType['takeout'] || cloudBreakdown.byOrderType['takeaway'] || { count: 0, sales: 0 },
        'delivery': cloudBreakdown.byOrderType['delivery'] || { count: 0, sales: 0 },
      };

      const topItems: TopItem[] = cloudTopItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        revenue: item.revenue,
      }));

      // For transactions, we still need local SQLite since cloud doesn't return full transaction details
      let transactions: SalesTransaction[] = [];
      try {
        transactions = await salesTransactionService.getAllTransactions(tenantId, targetDate);
      } catch (e) {
        console.warn('[DailySalesStore] Could not fetch local transactions:', e);
      }

      // If cloud returned empty aggregator data but we have local transactions, supplement the source breakdown
      // This handles the case where orders haven't synced to cloud yet
      if (sourceBreakdown.zomato.orders === 0 && sourceBreakdown.swiggy.orders === 0) {
        try {
          const localSummary = await salesTransactionService.getCombinedSalesSummary(tenantId, targetDate);
          // Merge local aggregator data if cloud data is empty
          if (localSummary.sourceBreakdown.zomato.orders > 0 || localSummary.sourceBreakdown.swiggy.orders > 0) {
            console.log('[DailySalesStore] Supplementing with local aggregator data');
            sourceBreakdown.zomato = localSummary.sourceBreakdown.zomato;
            sourceBreakdown.swiggy = localSummary.sourceBreakdown.swiggy;
            sourceBreakdown.website = localSummary.sourceBreakdown.website;
            // Update summary totals
            const aggTotal = sourceBreakdown.zomato.sales + sourceBreakdown.swiggy.sales + sourceBreakdown.website.sales;
            const aggOrders = sourceBreakdown.zomato.orders + sourceBreakdown.swiggy.orders + sourceBreakdown.website.orders;
            summary.totalSales = cloudCombined.pos.totalSales + aggTotal;
            summary.totalOrders = cloudCombined.pos.totalOrders + aggOrders;
            summary.averageOrderValue = summary.totalOrders > 0 ? summary.totalSales / summary.totalOrders : 0;
          }
        } catch (localError) {
          console.warn('[DailySalesStore] Could not supplement with local aggregator data:', localError);
        }
      }

      const report: DailySalesReport = {
        date: targetDate,
        summary,
        sourceBreakdown,
        paymentBreakdown,
        hourlySales: fullHourlySales,
        topItems,
        orderTypeBreakdown,
        transactions,
      };

      set({ report, selectedDate: targetDate, isLoading: false });
      console.log('[DailySalesStore] Report built from cloud data successfully');

    } catch (cloudError) {
      console.warn('[DailySalesStore] Cloud fetch failed, falling back to local SQLite:', cloudError);

      // Fallback to local SQLite
      try {
        const [
          combinedSummary,
          paymentBreakdown,
          hourlySales,
          topItems,
          orderTypeBreakdown,
          transactions,
        ] = await Promise.all([
          salesTransactionService.getCombinedSalesSummary(tenantId, targetDate),
          salesTransactionService.getPaymentBreakdown(tenantId, targetDate),
          salesTransactionService.getCombinedHourlySales(tenantId, targetDate),
          salesTransactionService.getCombinedTopItems(tenantId, targetDate, 10),
          salesTransactionService.getOrderTypeBreakdown(tenantId, targetDate),
          salesTransactionService.getAllTransactions(tenantId, targetDate),
        ]);

        const report: DailySalesReport = {
          date: targetDate,
          summary: combinedSummary.summary,
          sourceBreakdown: combinedSummary.sourceBreakdown,
          paymentBreakdown,
          hourlySales,
          topItems,
          orderTypeBreakdown,
          transactions,
        };

        set({ report, selectedDate: targetDate, isLoading: false });
        console.log('[DailySalesStore] Report built from local SQLite');
      } catch (localError) {
        console.error('[DailySalesStore] Both cloud and local fetch failed:', localError);
        set({
          error: 'Failed to fetch sales report from cloud and local database',
          isLoading: false,
        });
      }
    }
  },

  // Fetch cash register for date
  fetchCashRegister: async (tenantId: string, date?: string) => {
    const targetDate = date || get().selectedDate;

    try {
      const register = await cashRegisterService.getRegisterByDate(tenantId, targetDate);
      set({ cashRegister: register });
    } catch (error) {
      console.error('[DailySalesStore] Failed to fetch cash register:', error);
    }
  },

  // Open cash register for today
  openCashRegister: async (tenantId: string, openingCash: number, staffName?: string) => {
    set({ isLoading: true, error: null });

    try {
      const register = await cashRegisterService.openRegister(tenantId, openingCash, staffName);
      set({ cashRegister: register, isLoading: false });
    } catch (error) {
      console.error('[DailySalesStore] Failed to open cash register:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to open cash register',
        isLoading: false,
      });
      throw error;
    }
  },

  // Close cash register for today (accounting for payouts)
  closeCashRegister: async (tenantId: string, actualCash: number, staffName?: string, notes?: string) => {
    set({ isLoading: true, error: null });

    try {
      const today = getTodayDate();

      // Get today's cash sales and total payouts
      const [paymentBreakdown, totalPayouts] = await Promise.all([
        salesTransactionService.getPaymentBreakdown(tenantId, today),
        cashPayoutService.getTotalPayoutsForDate(tenantId, today),
      ]);

      // Net cash = cash sales - payouts
      const netCashSales = paymentBreakdown.cash - totalPayouts;

      const register = await cashRegisterService.closeRegister(
        tenantId,
        actualCash,
        netCashSales, // Pass net cash (sales minus payouts)
        staffName,
        notes ? `${notes} | Payouts: ₹${totalPayouts}` : `Payouts: ₹${totalPayouts}`
      );

      set({ cashRegister: register, isLoading: false });

      // Refresh the report and payouts
      await Promise.all([
        get().fetchReport(tenantId),
        get().fetchPayouts(tenantId),
      ]);
    } catch (error) {
      console.error('[DailySalesStore] Failed to close cash register:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to close cash register',
        isLoading: false,
      });
      throw error;
    }
  },

  // Check if register is open
  isRegisterOpen: async (tenantId: string) => {
    return await cashRegisterService.isRegisterOpen(tenantId);
  },

  // Fetch payouts for a date
  fetchPayouts: async (tenantId: string, date?: string) => {
    const targetDate = date || get().selectedDate;

    try {
      const [payouts, payoutSummary] = await Promise.all([
        cashPayoutService.getPayoutsByDate(tenantId, targetDate),
        cashPayoutService.getPayoutSummary(tenantId, targetDate),
      ]);

      set({ payouts, payoutSummary });
    } catch (error) {
      console.error('[DailySalesStore] Failed to fetch payouts:', error);
    }
  },

  // Record a new payout
  recordPayout: async (
    tenantId: string,
    amount: number,
    payoutType: PayoutType,
    recordedBy: string,
    options?: {
      category?: PayoutCategory;
      description?: string;
      referenceNumber?: string;
      authorizedBy?: string;
    }
  ) => {
    set({ isLoading: true, error: null });

    try {
      const payout = await cashPayoutService.recordPayout(
        tenantId,
        amount,
        payoutType,
        recordedBy,
        options
      );

      // Refresh payouts list
      await get().fetchPayouts(tenantId);

      set({ isLoading: false });
      return payout;
    } catch (error) {
      console.error('[DailySalesStore] Failed to record payout:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to record payout',
        isLoading: false,
      });
      throw error;
    }
  },

  // Cancel a payout
  cancelPayout: async (payoutId: string, tenantId: string) => {
    set({ isLoading: true, error: null });

    try {
      await cashPayoutService.cancelPayout(payoutId);

      // Refresh payouts list
      await get().fetchPayouts(tenantId);

      set({ isLoading: false });
    } catch (error) {
      console.error('[DailySalesStore] Failed to cancel payout:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel payout',
        isLoading: false,
      });
      throw error;
    }
  },

  // Get today's date
  getTodayDate,

  // Clear error
  clearError: () => set({ error: null }),
}));
