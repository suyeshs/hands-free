/**
 * Bar Closing Service
 * Business logic for end-of-day closing, variance calculation, and reporting
 */

import type {
  BarClosingSession,
  BarClosingCount,
  BarInventoryItem,
  // BarInventoryTransaction,
  UsageSummary,
} from '../types/bar';
import { barInventoryService } from './barInventoryService';

interface OpeningStock {
  itemId: string;
  fullBottles: number;
  partialMl: number;
  totalMl: number;
}

interface VarianceCalculation {
  expected: {
    fullBottles: number;
    partialMl: number;
    totalMl: number;
  };
  actual: {
    fullBottles: number;
    partialMl: number;
    totalMl: number;
  };
  variance: {
    bottles: number;
    ml: number;
    cost: number;
    percentage: number;
  };
}

class BarClosingService {
  /**
   * Get opening stock for a closing session
   * Uses previous closing session's actual counts or current inventory
   */
  async getOpeningStock(tenantId: string, sessionDate: string): Promise<Map<string, OpeningStock>> {
    // Get previous closing session
    const previousSessions = await barInventoryService.getClosingSessions(tenantId, {
      endDate: sessionDate,
      status: 'closed',
    });

    const openingStock = new Map<string, OpeningStock>();

    if (previousSessions.length > 0) {
      // Use previous session's actual counts as opening stock
      const lastSession = previousSessions[0];
      if (lastSession.counts) {
        for (const count of lastSession.counts) {
          openingStock.set(count.inventoryItemId, {
            itemId: count.inventoryItemId,
            fullBottles: count.actualFullBottles,
            partialMl: count.actualPartialMl,
            totalMl:
              count.actualFullBottles * 750 + count.actualPartialMl, // Assuming 750ml bottles
          });
        }
      }
    } else {
      // Use current inventory as opening stock (first-time closing)
      const items = await barInventoryService.getInventoryItems(tenantId);
      for (const item of items) {
        openingStock.set(item.id, {
          itemId: item.id,
          fullBottles: item.fullContainers,
          partialMl: item.partialContainerMl,
          totalMl: item.fullContainers * item.containerSizeMl + item.partialContainerMl,
        });
      }
    }

    return openingStock;
  }

  /**
   * Calculate expected inventory based on transactions
   */
  async calculateExpectedInventory(
    tenantId: string,
    sessionId: string,
    sessionDate: string,
    item: BarInventoryItem,
    openingStock: OpeningStock
  ): Promise<{ fullBottles: number; partialMl: number; totalMl: number }> {
    // Get opening time from session
    const sessions = await barInventoryService.getClosingSessions(tenantId, { status: 'open' });
    const session = sessions.find((s) => s.id === sessionId);
    const startTime = session?.openedAt || sessionDate;

    // Get transactions during the session
    const transactions = await barInventoryService.getTransactions(tenantId, {
      startDate: startTime,
      itemId: item.id,
    });

    // Calculate net change
    let netChangeMl = 0;

    for (const txn of transactions) {
      if (txn.transactionType === 'sale' || txn.transactionType === 'waste') {
        // Deduct usage
        netChangeMl -= Math.abs(txn.quantityMl);
      } else if (txn.transactionType === 'restock') {
        // Add restock
        netChangeMl += txn.quantityMl;
      } else if (txn.transactionType === 'adjustment') {
        // Apply adjustment
        netChangeMl += txn.quantityMl;
      }
    }

    // Calculate expected
    const expectedTotalMl = openingStock.totalMl + netChangeMl;
    const expectedFullBottles = Math.floor(expectedTotalMl / item.containerSizeMl);
    const expectedPartialMl = expectedTotalMl % item.containerSizeMl;

    return {
      fullBottles: expectedFullBottles,
      partialMl: expectedPartialMl,
      totalMl: expectedTotalMl,
    };
  }

  /**
   * Calculate variance between expected and actual counts
   */
  calculateVariance(
    item: BarInventoryItem,
    expected: { fullBottles: number; partialMl: number },
    actual: { fullBottles: number; partialMl: number }
  ): VarianceCalculation {
    const expectedTotalMl = expected.fullBottles * item.containerSizeMl + expected.partialMl;
    const actualTotalMl = actual.fullBottles * item.containerSizeMl + actual.partialMl;

    const varianceMl = actualTotalMl - expectedTotalMl;
    const varianceBottles = actual.fullBottles - expected.fullBottles;
    const varianceCost = varianceMl * (item.costPerContainer / item.containerSizeMl);
    const variancePercentage = expectedTotalMl > 0 ? (varianceMl / expectedTotalMl) * 100 : 0;

    return {
      expected: {
        fullBottles: expected.fullBottles,
        partialMl: expected.partialMl,
        totalMl: expectedTotalMl,
      },
      actual: {
        fullBottles: actual.fullBottles,
        partialMl: actual.partialMl,
        totalMl: actualTotalMl,
      },
      variance: {
        bottles: varianceBottles,
        ml: varianceMl,
        cost: varianceCost,
        percentage: variancePercentage,
      },
    };
  }

