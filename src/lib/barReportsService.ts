/**
 * Bar Reports Service
 * Generates comprehensive reports: Daily Sales, Usage/Variance, Pour Cost, Staff Performance
 */

import { barInventoryService } from './barInventoryService';
import type {
  BarInventoryTransaction,
  // BarClosingSession,
  // BarInventoryItem,
  // UsageSummary,
} from '../types/bar';

interface DailySalesReport {
  date: string;
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  salesByCategory: {
    category: string;
    revenue: number;
    count: number;
    percentage: number;
  }[];
  hourlySales: {
    hour: number;
    revenue: number;
    orders: number;
  }[];
  paymentBreakdown: {
    cash: number;
    card: number;
    upi: number;
  };
}

interface VarianceReport {
  sessionDate: string;
  totalItemsCounted: number;
  totalVarianceMl: number;
  totalVarianceCost: number;
  variancePercentage: number;
  itemVariances: {
    itemName: string;
    category: string;
    expectedBottles: number;
    actualBottles: number;
    varianceMl: number;
    varianceCost: number;
    variancePercentage: number;
  }[];
  topDiscrepancies: {
    itemName: string;
    varianceMl: number;
    varianceCost: number;
  }[];
}

interface PourCostReport {
  overallPourCost: number; // Percentage
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number; // Percentage
  itemAnalysis: {
    itemName: string;
    category: string;
    quantitySold: number;
    revenue: number;
    cost: number;
    pourCost: number; // Percentage
    profit: number;
    profitMargin: number; // Percentage
  }[];
  mostProfitable: {
    itemName: string;
    profit: number;
    profitMargin: number;
  }[];
  leastProfitable: {
    itemName: string;
    pourCost: number;
    profit: number;
  }[];
}

interface StaffPerformanceReport {
  reportPeriod: { start: string; end: string };
  staffMetrics: {
    staffId: string;
    staffName: string;
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
    drinksPerHour: number;
    hoursWorked: number;
    wasteIncidents: number;
    wasteValue: number;
  }[];
  topPerformers: {
    byRevenue: { staffName: string; revenue: number }[];
    byOrders: { staffName: string; orders: number }[];
    byEfficiency: { staffName: string; drinksPerHour: number }[];
  };
}

class BarReportsService {
  /**
   * Generate Daily Sales Summary Report
   */
  async generateDailySalesReport(
    tenantId: string,
    date: string
  ): Promise<DailySalesReport> {
    // Get all sales transactions for the date
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const transactions = await barInventoryService.getTransactions(tenantId, {
      startDate: startOfDay,
      endDate: endOfDay,
      type: 'sale',
    });

    // Get inventory items for category mapping
    const items = await barInventoryService.getInventoryItems(tenantId);
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Calculate totals
    const totalRevenue = transactions.reduce((sum, txn) => sum + (txn.totalCost || 0), 0);
    const uniqueOrders = new Set(transactions.map((txn) => txn.barOrderId).filter(Boolean));
    const totalOrders = uniqueOrders.size;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Sales by category
    const categoryMap = new Map<string, { revenue: number; count: number }>();
    for (const txn of transactions) {
      const item = itemMap.get(txn.inventoryItemId);
      if (!item) continue;

      const current = categoryMap.get(item.category) || { revenue: 0, count: 0 };
      categoryMap.set(item.category, {
        revenue: current.revenue + (txn.totalCost || 0),
        count: current.count + 1,
      });
    }

    const salesByCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        revenue: data.revenue,
        count: data.count,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Hourly sales (group by hour)
    const hourlyMap = new Map<number, { revenue: number; orders: Set<string> }>();
    for (const txn of transactions) {
      const hour = new Date(txn.createdAt).getHours();
      const current = hourlyMap.get(hour) || { revenue: 0, orders: new Set() };
      current.revenue += txn.totalCost || 0;
      if (txn.barOrderId) current.orders.add(txn.barOrderId);
      hourlyMap.set(hour, current);
    }

    const hourlySales = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({
        hour,
        revenue: data.revenue,
        orders: data.orders.size,
      }))
      .sort((a, b) => a.hour - b.hour);

