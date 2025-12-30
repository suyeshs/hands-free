/**
 * Inventory Dashboard Page
 * Main inventory management interface with summary, alerts, and item management
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../stores/inventoryStore';
import { useTenantStore } from '../stores/tenantStore';
import { InventoryList } from '../components/inventory/InventoryList';
import {
  InventoryItem,
  InventoryCategory,
  CreateInventoryItemInput,
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  InventoryUnit,
} from '../types/inventory';
import { cn } from '../lib/utils';

export function InventoryDashboard() {
  const navigate = useNavigate();
  const { tenant } = useTenantStore();
  const tenantId = tenant?.tenantId;
  const {
    items,
    suppliers,
    summary,
    lowStockAlerts,
    expiryAlerts,
    isLoading,
    error,
    loadInventory,
    loadSuppliers,
    loadSummary,
    loadAlerts,
    addItem,
    updateItem,
    adjustStock,
    deleteItem,
  } = useInventoryStore();

  // Modal states
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form state for add/edit
  const [formData, setFormData] = useState<CreateInventoryItemInput>({
    name: '',
    category: 'other',
    unit: 'pcs',
    currentStock: 0,
    reorderLevel: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load data on mount
  useEffect(() => {
    if (tenantId) {
      loadInventory(tenantId);
      loadSuppliers(tenantId);
      loadSummary(tenantId);
      loadAlerts(tenantId);
    }
  }, [tenantId]);

  // Handle edit item
  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      pricePerUnit: item.pricePerUnit,
      reorderLevel: item.reorderLevel,
      supplierId: item.supplierId,
      storageLocation: item.storageLocation,
      expiryDate: item.expiryDate,
    });
    setShowAddItem(true);
  };

  // Handle save (add or update)
  const handleSave = async () => {
    if (!tenantId || !formData.name) return;

    setIsSaving(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, formData, tenantId);
      } else {
        await addItem(formData, tenantId);
      }
      setShowAddItem(false);
      setEditingItem(null);
      setFormData({
        name: '',
        category: 'other',
        unit: 'pcs',
        currentStock: 0,
        reorderLevel: 0,
      });
      // Refresh data
      loadSummary(tenantId);
      loadAlerts(tenantId);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle stock adjustment
  const handleAdjustStock = async (itemId: string, change: number, reason: string) => {
    if (!tenantId) return;
    const transactionType = change > 0 ? 'purchase' : 'adjustment';
    await adjustStock(itemId, change, transactionType, reason, tenantId);
    loadSummary(tenantId);
    loadAlerts(tenantId);
  };

  // Handle delete
  const handleDelete = async (itemId: string) => {
    if (!tenantId) return;
    await deleteItem(itemId, tenantId);
    loadSummary(tenantId);
    loadAlerts(tenantId);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-slate-400">Track stock levels and manage supplies</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/inventory/scan')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            <span>📷</span>
            Scan Bill
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({
                name: '',
                category: 'other',
                unit: 'pcs',
                currentStock: 0,
                reorderLevel: 0,
              });
              setShowAddItem(true);
            }}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            <span>+</span>
            Add Item
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-blue-400">{summary?.totalItems || 0}</div>
          <div className="text-sm text-slate-400">Total Items</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-green-400">
            Rs. {(summary?.totalValue || 0).toLocaleString()}
          </div>
          <div className="text-sm text-slate-400">Total Value</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-red-400">{summary?.lowStockCount || 0}</div>
          <div className="text-sm text-slate-400">Low Stock Items</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-yellow-400">{summary?.expiringSoonCount || 0}</div>
          <div className="text-sm text-slate-400">Expiring Soon</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {summary?.byCategory && (
        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <h3 className="font-bold mb-3">By Category</h3>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {Object.entries(INVENTORY_CATEGORIES).map(([key, { label, icon }]) => {
              const categoryData = summary.byCategory[key as InventoryCategory];
              return (
                <div
                  key={key}
                  className="text-center p-2 bg-slate-700/50 rounded-lg"
                >
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-sm font-medium">{categoryData?.count || 0}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {(lowStockAlerts.length > 0 || expiryAlerts.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Low Stock Alerts */}
          {lowStockAlerts.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <h3 className="font-bold text-red-400 mb-3 flex items-center gap-2">
                <span>⚠️</span>
                Low Stock ({lowStockAlerts.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {lowStockAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.item.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span>{alert.item.name}</span>
                    <span className="text-red-400">
                      {alert.currentStock} / {alert.reorderLevel}{' '}
                      {INVENTORY_UNITS[alert.item.unit]?.abbreviation}
                    </span>
                  </div>
                ))}
                {lowStockAlerts.length > 5 && (
                  <div className="text-xs text-slate-500 text-center pt-2">
                    +{lowStockAlerts.length - 5} more items
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expiring Soon Alerts */}
          {expiryAlerts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <h3 className="font-bold text-yellow-400 mb-3 flex items-center gap-2">
                <span>⏰</span>
                Expiring Soon ({expiryAlerts.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {expiryAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.item.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span>{alert.item.name}</span>
                    <span
                      className={cn(
                        alert.daysUntilExpiry <= 3 ? 'text-red-400' : 'text-yellow-400'
                      )}
                    >
                      {alert.daysUntilExpiry <= 0
                        ? 'Expired'
                        : `${alert.daysUntilExpiry} days`}
                    </span>
                  </div>
                ))}
                {expiryAlerts.length > 5 && (
                  <div className="text-xs text-slate-500 text-center pt-2">
                    +{expiryAlerts.length - 5} more items
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory List */}
      <div className="bg-slate-800/50 rounded-xl p-4">
        <InventoryList
          items={items}
          onAdjustStock={handleAdjustStock}
          onEditItem={handleEditItem}
          onDeleteItem={handleDelete}
          isLoading={isLoading}
        />
      </div>

      {/* Add/Edit Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-400 mb-2">Item Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Tomatoes"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">SKU (Optional)</label>
                <input
                  type="text"
                  value={formData.sku || ''}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., TOM-001"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as InventoryCategory })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(INVENTORY_CATEGORIES).map(([key, { label, icon }]) => (
                    <option key={key} value={key}>
                      {icon} {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Stock */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Current Stock</label>
                <input
                  type="number"
                  value={formData.currentStock || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Unit *</label>
                <select
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value as InventoryUnit })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(INVENTORY_UNITS).map(([key, { label, abbreviation }]) => (
                    <option key={key} value={key}>
                      {label} ({abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price per Unit */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Price per Unit (Rs.)</label>
                <input
                  type="number"
                  value={formData.pricePerUnit || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || undefined })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>

              {/* Reorder Level */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Reorder Level</label>
                <input
                  type="number"
                  value={formData.reorderLevel || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Supplier</label>
                <select
                  value={formData.supplierId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, supplierId: e.target.value || undefined })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Storage Location */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Storage Location</label>
                <input
                  type="text"
                  value={formData.storageLocation || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, storageLocation: e.target.value || undefined })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Fridge 1, Dry Storage"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, expiryDate: e.target.value || undefined })
                  }
                  className="w-full bg-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddItem(false);
                  setEditingItem(null);
                }}
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
                {isSaving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
