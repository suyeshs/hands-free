import { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import {
  Customer,
  listCustomers,
  upsertCustomer,
  deleteCustomer,
  importCustomersFromCSV,
  CustomerImportResult,
} from '../../lib/handsfreeApi';

interface CustomerManagerProps {
  tenantId: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-700',
  'from-emerald-500 to-teal-700',
  'from-orange-500 to-amber-700',
  'from-pink-500 to-rose-700',
  'from-indigo-500 to-violet-700',
  'from-cyan-500 to-blue-700',
  'from-fuchsia-500 to-pink-700',
];

function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 65) % AVATAR_GRADIENTS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function tier(orders: number, spent: number) {
  if (orders >= 20 || spent >= 5000) return { label: 'VIP', cls: 'text-amber-400 bg-amber-400/15 border-amber-400/30' };
  if (orders >= 5  || spent >= 1000) return { label: 'Regular', cls: 'text-sky-400 bg-sky-400/15 border-sky-400/30' };
  return { label: 'New', cls: 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30' };
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 5)} ${d.slice(5)}`;
  return phone;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const label = name && name !== 'Unnamed' ? initials(name) : '?';
  const grad  = avatarGradient(label);
  const sz = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={cn('rounded-xl bg-gradient-to-br flex items-center justify-center font-black text-white shrink-0 shadow-lg', sz, grad)}>
      {label}
    </div>
  );
}

// ── Customer Card (grid) ─────────────────────────────────────────────────────

function CustomerCard({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  const t = tier(customer.totalOrders, customer.totalSpent);
  const name = customer.name || 'Unnamed';
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center text-center p-5 rounded-2xl bg-card border border-border hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-200 active:scale-[0.98] w-full"
    >
      {/* tier pill top-right */}
      <span className={cn('absolute top-3 right-3 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border', t.cls)}>
        {t.label}
      </span>

      <Avatar name={name} size="lg" />

      <p className="mt-3 font-bold text-sm leading-tight line-clamp-1 w-full">{name}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{formatPhone(customer.phone)}</p>

      <div className="mt-4 w-full grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 p-2">
          <p className="text-base font-black tabular-nums leading-none">{customer.totalOrders}</p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">Orders</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <p className="text-base font-black tabular-nums leading-none">{formatCurrency(customer.totalSpent)}</p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">Spent</p>
        </div>
      </div>
    </button>
  );
}

// ── Customer Row (list) ──────────────────────────────────────────────────────

function CustomerRow({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  const t = tier(customer.totalOrders, customer.totalSpent);
  const name = customer.name || 'Unnamed';
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-accent/40 hover:shadow-md hover:shadow-accent/5 transition-all duration-150 active:scale-[0.99] w-full text-left"
    >
      <Avatar name={name} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm truncate">{name}</span>
          <span className={cn('hidden sm:inline text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0', t.cls)}>
            {t.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{formatPhone(customer.phone)}</p>
      </div>

      {/* order count – hidden on very small */}
      <div className="hidden xs:flex flex-col items-end shrink-0 w-14">
        <span className="text-sm font-black tabular-nums">{customer.totalOrders}</span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">orders</span>
      </div>

      <div className="flex flex-col items-end shrink-0 w-20">
        <span className="text-sm font-black tabular-nums">{formatCurrency(customer.totalSpent)}</span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">spent</span>
      </div>
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CustomerManager({ tenantId }: CustomerManagerProps) {
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'direct' | 'swiggy' | 'zomato'>('all');
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(false);
  const [total, setTotal]           = useState(0);
  const [viewMode, setViewMode]     = useState<'list' | 'grid'>('list');

  const [isAddModalOpen, setIsAddModalOpen]     = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen]       = useState(false);

  const [formPhone, setFormPhone]   = useState('');
  const [formName, setFormName]     = useState('');
  const [formEmail, setFormEmail]   = useState('');
  const [formNotes, setFormNotes]   = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  const [csvText, setCsvText]           = useState('');
  const [isImporting, setIsImporting]   = useState(false);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);

  const ITEMS_PER_PAGE = 20;

  const loadCustomers = useCallback(async (resetPage = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const currentPage = resetPage ? 1 : page;
      if (resetPage) setPage(1);
      const response = await listCustomers(tenantId, {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchQuery || undefined,
        sortBy: 'created_at',
        sortOrder: 'desc',
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
      });
      if (response.success) {
        setCustomers(response.customers || []);
        setTotal(response.total || 0);
        setHasMore(response.pagination?.hasMore || false);
      } else {
        setCustomers([]); setTotal(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, page, searchQuery, sourceFilter]);

  useEffect(() => { loadCustomers(true); }, [tenantId]);
  useEffect(() => {
    const t = setTimeout(() => loadCustomers(true), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => { loadCustomers(true); }, [sourceFilter]);

  const handlePageChange = (n: number) => { setPage(n); loadCustomers(); };

  const openAddModal = (customer?: Customer) => {
    setFormPhone(customer?.phone || '');
    setFormName(customer?.name || '');
    setFormEmail(customer?.email || '');
    setFormNotes(customer?.notes || '');
    setSelectedCustomer(customer || null);
    setIsAddModalOpen(true);
  };

  const handleSave = async () => {
    if (!formPhone.trim()) { alert('Phone number is required'); return; }
    try {
      setIsSaving(true);
      await upsertCustomer(tenantId, {
        phone: formPhone.trim(),
        name: formName.trim() || undefined,
        email: formEmail.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
      setIsAddModalOpen(false);
      loadCustomers(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete ${customer.name || customer.phone}?`)) return;
    try {
      await deleteCustomer(tenantId, customer.id);
      setIsDetailsOpen(false);
      loadCustomers(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete customer');
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) { alert('Please paste CSV data'); return; }
    try {
      setIsImporting(true); setImportResult(null);
      const result = await importCustomersFromCSV(tenantId, csvText);
      setImportResult(result);
      if (result.success > 0) loadCustomers(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const viewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black tracking-tight">Customers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? '—' : total} registered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="h-9 px-3 rounded-xl border border-border bg-card text-xs font-bold hover:border-accent/50 hover:bg-surface-2 transition-all"
          >
            ↑ Import
          </button>
          <button
            onClick={() => openAddModal()}
            className="h-9 px-4 rounded-xl bg-accent text-white text-xs font-black tracking-wide hover:opacity-90 transition-opacity"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {/* ── Search + View Toggle ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/60 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm">✕</button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex h-10 rounded-xl border border-border bg-card overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            className={cn('w-10 flex items-center justify-center transition-colors', viewMode === 'list' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <rect x="1" y="3" width="14" height="2" rx="1" />
              <rect x="1" y="7" width="14" height="2" rx="1" />
              <rect x="1" y="11" width="14" height="2" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid view"
            className={cn('w-10 flex items-center justify-center transition-colors', viewMode === 'grid' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground')}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <rect x="1" y="1" width="6" height="6" rx="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Source filter chips ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { value: 'all',    label: 'All' },
          { value: 'direct', label: 'Direct' },
          { value: 'swiggy', label: 'Swiggy' },
          { value: 'zomato', label: 'Zomato' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setSourceFilter(value)}
            className={cn(
              'h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all duration-150',
              sourceFilter === value
                ? value === 'swiggy' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                : value === 'zomato' ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : value === 'direct' ? 'bg-accent/20 border-accent/50 text-accent'
                : 'bg-surface-2 border-border text-foreground'
                : 'bg-transparent border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
        {sourceFilter !== 'all' && (
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {isLoading ? '…' : `${total} found`}
          </span>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── List / Grid ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading customers…</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center text-2xl">👥</div>
            <p className="text-sm font-medium">No customers found</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-accent hover:underline mt-1">
                Clear search
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="flex flex-col gap-2">
            {customers.map(c => (
              <CustomerRow key={c.id} customer={c} onClick={() => viewDetails(c)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {customers.map(c => (
              <CustomerCard key={c.id} customer={c} onClick={() => viewDetails(c)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {total > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground tabular-nums">
            {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className={cn('h-8 px-3 rounded-lg text-xs font-bold border transition-colors', page === 1 ? 'opacity-40 cursor-not-allowed border-border' : 'border-border hover:border-accent/50 hover:bg-surface-2')}
            >
              ← Prev
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasMore}
              className={cn('h-8 px-3 rounded-lg text-xs font-bold border transition-colors', !hasMore ? 'opacity-40 cursor-not-allowed border-border' : 'border-border hover:border-accent/50 hover:bg-surface-2')}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-black text-base">{selectedCustomer ? 'Edit Customer' : 'New Customer'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-2 text-muted-foreground text-sm">✕</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { label: 'Phone *', value: formPhone, set: setFormPhone, type: 'tel', placeholder: '98765 43210', disabled: !!selectedCustomer },
                { label: 'Name', value: formName, set: setFormName, type: 'text', placeholder: 'Customer name' },
                { label: 'Email', value: formEmail, set: setFormEmail, type: 'email', placeholder: 'customer@example.com' },
              ].map(({ label, value, set, type, placeholder, disabled }) => (
                <div key={label}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full h-10 px-3 rounded-xl bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/60 disabled:opacity-50 transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Preferences, allergies…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/60 resize-none transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setIsAddModalOpen(false)} className="flex-1 h-10 rounded-xl border border-border text-xs font-bold hover:bg-surface-2 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 h-10 rounded-xl bg-accent text-white text-xs font-black hover:opacity-90 disabled:opacity-60 transition-opacity">
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-black text-base">Import Customers</h3>
                <p className="text-xs text-muted-foreground mt-0.5">CSV columns: phone, name, email, address, location, notes</p>
              </div>
              <button onClick={() => { setIsImportModalOpen(false); setCsvText(''); setImportResult(null); }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-2 text-muted-foreground text-sm mt-0.5">✕</button>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`phone,name,email\n9876543210,Rahul Sharma,rahul@example.com\n9900024260,Priya Nair,`}
                rows={9}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:border-accent/60 resize-none transition-colors"
              />
              {importResult && (
                <div className={cn('mt-3 p-3 rounded-xl text-sm', importResult.failed > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20')}>
                  <p className="font-bold">{importResult.success} of {importResult.total} imported</p>
                  {importResult.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground mt-1">Row {e.row}: {e.error}</p>
                  ))}
                  {importResult.errors.length > 5 && <p className="text-xs text-muted-foreground mt-1">…and {importResult.errors.length - 5} more errors</p>}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => { setIsImportModalOpen(false); setCsvText(''); setImportResult(null); }} className="flex-1 h-10 rounded-xl border border-border text-xs font-bold hover:bg-surface-2 transition-colors">Close</button>
              <button onClick={handleImport} disabled={isImporting || !csvText.trim()} className="flex-1 h-10 rounded-xl bg-accent text-white text-xs font-black hover:opacity-90 disabled:opacity-50 transition-opacity">
                {isImporting ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Customer Details Modal ── */}
      {isDetailsOpen && selectedCustomer && (() => {
        const t = tier(selectedCustomer.totalOrders, selectedCustomer.totalSpent);
        const name = selectedCustomer.name || 'Unnamed';
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

              {/* Hero */}
              <div className="relative px-5 pt-8 pb-6 flex flex-col items-center text-center bg-gradient-to-b from-surface-2 to-card border-b border-border">
                <button onClick={() => setIsDetailsOpen(false)} className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-card text-muted-foreground text-sm">✕</button>
                <Avatar name={name} size="lg" />
                <h3 className="mt-3 font-black text-lg leading-tight">{name}</h3>
                <p className="text-sm text-muted-foreground tabular-nums mt-0.5">{formatPhone(selectedCustomer.phone)}</p>
                {selectedCustomer.email && <p className="text-xs text-muted-foreground mt-0.5">{selectedCustomer.email}</p>}
                <span className={cn('mt-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border', t.cls)}>{t.label}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[
                  { value: selectedCustomer.totalOrders, label: 'Orders' },
                  { value: formatCurrency(selectedCustomer.totalSpent), label: 'Spent' },
                  { value: formatCurrency(selectedCustomer.averageOrderValue), label: 'Avg Order' },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center justify-center py-4 px-2">
                    <span className="text-xl font-black tabular-nums leading-none">{value}</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{label}</span>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="px-5 py-4 space-y-2 text-sm max-h-48 overflow-auto">
                {[
                  { label: 'First order', value: formatDate(selectedCustomer.firstOrderDate) },
                  { label: 'Last order', value: formatDate(selectedCustomer.lastOrderDate) },
                  { label: 'Member since', value: formatDate(selectedCustomer.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-muted-foreground text-xs">{label}</span>
                    <span className="font-medium text-xs tabular-nums">{value}</span>
                  </div>
                ))}
                {selectedCustomer.notes && (
                  <div className="mt-2 p-3 rounded-xl bg-surface-2 text-xs text-muted-foreground">{selectedCustomer.notes}</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-5 pb-5">
                <button onClick={() => handleDelete(selectedCustomer)} className="h-9 px-3 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors">
                  Delete
                </button>
                <div className="flex-1 flex gap-2">
                  <button
                    onClick={() => { setIsDetailsOpen(false); openAddModal(selectedCustomer); }}
                    className="flex-1 h-9 rounded-xl border border-border text-xs font-bold hover:bg-surface-2 transition-colors"
                  >
                    Edit
                  </button>
                  <button onClick={() => setIsDetailsOpen(false)} className="flex-1 h-9 rounded-xl bg-accent text-white text-xs font-black hover:opacity-90 transition-opacity">
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default CustomerManager;