  /**
   * Save inventory count and calculate variance
   */
  async saveInventoryCount(
    tenantId: string,
    sessionId: string,
    sessionDate: string,
    item: BarInventoryItem,
    actualFullBottles: number,
    actualPartialMl: number,
    notes?: string
  ): Promise<BarClosingCount> {
    // Get opening stock
    const openingStockMap = await this.getOpeningStock(tenantId, sessionDate);
    const openingStock = openingStockMap.get(item.id) || {
      itemId: item.id,
      fullBottles: 0,
      partialMl: 0,
      totalMl: 0,
    };

    // Calculate expected
    const expected = await this.calculateExpectedInventory(
      tenantId,
      sessionId,
      sessionDate,
      item,
      openingStock
    );

    // Calculate variance
    const variance = this.calculateVariance(
      item,
      { fullBottles: expected.fullBottles, partialMl: expected.partialMl },
      { fullBottles: actualFullBottles, partialMl: actualPartialMl }
    );

    // Create closing count
    const count: BarClosingCount = {
      id: `count-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      closingSessionId: sessionId,
      inventoryItemId: item.id,
      expectedFullBottles: expected.fullBottles,
      expectedPartialMl: expected.partialMl,
      actualFullBottles,
      actualPartialMl,
      varianceBottles: variance.variance.bottles,
      varianceMl: variance.variance.ml,
      varianceCost: variance.variance.cost,
      notes,
      countedAt: new Date().toISOString(),
    };

    // Save to database
    await barInventoryService.saveClosingCount(count);

    return count;
  }

  /**
   * Generate usage summary report
   */
  async generateUsageSummary(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<UsageSummary[]> {
    // Get all transactions in date range
    const transactions = await barInventoryService.getTransactions(tenantId, {
      startDate,
      endDate,
    });

    // Get all items
    const items = await barInventoryService.getInventoryItems(tenantId);
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Group by item
    const usageByItem = new Map<string, { totalMl: number; totalCost: number; sales: number }>();

    for (const txn of transactions) {
      if (txn.transactionType === 'sale') {
        const current = usageByItem.get(txn.inventoryItemId) || {
          totalMl: 0,
          totalCost: 0,
          sales: 0,
        };

        usageByItem.set(txn.inventoryItemId, {
          totalMl: current.totalMl + Math.abs(txn.quantityMl),
          totalCost: current.totalCost + (txn.totalCost || 0),
          sales: current.sales + 1,
        });
      }
    }

    // Convert to summary array
    const summary: UsageSummary[] = [];

    for (const [itemId, usage] of usageByItem.entries()) {
      const item = itemMap.get(itemId);
      if (!item) continue;

      summary.push({
        itemId,
        itemName: item.name,
        category: item.category,
        totalUsageMl: usage.totalMl,
        totalCost: usage.totalCost,
        drinksSold: usage.sales,
        averagePourMl: usage.sales > 0 ? usage.totalMl / usage.sales : 0,
      });
    }

    // Sort by total usage descending
    summary.sort((a, b) => b.totalUsageMl - a.totalUsageMl);

    return summary;
  }

  /**
   * Calculate session totals and update session
   */
  async finalizeClosingSession(sessionId: string, tenantId: string): Promise<void> {
    // Get session
    const sessions = await barInventoryService.getClosingSessions(tenantId);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    // Calculate totals from counts
    let totalVarianceMl = 0;
    let totalVarianceCost = 0;

    if (session.counts) {
      for (const count of session.counts) {
        totalVarianceMl += count.varianceMl;
        totalVarianceCost += count.varianceCost;
      }
    }

    // Get waste transactions
    const wasteTransactions = await barInventoryService.getTransactions(tenantId, {
      startDate: session.openedAt,
      type: 'waste',
    });

    const totalWasteMl = wasteTransactions.reduce(
      (sum, txn) => sum + Math.abs(txn.quantityMl),
      0
    );

    // Update session with totals
    await barInventoryService.saveClosingSession({
      ...session,
      totalVarianceMl,
      totalWasteMl,
      status: 'closed',
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Export closing report to CSV
   */
  exportClosingReportCSV(session: BarClosingSession, counts: BarClosingCount[]): string {
    const lines: string[] = [];

    // Header
    lines.push('Bar Closing Report');
    lines.push(`Session Date: ${session.sessionDate}`);
    lines.push(`Opened: ${session.openedAt}`);
    lines.push(`Closed: ${session.closedAt || 'In Progress'}`);
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push(`Total Orders: ${session.totalOrders}`);
    lines.push(`Gross Revenue: ₹${session.grossRevenue.toLocaleString()}`);
    lines.push(`Items Counted: ${session.itemsCounted}`);
    lines.push(`Total Variance: ${session.totalVarianceMl.toFixed(2)} ml`);
    lines.push(`Total Waste: ${session.totalWasteMl.toFixed(2)} ml`);
    lines.push('');

    // Inventory Counts
    lines.push('INVENTORY COUNTS');
    lines.push(
      'Item,Expected Bottles,Expected Partial (ml),Actual Bottles,Actual Partial (ml),Variance (ml),Variance (₹),Notes'
    );

    for (const count of counts) {
      lines.push(
        [
          count.inventoryItem?.name || count.inventoryItemId,
          count.expectedFullBottles,
          count.expectedPartialMl.toFixed(2),
          count.actualFullBottles,
          count.actualPartialMl.toFixed(2),
          count.varianceMl.toFixed(2),
          count.varianceCost.toFixed(2),
          count.notes || '',
        ].join(',')
      );
    }

    return lines.join('\n');
  }
}

export const barClosingService = new BarClosingService();
