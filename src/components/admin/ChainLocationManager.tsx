/**
 * Chain Location Manager
 * Admin panel for configuring multi-location/brand setup
 * Allows chain owners to add and manage all their restaurant locations
 */

import { useState, useEffect } from 'react';
import { useChainConfigStore, ChainLocation } from '../../stores/chainConfigStore';
import { useChainSalesStore } from '../../stores/chainSalesStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';
import { Plus, Edit2, Trash2, Power, PowerOff, Check, X } from 'lucide-react';

export default function ChainLocationManager() {
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const {
    locations,
    isLoading,
    error,
    loadLocations,
    addLocation,
    updateLocation,
    removeLocation,
    toggleLocationActive,
    clearError,
  } = useChainConfigStore();

  const { addLocation: addToSalesStore } = useChainSalesStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ChainLocation | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    locationName: '',
    tenantId: '',
    locationId: '',
    isActive: true,
    isPrimary: false,
  });

  // Load locations on mount
  useEffect(() => {
    const parentTenantId = tenant?.tenantId || user?.tenantId;
    if (parentTenantId) {
      loadLocations(parentTenantId);
    }
  }, [tenant?.tenantId, user?.tenantId]);

  // Sync active locations to chainSalesStore
  useEffect(() => {
    const activeLocations = locations.filter((loc) => loc.isActive);
    activeLocations.forEach((loc) => {
      addToSalesStore({
        locationId: loc.locationId,
        locationName: loc.locationName,
        tenantId: loc.tenantId,
        isActive: loc.isActive,
      });
    });
  }, [locations]);

  const handleAddLocation = async () => {
    try {
      await addLocation(formData);
      setShowAddModal(false);
      setFormData({
        locationName: '',
        tenantId: '',
        locationId: '',
        isActive: true,
        isPrimary: false,
      });
    } catch (err) {
      console.error('Failed to add location:', err);
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation) return;

    try {
      await updateLocation(editingLocation.id, formData);
      setEditingLocation(null);
      setFormData({
        locationName: '',
        tenantId: '',
        locationId: '',
        isActive: true,
        isPrimary: false,
      });
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  };

  const handleEdit = (location: ChainLocation) => {
    setEditingLocation(location);
    setFormData({
      locationName: location.locationName,
      tenantId: location.tenantId,
      locationId: location.locationId,
      isActive: location.isActive,
      isPrimary: location.isPrimary,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this location?')) return;

    try {
      await removeLocation(id);
    } catch (err) {
      console.error('Failed to remove location:', err);
    }
  };

  return (
    <div className="glass-panel-dark p-6 rounded-2xl border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Chain Locations Manager</h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure all restaurant locations for real-time sales aggregation
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors rounded-lg font-bold text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isLoading && locations.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading locations...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">No locations configured yet</p>
          <p className="text-sm text-slate-500">
            Add your first location to start tracking multi-location sales
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((location) => (
            <div
              key={location.id}
              className={cn(
                'p-4 rounded-lg border transition-colors',
                location.isActive
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-slate-800/20 border-slate-700/50 opacity-60'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{location.locationName}</h3>
                    {location.isPrimary && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs font-bold">
                        PRIMARY
                      </span>
                    )}
                    {location.isActive ? (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-xs font-bold">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded text-xs font-bold">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-400">Tenant ID:</span>
                      <span className="ml-2 font-mono text-slate-300">{location.tenantId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Location ID:</span>
                      <span className="ml-2 font-mono text-slate-300">{location.locationId}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleLocationActive(location.id)}
                    className={cn(
                      'p-2 rounded transition-colors',
                      location.isActive
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    )}
                    title={location.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {location.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(location)}
                    className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(location.id)}
                    className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingLocation) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-panel-dark p-6 rounded-2xl border border-slate-700 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  Location Name
                </label>
                <input
                  type="text"
                  value={formData.locationName}
                  onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                  placeholder="Downtown Branch"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  placeholder="tenant-abc-123"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  Location ID
                </label>
                <input
                  type="text"
                  value={formData.locationId}
                  onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                  placeholder="loc-downtown-01"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold">Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPrimary}
                    onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold">Primary Location</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLocation(null);
                  setFormData({
                    locationName: '',
                    tenantId: '',
                    locationId: '',
                    isActive: true,
                    isPrimary: false,
                  });
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 transition-colors rounded-lg font-bold"
              >
                Cancel
              </button>
              <button
                onClick={editingLocation ? handleUpdateLocation : handleAddLocation}
                disabled={!formData.locationName || !formData.tenantId || !formData.locationId}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingLocation ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
