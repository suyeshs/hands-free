/**
 * Aggregator Sales Service
 * Records sales transactions for Swiggy/Zomato orders
 * Triggered when orders are marked ready for pickup
 */

import Database from '@tauri-apps/plugin-sql';
import { AggregatorOrder } from '../types/aggregator';
import { CartItem, PaymentMethod } from '../types/pos';
import { isTauri } from './platform';

let db: Database | null = null;

async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:pos.db');
  }
  return db;
}

/**
 * Generate invoice number for aggregator orders
 * Format: AGG-{YYMM}-{SWG|ZMT}{orderNumber}
 */
export function generateAggregatorInvoiceNumber(order: AggregatorOrder): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');

  const aggregatorPrefix = order.aggregator === 'swiggy' ? 'SWG' :
                           order.aggregator === 'zomato' ? 'ZMT' : 'DIR';

  return `AGG-${yy}${mm}-${aggregatorPrefix}${order.orderNumber}`;
}

/**
 * Transform aggregator order items to CartItem format
 */
function transformItemsToCartItems(order: AggregatorOrder): CartItem[] {
  return order.cart.items.map((item, index) => ({
    id: item.id || `agg-item-${index}`,
    menuItem: {
      id: item.id || `agg-menu-${index}`,
      name: item.name,
      price: item.price,
      category: item.category || 'Aggregator',
      available: true,
    },
    quantity: item.quantity,
    modifiers: item.addons?.map((addon: any) => ({
      id: addon.id || `addon-${Math.random().toString(36).substr(2, 9)}`,
      name: addon.name || 'Addon',
      price: addon.price || 0,
    })) || [],
    specialInstructions: item.specialInstructions || undefined,
    subtotal: item.total,
  }));
}

/**
 * Determine payment method based on order payment info
 */
function determinePaymentMethod(order: AggregatorOrder): PaymentMethod {
  if (order.payment.isPrepaid) {
    return 'upi'; // Prepaid orders are typically UPI/online
  }
  return 'cash'; // Cash on delivery
}

export interface AggregatorSalesRecord {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  orderNumber: string;
  orderType: string;
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
  createdAt: string;
  completedAt: string;
}

/**
 * Record aggregator sale to sales_transactions table
 * Called when order is marked ready
 */
export async function recordAggregatorSale(
  tenantId: string,
  order: AggregatorOrder
): Promise<AggregatorSalesRecord | null> {
  if (!isTauri()) {
    console.log('[AggregatorSalesService] Not in Tauri, skipping sale recording');
    return null;
  }

  try {
    const database = await getDatabase();
    const now = new Date().toISOString();
    const id = `agg-sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const invoiceNumber = generateAggregatorInvoiceNumber(order);

    // Split tax evenly between CGST and SGST
    const cgst = order.cart.tax / 2;
    const sgst = order.cart.tax / 2;

    const items = transformItemsToCartItems(order);
    const paymentMethod = determinePaymentMethod(order);

    const record: AggregatorSalesRecord = {
      id,
      tenantId,
      invoiceNumber,
      orderNumber: order.orderNumber,
      orderType: 'delivery',
      source: order.aggregator,
      subtotal: order.cart.subtotal,
      serviceCharge: 0,
      cgst,
      sgst,
      discount: order.cart.discount,
      roundOff: 0,
      grandTotal: order.cart.total,
      paymentMethod,
      paymentStatus: order.payment.isPrepaid ? 'completed' : 'pending',
      items,
      createdAt: order.createdAt,
      completedAt: now,
    };

    // Insert into sales_transactions table
    await database.execute(
      `INSERT INTO sales_transactions (
        id, tenant_id, invoice_number, order_number, order_type, table_number,
        source, subtotal, service_charge, cgst, sgst, discount, round_off,
        grand_total, payment_method, payment_status, items_json, cashier_name,
        staff_id, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        record.id,
        record.tenantId,
        record.invoiceNumber,
        record.orderNumber,
        record.orderType,
        null, // No table for delivery orders
        record.source,
        record.subtotal,
        record.serviceCharge,
        record.cgst,
        record.sgst,
        record.discount,
        record.roundOff,
        record.grandTotal,
        record.paymentMethod,
        record.paymentStatus,
        JSON.stringify(record.items),
        order.aggregator.toUpperCase(), // Use aggregator name as cashier
        null, // No staff for aggregator orders
        record.createdAt,
        record.completedAt,
      ]
    );

    console.log(`[AggregatorSalesService] Recorded sale: ${invoiceNumber} - ₹${record.grandTotal}`);
    return record;
  } catch (error) {
    console.error('[AggregatorSalesService] Failed to record sale:', error);
    return null;
  }
}

/**
 * Check if sale already exists for an order (prevent duplicates)
 */
export async function saleExistsForOrder(orderNumber: string): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const database = await getDatabase();
    const result = await database.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM sales_transactions
       WHERE order_number = $1 AND source IN ('swiggy', 'zomato', 'direct')`,
      [orderNumber]
    );
    return (result[0]?.count || 0) > 0;
  } catch (error) {
    console.error('[AggregatorSalesService] Failed to check existing sale:', error);
    return false;
  }
}

export const aggregatorSalesService = {
  generateInvoiceNumber: generateAggregatorInvoiceNumber,
  recordSale: recordAggregatorSale,
  saleExists: saleExistsForOrder,
};

export default aggregatorSalesService;
