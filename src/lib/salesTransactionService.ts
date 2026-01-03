/**
 * Sales Transaction Service
 * Records and queries completed sales for daily reporting
 */

import Database from '@tauri-apps/plugin-sql';
import { GeneratedBill } from './billService';
import { PaymentMethod, CartItem } from '../types/pos';
import { orderSyncService } from './orderSyncService';

export interface SalesTransaction {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  orderNumber?: string;
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
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  items: CartItem[];
  cashierName?: string;
  staffId?: string;
  createdAt: string;
  completedAt: string;
}

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

export interface SalesSummary {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  totalTax: number;
  totalDiscount: number;
  totalServiceCharge: number;
}

export interface SourceBreakdown {
  pos: { orders: number; sales: number };
  zomato: { orders: number; sales: number };
  swiggy: { orders: number; sales: number };
  website: { orders: number; sales: number };
}

export interface PaymentBreakdown {
  cash: number;
  card: number;
  upi: number;
  wallet: number;
  pending: number;
}

export interface HourlySales {
  hour: number; // 0-23
  sales: number;
  orders: number;
}

export interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface OrderTypeBreakdown {
  'dine-in': { count: number; sales: number };
  'takeout': { count: number; sales: number };
  'delivery': { count: number; sales: number };
}

class SalesTransactionService {
  private db: Database | null = null;
  private dbPromise: Promise<Database> | null = null;

  private async getDb(): Promise<Database> {
    if (this.db) return this.db;

    if (!this.dbPromise) {
      this.dbPromise = Database.load('sqlite:pos.db').then((db) => {
        this.db = db;
        return db;
      });
    }

    return this.dbPromise;
  }

