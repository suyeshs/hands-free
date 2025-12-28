/**
 * Daily Sales Report
 *
 * Comprehensive sales reporting with:
 * - Sales summary (total, orders, average)
 * - Payment method breakdown
 * - Hourly sales chart
 * - Top selling items
 * - Order type breakdown
 * - Cash register reconciliation
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useDailySalesStore } from '../stores/dailySalesStore';
import { cn } from '../lib/utils';

type ViewMode = 'summary' | 'transactions';
type SortField = 'time' | 'invoice' | 'total' | 'payment' | 'type';
type SortDirection = 'asc' | 'desc';

// Simple bar chart component
function HourlySalesChart({ data }: { data: { hour: number; sales: number }[] }) {
  const maxSales = Math.max(...data.map((d) => d.sales), 1);
  const relevantHours = data.filter((d) => d.sales > 0 || (d.hour >= 8 && d.hour <= 23));

  if (relevantHours.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        No sales data for this date
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-32">
      {relevantHours.map((d) => (
        <div key={d.hour} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-blue-500 rounded-t transition-all"
            style={{ height: `${(d.sales / maxSales) * 100}%`, minHeight: d.sales > 0 ? 4 : 0 }}
          />
          <span className="text-[10px] text-slate-500 mt-1">
            {d.hour.toString().padStart(2, '0')}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DailySalesReport() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    selectedDate,
    setSelectedDate,
    report,
    cashRegister,
    isLoading,
    error,
    fetchReport,
    fetchCashRegister,
    openCashRegister,
    closeCashRegister,
    getTodayDate,
  } = useDailySalesStore();

  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [openingCashAmount, setOpeningCashAmount] = useState('');
  const [closingCashAmount, setClosingCashAmount] = useState('');

  // View mode and sorting
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isToday = selectedDate === getTodayDate();

  // Load data on mount and date change
  useEffect(() => {
    if (user?.tenantId) {
      fetchReport(user.tenantId, selectedDate);
      fetchCashRegister(user.tenantId, selectedDate);
    }
  }, [user?.tenantId, selectedDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleOpenRegister = async () => {
    if (!user?.tenantId || !openingCashAmount) return;
    try {
      await openCashRegister(user.tenantId, parseFloat(openingCashAmount), user.name);
      setShowOpenCashModal(false);
      setOpeningCashAmount('');
    } catch (e) {
      alert('Failed to open register');
    }
  };

  const handleCloseRegister = async () => {
    if (!user?.tenantId || !closingCashAmount) return;
    try {
      await closeCashRegister(user.tenantId, parseFloat(closingCashAmount), user.name);
      setShowCloseCashModal(false);
      setClosingCashAmount('');
    } catch (e) {
      alert('Failed to close register');
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleToday = () => {
    setSelectedDate(getTodayDate());
  };

  // Calculate payment percentages
  const paymentPercentages = useMemo(() => {
    if (!report) return { cash: 0, card: 0, upi: 0, wallet: 0 };
    const total = report.summary.totalSales || 1;
    return {
      cash: (report.paymentBreakdown.cash / total) * 100,
      card: (report.paymentBreakdown.card / total) * 100,
      upi: (report.paymentBreakdown.upi / total) * 100,
      wallet: (report.paymentBreakdown.wallet / total) * 100,
    };
  }, [report]);

  // Calculate order type percentages
  const orderTypePercentages = useMemo(() => {
    if (!report) return { 'dine-in': 0, takeout: 0, delivery: 0 };
    const totalOrders = report.summary.totalOrders || 1;
    return {
      'dine-in': (report.orderTypeBreakdown['dine-in'].count / totalOrders) * 100,
      takeout: (report.orderTypeBreakdown['takeout'].count / totalOrders) * 100,
      delivery: (report.orderTypeBreakdown['delivery'].count / totalOrders) * 100,
    };
  }, [report]);

  // Sorted transactions for table view
  const sortedTransactions = useMemo(() => {
    if (!report?.transactions) return [];

    const sorted = [...report.transactions].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'time':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'invoice':
          comparison = a.invoiceNumber.localeCompare(b.invoiceNumber);
          break;
        case 'total':
          comparison = a.grandTotal - b.grandTotal;
          break;
        case 'payment':
          comparison = a.paymentMethod.localeCompare(b.paymentMethod);
          break;
        case 'type':
          comparison = a.orderType.localeCompare(b.orderType);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [report?.transactions, sortField, sortDirection]);

  // Toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  
  // Format time
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get payment method badge color
  const getPaymentBadgeColor = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'card': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'upi': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'wallet': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  // Get order type badge color
  const getOrderTypeBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'dine-in': return 'bg-blue-500/20 text-blue-400';
      case 'takeout': return 'bg-amber-500/20 text-amber-400';
      case 'delivery': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  // Get source badge color
  const getSourceBadgeColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'pos': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'zomato': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'swiggy': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'website': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">DAILY SALES REPORT</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('summary')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-bold transition-colors',
                viewMode === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode('transactions')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-bold transition-colors',
                viewMode === 'transactions'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              Transactions
            </button>
          </div>

          <div className="w-px h-6 bg-slate-600" />

          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
          />
          <button
            onClick={handleToday}
            className={cn(
              'px-4 py-2 rounded-lg font-bold text-sm transition-colors',
              isToday
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            TODAY
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : error ? (
          <div className="text-center text-red-400 py-8">
            <p>Error loading report: {error}</p>
            <button
              onClick={() => user?.tenantId && fetchReport(user.tenantId)}
              className="mt-4 px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
            >
              Retry
            </button>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 rounded-xl p-6 text-center">
                <div className="text-slate-400 text-sm uppercase tracking-wide mb-2">Total Sales</div>
                <div className="text-4xl font-bold text-green-400">
                  {formatCurrency(report?.summary.totalSales || 0)}
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 text-center">
                <div className="text-slate-400 text-sm uppercase tracking-wide mb-2">Total Orders</div>
                <div className="text-4xl font-bold text-blue-400">
                  {report?.summary.totalOrders || 0}
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-6 text-center">
                <div className="text-slate-400 text-sm uppercase tracking-wide mb-2">Average Order</div>
                <div className="text-4xl font-bold text-purple-400">
                  {formatCurrency(report?.summary.averageOrderValue || 0)}
                </div>
              </div>
            </div>

            {/* Source Breakdown - POS, Swiggy, Zomato, Website */}
            {report?.sourceBreakdown && (
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">Sales by Channel</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* POS Sales */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">🏪</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">POS / Dine-in</div>
                    <div className="text-xl font-bold text-blue-400">
                      {formatCurrency(report.sourceBreakdown.pos.sales)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {report.sourceBreakdown.pos.orders} orders
                    </div>
                  </div>

                  {/* Zomato */}
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">🔴</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Zomato</div>
                    <div className="text-xl font-bold text-red-400">
                      {formatCurrency(report.sourceBreakdown.zomato.sales)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {report.sourceBreakdown.zomato.orders} orders
                    </div>
                  </div>

                  {/* Swiggy */}
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">🟠</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Swiggy</div>
                    <div className="text-xl font-bold text-orange-400">
                      {formatCurrency(report.sourceBreakdown.swiggy.sales)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {report.sourceBreakdown.swiggy.orders} orders
                    </div>
                  </div>

                  {/* Website / Online */}
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">🌐</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Website</div>
                    <div className="text-xl font-bold text-purple-400">
                      {formatCurrency(report.sourceBreakdown.website.sales)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {report.sourceBreakdown.website.orders} orders
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Breakdown */}
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">Payment Breakdown</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💵</span>
                      <span>Cash</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(report?.paymentBreakdown.cash || 0)}</div>
                      <div className="text-xs text-slate-400">{paymentPercentages.cash.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💳</span>
                      <span>Card</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(report?.paymentBreakdown.card || 0)}</div>
                      <div className="text-xs text-slate-400">{paymentPercentages.card.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📱</span>
                      <span>UPI</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(report?.paymentBreakdown.upi || 0)}</div>
                      <div className="text-xs text-slate-400">{paymentPercentages.upi.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">👛</span>
                      <span>Wallet</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(report?.paymentBreakdown.wallet || 0)}</div>
                      <div className="text-xs text-slate-400">{paymentPercentages.wallet.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Reconciliation */}
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">Cash Reconciliation</h2>
                {cashRegister ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Opening Cash</span>
                      <span className="font-bold">{formatCurrency(cashRegister.openingCash)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cash Sales</span>
                      <span className="font-bold text-green-400">
                        + {formatCurrency(report?.paymentBreakdown.cash || 0)}
                      </span>
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Expected Closing</span>
                        <span className="font-bold">
                          {formatCurrency((cashRegister.openingCash) + (report?.paymentBreakdown.cash || 0))}
                        </span>
                      </div>
                    </div>
                    {cashRegister.status === 'closed' ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Actual Closing</span>
                          <span className="font-bold">{formatCurrency(cashRegister.actualClosingCash || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Variance</span>
                          <span className={cn(
                            'font-bold',
                            (cashRegister.cashVariance || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                          )}>
                            {(cashRegister.cashVariance || 0) >= 0 ? '+' : ''}
                            {formatCurrency(cashRegister.cashVariance || 0)}
                          </span>
                        </div>
                      </>
                    ) : isToday ? (
                      <button
                        onClick={() => setShowCloseCashModal(true)}
                        className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition-colors"
                      >
                        CLOSE REGISTER
                      </button>
                    ) : null}
                  </div>
                ) : isToday ? (
                  <div className="text-center py-4">
                    <p className="text-slate-400 mb-4">Register not opened for today</p>
                    <button
                      onClick={() => setShowOpenCashModal(true)}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      OPEN REGISTER
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400">
                    No register data for this date
                  </div>
                )}
              </div>
            </div>

            {/* Hourly Sales Chart */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Hourly Sales</h2>
              <HourlySalesChart data={report?.hourlySales || []} />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Items */}
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">Top Selling Items</h2>
                {report?.topItems && report.topItems.length > 0 ? (
                  <div className="space-y-2">
                    {report.topItems.slice(0, 10).map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-mono text-sm w-5">{idx + 1}.</span>
                          <span className="truncate max-w-[200px]">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">{item.quantity}</span>
                          <span className="text-slate-400 text-sm ml-2">
                            ({formatCurrency(item.revenue)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-4">No items sold</div>
                )}
              </div>

              {/* Order Type Breakdown */}
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">Order Type Breakdown</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Dine-in</span>
                      <span>
                        {report?.orderTypeBreakdown['dine-in'].count || 0} orders
                        ({orderTypePercentages['dine-in'].toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${orderTypePercentages['dine-in']}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-slate-400 mt-1">
                      {formatCurrency(report?.orderTypeBreakdown['dine-in'].sales || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Takeout</span>
                      <span>
                        {report?.orderTypeBreakdown['takeout'].count || 0} orders
                        ({orderTypePercentages['takeout'].toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${orderTypePercentages['takeout']}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-slate-400 mt-1">
                      {formatCurrency(report?.orderTypeBreakdown['takeout'].sales || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Delivery</span>
                      <span>
                        {report?.orderTypeBreakdown['delivery'].count || 0} orders
                        ({orderTypePercentages['delivery'].toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${orderTypePercentages['delivery']}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-slate-400 mt-1">
                      {formatCurrency(report?.orderTypeBreakdown['delivery'].sales || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Summary */}
            <div className="bg-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Tax & Charges Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-slate-400 text-sm mb-1">Total Tax</div>
                  <div className="text-xl font-bold">{formatCurrency(report?.summary.totalTax || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 text-sm mb-1">Service Charge</div>
                  <div className="text-xl font-bold">{formatCurrency(report?.summary.totalServiceCharge || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 text-sm mb-1">Discounts Given</div>
                  <div className="text-xl font-bold text-red-400">
                    -{formatCurrency(report?.summary.totalDiscount || 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 text-sm mb-1">Net Sales</div>
                  <div className="text-xl font-bold text-green-400">
                    {formatCurrency((report?.summary.totalSales || 0) - (report?.summary.totalTax || 0))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Transactions Table View (Excel-like) */
          <div className="flex flex-col h-full">
            {/* Quick Stats Bar */}
            <div className="flex items-center gap-4 mb-4 bg-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Total:</span>
                <span className="font-bold text-green-400">{formatCurrency(report?.summary.totalSales || 0)}</span>
              </div>
              <div className="w-px h-5 bg-slate-600" />
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Orders:</span>
                <span className="font-bold text-blue-400">{report?.summary.totalOrders || 0}</span>
              </div>
              <div className="w-px h-5 bg-slate-600" />
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Avg:</span>
                <span className="font-bold text-purple-400">{formatCurrency(report?.summary.averageOrderValue || 0)}</span>
              </div>
              <div className="flex-1" />
              <div className="text-slate-500 text-sm">
                {sortedTransactions.length} transactions
              </div>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 bg-slate-800 rounded-xl overflow-hidden flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-700/50 text-sm font-bold uppercase tracking-wide text-slate-400 border-b border-slate-600">
                <button
                  onClick={() => handleSort('time')}
                  className="col-span-1 text-left flex items-center gap-1 hover:text-white transition-colors"
                >
                  Time
                  {sortField === 'time' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <button
                  onClick={() => handleSort('invoice')}
                  className="col-span-2 text-left flex items-center gap-1 hover:text-white transition-colors"
                >
                  Invoice
                  {sortField === 'invoice' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <button
                  onClick={() => handleSort('type')}
                  className="col-span-1 text-left flex items-center gap-1 hover:text-white transition-colors"
                >
                  Type
                  {sortField === 'type' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <div className="col-span-1 text-left">Source</div>
                <div className="col-span-2 text-left">Items</div>
                <button
                  onClick={() => handleSort('payment')}
                  className="col-span-1 text-left flex items-center gap-1 hover:text-white transition-colors"
                >
                  Payment
                  {sortField === 'payment' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <div className="col-span-1 text-right">Subtotal</div>
                <div className="col-span-1 text-right">Tax</div>
                <div className="col-span-1 text-right">Disc</div>
                <button
                  onClick={() => handleSort('total')}
                  className="col-span-1 text-right flex items-center justify-end gap-1 hover:text-white transition-colors"
                >
                  Total
                  {sortField === 'total' && (
                    <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-auto">
                {sortedTransactions.length === 0 ? (
                  <div className="text-center text-slate-500 py-12">
                    No transactions for this date
                  </div>
                ) : (
                  sortedTransactions.map((tx) => {
                    const items = tx.items || [];
                    const isExpanded = expandedRows.has(tx.id);

                    return (
                      <div key={tx.id}>
                        {/* Main Row */}
                        <div
                          className={cn(
                            'grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer',
                            isExpanded && 'bg-slate-700/20'
                          )}
                          onClick={() => toggleRowExpansion(tx.id)}
                        >
                          <div className="col-span-1 text-slate-300 font-mono text-sm">
                            {formatTime(tx.createdAt)}
                          </div>
                          <div className="col-span-2 font-mono text-sm text-white">
                            {tx.invoiceNumber}
                          </div>
                          <div className="col-span-1">
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-bold uppercase',
                              getOrderTypeBadgeColor(tx.orderType)
                            )}>
                              {tx.orderType === 'dine-in' ? 'DINE' : tx.orderType.slice(0, 4).toUpperCase()}
                            </span>
                          </div>
                          <div className="col-span-1">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border',
                              getSourceBadgeColor(tx.source)
                            )}>
                              {tx.source === 'pos' ? (tx.tableNumber ? `T${tx.tableNumber}` : 'POS') : tx.source.slice(0, 4).toUpperCase()}
                            </span>
                          </div>
                          <div className="col-span-2 text-slate-300 text-sm truncate">
                            {items.length > 0 ? (
                              <span className="flex items-center gap-1">
                                <span className="text-slate-500">{items.length}x</span>
                                {items.slice(0, 2).map(i => i.menuItem.name).join(', ')}
                                {items.length > 2 && <span className="text-slate-500">+{items.length - 2}</span>}
                              </span>
                            ) : '-'}
                          </div>
                          <div className="col-span-1">
                            <span className={cn(
                              'px-2 py-0.5 rounded text-xs font-bold uppercase border',
                              getPaymentBadgeColor(tx.paymentMethod)
                            )}>
                              {tx.paymentMethod.slice(0, 4)}
                            </span>
                          </div>
                          <div className="col-span-1 text-right text-slate-300 text-sm font-mono">
                            {formatCurrency(tx.subtotal)}
                          </div>
                          <div className="col-span-1 text-right text-slate-400 text-sm font-mono">
                            {formatCurrency(tx.cgst + tx.sgst)}
                          </div>
                          <div className="col-span-1 text-right text-red-400 text-sm font-mono">
                            {tx.discount > 0 ? `-${formatCurrency(tx.discount)}` : '-'}
                          </div>
                          <div className="col-span-1 text-right text-green-400 font-bold font-mono">
                            {formatCurrency(tx.grandTotal)}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && items.length > 0 && (
                          <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-3">
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-3" />
                              <div className="col-span-9">
                                <div className="text-xs text-slate-500 uppercase font-bold mb-2">Order Items</div>
                                <div className="bg-slate-900/50 rounded-lg p-3">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-slate-500 text-xs uppercase">
                                        <th className="text-left py-1">Item</th>
                                        <th className="text-center py-1 w-16">Qty</th>
                                        <th className="text-right py-1 w-24">Price</th>
                                        <th className="text-right py-1 w-24">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item, idx) => (
                                        <tr key={idx} className="border-t border-slate-700/50">
                                          <td className="py-2 text-white">{item.menuItem.name}</td>
                                          <td className="py-2 text-center text-slate-300">{item.quantity}</td>
                                          <td className="py-2 text-right text-slate-400 font-mono">
                                            {formatCurrency(item.menuItem.price)}
                                          </td>
                                          <td className="py-2 text-right text-white font-mono">
                                            {formatCurrency(item.subtotal)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-slate-600">
                                        <td colSpan={3} className="py-2 text-right text-slate-400">Subtotal:</td>
                                        <td className="py-2 text-right font-mono">{formatCurrency(tx.subtotal)}</td>
                                      </tr>
                                      {tx.serviceCharge > 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-slate-400">Service Charge:</td>
                                          <td className="py-1 text-right font-mono text-slate-300">{formatCurrency(tx.serviceCharge)}</td>
                                        </tr>
                                      )}
                                      {(tx.cgst + tx.sgst) > 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-slate-400">
                                            Tax (CGST {formatCurrency(tx.cgst)} + SGST {formatCurrency(tx.sgst)}):
                                          </td>
                                          <td className="py-1 text-right font-mono text-slate-300">{formatCurrency(tx.cgst + tx.sgst)}</td>
                                        </tr>
                                      )}
                                      {tx.discount > 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-slate-400">Discount:</td>
                                          <td className="py-1 text-right font-mono text-red-400">-{formatCurrency(tx.discount)}</td>
                                        </tr>
                                      )}
                                      {tx.roundOff !== 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-slate-400">Round Off:</td>
                                          <td className="py-1 text-right font-mono text-slate-300">{formatCurrency(tx.roundOff)}</td>
                                        </tr>
                                      )}
                                      <tr className="border-t border-slate-600">
                                        <td colSpan={3} className="py-2 text-right font-bold">Grand Total:</td>
                                        <td className="py-2 text-right font-bold text-green-400 font-mono">{formatCurrency(tx.grandTotal)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                                <div className="mt-2 text-xs text-slate-500 flex gap-4">
                                  {tx.cashierName && <span>Cashier: {tx.cashierName}</span>}
                                  <span>Order #: {tx.orderNumber || '-'}</span>
                                  <span>Completed: {new Date(tx.completedAt).toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Table Footer with Totals */}
              {sortedTransactions.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-700/50 border-t border-slate-600 font-bold">
                  <div className="col-span-7 text-slate-400 uppercase text-sm">Totals</div>
                  <div className="col-span-1 text-right text-white font-mono">
                    {formatCurrency(sortedTransactions.reduce((sum, tx) => sum + tx.subtotal, 0))}
                  </div>
                  <div className="col-span-1 text-right text-slate-300 font-mono">
                    {formatCurrency(sortedTransactions.reduce((sum, tx) => sum + tx.cgst + tx.sgst, 0))}
                  </div>
                  <div className="col-span-1 text-right text-red-400 font-mono">
                    -{formatCurrency(sortedTransactions.reduce((sum, tx) => sum + tx.discount, 0))}
                  </div>
                  <div className="col-span-1 text-right text-green-400 font-mono">
                    {formatCurrency(sortedTransactions.reduce((sum, tx) => sum + tx.grandTotal, 0))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Open Cash Modal */}
      {showOpenCashModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Open Cash Register</h2>
            <p className="text-slate-400 mb-4">Enter the starting cash in drawer</p>
            <input
              type="number"
              value={openingCashAmount}
              onChange={(e) => setOpeningCashAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-2xl text-center mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowOpenCashModal(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenRegister}
                disabled={!openingCashAmount}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Open Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Cash Modal */}
      {showCloseCashModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Close Cash Register</h2>
            <p className="text-slate-400 mb-2">
              Expected: {formatCurrency((cashRegister?.openingCash || 0) + (report?.paymentBreakdown.cash || 0))}
            </p>
            <p className="text-slate-400 mb-4">Enter actual cash counted in drawer</p>
            <input
              type="number"
              value={closingCashAmount}
              onChange={(e) => setClosingCashAmount(e.target.value)}
              placeholder="Enter actual cash"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-2xl text-center mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseCashModal(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseRegister}
                disabled={!closingCashAmount}
                className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
