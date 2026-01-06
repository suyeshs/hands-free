/**
 * Delivery Verification Store
 * Manages barcode-based delivery verification against purchase orders/invoices
 * Optional feature - can be enabled/disabled in settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DeliveryVerificationSession,
  ExpectedDeliveryItem,
  ScannedDeliveryItem,
  DeliveryItemVerification,
  DeliveryItemStatus,
  BarcodeMapping,
  ExtractedItem,
} from '../types/inventory';

interface DeliveryVerificationState {
  // Feature toggle
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;

  // Current session
  currentSession: DeliveryVerificationSession | null;

  // Barcode mappings (barcode -> inventory item)
  barcodeMappings: Record<string, BarcodeMapping>;

  // Session history (last 50)
  sessionHistory: DeliveryVerificationSession[];

  // Actions
  startVerificationSession: (
    tenantId: string,
    expectedItems: ExpectedDeliveryItem[],
    supplierInfo?: { id?: string; name?: string; invoiceNumber?: string; invoiceDate?: string }
  ) => DeliveryVerificationSession;

  startVerificationFromExtractedItems: (
    tenantId: string,
    extractedItems: ExtractedItem[],
    supplierInfo?: { id?: string; name?: string; invoiceNumber?: string; invoiceDate?: string }
  ) => DeliveryVerificationSession;

  scanBarcode: (barcode: string, format: string, quantity?: number) => ScannedDeliveryItem | null;

  updateScannedQuantity: (scannedItemId: string, quantity: number) => void;

  removeScannedItem: (scannedItemId: string) => void;

  completeVerification: () => DeliveryVerificationSession | null;

  cancelVerification: () => void;

  // Barcode mapping management
  addBarcodeMapping: (mapping: BarcodeMapping) => void;
  removeBarcodeMapping: (barcode: string) => void;
  getBarcodeMapping: (barcode: string) => BarcodeMapping | undefined;

  // Utilities
  getVerificationSummary: () => {
    matched: number;
    missing: number;
    extra: number;
    mismatch: number;
    pending: number;
  };

  clearHistory: () => void;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function computeVerificationResults(
  expectedItems: ExpectedDeliveryItem[],
  scannedItems: ScannedDeliveryItem[],
  barcodeMappings: Record<string, BarcodeMapping>
): DeliveryItemVerification[] {
  const results: DeliveryItemVerification[] = [];
  const matchedExpectedIds = new Set<string>();
  const matchedScannedIds = new Set<string>();

  // Group scanned items by barcode and sum quantities
  const scannedByBarcode: Record<string, { items: ScannedDeliveryItem[]; totalQuantity: number }> = {};
  for (const scanned of scannedItems) {
    if (!scannedByBarcode[scanned.barcode]) {
      scannedByBarcode[scanned.barcode] = { items: [], totalQuantity: 0 };
    }
    scannedByBarcode[scanned.barcode].items.push(scanned);
    scannedByBarcode[scanned.barcode].totalQuantity += scanned.quantity;
  }

  // Match expected items with scanned items
  for (const expected of expectedItems) {
    // Try to match by barcode first
    if (expected.barcode && scannedByBarcode[expected.barcode]) {
      const scannedGroup = scannedByBarcode[expected.barcode];
      const receivedQty = scannedGroup.totalQuantity;
      const diff = receivedQty - expected.expectedQuantity;

      let status: DeliveryItemStatus = 'matched';
      if (diff < 0) {
        status = 'quantity_mismatch';
      } else if (diff > 0) {
        status = 'quantity_mismatch';
      }

      results.push({
        expectedItemId: expected.id,
        scannedItemId: scannedGroup.items[0]?.id,
        status,
        expectedQuantity: expected.expectedQuantity,
        receivedQuantity: receivedQty,
        quantityDifference: diff,
        name: expected.name,
        barcode: expected.barcode,
      });

      matchedExpectedIds.add(expected.id);
      scannedGroup.items.forEach(s => matchedScannedIds.add(s.id));
    } else {
      // Try to match by inventory item ID through barcode mappings
      let matched = false;
      for (const [barcode, group] of Object.entries(scannedByBarcode)) {
        const mapping = barcodeMappings[barcode];
        if (mapping && mapping.inventoryItemId === expected.inventoryItemId) {
          const receivedQty = group.totalQuantity;
          const diff = receivedQty - expected.expectedQuantity;

          results.push({
            expectedItemId: expected.id,
            scannedItemId: group.items[0]?.id,
            status: diff === 0 ? 'matched' : 'quantity_mismatch',
            expectedQuantity: expected.expectedQuantity,
            receivedQuantity: receivedQty,
            quantityDifference: diff,
            name: expected.name,
            barcode,
          });

          matchedExpectedIds.add(expected.id);
          group.items.forEach(s => matchedScannedIds.add(s.id));
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Item is missing
        results.push({
          expectedItemId: expected.id,
          status: 'missing',
          expectedQuantity: expected.expectedQuantity,
          receivedQuantity: 0,
          quantityDifference: -expected.expectedQuantity,
          name: expected.name,
          barcode: expected.barcode,
        });
      }
    }
  }

  // Find extra items (scanned but not expected)
  for (const [barcode, group] of Object.entries(scannedByBarcode)) {
    const allMatched = group.items.every(s => matchedScannedIds.has(s.id));
    if (!allMatched) {
      const mapping = barcodeMappings[barcode];
      const name = mapping?.itemName || group.items[0]?.name || `Unknown (${barcode})`;

      results.push({
        scannedItemId: group.items[0]?.id,
        status: 'extra',
        expectedQuantity: 0,
        receivedQuantity: group.totalQuantity,
        quantityDifference: group.totalQuantity,
        name,
        barcode,
        notes: 'Item not in purchase order',
      });
    }
  }

  return results;
}

export const useDeliveryVerificationStore = create<DeliveryVerificationState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      currentSession: null,
      barcodeMappings: {},
      sessionHistory: [],

      setEnabled: (enabled) => set({ isEnabled: enabled }),

      startVerificationSession: (tenantId, expectedItems, supplierInfo) => {
        const session: DeliveryVerificationSession = {
          id: generateId('dv'),
          tenantId,
          supplierId: supplierInfo?.id,
          supplierName: supplierInfo?.name,
          invoiceNumber: supplierInfo?.invoiceNumber,
          invoiceDate: supplierInfo?.invoiceDate,
          status: 'in_progress',
          expectedItems,
          scannedItems: [],
          verificationResults: [],
          totalExpected: expectedItems.reduce((sum, i) => sum + i.expectedQuantity, 0),
          totalReceived: 0,
          matchedCount: 0,
          missingCount: expectedItems.length,
          extraCount: 0,
          mismatchCount: 0,
          startedAt: new Date().toISOString(),
        };

        set({ currentSession: session });
        return session;
      },

      startVerificationFromExtractedItems: (tenantId, extractedItems, supplierInfo) => {
        const expectedItems: ExpectedDeliveryItem[] = extractedItems.map((item) => ({
          id: generateId('exp'),
          name: item.name,
          expectedQuantity: item.quantity,
          unit: item.unit || 'pcs',
          unitPrice: item.unitPrice,
          inventoryItemId: item.matchedInventoryItemId,
        }));

        return get().startVerificationSession(tenantId, expectedItems, supplierInfo);
      },

      scanBarcode: (barcode, format, quantity = 1) => {
        const { currentSession, barcodeMappings } = get();
        if (!currentSession || currentSession.status !== 'in_progress') {
          return null;
        }

        const mapping = barcodeMappings[barcode];
        const scannedItem: ScannedDeliveryItem = {
          id: generateId('scn'),
          barcode,
          barcodeFormat: format,
          scannedAt: new Date().toISOString(),
          inventoryItemId: mapping?.inventoryItemId,
          name: mapping?.itemName,
          quantity,
          unit: mapping?.defaultUnit,
          unitPrice: mapping?.defaultPrice,
        };

        // Check if this barcode matches any expected item
        const matchedExpected = currentSession.expectedItems.find(
          e => e.barcode === barcode || (mapping && e.inventoryItemId === mapping.inventoryItemId)
        );
        if (matchedExpected) {
          scannedItem.matchedExpectedItemId = matchedExpected.id;
          scannedItem.name = scannedItem.name || matchedExpected.name;
        }

        const updatedScannedItems = [...currentSession.scannedItems, scannedItem];
        const verificationResults = computeVerificationResults(
          currentSession.expectedItems,
          updatedScannedItems,
          barcodeMappings
        );

        // Compute summary
        const matchedCount = verificationResults.filter(r => r.status === 'matched').length;
        const missingCount = verificationResults.filter(r => r.status === 'missing').length;
        const extraCount = verificationResults.filter(r => r.status === 'extra').length;
        const mismatchCount = verificationResults.filter(r => r.status === 'quantity_mismatch').length;
        const totalReceived = updatedScannedItems.reduce((sum, i) => sum + i.quantity, 0);

        set({
          currentSession: {
            ...currentSession,
            scannedItems: updatedScannedItems,
            verificationResults,
            totalReceived,
            matchedCount,
            missingCount,
            extraCount,
            mismatchCount,
          },
        });

        return scannedItem;
      },

      updateScannedQuantity: (scannedItemId, quantity) => {
        const { currentSession, barcodeMappings } = get();
        if (!currentSession) return;

        const updatedScannedItems = currentSession.scannedItems.map(item =>
          item.id === scannedItemId ? { ...item, quantity } : item
        );

        const verificationResults = computeVerificationResults(
          currentSession.expectedItems,
          updatedScannedItems,
          barcodeMappings
        );

        const matchedCount = verificationResults.filter(r => r.status === 'matched').length;
        const missingCount = verificationResults.filter(r => r.status === 'missing').length;
        const extraCount = verificationResults.filter(r => r.status === 'extra').length;
        const mismatchCount = verificationResults.filter(r => r.status === 'quantity_mismatch').length;
        const totalReceived = updatedScannedItems.reduce((sum, i) => sum + i.quantity, 0);

        set({
          currentSession: {
            ...currentSession,
            scannedItems: updatedScannedItems,
            verificationResults,
            totalReceived,
            matchedCount,
            missingCount,
            extraCount,
            mismatchCount,
          },
        });
      },

      removeScannedItem: (scannedItemId) => {
        const { currentSession, barcodeMappings } = get();
        if (!currentSession) return;

        const updatedScannedItems = currentSession.scannedItems.filter(item => item.id !== scannedItemId);

        const verificationResults = computeVerificationResults(
          currentSession.expectedItems,
          updatedScannedItems,
          barcodeMappings
        );

        const matchedCount = verificationResults.filter(r => r.status === 'matched').length;
        const missingCount = verificationResults.filter(r => r.status === 'missing').length;
        const extraCount = verificationResults.filter(r => r.status === 'extra').length;
        const mismatchCount = verificationResults.filter(r => r.status === 'quantity_mismatch').length;
        const totalReceived = updatedScannedItems.reduce((sum, i) => sum + i.quantity, 0);

        set({
          currentSession: {
            ...currentSession,
            scannedItems: updatedScannedItems,
            verificationResults,
            totalReceived,
            matchedCount,
            missingCount,
            extraCount,
            mismatchCount,
          },
        });
      },

      completeVerification: () => {
        const { currentSession, sessionHistory } = get();
        if (!currentSession) return null;

        const completedSession: DeliveryVerificationSession = {
          ...currentSession,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };

        // Add to history (keep last 50)
        const updatedHistory = [completedSession, ...sessionHistory].slice(0, 50);

        set({
          currentSession: null,
          sessionHistory: updatedHistory,
        });

        return completedSession;
      },

      cancelVerification: () => {
        const { currentSession, sessionHistory } = get();
        if (!currentSession) return;

        const cancelledSession: DeliveryVerificationSession = {
          ...currentSession,
          status: 'cancelled',
          completedAt: new Date().toISOString(),
        };

        const updatedHistory = [cancelledSession, ...sessionHistory].slice(0, 50);

        set({
          currentSession: null,
          sessionHistory: updatedHistory,
        });
      },

      addBarcodeMapping: (mapping) => {
        set(state => ({
          barcodeMappings: {
            ...state.barcodeMappings,
            [mapping.barcode]: mapping,
          },
        }));
      },

      removeBarcodeMapping: (barcode) => {
        set(state => {
          const { [barcode]: _, ...rest } = state.barcodeMappings;
          return { barcodeMappings: rest };
        });
      },

      getBarcodeMapping: (barcode) => {
        return get().barcodeMappings[barcode];
      },

      getVerificationSummary: () => {
        const { currentSession } = get();
        if (!currentSession) {
          return { matched: 0, missing: 0, extra: 0, mismatch: 0, pending: 0 };
        }

        const results = currentSession.verificationResults;
        return {
          matched: results.filter(r => r.status === 'matched').length,
          missing: results.filter(r => r.status === 'missing').length,
          extra: results.filter(r => r.status === 'extra').length,
          mismatch: results.filter(r => r.status === 'quantity_mismatch').length,
          pending: currentSession.expectedItems.length - results.filter(r => r.status !== 'pending').length,
        };
      },

      clearHistory: () => set({ sessionHistory: [] }),
    }),
    {
      name: 'delivery-verification-storage',
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        barcodeMappings: state.barcodeMappings,
        sessionHistory: state.sessionHistory,
      }),
    }
  )
);
