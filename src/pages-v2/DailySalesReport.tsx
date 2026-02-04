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
import { useDeviceStore } from '../stores/deviceStore';
import { PayoutType, PayoutCategory } from '../lib/cashPayoutService';
import { cn } from '../lib/utils';
import { exportTransactions } from '../utils/exportData';
import { orderSyncService } from '../lib/orderSyncService';

type ViewMode = 'summary' | 'transactions';
type SortField = 'time' | 'invoice' | 'total' | 'payment' | 'type';
type SortDirection = 'asc' | 'desc';

// Simple bar chart component
function HourlySalesChart({ data }: { data: { hour: number; sales: number }[] }) {
  const maxSales = Math.max(...data.map((d) => d.sales), 1);
  const relevantHours = data.filter((d) => d.sales > 0 || (d.hour >= 8 && d.hour <= 23));

  if (relevantHours.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No sales data for this date
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 h-32">
      {relevantHours.map((d) => (
        <div key={d.hour} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-primary rounded-t transition-all"
            style={{ height: `${(d.sales / maxSales) * 100}%`, minHeight: d.sales > 0 ? 4 : 0 }}
          />
          <span className="text-[10px] text-muted-foreground mt-1">
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
  const { shouldReceiveRealtimeSales } = useDeviceStore();
  const {
    selectedDate,
    setSelectedDate,
    report,
    cashRegister,
    payouts,
    payoutSummary,
    isLoading,
    error,
    fetchReport,
    fetchCashRegister,
    fetchPayouts,
    openCashRegister,
    closeCashRegister,
    recordPayout,
    cancelPayout,
    getTodayDate,
    latestSaleTimestamp,
    newSalesCount,
    clearNewSalesCount,
  } = useDailySalesStore();

  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [openingCashAmount, setOpeningCashAmount] = useState('');
  const [closingCashAmount, setClosingCashAmount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState<PayoutType>('expense');
  const [payoutCategory, setPayoutCategory] = useState<PayoutCategory | ''>('');
  const [payoutDescription, setPayoutDescription] = useState('');

  // View mode and sorting
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Real-time indicators
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [lastUpdatedText, setLastUpdatedText] = useState<string>('');

  const isToday = selectedDate === getTodayDate();
  const isOwnerDevice = shouldReceiveRealtimeSales();
  const showLiveIndicator = isOwnerDevice && isToday && wsStatus === 'connected';

  // Create tips lookup map (by invoice number)
  const tipsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (report?.tips) {
      report.tips.forEach((tip) => {
        map.set(tip.invoiceNumber, tip.tipAmount);
      });
    }
    return map;
  }, [report?.tips]);

  // Load data on mount and date change
  useEffect(() => {
    if (user?.tenantId) {
      fetchReport(user.tenantId, selectedDate);
      fetchCashRegister(user.tenantId, selectedDate);
      fetchPayouts(user.tenantId, selectedDate);
    }
  }, [user?.tenantId, selectedDate]);

  // Clear new sales count when component mounts or date changes
  useEffect(() => {
    clearNewSalesCount();
  }, [selectedDate]);

  // Poll WebSocket status for live indicator
  useEffect(() => {
    if (!isOwnerDevice || !isToday) return;

    const updateStatus = () => {
      const status = orderSyncService.getConnectionStatus();
      setWsStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, [isOwnerDevice, isToday]);

  // Update "last updated" text
  useEffect(() => {
    if (!latestSaleTimestamp) {
      setLastUpdatedText('');
      return;
    }

    const updateText = () => {
      const seconds = Math.floor((Date.now() - latestSaleTimestamp) / 1000);
      if (seconds < 5) {
        setLastUpdatedText('Just now');
      } else if (seconds < 60) {
        setLastUpdatedText(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setLastUpdatedText(`${minutes}m ago`);
      }
    };

    updateText();
    const interval = setInterval(updateText, 1000);
    return () => clearInterval(interval);
  }, [latestSaleTimestamp]);

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

  const handleRecordPayout = async () => {
    if (!user?.tenantId || !payoutAmount || !user.name) return;
    try {
      await recordPayout(
        user.tenantId,
        parseFloat(payoutAmount),
        payoutType,
        user.name,
        {
          category: payoutCategory || undefined,
          description: payoutDescription || undefined,
        }
      );
      setShowPayoutModal(false);
      setPayoutAmount('');
      setPayoutType('expense');
      setPayoutCategory('');
      setPayoutDescription('');
    } catch (e) {
      alert('Failed to record payout');
    }
  };

  const handleCancelPayout = async (payoutId: string) => {
    if (!user?.tenantId) return;
    if (!confirm('Are you sure you want to cancel this payout?')) return;
    try {
      await cancelPayout(payoutId, user.tenantId);
    } catch (e) {
      alert('Failed to cancel payout');
    }
  };

  // Calculate total payouts for today
  const totalPayouts = payoutSummary?.totalPayouts || 0;

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

  // Export transactions to CSV
  const handleExportTransactions = () => {
    if (!report?.transactions || report.transactions.length === 0) {
      alert('No transactions to export');
      return;
    }
    exportTransactions(report.transactions, selectedDate);
  };

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="settings-header">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-surface-2 transition-colors rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">DAILY SALES REPORT</h1>

              {/* LIVE Indicator for owner devices */}
              {showLiveIndicator && (
                <div className="flex items-center gap-2 bg-success-light border border-success/30 px-3 py-1 rounded-full">
                  <div className="relative flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                    <span className="text-xs font-bold text-success">LIVE</span>
                  </div>
                  {lastUpdatedText && (
                    <span className="text-xs text-success/70">{lastUpdatedText}</span>
                  )}
                </div>
              )}

              {/* New Sales Count Badge */}
              {isOwnerDevice && isToday && newSalesCount > 0 && (
                <div className="bg-warning-light border border-warning/30 text-warning px-2 py-1 rounded-full text-xs font-bold">
                  +{newSalesCount} new
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex neo-inset p-1 rounded-lg">
              <button
                onClick={() => setViewMode('summary')}
                className={cn(
                  'px-3 py-1.5 text-sm font-bold transition-colors rounded-lg',
                  viewMode === 'summary'
                    ? 'neo-raised-sm text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Summary
              </button>
              <button
                onClick={() => setViewMode('transactions')}
                className={cn(
                  'px-3 py-1.5 text-sm font-bold transition-colors rounded-lg',
                  viewMode === 'transactions'
                    ? 'neo-raised-sm text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Transactions
              </button>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExportTransactions}
              disabled={!report?.transactions || report.transactions.length === 0}
              className={cn(
                'neo-raised-sm px-4 py-2 font-bold text-sm transition-colors flex items-center gap-2 rounded-lg',
                'text-success neo-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title="Export transactions to CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              EXPORT
            </button>

            <div className="w-px h-6 bg-border" />

            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="neo-inset px-3 py-2 text-foreground rounded-lg"
            />
            <button
              onClick={handleToday}
              className={cn(
                'px-4 py-2 font-bold text-sm transition-colors rounded-lg',
                isToday
                  ? 'neo-raised-sm text-primary'
                  : 'neo-inset text-muted-foreground hover:text-foreground'
              )}
            >
              TODAY
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="text-center text-destructive py-8">
            <p>Error loading report: {error}</p>
            <button
              onClick={() => user?.tenantId && fetchReport(user.tenantId)}
              className="mt-4 px-4 py-2 neo-raised-sm rounded-lg hover:neo-hover"
            >
              Retry
            </button>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="space-y-6">
            {/* Summary Cards - Traditional Business Report Style */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="neo-raised p-6 text-center rounded-xl">
                <div className="text-muted-foreground text-sm uppercase tracking-wide mb-2 font-semibold">Total Sales</div>
                <div className="text-4xl font-bold text-success">
                  {formatCurrency(report?.summary.totalSales || 0)}
                </div>
              </div>
              <div className="neo-raised p-6 text-center rounded-xl">
                <div className="text-muted-foreground text-sm uppercase tracking-wide mb-2 font-semibold">Total Orders</div>
                <div className="text-4xl font-bold text-info">
                  {report?.summary.totalOrders || 0}
                </div>
              </div>
              <div className="neo-raised p-6 text-center rounded-xl">
                <div className="text-muted-foreground text-sm uppercase tracking-wide mb-2 font-semibold">Average Order</div>
                <div className="text-4xl font-bold text-primary">
                  {formatCurrency(report?.summary.averageOrderValue || 0)}
                </div>
              </div>
            </div>

            {/* Source Breakdown - POS, Swiggy, Zomato, Website */}
            {report?.sourceBreakdown && (
              <div className="neo-raised p-6 rounded-xl">
                <h2 className="text-lg font-bold mb-4 text-foreground">Sales by Channel</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* POS Sales */}
                  <div className="neo-inset bg-info-light border border-info/30 p-4 text-center rounded-lg">
                    <div className="text-3xl mb-2">🏪</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-semibold">POS / Dine-in</div>
                    <div className="text-xl font-bold text-info">
                      {formatCurrency(report.sourceBreakdown.pos.sales)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {report.sourceBreakdown.pos.orders} orders
                    </div>
                  </div>

                  {/* Zomato */}
                  <div className="neo-inset bg-destructive-light border border-destructive/30 p-4 text-center rounded-lg">
                    <div className="text-3xl mb-2">🔴</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-semibold">Zomato</div>
                    <div className="text-xl font-bold text-destructive">
                      {formatCurrency(report.sourceBreakdown.zomato.sales)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {report.sourceBreakdown.zomato.orders} orders
                    </div>
                  </div>

                  {/* Swiggy */}
                  <div className="neo-inset bg-warning-light border border-warning/30 p-4 text-center rounded-lg">
                    <div className="text-3xl mb-2">🟠</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-semibold">Swiggy</div>
                    <div className="text-xl font-bold text-warning">
                      {formatCurrency(report.sourceBreakdown.swiggy.sales)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {report.sourceBreakdown.swiggy.orders} orders
                    </div>
                  </div>

                  {/* Website / Online */}
                  <div className="neo-inset bg-primary-light border border-primary/30 p-4 text-center rounded-lg">
                    <div className="text-3xl mb-2">🌐</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-semibold">Website</div>
                    <div className="text-xl font-bold text-primary">
                      {formatCurrency(report.sourceBreakdown.website.sales)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {report.sourceBreakdown.website.orders} orders
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Breakdown */}
              <div className="neo-raised p-6 rounded-xl">
                <h2 className="text-lg font-bold mb-4 text-foreground">Payment Breakdown</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💵</span>
                      <span className="font-medium">Cash</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{formatCurrency(report?.paymentBreakdown.cash || 0)}</div>
                      <div className="text-xs text-muted-foreground">{paymentPercentages.cash.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💳</span>
                      <span className="font-medium">Card</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{formatCurrency(report?.paymentBreakdown.card || 0)}</div>
                      <div className="text-xs text-muted-foreground">{paymentPercentages.card.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📱</span>
                      <span className="font-medium">UPI</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{formatCurrency(report?.paymentBreakdown.upi || 0)}</div>
                      <div className="text-xs text-muted-foreground">{paymentPercentages.upi.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">👛</span>
                      <span className="font-medium">Wallet</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{formatCurrency(report?.paymentBreakdown.wallet || 0)}</div>
                      <div className="text-xs text-muted-foreground">{paymentPercentages.wallet.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash Reconciliation */}
              <div className="neo-raised p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-foreground">Cash Reconciliation</h2>
                  {cashRegister && cashRegister.status === 'open' && isToday && (
                    <button
                      onClick={() => setShowPayoutModal(true)}
                      className="px-3 py-1.5 neo-raised-sm bg-destructive-light border border-destructive/30 text-destructive text-sm font-bold hover:neo-hover transition-colors rounded-lg"
                    >
                      + Payout
                    </button>
                  )}
                </div>
                {cashRegister ? (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Opening Cash</span>
                      <span className="font-bold text-foreground">{formatCurrency(cashRegister.openingCash)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Cash Sales</span>
                      <span className="font-bold text-success">
                        + {formatCurrency(report?.paymentBreakdown.cash || 0)}
                      </span>
                    </div>
                    {totalPayouts > 0 && (
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground">Payouts</span>
                        <span className="font-bold text-destructive">
                          - {formatCurrency(totalPayouts)}
                        </span>
                      </div>
                    )}
                    <div className="border-t-2 border-border pt-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-semibold">Expected Closing</span>
                        <span className="font-bold text-foreground">
                          {formatCurrency((cashRegister.openingCash) + (report?.paymentBreakdown.cash || 0) - totalPayouts)}
                        </span>
                      </div>
                    </div>
                    {cashRegister.status === 'closed' ? (
                      <>
                        <div className="flex justify-between py-2">
                          <span className="text-muted-foreground">Actual Closing</span>
                          <span className="font-bold text-foreground">{formatCurrency(cashRegister.actualClosingCash || 0)}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-muted-foreground">Variance</span>
                          <span className={cn(
                            'font-bold',
                            (cashRegister.cashVariance || 0) >= 0 ? 'text-success' : 'text-destructive'
                          )}>
                            {(cashRegister.cashVariance || 0) >= 0 ? '+' : ''}
                            {formatCurrency(cashRegister.cashVariance || 0)}
                          </span>
                        </div>
                      </>
                    ) : isToday ? (
                      <button
                        onClick={() => setShowCloseCashModal(true)}
                        className="w-full mt-4 neo-raised-sm text-warning font-bold py-3 transition-colors hover:neo-hover rounded-lg"
                      >
                        CLOSE REGISTER
                      </button>
                    ) : null}
                  </div>
                ) : isToday ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">Register not opened for today</p>
                    <button
                      onClick={() => setShowOpenCashModal(true)}
                      className="neo-raised-sm text-success font-bold py-3 px-6 transition-colors hover:neo-hover rounded-lg"
                    >
                      OPEN REGISTER
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No register data for this date
                  </div>
                )}
              </div>
            </div>

            {/* Cash Payouts */}
            {payouts.length > 0 && (
              <div className="neo-raised p-6 rounded-xl">
                <h2 className="text-lg font-bold mb-4 text-foreground">Cash Payouts ({payouts.length})</h2>
                <div className="space-y-2">
                  {payouts.map((payout) => (
                    <div
                      key={payout.id}
                      className="flex items-center justify-between neo-inset p-3 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-destructive-light flex items-center justify-center">
                          <span className="text-destructive">
                            {payout.payoutType === 'bank_deposit' ? '🏦' :
                             payout.payoutType === 'vendor_payment' ? '🧾' :
                             payout.payoutType === 'petty_cash' ? '💰' :
                             payout.payoutType === 'withdrawal' ? '💸' : '📤'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium capitalize text-foreground">
                            {payout.payoutType.replace('_', ' ')}
                            {payout.category && (
                              <span className="text-muted-foreground text-sm ml-2">
                                ({payout.category})
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {payout.description || 'No description'}
                            <span className="mx-2">|</span>
                            {new Date(payout.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                            <span className="mx-2">|</span>
                            by {payout.recordedBy}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-destructive text-lg">
                          -{formatCurrency(payout.amount)}
                        </span>
                        {isToday && cashRegister?.status === 'open' && (
                          <button
                            onClick={() => handleCancelPayout(payout.id)}
                            className="p-1.5 rounded neo-raised-sm text-muted-foreground hover:text-destructive transition-colors"
                            title="Cancel payout"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {payoutSummary && (
                  <div className="mt-4 pt-4 border-t-2 border-border flex justify-between items-center">
                    <span className="text-muted-foreground font-semibold">Total Payouts</span>
                    <span className="font-bold text-destructive text-xl">
                      -{formatCurrency(payoutSummary.totalPayouts)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Hourly Sales Chart */}
            <div className="neo-raised p-6 rounded-xl">
              <h2 className="text-lg font-bold mb-4 text-foreground">Hourly Sales</h2>
              <HourlySalesChart data={report?.hourlySales || []} />
            </div>

            {/* Tips Summary */}
            {report?.tipsSummary && (report.tipsSummary.tipCount > 0 || report.tipsSummary.totalTips > 0) && (
              <div className="neo-raised p-6 rounded-xl">
                <h2 className="text-lg font-bold mb-4 text-foreground">Tips Summary</h2>

                {/* Tips Overview */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {formatCurrency(report.tipsSummary.totalTips)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">Total Tips</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-info">
                      {report.tipsSummary.tipCount}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">Orders with Tips</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(report.tipsSummary.averageTip)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">Average Tip</div>
                  </div>
                </div>

                {/* Tips by Staff */}
                {report.tipsSummary.byStaff.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <h3 className="font-bold mb-3 text-sm text-muted-foreground">Tips by Server</h3>
                    <div className="space-y-2">
                      {report.tipsSummary.byStaff.map((staff) => (
                        <div
                          key={staff.staffId || staff.serverName}
                          className="flex justify-between items-center py-2 px-3 neo-inset rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-foreground">{staff.serverName}</div>
                            <div className="text-xs text-muted-foreground">
                              {staff.count} {staff.count === 1 ? 'order' : 'orders'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-success">
                              {formatCurrency(staff.tips)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg: {formatCurrency(staff.average)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Note about cash register exclusion */}
                <div className="mt-4 p-3 neo-raised bg-info-light border border-info/30 text-xs text-info flex items-start gap-2 rounded-lg">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Tips are tracked separately and NOT included in cash register reconciliation</span>
                </div>
              </div>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Items */}
              <div className="neo-raised p-6 rounded-xl">
                <h2 className="text-lg font-bold mb-4 text-foreground">Top Selling Items</h2>
                {report?.topItems && report.topItems.length > 0 ? (
                  <div className="space-y-2">
                    {report.topItems.slice(0, 10).map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between py-2 border-b border-border">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground font-mono text-sm w-5">{idx + 1}.</span>
                          <span className="truncate max-w-[200px] text-foreground">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground">{item.quantity}</span>
                          <span className="text-muted-foreground text-sm ml-2">
                            ({formatCurrency(item.revenue)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">No items sold</div>
                )}
              </div>

              {/* Order Type Breakdown */}
              <div className="neo-raised p-6 rounded-xl">
                <h2 className="text-lg font-bold mb-4 text-foreground">Order Type Breakdown</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1 text-foreground">
                      <span>Dine-in</span>
                      <span className="text-sm">
                        {report?.orderTypeBreakdown['dine-in'].count || 0} orders
                        ({orderTypePercentages['dine-in'].toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 neo-inset rounded-full overflow-hidden">
                      <div
                        className="h-full bg-info transition-all"
                        style={{ width: `${orderTypePercentages['dine-in']}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-muted-foreground mt-1">
                      {formatCurrency(report?.orderTypeBreakdown['dine-in'].sales || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 text-foreground">
                      <span>Takeout</span>
                      <span className="text-sm">
                        {report?.orderTypeBreakdown['takeout'].count || 0} orders
                        ({orderTypePercentages['takeout'].toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 neo-inset rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success transition-all"
                        style={{ width: `${orderTypePercentages['takeout']}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-muted-foreground mt-1">
                      {formatCurrency(report?.orderTypeBreakdown['takeout'].sales || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1 text-foreground">
                      <span>Delivery</span>
                      <span className="text-sm">
                        {report?.orderTypeBreakdown['delivery'].count || 0} orders
                        ({orderTypePercentages['delivery'].toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 neo-inset rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${orderTypePercentages['delivery']}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-muted-foreground mt-1">
                      {formatCurrency(report?.orderTypeBreakdown['delivery'].sales || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Summary */}
            <div className="neo-raised p-6 rounded-xl">
              <h2 className="text-lg font-bold mb-4 text-foreground">Tax & Charges Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-muted-foreground text-sm mb-1 font-medium">Total Tax</div>
                  <div className="text-xl font-bold text-foreground">{formatCurrency(report?.summary.totalTax || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-sm mb-1 font-medium">Service Charge</div>
                  <div className="text-xl font-bold text-foreground">{formatCurrency(report?.summary.totalServiceCharge || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-sm mb-1 font-medium">Discounts Given</div>
                  <div className="text-xl font-bold text-destructive">
                    -{formatCurrency(report?.summary.totalDiscount || 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-sm mb-1 font-medium">Net Sales</div>
                  <div className="text-xl font-bold text-success">
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
            <div className="flex items-center gap-4 mb-4 neo-raised p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-medium">Total:</span>
                <span className="font-bold text-success">{formatCurrency(report?.summary.totalSales || 0)}</span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-medium">Orders:</span>
                <span className="font-bold text-info">{report?.summary.totalOrders || 0}</span>
              </div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-medium">Avg:</span>
                <span className="font-bold text-primary">{formatCurrency(report?.summary.averageOrderValue || 0)}</span>
              </div>
              <div className="flex-1" />
              <div className="text-muted-foreground text-sm">
                {sortedTransactions.length} transactions
              </div>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 neo-raised overflow-hidden flex flex-col rounded-xl">
              {/* Table Header */}
              <div className="grid grid-cols-13 gap-2 px-4 py-3 bg-surface-2 text-sm font-bold uppercase tracking-wide text-muted-foreground border-b border-border">
                <button
                  onClick={() => handleSort('time')}
                  className="col-span-1 text-left flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Time
                  {sortField === 'time' && (
                    <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <button
                  onClick={() => handleSort('invoice')}
                  className="col-span-2 text-left flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Invoice
                  {sortField === 'invoice' && (
                    <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <button
                  onClick={() => handleSort('type')}
                  className="col-span-1 text-left flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Type
                  {sortField === 'type' && (
                    <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <div className="col-span-1 text-left">Source</div>
                <div className="col-span-2 text-left">Items</div>
                <button
                  onClick={() => handleSort('payment')}
                  className="col-span-1 text-left flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Payment
                  {sortField === 'payment' && (
                    <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
                <div className="col-span-1 text-right">Subtotal</div>
                <div className="col-span-1 text-right">Tax</div>
                <div className="col-span-1 text-right">Disc</div>
                <div className="col-span-1 text-right">Tip</div>
                <button
                  onClick={() => handleSort('total')}
                  className="col-span-1 text-right flex items-center justify-end gap-1 hover:text-foreground transition-colors"
                >
                  Total
                  {sortField === 'total' && (
                    <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-auto">
                {sortedTransactions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
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
                            'grid grid-cols-13 gap-2 px-4 py-3 border-b border-border hover:bg-surface-2 transition-colors cursor-pointer',
                            isExpanded && 'bg-surface-2'
                          )}
                          onClick={() => toggleRowExpansion(tx.id)}
                        >
                          <div className="col-span-1 text-muted-foreground font-mono text-sm">
                            {formatTime(tx.createdAt)}
                          </div>
                          <div className="col-span-2 font-mono text-sm text-foreground font-medium">
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
                          <div className="col-span-2 text-foreground text-sm truncate">
                            {items.length > 0 ? (
                              <span className="flex items-center gap-1">
                                <span className="text-muted-foreground">{items.length}x</span>
                                {items.slice(0, 2).map(i => i.menuItem.name).join(', ')}
                                {items.length > 2 && <span className="text-muted-foreground">+{items.length - 2}</span>}
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
                          <div className="col-span-1 text-right text-foreground text-sm font-mono">
                            {formatCurrency(tx.subtotal)}
                          </div>
                          <div className="col-span-1 text-right text-muted-foreground text-sm font-mono">
                            {formatCurrency(tx.cgst + tx.sgst)}
                          </div>
                          <div className="col-span-1 text-right text-destructive text-sm font-mono">
                            {tx.discount > 0 ? `-${formatCurrency(tx.discount)}` : '-'}
                          </div>
                          <div className="col-span-1 text-right text-success text-sm font-mono">
                            {tipsMap.has(tx.invoiceNumber) ? formatCurrency(tipsMap.get(tx.invoiceNumber)!) : '-'}
                          </div>
                          <div className="col-span-1 text-right text-success font-bold font-mono">
                            {formatCurrency(tx.grandTotal)}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && items.length > 0 && (
                          <div className="bg-surface-3 border-b border-border px-4 py-3">
                            <div className="grid grid-cols-12 gap-2">
                              <div className="col-span-3" />
                              <div className="col-span-9">
                                <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Order Items</div>
                                <div className="neo-inset p-3 rounded-lg">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-muted-foreground text-xs uppercase">
                                        <th className="text-left py-1">Item</th>
                                        <th className="text-center py-1 w-16">Qty</th>
                                        <th className="text-right py-1 w-24">Price</th>
                                        <th className="text-right py-1 w-24">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item, idx) => (
                                        <tr key={idx} className="border-t border-border">
                                          <td className="py-2 text-foreground">{item.menuItem.name}</td>
                                          <td className="py-2 text-center text-foreground">{item.quantity}</td>
                                          <td className="py-2 text-right text-muted-foreground font-mono">
                                            {formatCurrency(item.menuItem.price)}
                                          </td>
                                          <td className="py-2 text-right text-foreground font-mono">
                                            {formatCurrency(item.subtotal)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-border">
                                        <td colSpan={3} className="py-2 text-right text-muted-foreground">Subtotal:</td>
                                        <td className="py-2 text-right font-mono text-foreground">{formatCurrency(tx.subtotal)}</td>
                                      </tr>
                                      {tx.serviceCharge > 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-muted-foreground">Service Charge:</td>
                                          <td className="py-1 text-right font-mono text-foreground">{formatCurrency(tx.serviceCharge)}</td>
                                        </tr>
                                      )}
                                      {(tx.cgst + tx.sgst) > 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-muted-foreground">
                                            Tax (CGST {formatCurrency(tx.cgst)} + SGST {formatCurrency(tx.sgst)}):
                                          </td>
                                          <td className="py-1 text-right font-mono text-foreground">{formatCurrency(tx.cgst + tx.sgst)}</td>
                                        </tr>
                                      )}
                                      {tx.discount > 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-muted-foreground">Discount:</td>
                                          <td className="py-1 text-right font-mono text-destructive">-{formatCurrency(tx.discount)}</td>
                                        </tr>
                                      )}
                                      {tx.roundOff !== 0 && (
                                        <tr>
                                          <td colSpan={3} className="py-1 text-right text-muted-foreground">Round Off:</td>
                                          <td className="py-1 text-right font-mono text-foreground">{formatCurrency(tx.roundOff)}</td>
                                        </tr>
                                      )}
                                      <tr className="border-t-2 border-border">
                                        <td colSpan={3} className="py-2 text-right font-bold text-foreground">Grand Total:</td>
                                        <td className="py-2 text-right font-bold text-success font-mono">{formatCurrency(tx.grandTotal)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground flex gap-4">
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
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-surface-2 border-t-2 border-border font-bold">
                  <div className="col-span-7 text-muted-foreground uppercase text-sm">Totals</div>
                  <div className="col-span-1 text-right text-foreground font-mono">
                    {formatCurrency(sortedTransactions.reduce((sum, tx) => sum + tx.subtotal, 0))}
                  </div>
                  <div className="col-span-1 text-right text-foreground font-mono">
                    {formatCurrency(sortedTransactions.reduce((sum, tx) => sum + tx.cgst + tx.sgst, 0))}
                  </div>
                  <div className="col-span-1 text-right text-destructive font-mono">
                    -{formatCurrency(sortedTransactions.reduce((sum, tx) => sum + tx.discount, 0))}
                  </div>
                  <div className="col-span-1 text-right text-success font-mono">
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
          <div className="glass-panel p-6 w-full max-w-sm rounded-xl">
            <h2 className="text-xl font-bold mb-4 text-foreground">Open Cash Register</h2>
            <p className="text-muted-foreground mb-4">Enter the starting cash in drawer</p>
            <input
              type="number"
              value={openingCashAmount}
              onChange={(e) => setOpeningCashAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full neo-inset px-4 py-3 text-foreground text-2xl text-center mb-4 rounded-lg"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowOpenCashModal(false)}
                className="flex-1 neo-raised-sm font-bold py-3 transition-colors hover:neo-hover rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenRegister}
                disabled={!openingCashAmount}
                className="flex-1 neo-raised-sm text-success disabled:opacity-50 font-bold py-3 transition-colors hover:neo-hover rounded-lg"
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
          <div className="glass-panel p-6 w-full max-w-sm rounded-xl">
            <h2 className="text-xl font-bold mb-4 text-foreground">Close Cash Register</h2>
            <div className="text-muted-foreground mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Opening:</span>
                <span className="text-foreground">{formatCurrency(cashRegister?.openingCash || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Cash Sales:</span>
                <span className="text-success">{formatCurrency(report?.paymentBreakdown.cash || 0)}</span>
              </div>
              {totalPayouts > 0 && (
                <div className="flex justify-between">
                  <span>- Payouts:</span>
                  <span className="text-destructive">{formatCurrency(totalPayouts)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-border pt-1 font-bold text-foreground">
                <span>Expected:</span>
                <span>{formatCurrency((cashRegister?.openingCash || 0) + (report?.paymentBreakdown.cash || 0) - totalPayouts)}</span>
              </div>
            </div>
            <p className="text-muted-foreground mb-4">Enter actual cash counted in drawer</p>
            <input
              type="number"
              value={closingCashAmount}
              onChange={(e) => setClosingCashAmount(e.target.value)}
              placeholder="Enter actual cash"
              className="w-full neo-inset px-4 py-3 text-foreground text-2xl text-center mb-4 rounded-lg"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseCashModal(false)}
                className="flex-1 neo-raised-sm font-bold py-3 transition-colors hover:neo-hover rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseRegister}
                disabled={!closingCashAmount}
                className="flex-1 neo-raised-sm text-warning disabled:opacity-50 font-bold py-3 transition-colors hover:neo-hover rounded-lg"
              >
                Close Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="glass-panel p-6 w-full max-w-md rounded-xl">
            <h2 className="text-xl font-bold mb-4 text-foreground">Record Cash Payout</h2>

            {/* Amount */}
            <div className="mb-4">
              <label className="block text-muted-foreground text-sm mb-2 font-medium">Amount *</label>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full neo-inset px-4 py-3 text-foreground text-2xl text-center rounded-lg"
                autoFocus
              />
            </div>

            {/* Payout Type */}
            <div className="mb-4">
              <label className="block text-muted-foreground text-sm mb-2 font-medium">Payout Type *</label>
              <select
                value={payoutType}
                onChange={(e) => setPayoutType(e.target.value as PayoutType)}
                className="w-full neo-inset px-4 py-3 text-foreground rounded-lg"
              >
                <option value="expense">Expense</option>
                <option value="withdrawal">Cash Withdrawal</option>
                <option value="petty_cash">Petty Cash</option>
                <option value="bank_deposit">Bank Deposit</option>
                <option value="vendor_payment">Vendor Payment</option>
              </select>
            </div>

            {/* Category (optional) */}
            <div className="mb-4">
              <label className="block text-muted-foreground text-sm mb-2 font-medium">Category (optional)</label>
              <select
                value={payoutCategory}
                onChange={(e) => setPayoutCategory(e.target.value as PayoutCategory | '')}
                className="w-full neo-inset px-4 py-3 text-foreground rounded-lg"
              >
                <option value="">-- Select Category --</option>
                <option value="utilities">Utilities</option>
                <option value="supplies">Supplies</option>
                <option value="salary">Salary / Wages</option>
                <option value="maintenance">Maintenance</option>
                <option value="change_fund">Change Fund</option>
                <option value="misc">Miscellaneous</option>
              </select>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-muted-foreground text-sm mb-2 font-medium">Description (optional)</label>
              <input
                type="text"
                value={payoutDescription}
                onChange={(e) => setPayoutDescription(e.target.value)}
                placeholder="e.g., Gas bill payment"
                className="w-full neo-inset px-4 py-3 text-foreground rounded-lg"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPayoutModal(false);
                  setPayoutAmount('');
                  setPayoutType('expense');
                  setPayoutCategory('');
                  setPayoutDescription('');
                }}
                className="flex-1 neo-raised-sm font-bold py-3 transition-colors hover:neo-hover rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayout}
                disabled={!payoutAmount || parseFloat(payoutAmount) <= 0}
                className="flex-1 neo-raised-sm text-destructive disabled:opacity-50 font-bold py-3 transition-colors hover:neo-hover rounded-lg"
              >
                Record Payout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
