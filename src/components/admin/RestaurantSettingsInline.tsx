/**
 * Restaurant Settings Inline Component
 * Same as RestaurantSettings but without the modal wrapper - for use in full-page views
 */

import { useState, useEffect } from 'react';
import { useRestaurantSettingsStore, RestaurantDetails } from '../../stores/restaurantSettingsStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { cn } from '../../lib/utils';

export function RestaurantSettingsInline() {
  const { settings, updateSettings, isConfigured, syncFromCloud, syncToCloud, isSyncing, lastSyncedAt } = useRestaurantSettingsStore();
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const tenantId = user?.tenantId || tenant?.tenantId || '';

  const [activeTab, setActiveTab] = useState<'basic' | 'legal' | 'invoice' | 'tax' | 'print' | 'pos'>('basic');
  const [formData, setFormData] = useState<RestaurantDetails>(settings);
  const [isSaving, setIsSaving] = useState(false);

  // Sync from cloud on mount
  useEffect(() => {
    if (tenantId) {
      syncFromCloud(tenantId);
    }
  }, [tenantId]);

  // Update form data when settings change (e.g., after cloud sync)
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      const [parent, child] = keys;
      return {
        ...prev,
        [parent]: {
          ...(prev[parent as keyof RestaurantDetails] as object),
          [child]: value,
        },
      };
    });
  };

  const Toggle = ({ enabled, onChange, label, description }: {
    enabled: boolean;
    onChange: (val: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-white">{label}</h3>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative w-14 h-7 rounded-full transition-colors',
          enabled ? 'bg-blue-600' : 'bg-slate-600'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
            enabled ? 'translate-x-8' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save locally first
      updateSettings(formData);

      // Then sync to cloud
      if (tenantId) {
        await syncToCloud(tenantId);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '🏪' },
    { id: 'legal', label: 'Legal & Tax IDs', icon: '📋' },
    { id: 'invoice', label: 'Invoice', icon: '🧾' },
    { id: 'tax', label: 'Tax & Charges', icon: '💰' },
    { id: 'print', label: 'Print', icon: '🖨️' },
    { id: 'pos', label: 'POS', icon: '👤' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-slate-700 bg-slate-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Restaurant Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter restaurant name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline || ''}
                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Authentic Indian Cuisine"
                />
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-sm font-semibold text-white mb-4">Address</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.address.line1}
                  onChange={(e) => handleInputChange('address.line1', e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Address Line 1"
                />
                <input
                  type="text"
                  value={formData.address.line2 || ''}
                  onChange={(e) => handleInputChange('address.line2', e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Address Line 2"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="State"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.pincode}
                    onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Pincode"
                    maxLength={6}
                  />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Phone"
                  />
                </div>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email"
                />
              </div>
            </div>
          </div>
        )}

        {/* Legal Tab */}
        {activeTab === 'legal' && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-white mb-2">GSTIN (GST Number)</label>
              <input
                type="text"
                value={formData.gstNumber || ''}
                onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">FSSAI License Number</label>
              <input
                type="text"
                value={formData.fssaiNumber || ''}
                onChange={(e) => handleInputChange('fssaiNumber', e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12345678901234"
                maxLength={14}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">PAN Number</label>
              <input
                type="text"
                value={formData.panNumber || ''}
                onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AAAAA0000A"
                maxLength={10}
              />
            </div>
          </div>
        )}

        {/* Invoice Tab */}
        {activeTab === 'invoice' && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Invoice Prefix</label>
              <input
                type="text"
                value={formData.invoicePrefix || 'INV'}
                onChange={(e) => handleInputChange('invoicePrefix', e.target.value.toUpperCase())}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="INV"
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Invoice Terms</label>
              <textarea
                value={formData.invoiceTerms || ''}
                onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Terms and conditions"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Footer Note</label>
              <textarea
                value={formData.footerNote || ''}
                onChange={(e) => handleInputChange('footerNote', e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Thank you for dining with us!"
              />
            </div>
          </div>
        )}

        {/* Tax Tab */}
        {activeTab === 'tax' && (
          <div className="space-y-6 max-w-2xl">
            {/* Tax Enable/Disable Toggle */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <Toggle
                enabled={formData.taxEnabled ?? true}
                onChange={(val) => handleInputChange('taxEnabled', val)}
                label="Tax Enabled"
                description="When disabled, menu price = billing price (no GST applied)"
              />
              {!formData.taxEnabled && (
                <div className="mt-3 p-3 bg-amber-900/30 border border-amber-600/50 rounded-lg">
                  <p className="text-sm text-amber-300">
                    Tax is disabled. Menu prices will be billed as-is without any GST calculation.
                  </p>
                </div>
              )}
            </div>

            <div className={cn("grid grid-cols-2 gap-4", !formData.taxEnabled && "opacity-50 pointer-events-none")}>
              <div>
                <label className="block text-sm font-medium text-white mb-2">CGST Rate (%)</label>
                <input
                  type="number"
                  value={formData.cgstRate}
                  onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value))}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.5"
                  min="0"
                  max="50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">SGST Rate (%)</label>
                <input
                  type="number"
                  value={formData.sgstRate}
                  onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value))}
                  className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  step="0.5"
                  min="0"
                  max="50"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Service Charge (%)</label>
              <input
                type="number"
                value={formData.serviceChargeRate}
                onChange={(e) => handleInputChange('serviceChargeRate', parseFloat(e.target.value))}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                step="0.5"
                min="0"
                max="25"
              />
            </div>
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <Toggle
                enabled={formData.serviceChargeEnabled}
                onChange={(val) => handleInputChange('serviceChargeEnabled', val)}
                label="Enable Service Charge"
                description="Add service charge to all bills"
              />
              <div className={cn(!formData.taxEnabled && "opacity-50 pointer-events-none")}>
                <Toggle
                  enabled={formData.taxIncludedInPrice}
                  onChange={(val) => handleInputChange('taxIncludedInPrice', val)}
                  label="Tax Inclusive Pricing"
                  description="Menu prices already include GST"
                />
              </div>
              <Toggle
                enabled={formData.roundOffEnabled}
                onChange={(val) => handleInputChange('roundOffEnabled', val)}
                label="Round Off Total"
                description="Round bill total to nearest rupee"
              />
            </div>
          </div>
        )}

        {/* Print Tab */}
        {activeTab === 'print' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Paper Width</label>
              <select
                value={formData.paperWidth}
                onChange={(e) => handleInputChange('paperWidth', e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="58mm">58mm (2 inch)</option>
                <option value="80mm">80mm (3 inch)</option>
              </select>
            </div>
            <div className="space-y-4">
              <Toggle
                enabled={formData.printLogo}
                onChange={(val) => handleInputChange('printLogo', val)}
                label="Print Logo"
                description="Show restaurant logo on receipts"
              />
              <Toggle
                enabled={formData.printQRCode}
                onChange={(val) => handleInputChange('printQRCode', val)}
                label="Print QR Code"
                description="Show payment QR code on receipts"
              />
              <Toggle
                enabled={formData.showItemwiseTax}
                onChange={(val) => handleInputChange('showItemwiseTax', val)}
                label="Show Itemwise Tax"
                description="Display tax breakdown per item"
              />
            </div>
          </div>
        )}

        {/* POS Tab */}
        {activeTab === 'pos' && (
          <div className="space-y-6 max-w-2xl">
            <Toggle
              enabled={formData.posSettings?.requireStaffPinForPOS ?? false}
              onChange={(val) => handleInputChange('posSettings.requireStaffPinForPOS', val)}
              label="Require Staff PIN"
              description="Staff must enter PIN to access POS"
            />
            <Toggle
              enabled={formData.posSettings?.filterTablesByStaffAssignment ?? false}
              onChange={(val) => handleInputChange('posSettings.filterTablesByStaffAssignment', val)}
              label="Filter Tables by Staff"
              description="Only show tables assigned to logged-in staff"
            />
            <div>
              <label className="block text-sm font-medium text-white mb-2">PIN Session Timeout (minutes)</label>
              <input
                type="number"
                value={formData.posSettings?.pinSessionTimeoutMinutes ?? 0}
                onChange={(e) => handleInputChange('posSettings.pinSessionTimeoutMinutes', parseInt(e.target.value))}
                className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                placeholder="0 = no timeout"
              />
              <p className="text-xs text-slate-400 mt-1">0 = no timeout, staff stays logged in</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-slate-700 bg-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm space-y-1">
            {isConfigured ? (
              <span className="text-green-400">Settings configured</span>
            ) : (
              <span className="text-amber-400">Please configure your restaurant details</span>
            )}
            {lastSyncedAt && (
              <div className="text-xs text-slate-500">
                Last synced: {new Date(lastSyncedAt).toLocaleString()}
              </div>
            )}
            {isSyncing && (
              <div className="text-xs text-blue-400">Syncing with cloud...</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Sync from Cloud Button */}
            <button
              onClick={() => tenantId && syncFromCloud(tenantId)}
              disabled={isSyncing || !tenantId}
              className="px-4 py-2.5 rounded-lg bg-slate-600 text-white font-medium hover:bg-slate-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Pull settings from cloud"
            >
              {isSyncing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              Pull from Cloud
            </button>
            {/* Sync to Cloud Button */}
            <button
              onClick={async () => {
                if (tenantId) {
                  updateSettings(formData);
                  await syncToCloud(tenantId);
                }
              }}
              disabled={isSyncing || !tenantId}
              className="px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Push settings to cloud"
            >
              {isSyncing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              )}
              Sync to Cloud
            </button>
            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || isSyncing}
              className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
