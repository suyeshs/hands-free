import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, ChevronDown, ChevronUp } from 'lucide-react';
import {
  fetchTransactions,
  transactionsToCSV,
  downloadCSV,
  type Transaction,
} from '../services/transactionsApi';
import './TransactionsList.css';

interface TransactionsListProps {
  onBack: () => void;
  tenantId: string;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDisplayDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month} ${day}, ${year} • ${hours}:${minutes} ${ampm}`;
}

function getOrderTypeBadgeColor(orderType: string): string {
  const t = (orderType || '').toLowerCase();
  if (t === 'dine-in' || t === 'dine_in' || t === 'dinein') return '#6366f1';
  if (t === 'takeout' || t === 'take-out' || t === 'take_out') return '#f59e0b';
  if (t === 'delivery') return '#10b981';
  return '#6b7280';
}

function getPaymentBadgeColor(method: string): string {
  const m = (method || '').toLowerCase();
  if (m === 'cash') return '#10b981';
  if (m === 'upi') return '#8b5cf6';
  if (m === 'card') return '#3b82f6';
  return '#6b7280';
}

function isDineIn(orderType: string): boolean {
  const t = (orderType || '').toLowerCase();
  return t === 'dine-in' || t === 'dine_in' || t === 'dinein';
}

function SkeletonCard() {
  return (
    <div className="txn-skeleton-card">
      <div className="txn-skeleton-line txn-skeleton-short" />
      <div className="txn-skeleton-line txn-skeleton-medium" />
      <div className="txn-skeleton-line txn-skeleton-long" />
    </div>
  );
}

export default function TransactionsList({ onBack, tenantId }: TransactionsListProps) {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [appliedFrom, setAppliedFrom] = useState(todayStr());
  const [appliedTo, setAppliedTo] = useState(todayStr());
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [appliedOrderType, setAppliedOrderType] = useState('');
  const [appliedPaymentMethod, setAppliedPaymentMethod] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadTransactions = useCallback(async (
    fromDate: string,
    toDate: string,
    orderType: string,
    paymentMethod: string,
    pageNum: number,
    append: boolean
  ) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchTransactions(tenantId, {
        from: fromDate,
        to: toDate,
        page: pageNum,
        limit: 50,
        order_type: orderType || undefined,
        payment_method: paymentMethod || undefined,
      });

      if (append) {
        setTransactions((prev) => [...prev, ...result.transactions]);
      } else {
        setTransactions(result.transactions);
      }
      setTotal(result.total);
      setPage(result.page);
      setPages(result.pages);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadTransactions(appliedFrom, appliedTo, appliedOrderType, appliedPaymentMethod, 1, false);
  }, []);

  const handleApplyFilters = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedOrderType(orderTypeFilter);
    setAppliedPaymentMethod(paymentMethodFilter);
    setPage(1);
    loadTransactions(from, to, orderTypeFilter, paymentMethodFilter, 1, false);
  };

  const handleLoadMore = () => {
    if (page < pages && !loadingMore) {
      loadTransactions(appliedFrom, appliedTo, appliedOrderType, appliedPaymentMethod, page + 1, true);
    }
  };

  const handleDownload = async () => {
    if (transactions.length === 0) return;
    setDownloading(true);
    try {
      // Fetch all pages for download
      let allTransactions: Transaction[] = [];
      let p = 1;
      let totalPages = pages;
      do {
        const result = await fetchTransactions(tenantId, {
          from: appliedFrom,
          to: appliedTo,
          page: p,
          limit: 200,
          order_type: appliedOrderType || undefined,
          payment_method: appliedPaymentMethod || undefined,
        });
        allTransactions = [...allTransactions, ...result.transactions];
        totalPages = result.pages;
        p++;
      } while (p <= totalPages);

      const csv = transactionsToCSV(allTransactions);
      const filename = `transactions_${appliedFrom}_to_${appliedTo}.csv`;
      downloadCSV(csv, filename);
    } catch (err: any) {
      setError(err.message || 'Failed to download CSV');
    } finally {
      setDownloading(false);
    }
  };

  const totalAmount = transactions.reduce((sum, t) => sum + (t.grand_total || 0), 0);

  return (
    <div className="txn-screen">
      {/* Header */}
      <div className="txn-header glass">
        <button className="txn-back-btn tap-feedback" onClick={onBack}>
          <ArrowLeft size={20} />
          <span>Transactions</span>
        </button>
        <button
          className="txn-download-btn tap-feedback"
          onClick={handleDownload}
          disabled={downloading || transactions.length === 0}
        >
          <Download size={18} />
          {downloading ? 'Downloading...' : 'CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="txn-filters glass">
        <div className="txn-date-row">
          <div className="txn-date-field">
            <label className="txn-label">From</label>
            <input
              type="date"
              className="txn-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="txn-date-field">
            <label className="txn-label">To</label>
            <input
              type="date"
              className="txn-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="txn-filter-row">
          <select
            className="txn-select"
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
          >
            <option value="">All Order Types</option>
            <option value="dine-in">Dine-in</option>
            <option value="takeout">Takeout</option>
            <option value="delivery">Delivery</option>
          </select>
          <select
            className="txn-select"
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
          >
            <option value="">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
          </select>
        </div>
        <button className="txn-apply-btn tap-feedback" onClick={handleApplyFilters}>
          Apply Filters
        </button>
      </div>

      {/* Summary Bar */}
      {!loading && transactions.length > 0 && (
        <div className="txn-summary glass">
          <div className="txn-summary-item">
            <span className="txn-summary-label">Showing</span>
            <span className="txn-summary-value">{transactions.length} of {total}</span>
          </div>
          <div className="txn-summary-divider" />
          <div className="txn-summary-item">
            <span className="txn-summary-label">Total Amount</span>
            <span className="txn-summary-value txn-amount-highlight">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="txn-list">
        {error && (
          <div className="txn-error glass">
            <p>{error}</p>
            <button className="txn-retry-btn tap-feedback" onClick={handleApplyFilters}>
              Retry
            </button>
          </div>
        )}

        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="txn-empty glass">
            <p className="txn-empty-title">No transactions found</p>
            <p className="txn-empty-sub">
              Try adjusting the date range or filters.
            </p>
          </div>
        )}

        {!loading && transactions.map((txn) => {
          const isExpanded = expandedId === txn.id;
          return (
            <div
              key={txn.id}
              className={`txn-card glass tap-feedback ${isExpanded ? 'txn-card-expanded' : ''}`}
              onClick={() => setExpandedId(isExpanded ? null : txn.id)}
            >
              {/* Card Top Row */}
              <div className="txn-card-top">
                <div className="txn-card-left">
                  <span className="txn-invoice">{txn.invoice_number}</span>
                  <div className="txn-badges">
                    <span
                      className="txn-badge"
                      style={{ background: getOrderTypeBadgeColor(txn.order_type) }}
                    >
                      {txn.order_type}
                    </span>
                    {isDineIn(txn.order_type) && txn.table_number != null && (
                      <span className="txn-table-badge">Table {txn.table_number}</span>
                    )}
                  </div>
                </div>
                <div className="txn-card-right">
                  <span className="txn-grand-total">₹{(txn.grand_total || 0).toFixed(2)}</span>
                  <span
                    className="txn-badge"
                    style={{ background: getPaymentBadgeColor(txn.payment_method) }}
                  >
                    {txn.payment_method}
                  </span>
                </div>
              </div>

              {/* Card Meta Row */}
              <div className="txn-card-meta">
                <span className="txn-date">{formatDisplayDate(txn.completed_at)}</span>
                {txn.cashier_name && (
                  <span className="txn-cashier">{txn.cashier_name}</span>
                )}
                <span className="txn-expand-icon">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </div>

              {/* Expanded Items */}
              {isExpanded && (
                <div className="txn-items-list" onClick={(e) => e.stopPropagation()}>
                  <div className="txn-items-divider" />
                  {(txn.items || []).length === 0 ? (
                    <p className="txn-no-items">No item details available</p>
                  ) : (
                    (txn.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="txn-item-row">
                        <div className="txn-item-name-qty">
                          <span className="txn-item-name">{item.name || 'Item'}</span>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <span className="txn-item-mods">{item.modifiers.join(', ')}</span>
                          )}
                        </div>
                        <div className="txn-item-right">
                          <span className="txn-item-qty">×{item.quantity || 1}</span>
                          <span className="txn-item-price">
                            ₹{(item.subtotal ?? (item.price * (item.quantity || 1))).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  <div className="txn-items-subtotals">
                    {txn.discount > 0 && (
                      <div className="txn-subtotal-row">
                        <span>Discount</span>
                        <span className="txn-discount">-₹{txn.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {(txn.cgst > 0 || txn.sgst > 0) && (
                      <div className="txn-subtotal-row">
                        <span>Tax (CGST + SGST)</span>
                        <span>₹{(txn.cgst + txn.sgst).toFixed(2)}</span>
                      </div>
                    )}
                    {txn.service_charge > 0 && (
                      <div className="txn-subtotal-row">
                        <span>Service Charge</span>
                        <span>₹{txn.service_charge.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Load More */}
        {!loading && page < pages && (
          <button
            className="txn-load-more tap-feedback"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : `Load More (${transactions.length} of ${total})`}
          </button>
        )}

        {!loading && transactions.length > 0 && page >= pages && (
          <p className="txn-all-loaded">All {total} transactions loaded</p>
        )}
      </div>
    </div>
  );
}
