/**
 * Print Modal Store
 * Manages the state for in-app print modals (KOT, Bill)
 * Allows services to request print with preview instead of silent print
 */

import { create } from 'zustand';
import { KitchenOrder } from '../types/kds';
import { BillData } from '../components/print/BillPrint';

interface PrintModalState {
  // KOT Print Modal
  kotModalOpen: boolean;
  kotOrder: KitchenOrder | null;
  kotRestaurantName: string;
  kotStationFilter?: string;
  kotOnComplete?: (success: boolean) => void;

  // Bill Print Modal (future use)
  billModalOpen: boolean;
  billData: BillData | null;
  billOnComplete?: (success: boolean) => void;

  // Actions
  openKotPrintModal: (
    order: KitchenOrder,
    restaurantName: string,
    stationFilter?: string,
    onComplete?: (success: boolean) => void
  ) => void;
  closeKotPrintModal: () => void;

  openBillPrintModal: (
    billData: BillData,
    onComplete?: (success: boolean) => void
  ) => void;
  closeBillPrintModal: () => void;
}

export const usePrintModalStore = create<PrintModalState>((set) => ({
  // Initial state
  kotModalOpen: false,
  kotOrder: null,
  kotRestaurantName: 'Restaurant',
  kotStationFilter: undefined,
  kotOnComplete: undefined,

  billModalOpen: false,
  billData: null,
  billOnComplete: undefined,

  // KOT Modal Actions
  openKotPrintModal: (order, restaurantName, stationFilter, onComplete) => {
    set({
      kotModalOpen: true,
      kotOrder: order,
      kotRestaurantName: restaurantName,
      kotStationFilter: stationFilter,
      kotOnComplete: onComplete,
    });
  },

  closeKotPrintModal: () => {
    set({
      kotModalOpen: false,
      kotOrder: null,
      kotStationFilter: undefined,
      kotOnComplete: undefined,
    });
  },

  // Bill Modal Actions
  openBillPrintModal: (billData, onComplete) => {
    set({
      billModalOpen: true,
      billData,
      billOnComplete: onComplete,
    });
  },

  closeBillPrintModal: () => {
    set({
      billModalOpen: false,
      billData: null,
      billOnComplete: undefined,
    });
  },
}));
