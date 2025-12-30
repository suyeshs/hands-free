/**
 * Daily Sales Store
 * Manages state for daily sales reports and cash register
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

  // Fetch complete daily sales report (including aggregator/online orders)
  fetchReport: async (tenantId: string, date?: string) => {
    const targetDate = date || get().selectedDate;
    set({ isLoading: true, error: null });

    try {
      // Use combined methods that include both POS and aggregator data
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
    } catch (error) {
      console.error('[DailySalesStore] Failed to fetch report:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch report',
        isLoading: false,
      });
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
