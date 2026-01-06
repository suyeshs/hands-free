/**
 * Remote Print Handler
 * Listens for print requests from other devices on the LAN and prints using the POS's configured printer
 */

import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { aggregatorOrderDb } from './aggregatorOrderDb';
import { printerDiscoveryService } from './printerDiscoveryService';
import { usePrinterStore } from '../stores/printerStore';
import { billService } from './billService';
import { generateBillEscPos } from '../components/print/BillPrint';
import { Order } from '../types/pos';

interface RemotePrintRequest {
  print_type: string;
  order_id: string;
  request_id?: string;
  device_name?: string;
}

let unlistenFn: UnlistenFn | null = null;

/**
 * Initialize the remote print request listener
 * Call this when the POS app starts
 */
export async function initRemotePrintHandler(): Promise<void> {
  // Avoid duplicate listeners
  if (unlistenFn) {
    console.log('[RemotePrint] Handler already initialized');
    return;
  }

  console.log('[RemotePrint] Initializing remote print handler...');

  unlistenFn = await listen<RemotePrintRequest>('remote_print_request', async (event) => {
    const { print_type, order_id, request_id, device_name } = event.payload;

    console.log(`[RemotePrint] Received request from ${device_name || 'unknown'}: ${print_type} for order ${order_id}`);

    try {
      if (print_type === 'bill') {
        await handleBillPrint(order_id);
      } else if (print_type === 'kot') {
        await handleKOTPrint(order_id);
      } else {
        console.warn(`[RemotePrint] Unknown print type: ${print_type}`);
      }

      console.log(`[RemotePrint] Completed: ${request_id || 'no-id'}`);
    } catch (error) {
      console.error(`[RemotePrint] Failed to print:`, error);
    }
  });

  console.log('[RemotePrint] Handler initialized successfully');
}

/**
 * Stop listening for remote print requests
 */
export function stopRemotePrintHandler(): void {
  if (unlistenFn) {
    unlistenFn();
    unlistenFn = null;
    console.log('[RemotePrint] Handler stopped');
  }
}

/**
 * Handle bill print request
 */
async function handleBillPrint(orderId: string): Promise<void> {
  // Lookup order from database
  const order = await aggregatorOrderDb.get(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // Convert aggregator order to POS Order format for bill generation
  const posOrder = convertToPosOrder(order);

  // Generate bill data
  const bill = billService.generateBill(posOrder);

  // Generate ESC/POS content
  const escPosContent = generateBillEscPos(bill.billData);

  // Send to configured printer
  await sendToPrinter(escPosContent);

  console.log(`[RemotePrint] Bill printed for order ${orderId}`);
}

/**
 * Handle KOT print request
 */
async function handleKOTPrint(orderId: string): Promise<void> {
  // TODO: Implement KOT printing
  // This would need to lookup the order and format it as a KOT
  console.log(`[RemotePrint] KOT print not yet implemented for order ${orderId}`);
}

/**
 * Send ESC/POS content to the configured printer (no dialog)
 */
async function sendToPrinter(escPosContent: string): Promise<void> {
  const config = usePrinterStore.getState().config;

  if (config.printerType === 'network' && config.networkPrinterUrl) {
    // Parse network printer URL (format: "192.168.1.100:9100" or just "192.168.1.100")
    const [address, portStr] = config.networkPrinterUrl.replace(/^https?:\/\//, '').split(':');
    const port = parseInt(portStr) || 9100;

    const success = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);
    if (!success) {
      throw new Error('Failed to send to network printer');
    }
    console.log(`[RemotePrint] Sent to network printer at ${address}:${port}`);
  } else if (config.printerType === 'system' && config.systemPrinterName) {
    const success = await printerDiscoveryService.printToSystemPrinter(
      config.systemPrinterName,
      escPosContent,
      'text'
    );
    if (!success) {
      throw new Error('Failed to send to system printer');
    }
    console.log(`[RemotePrint] Sent to system printer: ${config.systemPrinterName}`);
  } else {
    throw new Error('No printer configured. Set up a network or system printer in settings.');
  }
}

/**
 * Convert aggregator order to POS Order format for bill generation
 */
function convertToPosOrder(aggregatorOrder: any): Order {
  const items = Array.isArray(aggregatorOrder.items)
    ? aggregatorOrder.items
    : JSON.parse(aggregatorOrder.items_json || '[]');

  return {
    id: aggregatorOrder.order_id || aggregatorOrder.id,
    orderNumber: aggregatorOrder.order_number,
    items: items.map((item: any) => ({
      menuItem: {
        id: item.id || '',
        name: item.name || item.menuItem?.name || 'Unknown Item',
        price: item.price || item.menuItem?.price || 0,
        description: '',
        category_id: '',
        dietary_tags: [],
        allergens: [],
        spice_level: 0,
        is_veg: false,
        is_vegan: false,
        preparation_time: 0,
        available: true,
        active: true,
        variants: [],
        addons: [],
        is_popular: false,
      },
      quantity: item.quantity || 1,
      modifiers: item.modifiers || [],
      subtotal: item.subtotal || (item.quantity || 1) * (item.price || item.menuItem?.price || 0),
      specialInstructions: item.specialInstructions || '',
    })),
    subtotal: aggregatorOrder.subtotal || 0,
    total: aggregatorOrder.total || 0,
    discount: aggregatorOrder.discount || 0,
    packingCharges: aggregatorOrder.packing_charges || 0,
    orderType: aggregatorOrder.order_type || 'delivery',
    tableNumber: aggregatorOrder.table_number || undefined,
    customer: {
      name: aggregatorOrder.customer_name,
      phone: aggregatorOrder.customer_phone,
      address: aggregatorOrder.customer_address,
    },
    createdAt: aggregatorOrder.created_at || new Date().toISOString(),
    paymentMethod: aggregatorOrder.payment_method || undefined,
    status: aggregatorOrder.status || 'pending',
    tax: aggregatorOrder.tax || 0,
  };
}
