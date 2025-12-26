/**
 * Customer Manager Component
 * Provides customer management functionality for POS
 *
 * Features:
 * - List customers with search and pagination
 * - Add/edit customer details
 * - Bulk import from CSV
 * - View customer order history and preferences
 */

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

export function CustomerManager({ tenantId }: CustomerManagerProps) {
  // List state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Form state
  const [formPhone, setFormPhone] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Import state
  const [csvText, setCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<CustomerImportResult | null>(null);

  const ITEMS_PER_PAGE = 20;

  // Load customers
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
      });

      if (response.success) {
        setCustomers(response.customers || []);
        setTotal(response.total || 0);
        setHasMore(response.pagination?.hasMore || false);
      } else {
        setCustomers([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customers');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, page, searchQuery]);

  // Initial load
  useEffect(() => {
    loadCustomers(true);
  }, [tenantId]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadCustomers();
  };

  // Open add modal
  const openAddModal = (customer?: Customer) => {
    if (customer) {
      setFormPhone(customer.phone);
      setFormName(customer.name || '');
      setFormEmail(customer.email || '');
      setFormNotes(customer.notes || '');
      setSelectedCustomer(customer);
    } else {
      setFormPhone('');
      setFormName('');
      setFormEmail('');
      setFormNotes('');
      setSelectedCustomer(null);
    }
    setIsAddModalOpen(true);
  };

  // Save customer
  const handleSave = async () => {
    if (!formPhone.trim()) {
      alert('Phone number is required');
      return;
    }

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

  // Delete customer
  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete customer ${customer.name || customer.phone}?`)) {
      return;
    }

    try {
      await deleteCustomer(tenantId, customer.id);
      loadCustomers(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete customer');
    }
  };

  // Handle CSV import
  const handleImport = async () => {
    if (!csvText.trim()) {
      alert('Please paste CSV data');
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      const result = await importCustomersFromCSV(tenantId, csvText);
      setImportResult(result);

      if (result.success > 0) {
        loadCustomers(true);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // View customer details
  const viewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
  };

  // Format phone for display
  const formatPhone = (phone: string) => {
    if (phone.startsWith('+91') && phone.length === 13) {
      return `${phone.slice(0, 3)} ${phone.slice(3, 8)} ${phone.slice(8)}`;
    }
    return phone;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Customers</h2>
          <p className="text-xs text-muted-foreground">
            {total} customers registered
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 rounded-lg neo-raised-sm text-xs font-bold uppercase tracking-wider hover:bg-surface-2 transition-colors"
          >
            📥 Import
          </button>
          <button
            onClick={() => openAddModal()}
            className="px-3 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider"
          >
            + Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-neo w-full"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Customer List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <span className="text-3xl mb-2">👥</span>
            <p className="text-sm">No customers found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="glass-panel p-3 rounded-xl border border-border hover:border-accent/50 transition-colors cursor-pointer"
                onClick={() => viewDetails(customer)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold truncate">
                        {customer.name || 'Unnamed'}
                      </span>
                      {customer.totalOrders > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent rounded-full">
                          {customer.totalOrders} orders
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatPhone(customer.phone)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">
                      {formatCurrency(customer.totalSpent)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Total spent
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold",
                page === 1 ? "opacity-50 cursor-not-allowed" : "neo-raised-sm hover:bg-surface-2"
              )}
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={!hasMore}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold",
                !hasMore ? "opacity-50 cursor-not-allowed" : "neo-raised-sm hover:bg-surface-2"
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold text-lg">
                {selectedCustomer ? 'Edit Customer' : 'Add Customer'}
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="input-neo w-full"
                  disabled={!!selectedCustomer}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Customer name"
                  className="input-neo w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="input-neo w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1">
                  Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Special preferences, allergies, etc."
                  rows={3}
                  className="input-neo w-full resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-lg neo-raised-sm text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold text-lg">Import Customers</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Paste CSV data with columns: phone, name, email, address, location, notes
              </p>
            </div>
            <div className="p-4">
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`phone,name,email,address,location,notes
+919876543210,John Doe,john@example.com,123 Main St,Banashankari,VIP customer
9900024260,Jane Smith,,456 2nd Ave,Koramangala,`}
                rows={10}
                className="input-neo w-full font-mono text-xs resize-none"
              />

              {/* Import Result */}
              {importResult && (
                <div className={cn(
                  "mt-4 p-3 rounded-lg text-sm",
                  importResult.failed > 0
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-green-500/10 border border-green-500/30"
                )}>
                  <div className="font-bold">
                    Imported {importResult.success} of {importResult.total} customers
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground max-h-32 overflow-auto">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <div key={i}>Row {err.row}: {err.error}</div>
                      ))}
                      {importResult.errors.length > 5 && (
                        <div>...and {importResult.errors.length - 5} more errors</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setCsvText('');
                  setImportResult(null);
                }}
                className="px-4 py-2 rounded-lg neo-raised-sm text-xs font-bold uppercase"
              >
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || !csvText.trim()}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase",
                  isImporting || !csvText.trim()
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-accent text-white"
                )}
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {isDetailsOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-border flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">
                  {selectedCustomer.name || 'Customer Details'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatPhone(selectedCustomer.phone)}
                </p>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="w-8 h-8 rounded-lg neo-raised-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 neo-inset-sm rounded-lg">
                  <div className="text-xl font-bold">{selectedCustomer.totalOrders}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Orders</div>
                </div>
                <div className="text-center p-3 neo-inset-sm rounded-lg">
                  <div className="text-xl font-bold">{formatCurrency(selectedCustomer.totalSpent)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Spent</div>
                </div>
                <div className="text-center p-3 neo-inset-sm rounded-lg">
                  <div className="text-xl font-bold">{formatCurrency(selectedCustomer.averageOrderValue)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Avg Order</div>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-2 text-sm">
                {selectedCustomer.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.firstOrderDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">First Order</span>
                    <span>{new Date(selectedCustomer.firstOrderDate).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedCustomer.lastOrderDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Order</span>
                    <span>{new Date(selectedCustomer.lastOrderDate).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member Since</span>
                  <span>{new Date(selectedCustomer.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Preferences */}
              {selectedCustomer.preferences && (
                <div className="p-3 neo-inset-sm rounded-lg">
                  <div className="text-[10px] font-black uppercase text-muted-foreground mb-2">
                    Preferences
                  </div>
                  <div className="text-xs space-y-1">
                    {selectedCustomer.preferences.spice_preference && (
                      <div>Spice: {selectedCustomer.preferences.spice_preference}</div>
                    )}
                    {(selectedCustomer.preferences.dietary_preferences?.length ?? 0) > 0 && (
                      <div>Diet: {selectedCustomer.preferences.dietary_preferences!.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCustomer.notes && (
                <div className="p-3 neo-inset-sm rounded-lg">
                  <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">
                    Notes
                  </div>
                  <div className="text-xs">{selectedCustomer.notes}</div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-between">
              <button
                onClick={() => handleDelete(selectedCustomer)}
                className="px-4 py-2 rounded-lg text-red-500 hover:bg-red-500/10 text-xs font-bold uppercase"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsDetailsOpen(false);
                    openAddModal(selectedCustomer);
                  }}
                  className="px-4 py-2 rounded-lg neo-raised-sm text-xs font-bold uppercase"
                >
                  Edit
                </button>
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerManager;
