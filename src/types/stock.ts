/**
 * Out of Stock (86) Types
 *
 * Tracks items marked as out of stock by kitchen staff
 * and alerts sent to POS/service devices.
 */

export interface OutOfStockItem {
  id: string;
  itemName: string;
  menuItemId?: string;
  portionsOut: number; // Number of portions out, or -1 for "all out"
  createdAt: string;
  createdByDeviceId?: string;
  createdByStaffName?: string;
  isActive: boolean;
}

export interface OutOfStockAlert {
  id: string;
  outOfStockItemId: string;
  itemName: string;
  portionsOut: number;
  orderContext?: {
    orderId: string;
    orderNumber: string;
    tableNumber?: number;
  };
  createdAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedByStaffName?: string;
}

export interface OutOfStockBroadcast {
  type: 'out_of_stock';
  item: OutOfStockItem;
  alert: OutOfStockAlert;
}

export interface BackInStockBroadcast {
  type: 'back_in_stock';
  itemId: string;
  itemName: string;
}
