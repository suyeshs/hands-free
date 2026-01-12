/**
 * Billing History Panel
 * Allows viewing and reprinting bills from previous orders
 * Used inline in Settings page
 */

import { useState, useEffect } from 'react';
import { IndustrialButton } from '../ui-industrial/IndustrialButton';
import { salesTransactionService, SalesTransaction } from '../../lib/salesTransactionService';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { usePrinterStore } from '../../stores/printerStore';
import { printerDiscoveryService } from '../../lib/printerDiscoveryService';
import { generateBillPDF, generateBillHTML, generateBillEscPos, BillData } from '../print/BillPrint';
import { Order } from '../../types/pos';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { Search, Printer, FileText, Download, RefreshCw } from 'lucide-react';

export function BillingHistoryPanel() {
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  // Priority: Tenant Store (device activation) > Auth Store (user login)
  const tenantId = tenant?.tenantId || user?.tenantId || '';

  const [orders, setOrders] = useState<SalesTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesTransaction | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const [reprintResult, setReprintResult] = useState<{ success: boolean; message: string } | null>(null);
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');

  const settings = useRestaurantSettingsStore((s) => s.settings);
  const { config: printerConfig } = usePrinterStore();

  useEffect(() => {
    loadRecentOrders();
  }, [tenantId]);

  const loadRecentOrders = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Get last 7 days of orders for reprinting
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const startDate = weekAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      const allOrders = await salesTransactionService.getSalesForDateRange(tenantId, startDate, endDate);
      setOrders(allOrders);
    } catch (error) {
      console.error('[BillingHistoryPanel] Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadRecentOrders();
      return;
    }

    setLoading(true);
    try {
      const results = await salesTransactionService.searchTransactions(
        tenantId,
        searchQuery.trim(),
        orderTypeFilter === 'all' ? undefined : orderTypeFilter
      );
      setOrders(results);
    } catch (error) {
      console.error('[BillingHistoryPanel] Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const convertToOrder = (tx: SalesTransaction): Order => ({
    id: tx.id,
    orderNumber: tx.orderNumber,
    tableNumber: tx.tableNumber,
    orderType: tx.orderType as 'dine-in' | 'takeout' | 'delivery',
    items: tx.items,
    subtotal: tx.subtotal,
    tax: tx.cgst + tx.sgst,
    discount: tx.discount,
    total: tx.grandTotal,
    status: 'completed',
    paymentMethod: tx.paymentMethod,
    createdAt: tx.createdAt,
  });

  const createBillData = (tx: SalesTransaction): BillData => ({
    order: convertToOrder(tx),
    invoiceNumber: tx.invoiceNumber,
    restaurantSettings: settings,
    taxes: {
      cgst: tx.cgst,
      sgst: tx.sgst,
      serviceCharge: tx.serviceCharge,
      roundOff: tx.roundOff,
      grandTotal: tx.grandTotal,
    },
    printedAt: new Date(tx.completedAt),
    cashierName: tx.cashierName,
  });

  const handleReprint = async (method: 'printer' | 'pdf' | 'download') => {
    if (!selectedOrder) return;

    setReprinting(true);
    setReprintResult(null);

    try {
      const billData = createBillData(selectedOrder);

      if (method === 'printer') {
        // Print to configured printer
        if (printerConfig.printerType === 'network' && printerConfig.networkPrinterUrl) {
          const [address, portStr] = printerConfig.networkPrinterUrl.replace(/^https?:\/\//, '').split(':');
          const port = parseInt(portStr) || 9100;
          const escPosContent = generateBillEscPos(billData);
          const success = await printerDiscoveryService.sendToNetworkPrinter(address, port, escPosContent);
          setReprintResult({
            success,
            message: success ? 'Bill sent to printer!' : 'Failed to send to printer',
          });
        } else if (printerConfig.printerType === 'system' && printerConfig.systemPrinterName) {
          const html = generateBillHTML(billData);
          const plainText = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
          const success = await printerDiscoveryService.printToSystemPrinter(
            printerConfig.systemPrinterName,
            plainText,
            'text'
          );
          setReprintResult({
            success,
            message: success ? 'Bill sent to printer!' : 'Failed to send to printer',
          });
        } else {
          // Use native Tauri print or fallback to iframe
          const html = generateBillHTML(billData);
          const success = await printerDiscoveryService.printHtmlContent(html);
          setReprintResult({
            success,
            message: success ? 'Print dialog opened' : 'Failed to open print dialog',
          });
        }
      } else if (method === 'pdf') {
        // Open PDF in new tab
        const doc = await generateBillPDF(billData);
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
        setReprintResult({ success: true, message: 'PDF opened in new tab' });
      } else if (method === 'download') {
        // Download PDF
        const doc = await generateBillPDF(billData);
        const dateStr = new Date(selectedOrder.completedAt).toLocaleDateString('en-IN').replace(/\//g, '-');
        const filename = `Bill_${selectedOrder.invoiceNumber}_${dateStr}.pdf`;
        doc.save(filename);
        setReprintResult({ success: true, message: 'PDF downloaded' });
      }
    } catch (error) {
      console.error('[BillingHistoryPanel] Reprint failed:', error);
      setReprintResult({
        success: false,
        message: error instanceof Error ? error.message : 'Reprint failed',
      });
    } finally {
      setReprinting(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  };

  const filteredOrders = orderTypeFilter === 'all'
    ? orders
    : orders.filter(o => o.orderType === orderTypeFilter);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Billing History</h2>
          <p className="text-sm text-slate-400">View and reprint previous bills</p>
        </div>
        <button
          onClick={loadRecentOrders}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by invoice # or table #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={orderTypeFilter}
          onChange={(e) => setOrderTypeFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Types</option>
          <option value="dine-in">Dine-In</option>
          <option value="takeout">Takeout</option>
          <option value="delivery">Delivery</option>
        </select>
        <IndustrialButton variant="primary" onClick={handleSearch}>
          Search
        </IndustrialButton>
        <IndustrialButton variant="secondary" onClick={loadRecentOrders}>
          Last 7 Days
        </IndustrialButton>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Orders List */}
        <div className="flex-1 max-h-[500px] overflow-y-auto border border-slate-700 rounded-lg">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <div className="text-3xl mb-2">📋</div>
              <div>No orders found</div>
              <div className="text-xs mt-1">Try adjusting your search or filters</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800 sticky top-0">
                <tr className="text-left text-slate-400">
                  <th className="p-2">Invoice</th>
                  <th className="p-2">Table</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Time</th>
                  <th className="p-2">Payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`cursor-pointer border-t border-slate-700 hover:bg-slate-700/50 ${
                      selectedOrder?.id === order.id ? 'bg-blue-600/30 border-blue-500' : ''
                    }`}
                  >
                    <td className="p-2 font-mono text-xs">{order.invoiceNumber}</td>
                    <td className="p-2">
                      {order.tableNumber ? `T${order.tableNumber}` : '-'}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        order.orderType === 'dine-in' ? 'bg-green-500/20 text-green-400' :
                        order.orderType === 'takeout' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {order.orderType}
                      </span>
                    </td>
                    <td className="p-2 font-mono">Rs.{order.grandTotal.toFixed(0)}</td>
                    <td className="p-2 text-slate-400">
                      {formatDate(order.completedAt)} {formatTime(order.completedAt)}
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 bg-slate-600 rounded text-xs uppercase">
                        {order.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Selected Order Details & Actions */}
        {selectedOrder && (
          <div className="w-full lg:w-72 bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Selected Order</h3>
              <div className="text-lg font-mono font-bold">{selectedOrder.invoiceNumber}</div>
              {selectedOrder.tableNumber && (
                <div className="text-sm text-slate-400">Table {selectedOrder.tableNumber}</div>
              )}
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-1">Items ({selectedOrder.items.length})</div>
              <div className="text-xs max-h-32 overflow-y-auto space-y-1 bg-slate-900/50 rounded p-2">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate">{item.quantity}x {item.menuItem?.name}</span>
                    <span className="text-slate-400 ml-2">Rs.{item.subtotal.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span>Rs.{selectedOrder.subtotal.toFixed(2)}</span>
              </div>
              {selectedOrder.cgst > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>CGST</span>
                  <span>Rs.{selectedOrder.cgst.toFixed(2)}</span>
                </div>
              )}
              {selectedOrder.sgst > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>SGST</span>
                  <span>Rs.{selectedOrder.sgst.toFixed(2)}</span>
                </div>
              )}
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>-Rs.{selectedOrder.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-600">
                <span>Total</span>
                <span>Rs.{selectedOrder.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <IndustrialButton
                variant="success"
                onClick={() => handleReprint('printer')}
                disabled={reprinting}
                className="w-full"
              >
                <Printer size={16} className="mr-2" />
                {reprinting ? 'PRINTING...' : 'PRINT BILL'}
              </IndustrialButton>

              <div className="grid grid-cols-2 gap-2">
                <IndustrialButton
                  variant="primary"
                  onClick={() => handleReprint('pdf')}
                  disabled={reprinting}
                  size="sm"
                >
                  <FileText size={14} className="mr-1" />
                  PDF
                </IndustrialButton>
                <IndustrialButton
                  variant="secondary"
                  onClick={() => handleReprint('download')}
                  disabled={reprinting}
                  size="sm"
                >
                  <Download size={14} className="mr-1" />
                  SAVE
                </IndustrialButton>
              </div>
            </div>

            {reprintResult && (
              <div
                className={`p-2 rounded text-xs text-center ${
                  reprintResult.success
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {reprintResult.success ? '✓' : '✕'} {reprintResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="text-xs text-slate-500 text-center pt-2">
        Showing {filteredOrders.length} orders from the last 7 days
      </div>
    </div>
  );
}

export default BillingHistoryPanel;
