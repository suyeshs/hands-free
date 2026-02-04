/**
 * Inventory Dashboard Page
 * Main inventory management interface with summary, alerts, and item management
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../stores/inventoryStore';
import { useTenantStore } from '../stores/tenantStore';
import { InventoryList } from '../components/inventory/InventoryList';
import RecipeManager from '../components/admin/RecipeManager';
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
    isSyncing,
    lastSyncedAt,
    pendingSyncCount,
    loadInventory,
    loadSuppliers,
    loadSummary,
    loadAlerts,
    addItem,
    updateItem,
    adjustStock,
    deleteItem,
  } = useInventoryStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<'inventory' | 'recipes'>('inventory');

  // Modal states
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="settings-header">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/hub')}
              className="p-2 hover:bg-surface-2 transition-colors rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Inventory Management</h1>
              <p className="text-sm text-muted-foreground">Track stock levels and manage supplies</p>
            </div>
          </div>
        </div>
      </header>

      {/* Action Bar & Tabs */}
      <div className="flex-shrink-0 px-6 pt-3">
        <div className="flex items-center justify-between mb-3">
          {/* Sync Status Indicators */}
          <div className="flex items-center gap-3">
            {isSyncing && (
              <div className="flex items-center gap-2 text-info text-sm">
                <div className="w-3 h-3 border-2 border-info border-t-transparent rounded-full animate-spin"></div>
                <span>Syncing...</span>
              </div>
            )}

            {pendingSyncCount > 0 && !isSyncing && (
              <div className="flex items-center gap-2 bg-warning-light border border-warning/30 px-3 py-1 rounded-full text-warning text-sm">
                <span>⏳</span>
                <span>{pendingSyncCount} change{pendingSyncCount !== 1 ? 's' : ''} pending sync</span>
              </div>
            )}

            {!isOnline && (
              <div className="flex items-center gap-2 bg-destructive-light border border-destructive/30 px-3 py-1 rounded-full text-destructive text-sm">
                <span>⚠️</span>
                <span>Offline - changes will sync when online</span>
              </div>
            )}

            {lastSyncedAt && !isSyncing && (
              <div className="text-muted-foreground text-xs">
                Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {activeTab === 'inventory' && (
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/inventory/suppliers')}
                className="px-4 py-2 neo-raised-sm hover:neo-hover font-medium transition-all flex items-center gap-2 text-sm"
              >
                <span>🏢</span>
                Suppliers ({suppliers.length})
              </button>
              <button
                onClick={() => navigate('/inventory/scan')}
                className="px-4 py-2 neo-raised-sm bg-info/10 hover:bg-info/20 text-info font-medium transition-all flex items-center gap-2 text-sm"
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
                className="px-4 py-2 neo-raised-sm bg-success/10 hover:bg-success/20 text-success font-medium transition-all flex items-center gap-2 text-sm"
              >
                <span>+</span>
                Add Item
              </button>
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab('inventory')}
            className={cn(
              "px-6 py-3 font-medium transition-colors relative",
              activeTab === 'inventory'
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            📦 Inventory
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={cn(
              "px-6 py-3 font-medium transition-colors relative flex items-center gap-2",
              activeTab === 'recipes'
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>🧪</span>
            <span>Recipe Management</span>
            <span className="px-2 py-0.5 bg-info/20 text-info text-xs rounded-full">AI</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain p-6 pt-4">
      {activeTab === 'inventory' ? (
        <>
      {/* Error Display */}
      {error && (
        <div className="neo-raised-sm bg-destructive-light border border-destructive/30 p-4 mb-6 text-destructive">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="neo-raised p-5">
          <div className="text-3xl font-bold text-info">{summary?.totalItems || 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Total Items</div>
        </div>
        <div className="neo-raised p-5">
          <div className="text-3xl font-bold text-success">
            Rs. {(summary?.totalValue || 0).toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground mt-1">Total Value</div>
        </div>
        <div className="neo-raised p-5">
          <div className="text-3xl font-bold text-destructive">{summary?.lowStockCount || 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Low Stock Items</div>
        </div>
        <div className="neo-raised p-5">
          <div className="text-3xl font-bold text-warning">{summary?.expiringSoonCount || 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Expiring Soon</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {summary && (summary.byCategory || summary.categoryBreakdown) && (
        <div className="neo-raised p-5 mb-6">
          <h3 className="font-bold mb-4 text-foreground">By Category</h3>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {Object.entries(INVENTORY_CATEGORIES).map(([key, { label, icon }]) => {
              const categoryData = summary.byCategory?.[key as InventoryCategory] || summary.categoryBreakdown?.[key];
              return (
                <div
                  key={key}
                  className="text-center p-3 neo-inset-sm hover:neo-raised-sm transition-all"
                >
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-sm font-medium text-foreground">{categoryData?.count || 0}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
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
            <div className="neo-raised bg-destructive-light border border-destructive/30 p-5">
              <h3 className="font-bold text-destructive mb-3 flex items-center gap-2">
                <span>⚠️</span>
                Low Stock ({lowStockAlerts.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {lowStockAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.itemId}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-foreground">{alert.itemName}</span>
                    <span className="text-destructive font-medium">
                      {alert.currentStock} / {alert.reorderLevel}{' '}
                      {INVENTORY_UNITS[alert.unit as InventoryUnit]?.abbreviation || alert.unit}
                    </span>
                  </div>
                ))}
                {lowStockAlerts.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    +{lowStockAlerts.length - 5} more items
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expiring Soon Alerts */}
          {expiryAlerts.length > 0 && (
            <div className="neo-raised bg-warning-light border border-warning/30 p-5">
              <h3 className="font-bold text-warning mb-3 flex items-center gap-2">
                <span>⏰</span>
                Expiring Soon ({expiryAlerts.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {expiryAlerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.itemId}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-foreground">{alert.itemName}</span>
                    <span
                      className={cn(
                        'font-medium',
                        alert.daysUntilExpiry <= 3 ? 'text-destructive' : 'text-warning'
                      )}
                    >
                      {alert.daysUntilExpiry <= 0
                        ? 'Expired'
                        : `${alert.daysUntilExpiry} days`}
                    </span>
                  </div>
                ))}
                {expiryAlerts.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center pt-2">
                    +{expiryAlerts.length - 5} more items
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventory List */}
      <div className="neo-raised p-5">
        <InventoryList
          items={items}
          onAdjustStock={handleAdjustStock}
          onEditItem={handleEditItem}
          onDeleteItem={handleDelete}
          isLoading={isLoading}
        />
      </div>
      </>
      ) : (
        /* Recipe Management Tab */
        <div className="h-full bg-white rounded-lg">
          <RecipeManager />
        </div>
      )}
      </main>

      {/* Add/Edit Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-foreground">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="md:col-span-2">
                <label className="block text-sm text-muted-foreground mb-2">Item Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  placeholder="e.g., Tomatoes"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">SKU (Optional)</label>
                <input
                  type="text"
                  value={formData.sku || ''}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  placeholder="e.g., TOM-001"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as InventoryCategory })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
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
                <label className="block text-sm text-muted-foreground mb-2">Current Stock</label>
                <input
                  type="number"
                  value={formData.currentStock || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Unit *</label>
                <select
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value as InventoryUnit })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
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
                <label className="block text-sm text-muted-foreground mb-2">Price per Unit (Rs.)</label>
                <input
                  type="number"
                  value={formData.pricePerUnit || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || undefined })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>

              {/* Reorder Level */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Reorder Level</label>
                <input
                  type="number"
                  value={formData.reorderLevel || 0}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  step="0.01"
                  min="0"
                />
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Supplier</label>
                <select
                  value={formData.supplierId || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, supplierId: e.target.value || undefined })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
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
                <label className="block text-sm text-muted-foreground mb-2">Storage Location</label>
                <input
                  type="text"
                  value={formData.storageLocation || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, storageLocation: e.target.value || undefined })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                  placeholder="e.g., Fridge 1, Dry Storage"
                />
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, expiryDate: e.target.value || undefined })
                  }
                  className="w-full neo-inset px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
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
                className="flex-1 py-3 neo-raised-sm hover:neo-hover disabled:opacity-50 font-bold transition-all rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name}
                className="flex-1 py-3 neo-raised-sm bg-primary/20 hover:bg-primary/30 text-primary disabled:opacity-50 font-bold transition-all rounded-lg"
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
