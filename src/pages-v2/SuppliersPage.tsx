/**
 * Suppliers Management Page
 * Add, edit, and manage vendor/supplier information
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../stores/inventoryStore';
import { useTenantStore } from '../stores/tenantStore';
import { Supplier, CreateSupplierInput } from '../types/inventory';

export function SuppliersPage() {
  const navigate = useNavigate();
  const { tenant } = useTenantStore();
  const tenantId = tenant?.tenantId;
  const {
    suppliers,
    isLoading,
    error,
    loadSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  } = useInventoryStore();

  // Modal states
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateSupplierInput>({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    paymentTerms: 'net_30',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load suppliers on mount
  useEffect(() => {
    if (tenantId) {
      loadSuppliers(tenantId);
    }
  }, [tenantId]);

  // Filter suppliers
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.contactName?.toLowerCase().includes(query) ||
      supplier.phone?.toLowerCase().includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    );
  });

  // Handle edit
  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      gstin: supplier.gstin || '',
      paymentTerms: supplier.paymentTerms || 'net_30',
    });
    setShowAddSupplier(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!tenantId || !formData.name) return;

    setIsSaving(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formData, tenantId);
      } else {
        await addSupplier(formData, tenantId);
      }
      setShowAddSupplier(false);
      setEditingSupplier(null);
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!tenantId || !deleteConfirm) return;

    setIsSaving(true);
    try {
      await deleteSupplier(deleteConfirm.id, tenantId);
      setDeleteConfirm(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      gstin: '',
      paymentTerms: 'net_30',
    });
  };

  // Close modal
  const closeModal = () => {
    setShowAddSupplier(false);
    setEditingSupplier(null);
    resetForm();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => navigate('/inventory')}
              className="text-slate-400 hover:text-white mb-2 flex items-center gap-2 text-sm"
            >
              <span>←</span>
              Back to Inventory
            </button>
            <h1 className="text-2xl font-bold">Suppliers / Vendors</h1>
            <p className="text-slate-400">Manage your supplier contacts and information</p>
          </div>
          <button
            onClick={() => {
              setEditingSupplier(null);
              resetForm();
              setShowAddSupplier(true);
            }}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            <span>+</span>
            Add Supplier
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers..."
            className="w-full bg-slate-800 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="mx-6 bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Suppliers List */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-6 pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold mb-2">
              {searchQuery ? 'No suppliers found' : 'No suppliers yet'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first supplier to start tracking vendors'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddSupplier(true);
                }}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
              >
                Add First Supplier
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="bg-slate-800 rounded-xl p-4 hover:bg-slate-700/80 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg">{supplier.name}</h3>
                    {supplier.contactName && (
                      <p className="text-sm text-slate-400">{supplier.contactName}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(supplier)}
                      className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(supplier)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <span>📞</span>
                      <a href={`tel:${supplier.phone}`} className="hover:text-blue-400">
                        {supplier.phone}
                      </a>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <span>📧</span>
                      <a href={`mailto:${supplier.email}`} className="hover:text-blue-400">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-slate-400">
                      <span>📍</span>
                      <span className="line-clamp-2">{supplier.address}</span>
                    </div>
                  )}
                  {supplier.gstin && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>🏢</span>
                      <span>GSTIN: {supplier.gstin}</span>
                    </div>
                  )}
                </div>

                {supplier.paymentTerms && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300">
                      {supplier.paymentTerms === 'cod'
                        ? 'Cash on Delivery'
                        : supplier.paymentTerms === 'net_7'
                        ? 'Net 7 Days'
                        : supplier.paymentTerms === 'net_15'
                        ? 'Net 15 Days'
                        : supplier.paymentTerms === 'net_30'
                        ? 'Net 30 Days'
                        : supplier.paymentTerms === 'net_60'
                        ? 'Net 60 Days'
                        : supplier.paymentTerms}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6">
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Supplier Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Fresh Farms Pvt Ltd"
                />
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactName || ''}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Rajesh Kumar"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., +91 98765 43210"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., contact@freshfarms.com"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Address</label>
                <textarea
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="e.g., 123 Market Street, Bangalore"
                />
              </div>

              {/* GSTIN */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">GSTIN (Tax ID)</label>
                <input
                  type="text"
                  value={formData.gstin || ''}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 29AABCU9603R1ZM"
                  maxLength={15}
                />
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Payment Terms</label>
                <select
                  value={formData.paymentTerms || 'net_30'}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cod">Cash on Delivery</option>
                  <option value="net_7">Net 7 Days</option>
                  <option value="net_15">Net 15 Days</option>
                  <option value="net_30">Net 30 Days</option>
                  <option value="net_60">Net 60 Days</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={isSaving}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold transition-colors"
              >
                {isSaving ? 'Saving...' : editingSupplier ? 'Update' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Delete Supplier?</h3>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm.name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isSaving}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl font-bold transition-colors"
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
