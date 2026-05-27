/**
 * Daily Sales Report — Modern animated dashboard
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useDailySalesStore } from '../stores/dailySalesStore';
import { useDeviceStore } from '../stores/deviceStore';
import { PayoutType, PayoutCategory } from '../lib/cashPayoutService';
import { salesTransactionService } from '../lib/salesTransactionService';
import { cn } from '../lib/utils';
import { exportTransactions } from '../utils/exportData';
import { orderSyncService } from '../lib/orderSyncService';

type ViewMode = 'summary' | 'transactions';
type SortField = 'time' | 'invoice' | 'total' | 'payment' | 'type';
type SortDirection = 'asc' | 'desc';
type ChartView = 'hourly' | 'week' | 'month';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function fetchDailyAggregates(tenantId: string, startDate: string, endDate: string) {
  const txs = await salesTransactionService.getSalesForDateRange(tenantId, startDate, endDate);
  const byDate = new Map<string, number>();
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    byDate.set(cur.toISOString().split('T')[0], 0);
    cur.setDate(cur.getDate() + 1);
  }
  txs.forEach(tx => {
    const d = tx.completedAt.split('T')[0];
    byDate.set(d, (byDate.get(d) || 0) + tx.grandTotal);
  });
  return Array.from(byDate.entries())
    .map(([date, sales]) => ({ date, sales }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 900, enabled = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || target === 0) { setValue(target); return; }
    let startTime: number | null = null;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const eased = 1 - Math.pow(1 - Math.min((ts - startTime) / duration, 1), 3);
      setValue(Math.round(target * eased));
      if (eased < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, enabled]);
  return value;
}

function useBarWidth(pct: number) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 60); return () => clearTimeout(t); }, [pct]);
  return w;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, prefix = '', delay = 0 }: {
  label: string; value: number; color: string; prefix?: string; delay?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  const animated = useAnimatedCounter(value, 900, visible);
  const formatted = prefix === '₹' ? formatCurrency(animated) : animated.toLocaleString('en-IN');
  return (
    <div className={cn('neo-raised p-6 rounded-2xl flex flex-col gap-2 transition-all duration-500',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3')}
      style={{ transitionDelay: `${delay}ms` }}>
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn('text-4xl font-black tabular-nums', color)}>{formatted}</div>
    </div>
  );
}

// ─── Animated progress bar ────────────────────────────────────────────────────
function AnimatedBar({ pct, gradient, height = 'h-2' }: { pct: number; gradient: string; height?: string }) {
  const w = useBarWidth(pct);
  return (
    <div className={cn('w-full neo-inset rounded-full overflow-hidden', height)}>
      <div className={cn('h-full rounded-full transition-all duration-700 ease-out', gradient)} style={{ width: `${w}%` }} />
    </div>
  );
}

// ─── Stacked payment bar ──────────────────────────────────────────────────────
function PaymentStackedBar({ cash, card, upi, wallet, total }: {
  cash: number; card: number; upi: number; wallet: number; total: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);
  if (total === 0) return null;
  const pct = (v: number) => mounted ? (v / total) * 100 : 0;
  return (
    <div className="h-3 w-full rounded-full overflow-hidden flex neo-inset mt-4 mb-2">
      {[
        { val: cash, cls: 'bg-emerald-500' },
        { val: card, cls: 'bg-blue-500' },
        { val: upi, cls: 'bg-purple-500' },
        { val: wallet, cls: 'bg-orange-400' },
      ].map(({ val, cls }, i) => (
        <div key={i} className={cn('h-full transition-all duration-700 ease-out', cls)}
          style={{ width: `${pct(val)}%`, transitionDelay: `${i * 100}ms` }} />
      ))}
    </div>
  );
}

// ─── Payment icon ─────────────────────────────────────────────────────────────
function PaymentIcon({ method }: { method: string }) {
  switch (method) {
    case 'cash': return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></svg>;
    case 'card': return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h3M15 15h3" /></svg>;
    case 'upi': return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M12 2L6 12l6 2 6-2L12 2z" /><path d="M6 12l6 10 6-10" /></svg>;
    default: return <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4h-4z" /></svg>;
  }
}

// ─── Hourly Sales Chart (FIXED: absolute pixel heights from bottom) ────────────
const CHART_H = 140; // bar area height in px

function HourlySalesChart({
  data,
  comparison,
  showComparison,
}: {
  data: { hour: number; sales: number; orders: number }[];
  comparison: { hour: number; sales: number }[];
  showComparison: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, [data]);

  const allSales = [...data.map(d => d.sales), ...(showComparison ? comparison.map(d => d.sales) : [])];
  const maxSales = Math.max(...allSales, 1);
  const relevant = data.filter(d => d.sales > 0 || (d.hour >= 6 && d.hour <= 23));
  const compMap = new Map(comparison.map(d => [d.hour, d.sales]));

  if (relevant.length === 0) {
    return <div className="text-center text-muted-foreground py-10 text-sm">No sales data for this date</div>;
  }

  return (
    <div className="flex items-end gap-0.5" style={{ height: `${CHART_H + 28}px` }}>
      {relevant.map((d, i) => {
        const barH = mounted && d.sales > 0 ? Math.max((d.sales / maxSales) * CHART_H, 3) : 0;
        const compSales = compMap.get(d.hour) || 0;
        const compH = mounted && showComparison && compSales > 0 ? Math.max((compSales / maxSales) * CHART_H, 2) : 0;
        return (
          <div key={d.hour} className="flex-1 group relative" style={{ height: `${CHART_H + 28}px` }}>
            {/* Hover tooltip */}
            {d.sales > 0 && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                {formatCurrency(d.sales)}
                <div className="text-[9px] font-normal opacity-70">{d.orders} orders</div>
                {showComparison && compSales > 0 && (
                  <div className="text-[9px] opacity-50">prev: {formatCurrency(compSales)}</div>
                )}
              </div>
            )}
            {/* Bar area — positioned from bottom */}
            <div className="absolute inset-x-0 bottom-6" style={{ height: `${CHART_H}px` }}>
              {/* Comparison ghost bar */}
              {showComparison && (
                <div
                  className="absolute inset-x-0.5 bottom-0 rounded-t-sm transition-all duration-700 ease-out"
                  style={{
                    height: `${compH}px`,
                    background: 'linear-gradient(180deg, rgba(148,163,184,0.5) 0%, rgba(100,116,139,0.3) 100%)',
                    transitionDelay: `${i * 20}ms`,
                  }}
                />
              )}
              {/* Main bar */}
              <div
                className="absolute inset-x-0.5 bottom-0 rounded-t-sm transition-all duration-700 ease-out"
                style={{
                  height: `${barH}px`,
                  background: d.sales > 0
                    ? 'linear-gradient(180deg, #ff8c00 0%, #f59e0b 100%)'
                    : 'rgba(0,0,0,0.04)',
                  transitionDelay: `${i * 20}ms`,
                }}
              />
            </div>
            {/* Hour label */}
            <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-muted-foreground font-medium">
              {d.hour.toString().padStart(2, '0')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Multi-Day Chart (7 or 30 day) ────────────────────────────────────────────
function MultiDayChart({
  data,
  comparison,
  showComparison,
  labelMode,
}: {
  data: { date: string; sales: number }[];
  comparison: { date: string; sales: number }[];
  showComparison: boolean;
  labelMode: 'day' | 'date';
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, [data]);

  const allSales = [...data.map(d => d.sales), ...(showComparison ? comparison.map(d => d.sales) : [])];
  const maxSales = Math.max(...allSales, 1);

  const dayLabel = (dateStr: string) => {
    if (labelMode === 'day') {
      return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 2);
    }
    return new Date(dateStr).getDate().toString();
  };

  return (
    <div className="flex items-end gap-1" style={{ height: `${CHART_H + 28}px` }}>
      {data.map((d, i) => {
        const barH = mounted && d.sales > 0 ? Math.max((d.sales / maxSales) * CHART_H, 3) : 0;
        const comp = comparison[i];
        const compH = mounted && showComparison && comp?.sales > 0 ? Math.max((comp.sales / maxSales) * CHART_H, 2) : 0;
        return (
          <div key={d.date} className="flex-1 group relative" style={{ height: `${CHART_H + 28}px` }}>
            {d.sales > 0 && (
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-20 bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                {formatCurrency(d.sales)}
                <div className="text-[9px] font-normal opacity-60">{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                {showComparison && comp?.sales > 0 && <div className="text-[9px] opacity-50">prev: {formatCurrency(comp.sales)}</div>}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-6" style={{ height: `${CHART_H}px` }}>
              {showComparison && (
                <div className="absolute inset-x-1 bottom-0 rounded-t-sm transition-all duration-700 ease-out"
                  style={{ height: `${compH}px`, background: 'linear-gradient(180deg, rgba(148,163,184,0.45) 0%, rgba(100,116,139,0.25) 100%)', transitionDelay: `${i * 20}ms` }} />
              )}
              <div className="absolute inset-x-1 bottom-0 rounded-t-sm transition-all duration-700 ease-out"
                style={{ height: `${barH}px`, background: d.sales > 0 ? 'linear-gradient(180deg, #ff8c00 0%, #f59e0b 100%)' : 'rgba(0,0,0,0.04)', transitionDelay: `${i * 20}ms` }} />
            </div>
            <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-muted-foreground font-medium">
              {dayLabel(d.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart Section (tabs + comparison) ───────────────────────────────────────
function ChartSection({
  tenantId,
  selectedDate,
  hourlyData,
}: {
  tenantId: string;
  selectedDate: string;
  hourlyData: { hour: number; sales: number; orders: number }[];
}) {
  const [view, setView] = useState<ChartView>('hourly');
  const [showComparison, setShowComparison] = useState(false);
  const [compHourly, setCompHourly] = useState<{ hour: number; sales: number }[]>([]);
  const [weekData, setWeekData] = useState<{ date: string; sales: number }[]>([]);
  const [compWeekData, setCompWeekData] = useState<{ date: string; sales: number }[]>([]);
  const [monthData, setMonthData] = useState<{ date: string; sales: number }[]>([]);
  const [compMonthData, setCompMonthData] = useState<{ date: string; sales: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch comparison hourly (same day last week)
  useEffect(() => {
    if (!showComparison || view !== 'hourly') return;
    const compDate = addDays(selectedDate, -7);
    salesTransactionService.getCombinedHourlySales(tenantId, compDate)
      .then(data => setCompHourly(data.map(h => ({ hour: h.hour, sales: h.sales }))))
      .catch(() => setCompHourly([]));
  }, [showComparison, view, selectedDate, tenantId]);

  // Fetch week/month chart data
  useEffect(() => {
    if (view === 'hourly') return;
    const days = view === 'week' ? 7 : 30;
    const endDate = selectedDate;
    const startDate = addDays(selectedDate, -(days - 1));
    const compEnd = addDays(selectedDate, -days);
    const compStart = addDays(selectedDate, -(days * 2 - 1));
    setLoading(true);
    Promise.all([
      fetchDailyAggregates(tenantId, startDate, endDate),
      fetchDailyAggregates(tenantId, compStart, compEnd),
    ]).then(([cur, prev]) => {
      if (view === 'week') { setWeekData(cur); setCompWeekData(prev); }
      else { setMonthData(cur); setCompMonthData(prev); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [view, selectedDate, tenantId]);

  const compLabel = view === 'hourly' ? 'vs last week' : view === 'week' ? 'vs prev 7d' : 'vs prev 30d';
  const currentData = view === 'week' ? weekData : monthData;
  const compData = view === 'week' ? compWeekData : compMonthData;

  return (
    <div className="neo-raised p-5 rounded-2xl">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Sales Trend</h2>
        <div className="flex items-center gap-2">
          {/* Comparison toggle */}
          <button
            onClick={() => setShowComparison(s => !s)}
            className={cn(
              'px-2.5 py-1 text-xs font-bold rounded-lg border transition-all',
              showComparison
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'neo-inset text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {compLabel}
          </button>
          {/* View tabs */}
          <div className="flex neo-inset p-0.5 rounded-lg">
            {(['hourly', 'week', 'month'] as ChartView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-md transition-all capitalize',
                  view === v ? 'neo-raised-sm text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {v === 'hourly' ? 'Hourly' : v === 'week' ? '7 Day' : '30 Day'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: `${CHART_H + 28}px` }}>
          <div className="w-8 h-8 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      ) : view === 'hourly' ? (
        <HourlySalesChart data={hourlyData} comparison={compHourly} showComparison={showComparison} />
      ) : (
        <MultiDayChart
          data={currentData}
          comparison={compData}
          showComparison={showComparison}
          labelMode={view === 'week' ? 'day' : 'date'}
        />
      )}

      {/* Comparison legend */}
      {showComparison && (
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-gradient-to-b from-orange-500 to-amber-400" />
            This period
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-slate-400/40" />
            {compLabel.replace('vs ', '')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Cash Register Modal ──────────────────────────────────────────────────────
function CashRegisterModal({
  open,
  onClose,
  cashRegister,
  payouts,
  payoutSummary,
  report,
  isToday,
  onOpenRegister,
  onCloseRegister,
  onRecordPayout,
  onCancelPayout,
}: {
  open: boolean;
  onClose: () => void;
  cashRegister: any;
  payouts: any[];
  payoutSummary: any;
  report: any;
  isToday: boolean;
  onOpenRegister: (amount: string) => void;
  onCloseRegister: (amount: string) => void;
  onRecordPayout: (amount: string, type: PayoutType, category: PayoutCategory | '', desc: string) => void;
  onCancelPayout: (id: string) => void;
}) {
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState<PayoutType>('expense');
  const [payoutCategory, setPayoutCategory] = useState<PayoutCategory | ''>('');
  const [payoutDesc, setPayoutDesc] = useState('');
  const [subView, setSubView] = useState<'register' | 'payout'>('register');

  const totalPayouts = payoutSummary?.totalPayouts || 0;
  const cashSales = report?.paymentBreakdown.cash || 0;
  const expected = (cashRegister?.openingCash || 0) + cashSales - totalPayouts;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-panel p-6 w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-black">Cash Register</h2>
            {cashRegister && (
              <span className={cn('text-xs font-bold uppercase px-2 py-0.5 rounded-full mt-1 inline-block',
                cashRegister.status === 'open'
                  ? 'bg-success/15 text-success'
                  : 'bg-destructive/15 text-destructive'
              )}>
                {cashRegister.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 neo-raised-sm rounded-xl hover:neo-hover transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!cashRegister ? (
          /* ── No register yet ─── */
          isToday ? (
            <div className="text-center py-4 space-y-4">
              <p className="text-muted-foreground text-sm">Enter starting cash to open today's register</p>
              <input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)}
                placeholder="₹ 0" className="w-full neo-inset px-4 py-3 text-foreground text-3xl text-center rounded-xl font-black" autoFocus />
              <button onClick={() => { onOpenRegister(openingCash); onClose(); }} disabled={!openingCash}
                className="w-full neo-raised-sm text-success disabled:opacity-40 font-bold py-3 rounded-xl hover:neo-hover transition-all">
                Open Register
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">No register data for this date</div>
          )
        ) : (
          <>
            {/* ── Reconciliation table ─── */}
            <div className="neo-inset p-4 rounded-xl space-y-2 text-sm mb-4">
              {[
                { label: 'Opening Cash', val: formatCurrency(cashRegister.openingCash), cls: '' },
                { label: '+ Cash Sales', val: `+${formatCurrency(cashSales)}`, cls: 'text-success' },
                ...(totalPayouts > 0 ? [{ label: '- Payouts', val: `-${formatCurrency(totalPayouts)}`, cls: 'text-destructive' }] : []),
              ].map(({ label, val, cls }) => (
                <div key={label} className="flex justify-between border-b border-border pb-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn('font-bold', cls)}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between font-black pt-1">
                <span>Expected Closing</span>
                <span>{formatCurrency(expected)}</span>
              </div>
              {cashRegister.status === 'closed' && (
                <>
                  <div className="flex justify-between text-sm pt-1 border-t border-border">
                    <span className="text-muted-foreground">Actual Closing</span>
                    <span className="font-bold">{formatCurrency(cashRegister.actualClosingCash || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Variance</span>
                    <span className={cn('font-bold text-base', (cashRegister.cashVariance || 0) >= 0 ? 'text-success' : 'text-destructive')}>
                      {(cashRegister.cashVariance || 0) >= 0 ? '+' : ''}{formatCurrency(cashRegister.cashVariance || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* ── Payouts list ─── */}
            {payouts.length > 0 && (
              <div className="mb-4 space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Payouts</div>
                {payouts.map(p => (
                  <div key={p.id} className="flex items-center justify-between neo-inset p-2.5 rounded-xl text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold capitalize">{p.payoutType.replace('_', ' ')}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.description || p.category || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="font-bold text-destructive">-{formatCurrency(p.amount)}</span>
                      {isToday && cashRegister.status === 'open' && (
                        <button onClick={() => onCancelPayout(p.id)}
                          className="p-1 rounded neo-raised-sm text-muted-foreground hover:text-destructive transition-colors">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Action buttons ─── */}
            {isToday && cashRegister.status === 'open' && (
              <>
                {subView === 'payout' ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Record Payout</div>
                    <input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)}
                      placeholder="₹ 0" className="w-full neo-inset px-4 py-3 text-foreground text-2xl text-center rounded-xl font-black" autoFocus />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={payoutType} onChange={e => setPayoutType(e.target.value as PayoutType)}
                        className="neo-inset px-3 py-2 text-sm rounded-xl">
                        <option value="expense">Expense</option>
                        <option value="withdrawal">Withdrawal</option>
                        <option value="petty_cash">Petty Cash</option>
                        <option value="bank_deposit">Bank Deposit</option>
                        <option value="vendor_payment">Vendor Payment</option>
                      </select>
                      <select value={payoutCategory} onChange={e => setPayoutCategory(e.target.value as PayoutCategory | '')}
                        className="neo-inset px-3 py-2 text-sm rounded-xl">
                        <option value="">Category</option>
                        <option value="utilities">Utilities</option>
                        <option value="supplies">Supplies</option>
                        <option value="salary">Salary</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="misc">Misc</option>
                      </select>
                    </div>
                    <input type="text" value={payoutDesc} onChange={e => setPayoutDesc(e.target.value)}
                      placeholder="Description (optional)" className="w-full neo-inset px-3 py-2 text-sm rounded-xl" />
                    <div className="flex gap-2">
                      <button onClick={() => setSubView('register')} className="flex-1 neo-raised-sm font-bold py-2.5 rounded-xl">Cancel</button>
                      <button onClick={() => { onRecordPayout(payoutAmount, payoutType, payoutCategory, payoutDesc); setSubView('register'); setPayoutAmount(''); setPayoutCategory(''); setPayoutDesc(''); }}
                        disabled={!payoutAmount || parseFloat(payoutAmount) <= 0}
                        className="flex-1 neo-raised-sm text-destructive disabled:opacity-40 font-bold py-2.5 rounded-xl">
                        Record
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setSubView('payout')}
                      className="flex-1 neo-raised-sm text-destructive font-bold py-2.5 rounded-xl text-sm hover:neo-hover transition-all">
                      + Payout
                    </button>
                    <button onClick={() => {
                      const amount = prompt('Enter actual closing cash amount:');
                      if (amount) { onCloseRegister(amount); onClose(); }
                    }}
                      className="flex-1 neo-raised-sm text-warning font-bold py-2.5 rounded-xl text-sm hover:neo-hover transition-all">
                      Close Register
                    </button>
                  </div>
                )}
              </>
            )}

            {isToday && cashRegister.status === 'closed' && (
              <div className="text-center py-2">
                <span className="text-xs text-muted-foreground">Register closed for today</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Cash Register Header Button ─────────────────────────────────────────────
function CashRegisterButton({ cashRegister, isToday, onClick }: {
  cashRegister: any; isToday: boolean; onClick: () => void;
}) {
  const status = cashRegister?.status;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 neo-raised-sm rounded-xl text-xs font-bold transition-all hover:neo-hover',
        status === 'open' ? 'text-success' : status === 'closed' ? 'text-warning' : 'text-muted-foreground'
      )}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M5 7h14M5 7a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2" />
        <circle cx="12" cy="14" r="2" />
      </svg>
      {status === 'open' ? 'REGISTER' : isToday && !cashRegister ? 'OPEN REG' : 'REGISTER'}
      {status && (
        <span className={cn('w-1.5 h-1.5 rounded-full',
          status === 'open' ? 'bg-success animate-pulse' : 'bg-warning')} />
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DailySalesReport() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { shouldReceiveRealtimeSales } = useDeviceStore();
  const {
    selectedDate, setSelectedDate, report, cashRegister, payouts, payoutSummary,
    isLoading, error, fetchReport, fetchCashRegister, fetchPayouts,
    openCashRegister, closeCashRegister, recordPayout, cancelPayout,
    getTodayDate, latestSaleTimestamp, newSalesCount, clearNewSalesCount,
  } = useDailySalesStore();

  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [lastUpdatedText, setLastUpdatedText] = useState('');
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);

  const isToday = selectedDate === getTodayDate();
  const isOwnerDevice = shouldReceiveRealtimeSales();
  const showLiveIndicator = isOwnerDevice && isToday && wsStatus === 'connected';

  const tipsMap = useMemo(() => {
    const map = new Map<string, number>();
    report?.tips?.forEach(tip => map.set(tip.invoiceNumber, tip.tipAmount));
    return map;
  }, [report?.tips]);

  useEffect(() => {
    if (user?.tenantId) {
      fetchReport(user.tenantId, selectedDate);
      fetchCashRegister(user.tenantId, selectedDate);
      fetchPayouts(user.tenantId, selectedDate);
    }
  }, [user?.tenantId, selectedDate]);

  useEffect(() => { clearNewSalesCount(); }, [selectedDate]);

  useEffect(() => {
    if (!isOwnerDevice || !isToday) return;
    const update = () => setWsStatus(orderSyncService.getConnectionStatus());
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [isOwnerDevice, isToday]);

  useEffect(() => {
    if (!latestSaleTimestamp) { setLastUpdatedText(''); return; }
    const update = () => {
      const s = Math.floor((Date.now() - latestSaleTimestamp) / 1000);
      setLastUpdatedText(s < 5 ? 'Just now' : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [latestSaleTimestamp]);

  const totalPayouts = payoutSummary?.totalPayouts || 0;

  const paymentPercentages = useMemo(() => {
    const t = report?.summary.totalSales || 1;
    return {
      cash: ((report?.paymentBreakdown.cash || 0) / t) * 100,
      card: ((report?.paymentBreakdown.card || 0) / t) * 100,
      upi: ((report?.paymentBreakdown.upi || 0) / t) * 100,
      wallet: ((report?.paymentBreakdown.wallet || 0) / t) * 100,
    };
  }, [report]);

  const orderTypePercentages = useMemo(() => {
    const t = report?.summary.totalOrders || 1;
    return {
      'dine-in': ((report?.orderTypeBreakdown['dine-in'].count || 0) / t) * 100,
      takeout: ((report?.orderTypeBreakdown['takeout'].count || 0) / t) * 100,
      delivery: ((report?.orderTypeBreakdown['delivery'].count || 0) / t) * 100,
    };
  }, [report]);

  const topItemsMax = useMemo(() => Math.max(...(report?.topItems?.map(i => i.quantity) ?? [1]), 1), [report?.topItems]);

  const sortedTransactions = useMemo(() => {
    if (!report?.transactions) return [];
    return [...report.transactions].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'time': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'invoice': cmp = a.invoiceNumber.localeCompare(b.invoiceNumber); break;
        case 'total': cmp = a.grandTotal - b.grandTotal; break;
        case 'payment': cmp = a.paymentMethod.localeCompare(b.paymentMethod); break;
        case 'type': cmp = a.orderType.localeCompare(b.orderType); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [report?.transactions, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };
  const toggleRow = (id: string) => setExpandedRows(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const paymentBadge = (m: string) => ({
    cash: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
    card: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
    upi: 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400',
    wallet: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400',
  }[m.toLowerCase()] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30');

  const orderTypeBadge = (t: string) => ({
    'dine-in': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    takeout: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    delivery: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  }[t.toLowerCase()] ?? 'bg-slate-500/15 text-slate-400');

  const sourceBadge = (s: string) => ({
    pos: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400',
    zomato: 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400',
    swiggy: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400',
    website: 'bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400',
  }[s.toLowerCase()] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30');

  // Cash register handlers (passed to modal)
  const handleOpenRegister = useCallback(async (amount: string) => {
    if (!user?.tenantId || !amount) return;
    try { await openCashRegister(user.tenantId, parseFloat(amount), user.name); }
    catch { alert('Failed to open register'); }
  }, [user, openCashRegister]);

  const handleCloseRegister = useCallback(async (amount: string) => {
    if (!user?.tenantId || !amount) return;
    try { await closeCashRegister(user.tenantId, parseFloat(amount), user.name); }
    catch { alert('Failed to close register'); }
  }, [user, closeCashRegister]);

  const handleRecordPayout = useCallback(async (amount: string, type: PayoutType, category: PayoutCategory | '', desc: string) => {
    if (!user?.tenantId || !user.name) return;
    try {
      await recordPayout(user.tenantId, parseFloat(amount), type, user.name, {
        category: category || undefined, description: desc || undefined,
      });
    } catch { alert('Failed to record payout'); }
  }, [user, recordPayout]);

  const handleCancelPayout = useCallback(async (id: string) => {
    if (!user?.tenantId || !confirm('Cancel this payout?')) return;
    try { await cancelPayout(id, user.tenantId); } catch { alert('Failed to cancel payout'); }
  }, [user, cancelPayout]);

  const SortIcon = ({ field }: { field: SortField }) => (
    sortField === field
      ? <span className="text-primary text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
      : <span className="opacity-0 group-hover:opacity-40 text-xs">↓</span>
  );

  const medal = (i: number) => i === 0 ? <span>🥇</span> : i === 1 ? <span>🥈</span> : i === 2 ? <span>🥉</span>
    : <span className="text-xs text-muted-foreground font-mono w-5 text-center">{i + 1}</span>;

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="settings-header">
        <div className="flex items-center justify-between w-full gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-2 rounded-xl flex-shrink-0 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-lg font-black tracking-tight whitespace-nowrap">SALES REPORT</h1>
            {showLiveIndicator && (
              <div className="flex items-center gap-1.5 bg-success-light border border-success/30 px-2.5 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                <span className="text-xs font-bold text-success">LIVE</span>
                {lastUpdatedText && <span className="text-[10px] text-success/70">{lastUpdatedText}</span>}
              </div>
            )}
            {isOwnerDevice && isToday && newSalesCount > 0 && (
              <div className="bg-warning-light border border-warning/30 text-warning px-2 py-0.5 rounded-full text-xs font-bold">+{newSalesCount}</div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Cash Register button in header */}
            <CashRegisterButton
              cashRegister={cashRegister}
              isToday={isToday}
              onClick={() => setShowCashRegisterModal(true)}
            />

            <div className="w-px h-5 bg-border" />

            {/* View toggle */}
            <div className="flex neo-inset p-1 rounded-xl">
              {(['summary', 'transactions'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={cn('px-3 py-1.5 text-xs font-bold transition-all rounded-lg capitalize',
                    viewMode === v ? 'neo-raised-sm text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  {v}
                </button>
              ))}
            </div>

            <button onClick={() => {
              if (!report?.transactions?.length) { alert('No transactions to export'); return; }
              exportTransactions(report.transactions, selectedDate);
            }}
              disabled={!report?.transactions?.length}
              className="neo-raised-sm px-3 py-2 font-bold text-xs text-success flex items-center gap-1.5 rounded-xl disabled:opacity-40 hover:neo-hover transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>

            <div className="w-px h-5 bg-border" />

            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="neo-inset px-3 py-2 text-foreground rounded-xl text-sm" />
            <button onClick={() => setSelectedDate(getTodayDate())}
              className={cn('px-3 py-2 text-xs font-bold rounded-xl transition-all',
                isToday ? 'neo-raised-sm text-primary' : 'neo-inset text-muted-foreground hover:text-foreground')}>
              TODAY
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
            </div>
            <span className="text-sm text-muted-foreground">Loading report…</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-destructive font-medium">{error}</div>
            <button onClick={() => user?.tenantId && fetchReport(user.tenantId)} className="px-4 py-2 neo-raised-sm rounded-xl text-sm hover:neo-hover transition-all">Retry</button>
          </div>
        ) : viewMode === 'summary' ? (
          <div className="space-y-5">

            {/* ── 1. KPI Cards ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard label="Total Sales" value={report?.summary.totalSales || 0} color="text-success" prefix="₹" delay={0} />
              <KpiCard label="Total Orders" value={report?.summary.totalOrders || 0} color="text-info" delay={80} />
              <KpiCard label="Avg Order Value" value={report?.summary.averageOrderValue || 0} color="text-primary" prefix="₹" delay={160} />
            </div>

            {/* ── 2. Sales by Channel ─────────────────────────────────── */}
            {report?.sourceBreakdown && (
              <div className="neo-raised p-5 rounded-2xl">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Sales by Channel</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'pos', label: 'POS / Dine-in', color: 'text-info', bg: 'bg-info/8 border-info/20', icon: '🏪', data: report.sourceBreakdown.pos },
                    { key: 'zomato', label: 'Zomato', color: 'text-destructive', bg: 'bg-destructive/8 border-destructive/20', icon: '🔴', data: report.sourceBreakdown.zomato },
                    { key: 'swiggy', label: 'Swiggy', color: 'text-warning', bg: 'bg-warning/8 border-warning/20', icon: '🟠', data: report.sourceBreakdown.swiggy },
                    { key: 'website', label: 'Website', color: 'text-primary', bg: 'bg-primary/8 border-primary/20', icon: '🌐', data: report.sourceBreakdown.website },
                  ].map(({ key, label, color, bg, icon, data }) => (
                    <div key={key} className={cn('neo-inset border rounded-xl p-4', bg)}>
                      <div className="text-2xl mb-2">{icon}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">{label}</div>
                      <div className={cn('text-xl font-black', color)}>{formatCurrency(data.sales)}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{data.orders} orders</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 3. Payment | Order Types (2-col) ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Payment Breakdown */}
              <div className="neo-raised p-5 rounded-2xl">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">Payment Breakdown</h2>
                <PaymentStackedBar
                  cash={report?.paymentBreakdown.cash || 0}
                  card={report?.paymentBreakdown.card || 0}
                  upi={report?.paymentBreakdown.upi || 0}
                  wallet={report?.paymentBreakdown.wallet || 0}
                  total={report?.summary.totalSales || 0}
                />
                <div className="flex flex-wrap gap-2 mb-4 text-[10px] font-bold text-muted-foreground">
                  {[['Cash', 'bg-emerald-500'], ['Card', 'bg-blue-500'], ['UPI', 'bg-purple-500'], ['Wallet', 'bg-orange-400']].map(([l, c]) => (
                    <span key={l} className="flex items-center gap-1"><span className={cn('inline-block w-2 h-2 rounded-full', c)} />{l}</span>
                  ))}
                </div>
                <div className="space-y-2.5">
                  {[
                    { key: 'cash', label: 'Cash', pct: paymentPercentages.cash, color: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400', icon: 'cash' },
                    { key: 'card', label: 'Card', pct: paymentPercentages.card, color: 'text-blue-600 dark:text-blue-400', bar: 'bg-gradient-to-r from-blue-500 to-blue-400', icon: 'card' },
                    { key: 'upi', label: 'UPI', pct: paymentPercentages.upi, color: 'text-purple-600 dark:text-purple-400', bar: 'bg-gradient-to-r from-purple-500 to-purple-400', icon: 'upi' },
                    { key: 'wallet', label: 'Wallet', pct: paymentPercentages.wallet, color: 'text-orange-500 dark:text-orange-400', bar: 'bg-gradient-to-r from-orange-400 to-amber-400', icon: 'wallet' },
                  ].map(({ key, label, pct, color, bar, icon }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className={cn('flex items-center gap-2 font-semibold text-sm', color)}>
                          <PaymentIcon method={icon} />{label}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground text-sm">{formatCurrency(report?.paymentBreakdown[key as keyof typeof report.paymentBreakdown] || 0)}</span>
                          <span className="text-muted-foreground text-xs ml-2">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <AnimatedBar pct={pct} gradient={bar} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Types */}
              <div className="neo-raised p-5 rounded-2xl">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Order Types</h2>
                <div className="space-y-4">
                  {[
                    { key: 'dine-in' as const, label: 'Dine-in', icon: '🍽️', gradient: 'bg-gradient-to-r from-blue-500 to-blue-400' },
                    { key: 'takeout' as const, label: 'Takeout', icon: '🥡', gradient: 'bg-gradient-to-r from-amber-500 to-yellow-400' },
                    { key: 'delivery' as const, label: 'Delivery', icon: '🛵', gradient: 'bg-gradient-to-r from-purple-500 to-purple-400' },
                  ].map(({ key, label, icon, gradient }) => {
                    const d = report?.orderTypeBreakdown[key];
                    const pct = orderTypePercentages[key];
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-2 text-sm font-semibold"><span>{icon}</span>{label}</span>
                          <span className="text-sm text-muted-foreground">{d?.count || 0} orders · <span className="text-foreground font-bold">{pct.toFixed(0)}%</span></span>
                        </div>
                        <AnimatedBar pct={pct} gradient={gradient} height="h-2.5" />
                        <div className="text-right text-xs text-muted-foreground mt-0.5">{formatCurrency(d?.sales || 0)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── 4. Cash Payouts ─────────────────────────────────────── */}
            {payouts.length > 0 && (
              <div className="neo-raised p-5 rounded-2xl">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Cash Payouts ({payouts.length})</h2>
                <div className="space-y-2">
                  {payouts.map(payout => (
                    <div key={payout.id} className="flex items-center justify-between neo-inset p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-base">
                          {({ bank_deposit: '🏦', vendor_payment: '🧾', petty_cash: '💰', withdrawal: '💸' } as any)[payout.payoutType] || '📤'}
                        </div>
                        <div>
                          <div className="font-semibold text-sm capitalize">{payout.payoutType.replace('_', ' ')}{payout.category && <span className="text-muted-foreground ml-1 font-normal">({payout.category})</span>}</div>
                          <div className="text-xs text-muted-foreground">{payout.description || '—'} · {new Date(payout.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-destructive">-{formatCurrency(payout.amount)}</span>
                        {isToday && cashRegister?.status === 'open' && (
                          <button onClick={() => handleCancelPayout(payout.id)} className="p-1.5 rounded-lg neo-raised-sm text-muted-foreground hover:text-destructive transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {payoutSummary && (
                  <div className="mt-3 pt-3 border-t-2 border-border flex justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Total Payouts</span>
                    <span className="font-black text-destructive text-lg">-{formatCurrency(payoutSummary.totalPayouts)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── 5. Top Selling Items ──────────────────────────────── */}
            <div className="neo-raised p-5 rounded-2xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Top Selling Items</h2>
              {report?.topItems?.length ? (
                <div className="space-y-2.5">
                  {report.topItems.slice(0, 10).map((item, i) => (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">{medal(i)}<span className="text-sm truncate font-medium">{item.name}</span></div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="font-black text-sm">{item.quantity}</span>
                          <span className="text-[11px] text-muted-foreground ml-1.5">{formatCurrency(item.revenue)}</span>
                        </div>
                      </div>
                      <AnimatedBar pct={(item.quantity / topItemsMax) * 100}
                        gradient={i === 0 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : i === 1 ? 'bg-gradient-to-r from-slate-400 to-slate-300' : i === 2 ? 'bg-gradient-to-r from-orange-700 to-orange-500' : 'bg-gradient-to-r from-primary/60 to-primary/40'} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8 text-sm">No items sold</div>
              )}
            </div>

            {/* ── 6. Tips Summary ──────────────────────────────────── */}
            {report?.tipsSummary && (report.tipsSummary.tipCount > 0 || report.tipsSummary.totalTips > 0) && (
              <div className="neo-raised p-5 rounded-2xl">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Tips Summary</h2>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { l: 'Total Tips', v: formatCurrency(report.tipsSummary.totalTips), c: 'text-success' },
                    { l: 'Tipped Orders', v: String(report.tipsSummary.tipCount), c: 'text-info' },
                    { l: 'Average Tip', v: formatCurrency(report.tipsSummary.averageTip), c: 'text-primary' },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="text-center">
                      <div className={cn('text-2xl font-black', c)}>{v}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-wide">{l}</div>
                    </div>
                  ))}
                </div>
                {report.tipsSummary.byStaff.length > 0 && (
                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">By Server</div>
                    {report.tipsSummary.byStaff.map(s => (
                      <div key={s.staffId || s.serverName} className="flex justify-between items-center py-2 px-3 neo-inset rounded-xl text-sm">
                        <div><div className="font-semibold">{s.serverName}</div><div className="text-xs text-muted-foreground">{s.count} orders</div></div>
                        <div className="text-right"><div className="font-bold text-success">{formatCurrency(s.tips)}</div><div className="text-xs text-muted-foreground">avg {formatCurrency(s.average)}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 7. Sales Trend Chart (moved to bottom) ───────────── */}
            {user?.tenantId && (
              <ChartSection
                tenantId={user.tenantId}
                selectedDate={selectedDate}
                hourlyData={report?.hourlySales || []}
              />
            )}

            {/* ── 8. Tax & Charges ─────────────────────────────────── */}
            <div className="neo-raised p-5 rounded-2xl">
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Tax & Charges</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { l: 'Total Tax', v: formatCurrency(report?.summary.totalTax || 0), c: '' },
                  { l: 'Service Charge', v: formatCurrency(report?.summary.totalServiceCharge || 0), c: '' },
                  { l: 'Discounts', v: `-${formatCurrency(report?.summary.totalDiscount || 0)}`, c: 'text-destructive' },
                  { l: 'Net Sales', v: formatCurrency((report?.summary.totalSales || 0) - (report?.summary.totalTax || 0)), c: 'text-success' },
                ].map(({ l, v, c }) => (
                  <div key={l} className="text-center neo-inset p-3 rounded-xl">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">{l}</div>
                    <div className={cn('text-lg font-black', c || 'text-foreground')}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          /* ── Transactions Table ───────────────────────────────────────── */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 mb-3 neo-raised p-3.5 rounded-2xl text-sm">
              <span className="text-muted-foreground">Total:</span><span className="font-bold text-success">{formatCurrency(report?.summary.totalSales || 0)}</span>
              <div className="w-px h-4 bg-border" />
              <span className="text-muted-foreground">Orders:</span><span className="font-bold text-info">{report?.summary.totalOrders || 0}</span>
              <div className="w-px h-4 bg-border" />
              <span className="text-muted-foreground">Avg:</span><span className="font-bold text-primary">{formatCurrency(report?.summary.averageOrderValue || 0)}</span>
              <div className="flex-1" />
              <span className="text-muted-foreground text-xs">{sortedTransactions.length} transactions</span>
            </div>

            <div className="flex-1 neo-raised overflow-hidden flex flex-col rounded-2xl">
              <div className="grid gap-2 px-4 py-3 bg-surface-2 text-xs font-black uppercase tracking-wide text-muted-foreground border-b border-border"
                style={{ gridTemplateColumns: '3rem 1fr 1fr 3.5rem 3.5rem 1fr 4rem 5rem 4rem 4rem 4rem 5rem' }}>
                {[['time', 'Time'], ['invoice', 'Invoice']].map(([f, l]) => (
                  <button key={f} onClick={() => handleSort(f as SortField)} className="group text-left flex items-center gap-1 hover:text-foreground">{l} <SortIcon field={f as SortField} /></button>
                ))}
                <div>Items</div>
                <button onClick={() => handleSort('type')} className="group text-left flex items-center gap-1 hover:text-foreground">Type <SortIcon field="type" /></button>
                <div>Src</div>
                <button onClick={() => handleSort('payment')} className="group text-left flex items-center gap-1 hover:text-foreground">Pay <SortIcon field="payment" /></button>
                <div className="text-right">Sub</div><div className="text-right">Tax</div><div className="text-right">Disc</div>
                <div className="text-right">Tip</div>
                <button onClick={() => handleSort('total')} className="group text-right flex items-center justify-end gap-1 hover:text-foreground">Total <SortIcon field="total" /></button>
              </div>

              <div className="flex-1 overflow-auto">
                {sortedTransactions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-16 text-sm">No transactions for this date</div>
                ) : sortedTransactions.map(tx => {
                  const items = tx.items || [];
                  const isExpanded = expandedRows.has(tx.id);
                  return (
                    <div key={tx.id}>
                      <div
                        className={cn('grid gap-2 px-4 py-2.5 border-b border-border hover:bg-surface-2 transition-colors cursor-pointer text-sm', isExpanded && 'bg-surface-2')}
                        style={{ gridTemplateColumns: '3rem 1fr 1fr 3.5rem 3.5rem 1fr 4rem 5rem 4rem 4rem 4rem 5rem' }}
                        onClick={() => toggleRow(tx.id)}
                      >
                        <div className="text-muted-foreground font-mono text-xs">{formatTime(tx.createdAt)}</div>
                        <div className="font-mono text-xs font-semibold truncate">{tx.invoiceNumber}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {items.length > 0 ? `${items.length}× ${items.slice(0, 1).map(i => i.menuItem?.name || '?').join('')}${items.length > 1 ? ` +${items.length - 1}` : ''}` : '—'}
                        </div>
                        <div><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase', orderTypeBadge(tx.orderType))}>{tx.orderType === 'dine-in' ? 'DINE' : tx.orderType.slice(0, 4).toUpperCase()}</span></div>
                        <div><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border', sourceBadge(tx.source))}>{tx.source === 'pos' ? (tx.tableNumber ? `T${tx.tableNumber}` : 'POS') : tx.source.slice(0, 3).toUpperCase()}</span></div>
                        <div><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border', paymentBadge(tx.paymentMethod))}>{tx.paymentMethod.slice(0, 4)}</span></div>
                        <div className="text-right font-mono text-xs">{formatCurrency(tx.subtotal)}</div>
                        <div className="text-right font-mono text-xs text-muted-foreground">{formatCurrency(tx.cgst + tx.sgst)}</div>
                        <div className="text-right font-mono text-xs text-destructive">{tx.discount > 0 ? `-${formatCurrency(tx.discount)}` : '—'}</div>
                        <div className="text-right font-mono text-xs text-success">{tipsMap.has(tx.invoiceNumber) ? formatCurrency(tipsMap.get(tx.invoiceNumber)!) : '—'}</div>
                        <div className="text-right font-mono text-sm font-black text-success">{formatCurrency(tx.grandTotal)}</div>
                      </div>
                      {isExpanded && items.length > 0 && (
                        <div className="bg-surface-3 border-b border-border px-4 py-3">
                          <div className="ml-16">
                            <div className="neo-inset p-3 rounded-xl">
                              <table className="w-full text-sm">
                                <thead><tr className="text-[10px] text-muted-foreground uppercase font-bold">
                                  <th className="text-left py-1">Item</th><th className="text-center py-1 w-14">Qty</th>
                                  <th className="text-right py-1 w-20">Price</th><th className="text-right py-1 w-20">Total</th>
                                </tr></thead>
                                <tbody>{items.map((item, idx) => (
                                  <tr key={idx} className="border-t border-border">
                                    <td className="py-1.5">{item.menuItem?.name || '?'}</td>
                                    <td className="py-1.5 text-center">{item.quantity}</td>
                                    <td className="py-1.5 text-right font-mono text-muted-foreground">{formatCurrency(item.menuItem?.price || 0)}</td>
                                    <td className="py-1.5 text-right font-mono">{formatCurrency(item.subtotal)}</td>
                                  </tr>
                                ))}</tbody>
                                <tfoot className="border-t-2 border-border">
                                  <tr><td colSpan={3} className="py-1.5 text-right text-muted-foreground">Subtotal</td><td className="py-1.5 text-right font-mono">{formatCurrency(tx.subtotal)}</td></tr>
                                  {tx.serviceCharge > 0 && <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Service Charge</td><td className="py-1 text-right font-mono">{formatCurrency(tx.serviceCharge)}</td></tr>}
                                  {(tx.cgst + tx.sgst) > 0 && <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Tax (CGST {formatCurrency(tx.cgst)} + SGST {formatCurrency(tx.sgst)})</td><td className="py-1 text-right font-mono">{formatCurrency(tx.cgst + tx.sgst)}</td></tr>}
                                  {tx.discount > 0 && <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Discount</td><td className="py-1 text-right font-mono text-destructive">-{formatCurrency(tx.discount)}</td></tr>}
                                  {tx.roundOff !== 0 && <tr><td colSpan={3} className="py-1 text-right text-muted-foreground">Round Off</td><td className="py-1 text-right font-mono">{formatCurrency(tx.roundOff)}</td></tr>}
                                  <tr className="border-t-2 border-border"><td colSpan={3} className="py-2 text-right font-black">Grand Total</td><td className="py-2 text-right font-black text-success font-mono">{formatCurrency(tx.grandTotal)}</td></tr>
                                </tfoot>
                              </table>
                              {(tx.cashierName || tx.orderNumber) && (
                                <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground flex gap-4">
                                  {tx.cashierName && <span>Cashier: {tx.cashierName}</span>}
                                  {tx.orderNumber && <span>Order #: {tx.orderNumber}</span>}
                                  <span>Completed: {new Date(tx.completedAt).toLocaleString('en-IN')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {sortedTransactions.length > 0 && (
                <div className="grid gap-2 px-4 py-3 bg-surface-2 border-t-2 border-border text-xs font-black"
                  style={{ gridTemplateColumns: '3rem 1fr 1fr 3.5rem 3.5rem 1fr 4rem 5rem 4rem 4rem 4rem 5rem' }}>
                  <div className="col-span-6 text-muted-foreground uppercase tracking-wide">Totals</div>
                  <div className="text-right font-mono">{formatCurrency(sortedTransactions.reduce((s, tx) => s + tx.subtotal, 0))}</div>
                  <div className="text-right font-mono text-muted-foreground">{formatCurrency(sortedTransactions.reduce((s, tx) => s + tx.cgst + tx.sgst, 0))}</div>
                  <div className="text-right font-mono text-destructive">-{formatCurrency(sortedTransactions.reduce((s, tx) => s + tx.discount, 0))}</div>
                  <div className="text-right font-mono text-success">{formatCurrency(Array.from(tipsMap.values()).reduce((s, v) => s + v, 0))}</div>
                  <div className="text-right font-mono text-success">{formatCurrency(sortedTransactions.reduce((s, tx) => s + tx.grandTotal, 0))}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Cash Register Modal ─────────────────────────────────────────────── */}
      <CashRegisterModal
        open={showCashRegisterModal}
        onClose={() => setShowCashRegisterModal(false)}
        cashRegister={cashRegister}
        payouts={payouts}
        payoutSummary={payoutSummary}
        report={report}
        isToday={isToday}
        onOpenRegister={handleOpenRegister}
        onCloseRegister={handleCloseRegister}
        onRecordPayout={handleRecordPayout}
        onCancelPayout={handleCancelPayout}
      />
    </div>
  );
}