  /**
   * Record a completed sale
   */
  async recordSale(
    tenantId: string,
    bill: GeneratedBill,
    paymentMethod: PaymentMethod,
    staffId?: string,
    source?: string
  ): Promise<SalesTransaction> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const id = `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const transaction: SalesTransaction = {
      id,
      tenantId,
      invoiceNumber: bill.invoiceNumber,
      orderNumber: bill.order.orderNumber,
      orderType: bill.order.orderType,
      tableNumber: bill.order.tableNumber ?? undefined,
      source: source || 'pos',
      subtotal: bill.taxes.subtotal,
      serviceCharge: bill.taxes.serviceCharge,
      cgst: bill.taxes.cgst,
      sgst: bill.taxes.sgst,
      discount: bill.taxes.discount,
      roundOff: bill.taxes.roundOff,
      grandTotal: bill.taxes.grandTotal,
      paymentMethod,
      paymentStatus: 'completed',
      items: bill.order.items,
      cashierName: bill.billData.cashierName,
      staffId,
      createdAt: bill.order.createdAt || now,
      completedAt: now,
    };

    await db.execute(
      `INSERT INTO sales_transactions (
        id, tenant_id, invoice_number, order_number, order_type, table_number,
        source, subtotal, service_charge, cgst, sgst, discount, round_off,
        grand_total, payment_method, payment_status, items_json, cashier_name,
        staff_id, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        transaction.id,
        transaction.tenantId,
        transaction.invoiceNumber,
        transaction.orderNumber || null,
        transaction.orderType,
        transaction.tableNumber || null,
        transaction.source,
        transaction.subtotal,
        transaction.serviceCharge,
        transaction.cgst,
        transaction.sgst,
        transaction.discount,
        transaction.roundOff,
        transaction.grandTotal,
        transaction.paymentMethod,
        transaction.paymentStatus,
        JSON.stringify(transaction.items),
        transaction.cashierName || null,
        transaction.staffId || null,
        transaction.createdAt,
        transaction.completedAt,
      ]
    );

    console.log(`[SalesTransactionService] Recorded sale: ${transaction.invoiceNumber} - ${transaction.grandTotal}`);

    // Broadcast to D1 for immediate cloud persistence
    // Transform items to the format expected by the DO
    try {
      orderSyncService.broadcastSaleCompleted({
        id: transaction.id,
        invoiceNumber: transaction.invoiceNumber,
        orderNumber: transaction.orderNumber || '',
        orderType: transaction.orderType,
        tableNumber: transaction.tableNumber,
        source: transaction.source,
        subtotal: transaction.subtotal,
        serviceCharge: transaction.serviceCharge,
        cgst: transaction.cgst,
        sgst: transaction.sgst,
        discount: transaction.discount,
        roundOff: transaction.roundOff,
        grandTotal: transaction.grandTotal,
        paymentMethod: transaction.paymentMethod,
        paymentStatus: transaction.paymentStatus,
        items: transaction.items.map((item) => ({
          name: item.menuItem?.name || 'Unknown',
          quantity: item.quantity,
          price: item.menuItem?.price || 0,
          subtotal: item.subtotal,
          modifiers: item.modifiers?.map((m) => m.name) || [],
        })),
        cashierName: transaction.cashierName,
        staffId: transaction.staffId,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt,
      });
    } catch (broadcastError) {
      // Don't fail the transaction if broadcast fails - batch sync will catch it
      console.warn('[SalesTransactionService] Failed to broadcast sale to D1:', broadcastError);
    }

    return transaction;
  }

  /**
   * Update the payment method for an existing sale
   */
  async updatePaymentMethod(
    invoiceNumber: string,
    paymentMethod: PaymentMethod
  ): Promise<boolean> {
    const db = await this.getDb();

    await db.execute(
      `UPDATE sales_transactions SET payment_method = $1 WHERE invoice_number = $2`,
      [paymentMethod, invoiceNumber]
    );

    console.log(`[SalesTransactionService] Updated payment method for ${invoiceNumber} to ${paymentMethod}`);
    return true;
  }

  /**
   * Check if a sale exists by invoice number
   */
  async saleExists(invoiceNumber: string): Promise<boolean> {
    const db = await this.getDb();

    const result = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM sales_transactions WHERE invoice_number = $1`,
      [invoiceNumber]
    );

    return (result[0]?.count || 0) > 0;
  }

  /**
   * Get a single transaction by invoice number (for reprinting)
   */
  async getTransactionByInvoice(invoiceNumber: string): Promise<SalesTransaction | null> {
    const db = await this.getDb();

    const rows = await db.select<SalesTransactionRow[]>(
      `SELECT * FROM sales_transactions WHERE invoice_number = $1 LIMIT 1`,
      [invoiceNumber]
    );

    if (rows.length === 0) return null;
    return this.rowToTransaction(rows[0]);
  }

  /**
   * Get recent dine-in orders for reprinting (last N orders)
   */
  async getRecentDineInOrders(tenantId: string, limit: number = 20): Promise<SalesTransaction[]> {
    const db = await this.getDb();

    const rows = await db.select<SalesTransactionRow[]>(
      `SELECT * FROM sales_transactions
       WHERE tenant_id = $1 AND order_type = 'dine-in'
       ORDER BY completed_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return rows.map((row) => this.rowToTransaction(row));
  }

  /**
   * Search transactions by table number or invoice number
   */
  async searchTransactions(
    tenantId: string,
    query: string,
    orderType?: string
  ): Promise<SalesTransaction[]> {
    const db = await this.getDb();

    let sql = `SELECT * FROM sales_transactions WHERE tenant_id = $1`;
    const params: (string | number)[] = [tenantId];

    if (orderType) {
      sql += ` AND order_type = $2`;
      params.push(orderType);
    }

    // Search by invoice number or table number
    const paramIndex = params.length + 1;
    sql += ` AND (invoice_number LIKE $${paramIndex} OR CAST(table_number AS TEXT) LIKE $${paramIndex})`;
    params.push(`%${query}%`);

    sql += ` ORDER BY completed_at DESC LIMIT 50`;

    const rows = await db.select<SalesTransactionRow[]>(sql, params);
    return rows.map((row) => this.rowToTransaction(row));
  }

  /**
   * Helper to get date range in local timezone converted to ISO for DB queries
   */
  private getLocalDateRange(date: string): { startOfDay: string; endOfDay: string } {
    // Parse date as local timezone (not UTC), then convert to ISO for comparison
    const startOfDay = new Date(`${date}T00:00:00`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59.999`).toISOString();
    return { startOfDay, endOfDay };
  }

  /**
   * Get all sales for a specific date
   */
  async getSalesByDate(tenantId: string, date: string): Promise<SalesTransaction[]> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    const rows = await db.select<SalesTransactionRow[]>(
      `SELECT * FROM sales_transactions
       WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3
       ORDER BY completed_at DESC`,
      [tenantId, startOfDay, endOfDay]
    );

    return rows.map((row) => this.rowToTransaction(row));
  }

  /**
   * Get sales summary for a date
   */
  async getSalesSummary(tenantId: string, date: string): Promise<SalesSummary> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    const result = await db.select<{
      total_sales: number;
      total_orders: number;
      total_tax: number;
      total_discount: number;
      total_service_charge: number;
    }[]>(
      `SELECT
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(SUM(cgst + sgst), 0) as total_tax,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(service_charge), 0) as total_service_charge
       FROM sales_transactions
       WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3`,
      [tenantId, startOfDay, endOfDay]
    );

    const row = result[0];
    const totalSales = row?.total_sales || 0;
    const totalOrders = row?.total_orders || 0;

    return {
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      totalTax: row?.total_tax || 0,
      totalDiscount: row?.total_discount || 0,
      totalServiceCharge: row?.total_service_charge || 0,
    };
  }

  /**
   * Get payment method breakdown for a date
   */
  async getPaymentBreakdown(tenantId: string, date: string): Promise<PaymentBreakdown> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    const rows = await db.select<{ payment_method: string; total: number }[]>(
      `SELECT payment_method, COALESCE(SUM(grand_total), 0) as total
       FROM sales_transactions
       WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3
       GROUP BY payment_method`,
      [tenantId, startOfDay, endOfDay]
    );

    const breakdown: PaymentBreakdown = {
      cash: 0,
      card: 0,
      upi: 0,
      wallet: 0,
      pending: 0,
    };

    for (const row of rows) {
      const method = row.payment_method as keyof PaymentBreakdown;
      if (method in breakdown) {
        breakdown[method] = row.total;
      }
    }

    return breakdown;
  }

  /**
   * Get hourly sales breakdown for a date
   */
  async getHourlySales(tenantId: string, date: string): Promise<HourlySales[]> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    const rows = await db.select<{ hour: number; sales: number; orders: number }[]>(
      `SELECT
        CAST(strftime('%H', completed_at) AS INTEGER) as hour,
        COALESCE(SUM(grand_total), 0) as sales,
        COUNT(*) as orders
       FROM sales_transactions
       WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3
       GROUP BY hour
       ORDER BY hour`,
      [tenantId, startOfDay, endOfDay]
    );

    // Fill in missing hours with zeros
    const hourlyMap = new Map(rows.map((r) => [r.hour, r]));
    const result: HourlySales[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyMap.get(hour);
      result.push({
        hour,
        sales: data?.sales || 0,
        orders: data?.orders || 0,
      });
    }

    return result;
  }

  /**
   * Get top selling items for a date
   */
  async getTopItems(tenantId: string, date: string, limit: number = 10): Promise<TopItem[]> {
    const transactions = await this.getSalesByDate(tenantId, date);

    // Aggregate items across all transactions
    const itemMap = new Map<string, { quantity: number; revenue: number }>();

    for (const transaction of transactions) {
      for (const item of transaction.items) {
        const existing = itemMap.get(item.menuItem.name) || { quantity: 0, revenue: 0 };
        itemMap.set(item.menuItem.name, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.subtotal,
        });
      }
    }

    // Sort by quantity and limit
    return Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  /**
   * Get order type breakdown for a date
   */
  async getOrderTypeBreakdown(tenantId: string, date: string): Promise<OrderTypeBreakdown> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    const rows = await db.select<{ order_type: string; count: number; sales: number }[]>(
      `SELECT order_type, COUNT(*) as count, COALESCE(SUM(grand_total), 0) as sales
       FROM sales_transactions
       WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3
       GROUP BY order_type`,
      [tenantId, startOfDay, endOfDay]
    );

    const breakdown: OrderTypeBreakdown = {
      'dine-in': { count: 0, sales: 0 },
      'takeout': { count: 0, sales: 0 },
      'delivery': { count: 0, sales: 0 },
    };

    for (const row of rows) {
      const type = row.order_type as keyof OrderTypeBreakdown;
      if (type in breakdown) {
        breakdown[type] = { count: row.count, sales: row.sales };
      }
    }

    return breakdown;
  }

  /**
   * Get sales for date range
   */
  async getSalesForDateRange(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<SalesTransaction[]> {
    const db = await this.getDb();
    const start = new Date(`${startDate}T00:00:00`).toISOString();
    const end = new Date(`${endDate}T23:59:59.999`).toISOString();

    const rows = await db.select<SalesTransactionRow[]>(
      `SELECT * FROM sales_transactions
       WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3
       ORDER BY completed_at DESC`,
      [tenantId, start, end]
    );

    return rows.map((row) => this.rowToTransaction(row));
  }

  private rowToTransaction(row: SalesTransactionRow): SalesTransaction {
    let items: CartItem[] = [];
    try {
      items = JSON.parse(row.items_json);
    } catch {
      items = [];
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      invoiceNumber: row.invoice_number,
      orderNumber: row.order_number || undefined,
      orderType: row.order_type,
      tableNumber: row.table_number || undefined,
      source: row.source,
      subtotal: row.subtotal,
      serviceCharge: row.service_charge,
      cgst: row.cgst,
      sgst: row.sgst,
      discount: row.discount,
      roundOff: row.round_off,
      grandTotal: row.grand_total,
      paymentMethod: row.payment_method as PaymentMethod,
      paymentStatus: row.payment_status,
      items,
      cashierName: row.cashier_name || undefined,
      staffId: row.staff_id || undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * Get aggregator orders summary for a date (Swiggy/Zomato)
   */
  async getAggregatorSalesSummary(date: string): Promise<{
    totalSales: number;
    totalOrders: number;
    totalTax: number;
    totalDiscount: number;
    byAggregator: { [key: string]: { orders: number; sales: number } };
  }> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    // Get completed/ready aggregator orders for the date
    // Include ready, pending_pickup, picked_up as these are fulfilled from kitchen/sales perspective
    const rows = await db.select<{
      aggregator: string;
      total: number;
      tax: number;
      discount: number;
      order_count: number;
    }[]>(
      `SELECT
        aggregator,
        COALESCE(SUM(total), 0) as total,
        COALESCE(SUM(tax), 0) as tax,
        COALESCE(SUM(discount), 0) as discount,
        COUNT(*) as order_count
       FROM aggregator_orders
       WHERE status IN ('ready', 'pending_pickup', 'picked_up', 'out_for_delivery', 'completed', 'delivered')
         AND created_at >= $1 AND created_at <= $2
       GROUP BY aggregator`,
      [startOfDay, endOfDay]
    );

    const byAggregator: { [key: string]: { orders: number; sales: number } } = {};
    let totalSales = 0;
    let totalOrders = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const row of rows) {
      byAggregator[row.aggregator] = {
        orders: row.order_count,
        sales: row.total,
      };
      totalSales += row.total;
      totalOrders += row.order_count;
      totalTax += row.tax;
      totalDiscount += row.discount;
    }

    return { totalSales, totalOrders, totalTax, totalDiscount, byAggregator };
  }

  /**
   * Get aggregator orders for a date as transactions
   */
  async getAggregatorTransactions(date: string): Promise<SalesTransaction[]> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    const rows = await db.select<{
      id: string;
      order_id: string;
      order_number: string;
      aggregator: string;
      status: string;
      order_type: string;
      customer_name: string | null;
      items_json: string;
      subtotal: number;
      tax: number;
      discount: number;
      total: number;
      payment_method: string | null;
      payment_status: string | null;
      created_at: string;
      delivered_at: string | null;
    }[]>(
      `SELECT
        id, order_id, order_number, aggregator, status, order_type,
        customer_name, items_json, subtotal, tax, discount, total,
        payment_method, payment_status, created_at, delivered_at
       FROM aggregator_orders
       WHERE status IN ('ready', 'pending_pickup', 'picked_up', 'out_for_delivery', 'completed', 'delivered')
         AND created_at >= $1 AND created_at <= $2
       ORDER BY created_at DESC`,
      [startOfDay, endOfDay]
    );

    return rows.map((row) => {
      let items: CartItem[] = [];
      try {
        // Aggregator items have different structure, convert to CartItem format
        const aggItems = JSON.parse(row.items_json || '[]');
        items = aggItems.map((item: any) => ({
          id: item.id || `agg-${Math.random().toString(36).substr(2, 9)}`,
          menuItem: {
            id: item.id || '',
            name: item.name || item.itemName || 'Unknown Item',
            price: item.price || item.unitPrice || 0,
            category: 'Aggregator',
            isActive: true,
          },
          quantity: item.quantity || 1,
          modifiers: [],
          subtotal: (item.price || item.unitPrice || 0) * (item.quantity || 1),
        }));
      } catch {
        items = [];
      }

      return {
        id: row.id,
        tenantId: '', // Aggregator orders don't have tenant in same way
        invoiceNumber: row.order_number,
        orderNumber: row.order_number,
        orderType: 'delivery',
        source: row.aggregator,
        subtotal: row.subtotal,
        serviceCharge: 0,
        cgst: row.tax / 2,
        sgst: row.tax / 2,
        discount: row.discount,
        roundOff: 0,
        grandTotal: row.total,
        paymentMethod: (row.payment_method || 'online') as PaymentMethod,
        paymentStatus: row.payment_status || 'paid',
        items,
        cashierName: row.aggregator.toUpperCase(),
        createdAt: row.created_at,
        completedAt: row.delivered_at || row.created_at,
      };
    });
  }

  /**
   * Get combined summary of all sales (POS + Aggregators)
   */
  async getCombinedSalesSummary(tenantId: string, date: string): Promise<{
    summary: SalesSummary;
    sourceBreakdown: SourceBreakdown;
  }> {
    const [posSummary, aggregatorSummary] = await Promise.all([
      this.getSalesSummary(tenantId, date),
      this.getAggregatorSalesSummary(date),
    ]);

    const totalSales = posSummary.totalSales + aggregatorSummary.totalSales;
    const totalOrders = posSummary.totalOrders + aggregatorSummary.totalOrders;

    const summary: SalesSummary = {
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      totalTax: posSummary.totalTax + aggregatorSummary.totalTax,
      totalDiscount: posSummary.totalDiscount + aggregatorSummary.totalDiscount,
      totalServiceCharge: posSummary.totalServiceCharge,
    };

    const sourceBreakdown: SourceBreakdown = {
      pos: { orders: posSummary.totalOrders, sales: posSummary.totalSales },
      zomato: aggregatorSummary.byAggregator['zomato'] || { orders: 0, sales: 0 },
      swiggy: aggregatorSummary.byAggregator['swiggy'] || { orders: 0, sales: 0 },
      // 'direct' is the source type for website orders
      website: aggregatorSummary.byAggregator['direct'] || aggregatorSummary.byAggregator['website'] || { orders: 0, sales: 0 },
    };

    return { summary, sourceBreakdown };
  }

  /**
   * Get all transactions (POS + Aggregator) for a date
   */
  async getAllTransactions(tenantId: string, date: string): Promise<SalesTransaction[]> {
    const [posTransactions, aggregatorTransactions] = await Promise.all([
      this.getSalesByDate(tenantId, date),
      this.getAggregatorTransactions(date),
    ]);

    // Combine and sort by time
    const allTransactions = [...posTransactions, ...aggregatorTransactions];
    allTransactions.sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return allTransactions;
  }

  /**
   * Get combined hourly sales (POS + Aggregators)
   */
  async getCombinedHourlySales(tenantId: string, date: string): Promise<HourlySales[]> {
    const db = await this.getDb();
    const { startOfDay, endOfDay } = this.getLocalDateRange(date);

    // Get POS hourly sales
    const posRows = await db.select<{ hour: number; sales: number; orders: number }[]>(
      `SELECT
        CAST(strftime('%H', completed_at) AS INTEGER) as hour,
        COALESCE(SUM(grand_total), 0) as sales,
        COUNT(*) as orders
       FROM sales_transactions
       WHERE tenant_id = $1 AND completed_at >= $2 AND completed_at <= $3
       GROUP BY hour`,
      [tenantId, startOfDay, endOfDay]
    );

    // Get Aggregator hourly sales
    const aggRows = await db.select<{ hour: number; sales: number; orders: number }[]>(
      `SELECT
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COALESCE(SUM(total), 0) as sales,
        COUNT(*) as orders
       FROM aggregator_orders
       WHERE status IN ('ready', 'pending_pickup', 'picked_up', 'out_for_delivery', 'completed', 'delivered')
         AND created_at >= $1 AND created_at <= $2
       GROUP BY hour`,
      [startOfDay, endOfDay]
    );

    // Combine hourly data
    const hourlyMap = new Map<number, { sales: number; orders: number }>();

    for (const row of posRows) {
      hourlyMap.set(row.hour, { sales: row.sales, orders: row.orders });
    }

    for (const row of aggRows) {
      const existing = hourlyMap.get(row.hour) || { sales: 0, orders: 0 };
      hourlyMap.set(row.hour, {
        sales: existing.sales + row.sales,
        orders: existing.orders + row.orders,
      });
    }

    // Fill in all hours
    const result: HourlySales[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyMap.get(hour);
      result.push({
        hour,
        sales: data?.sales || 0,
        orders: data?.orders || 0,
      });
    }

    return result;
  }

  /**
   * Get combined top items (POS + Aggregators)
   */
  async getCombinedTopItems(tenantId: string, date: string, limit: number = 10): Promise<TopItem[]> {
    const [posItems, aggregatorTransactions] = await Promise.all([
      this.getTopItems(tenantId, date, limit * 2),
      this.getAggregatorTransactions(date),
    ]);

    // Aggregate items from aggregator orders
    const itemMap = new Map<string, { quantity: number; revenue: number }>();

    // Add POS items
    for (const item of posItems) {
      const existing = itemMap.get(item.name) || { quantity: 0, revenue: 0 };
      itemMap.set(item.name, {
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + item.revenue,
      });
    }

    // Add aggregator items
    for (const tx of aggregatorTransactions) {
      for (const item of tx.items) {
        const name = item.menuItem?.name || 'Unknown';
        const existing = itemMap.get(name) || { quantity: 0, revenue: 0 };
        itemMap.set(name, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.subtotal,
        });
      }
    }

    return Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  /**
   * Get unsynced transactions (for D1 cloud sync)
   */
  async getUnsyncedTransactions(tenantId: string): Promise<SalesTransaction[]> {
    const db = await this.getDb();

    const rows = await db.select<SalesTransactionRow[]>(
      `SELECT * FROM sales_transactions
       WHERE tenant_id = $1 AND synced_at IS NULL
       ORDER BY completed_at ASC
       LIMIT 500`,
      [tenantId]
    );

    return rows.map((row) => this.rowToTransaction(row));
  }

  /**
   * Mark transactions as synced to cloud
   */
  async markTransactionsSynced(transactionIds: string[]): Promise<void> {
    if (transactionIds.length === 0) return;

    const db = await this.getDb();
    const now = new Date().toISOString();

    // SQLite doesn't support array parameters well, so we build the query
    const placeholders = transactionIds.map((_, i) => `$${i + 2}`).join(', ');
    await db.execute(
      `UPDATE sales_transactions SET synced_at = $1 WHERE id IN (${placeholders})`,
      [now, ...transactionIds]
    );

    console.log(`[SalesTransactionService] Marked ${transactionIds.length} transactions as synced`);
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(tenantId: string): Promise<{ total: number; synced: number; unsynced: number }> {
    const db = await this.getDb();

    const result = await db.select<{ total: number; synced: number }[]>(
      `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN synced_at IS NOT NULL THEN 1 END) as synced
       FROM sales_transactions
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const row = result[0] || { total: 0, synced: 0 };
    return {
      total: row.total,
      synced: row.synced,
      unsynced: row.total - row.synced,
    };
  }
}

export const salesTransactionService = new SalesTransactionService();