    // Payment breakdown (mock - would need order payment data)
    const paymentBreakdown = {
      cash: totalRevenue * 0.4,
      card: totalRevenue * 0.35,
      upi: totalRevenue * 0.25,
    };

    return {
      date,
      totalRevenue,
      totalOrders,
      averageTicket,
      salesByCategory,
      hourlySales,
      paymentBreakdown,
    };
  }

  /**
   * Generate Usage & Variance Report
   */
  async generateVarianceReport(
    tenantId: string,
    sessionId: string
  ): Promise<VarianceReport> {
    // Get closing session
    const sessions = await barInventoryService.getClosingSessions(tenantId);
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    // Get all counts
    const counts = session.counts || [];

    // Get items for names
    const items = await barInventoryService.getInventoryItems(tenantId);
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Calculate item variances
    const itemVariances = counts.map((count) => {
      const item = itemMap.get(count.inventoryItemId);
      if (!item) {
        return {
          itemName: 'Unknown',
          category: 'unknown',
          expectedBottles: 0,
          actualBottles: 0,
          varianceMl: 0,
          varianceCost: 0,
          variancePercentage: 0,
        };
      }

      const expectedTotal = count.expectedFullBottles + count.expectedPartialMl / item.containerSizeMl;
      const actualTotal = count.actualFullBottles + count.actualPartialMl / item.containerSizeMl;
      const expectedMl = count.expectedFullBottles * item.containerSizeMl + count.expectedPartialMl;

      return {
        itemName: item.name,
        category: item.category,
        expectedBottles: expectedTotal,
        actualBottles: actualTotal,
        varianceMl: count.varianceMl,
        varianceCost: count.varianceCost,
        variancePercentage: expectedMl > 0 ? (count.varianceMl / expectedMl) * 100 : 0,
      };
    });

    // Top discrepancies (largest absolute variance)
    const topDiscrepancies = itemVariances
      .map((item) => ({
        itemName: item.itemName,
        varianceMl: item.varianceMl,
        varianceCost: item.varianceCost,
      }))
      .sort((a, b) => Math.abs(b.varianceMl) - Math.abs(a.varianceMl))
      .slice(0, 5);

    const totalVarianceMl = counts.reduce((sum, c) => sum + c.varianceMl, 0);
    const totalVarianceCost = counts.reduce((sum, c) => sum + c.varianceCost, 0);
    const totalExpectedMl = counts.reduce((sum, c) => {
      const item = itemMap.get(c.inventoryItemId);
      if (!item) return sum;
      return sum + (c.expectedFullBottles * item.containerSizeMl + c.expectedPartialMl);
    }, 0);

    return {
      sessionDate: session.sessionDate,
      totalItemsCounted: counts.length,
      totalVarianceMl,
      totalVarianceCost,
      variancePercentage: totalExpectedMl > 0 ? (totalVarianceMl / totalExpectedMl) * 100 : 0,
      itemVariances,
      topDiscrepancies,
    };
  }

  /**
   * Generate Pour Cost Analysis Report
   */
  async generatePourCostReport(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<PourCostReport> {
    // Get sales transactions
    const transactions = await barInventoryService.getTransactions(tenantId, {
      startDate,
      endDate,
      type: 'sale',
    });

    // Get items
    const items = await barInventoryService.getInventoryItems(tenantId);
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Calculate per-item metrics
    const itemSales = new Map<string, { quantity: number; revenue: number; cost: number }>();

    for (const txn of transactions) {
      const current = itemSales.get(txn.inventoryItemId) || {
        quantity: 0,
        revenue: 0,
        cost: 0,
      };

      // Revenue would come from bar orders (mock for now)
      const estimatedRevenue = (txn.totalCost || 0) * 3; // Assuming 3x markup

      itemSales.set(txn.inventoryItemId, {
        quantity: current.quantity + 1,
        revenue: current.revenue + estimatedRevenue,
        cost: current.cost + (txn.totalCost || 0),
      });
    }

    // Item analysis
    const itemAnalysis = Array.from(itemSales.entries())
      .map(([itemId, sales]) => {
        const item = itemMap.get(itemId);
        if (!item) return null;

        const profit = sales.revenue - sales.cost;
        const pourCost = sales.revenue > 0 ? (sales.cost / sales.revenue) * 100 : 0;
        const profitMargin = sales.revenue > 0 ? (profit / sales.revenue) * 100 : 0;

        return {
          itemName: item.name,
          category: item.category,
          quantitySold: sales.quantity,
          revenue: sales.revenue,
          cost: sales.cost,
          pourCost,
          profit,
          profitMargin,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // Totals
    const totalCost = itemAnalysis.reduce((sum, item) => sum + item.cost, 0);
    const totalRevenue = itemAnalysis.reduce((sum, item) => sum + item.revenue, 0);
    const totalProfit = totalRevenue - totalCost;
    const overallPourCost = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Most profitable (highest absolute profit)
    const mostProfitable = itemAnalysis
      .map((item) => ({
        itemName: item.itemName,
        profit: item.profit,
        profitMargin: item.profitMargin,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Least profitable (highest pour cost %)
    const leastProfitable = itemAnalysis
      .map((item) => ({
        itemName: item.itemName,
        pourCost: item.pourCost,
        profit: item.profit,
      }))
      .sort((a, b) => b.pourCost - a.pourCost)
      .slice(0, 5);

    return {
      overallPourCost,
      totalCost,
      totalRevenue,
      totalProfit,
      profitMargin,
      itemAnalysis,
      mostProfitable,
      leastProfitable,
    };
  }

  /**
   * Generate Staff Performance Report
   */
  async generateStaffPerformanceReport(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<StaffPerformanceReport> {
    // Get all transactions in date range
    const transactions = await barInventoryService.getTransactions(tenantId, {
      startDate,
      endDate,
    });

    // Group by staff
    const staffData = new Map<
      string,
      {
        staffName: string;
        sales: BarInventoryTransaction[];
        waste: BarInventoryTransaction[];
        orders: Set<string>;
      }
    >();

    for (const txn of transactions) {
      if (!txn.staffId) continue;

      const current = staffData.get(txn.staffId) || {
        staffName: txn.staffName || 'Unknown',
        sales: [],
        waste: [],
        orders: new Set(),
      };

      if (txn.transactionType === 'sale') {
        current.sales.push(txn);
        if (txn.barOrderId) current.orders.add(txn.barOrderId);
      } else if (txn.transactionType === 'waste') {
        current.waste.push(txn);
      }

      staffData.set(txn.staffId, current);
    }

    // Calculate metrics
    const daysDiff =
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    const estimatedHoursPerDay = 8;

    const staffMetrics = Array.from(staffData.entries()).map(([staffId, data]) => {
      const totalRevenue = data.sales.reduce((sum, txn) => sum + (txn.totalCost || 0) * 3, 0); // 3x markup
      const totalOrders = data.orders.size;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const hoursWorked = daysDiff * estimatedHoursPerDay;
      const drinksPerHour = hoursWorked > 0 ? data.sales.length / hoursWorked : 0;
      const wasteValue = data.waste.reduce((sum, txn) => sum + (txn.totalCost || 0), 0);

      return {
        staffId,
        staffName: data.staffName,
        totalOrders,
        totalRevenue,
        averageTicket,
        drinksPerHour,
        hoursWorked,
        wasteIncidents: data.waste.length,
        wasteValue,
      };
    });

    // Top performers
    const topByRevenue = [...staffMetrics]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 3)
      .map((s) => ({ staffName: s.staffName, revenue: s.totalRevenue }));

    const topByOrders = [...staffMetrics]
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 3)
      .map((s) => ({ staffName: s.staffName, orders: s.totalOrders }));

    const topByEfficiency = [...staffMetrics]
      .sort((a, b) => b.drinksPerHour - a.drinksPerHour)
      .slice(0, 3)
      .map((s) => ({ staffName: s.staffName, drinksPerHour: s.drinksPerHour }));

    return {
      reportPeriod: { start: startDate, end: endDate },
      staffMetrics,
      topPerformers: {
        byRevenue: topByRevenue,
        byOrders: topByOrders,
        byEfficiency: topByEfficiency,
      },
    };
  }

  /**
   * Export report to CSV
   */
  exportDailySalesCSV(report: DailySalesReport): string {
    const lines: string[] = [];

    lines.push(`Daily Sales Report - ${report.date}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`Total Revenue,₹${report.totalRevenue.toLocaleString()}`);
    lines.push(`Total Orders,${report.totalOrders}`);
    lines.push(`Average Ticket,₹${report.averageTicket.toFixed(2)}`);
    lines.push('');
    lines.push('SALES BY CATEGORY');
    lines.push('Category,Revenue,Count,Percentage');
    for (const cat of report.salesByCategory) {
      lines.push(`${cat.category},₹${cat.revenue.toFixed(2)},${cat.count},${cat.percentage.toFixed(1)}%`);
    }

    return lines.join('\n');
  }

  exportVarianceCSV(report: VarianceReport): string {
    const lines: string[] = [];

    lines.push(`Variance Report - ${report.sessionDate}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`Items Counted,${report.totalItemsCounted}`);
    lines.push(`Total Variance,${report.totalVarianceMl.toFixed(2)} ml`);
    lines.push(`Variance Cost,₹${report.totalVarianceCost.toFixed(2)}`);
    lines.push(`Variance %,${report.variancePercentage.toFixed(2)}%`);
    lines.push('');
    lines.push('ITEM VARIANCES');
    lines.push('Item,Category,Expected,Actual,Variance (ml),Variance (₹),Variance %');
    for (const item of report.itemVariances) {
      lines.push(
        `${item.itemName},${item.category},${item.expectedBottles.toFixed(2)},${item.actualBottles.toFixed(2)},${item.varianceMl.toFixed(2)},₹${item.varianceCost.toFixed(2)},${item.variancePercentage.toFixed(2)}%`
      );
    }

    return lines.join('\n');
  }

  exportPourCostCSV(report: PourCostReport): string {
    const lines: string[] = [];

    lines.push('Pour Cost Analysis Report');
    lines.push('');
    lines.push('SUMMARY');
    lines.push(`Overall Pour Cost,${report.overallPourCost.toFixed(2)}%`);
    lines.push(`Total Revenue,₹${report.totalRevenue.toLocaleString()}`);
    lines.push(`Total Cost,₹${report.totalCost.toLocaleString()}`);
    lines.push(`Total Profit,₹${report.totalProfit.toLocaleString()}`);
    lines.push(`Profit Margin,${report.profitMargin.toFixed(2)}%`);
    lines.push('');
    lines.push('ITEM ANALYSIS');
    lines.push('Item,Category,Qty Sold,Revenue,Cost,Pour Cost %,Profit,Profit Margin %');
    for (const item of report.itemAnalysis) {
      lines.push(
        `${item.itemName},${item.category},${item.quantitySold},₹${item.revenue.toFixed(2)},₹${item.cost.toFixed(2)},${item.pourCost.toFixed(2)}%,₹${item.profit.toFixed(2)},${item.profitMargin.toFixed(2)}%`
      );
    }

    return lines.join('\n');
  }

  exportStaffPerformanceCSV(report: StaffPerformanceReport): string {
    const lines: string[] = [];

    lines.push(
      `Staff Performance Report - ${report.reportPeriod.start} to ${report.reportPeriod.end}`
    );
    lines.push('');
    lines.push('STAFF METRICS');
    lines.push('Staff,Orders,Revenue,Avg Ticket,Drinks/Hour,Hours,Waste Incidents,Waste Value');
    for (const staff of report.staffMetrics) {
      lines.push(
        `${staff.staffName},${staff.totalOrders},₹${staff.totalRevenue.toFixed(2)},₹${staff.averageTicket.toFixed(2)},${staff.drinksPerHour.toFixed(2)},${staff.hoursWorked.toFixed(1)},${staff.wasteIncidents},₹${staff.wasteValue.toFixed(2)}`
      );
    }

    return lines.join('\n');
  }
}

export const barReportsService = new BarReportsService();
