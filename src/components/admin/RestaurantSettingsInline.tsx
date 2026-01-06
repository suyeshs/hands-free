/**
 * Restaurant Settings Inline Component
 * Same as RestaurantSettings but without the modal wrapper - for use in full-page views
 */

import { useState, useEffect } from 'react';
import { useRestaurantSettingsStore, RestaurantDetails } from '../../stores/restaurantSettingsStore';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { cn } from '../../lib/utils';
import { Sun, Moon } from 'lucide-react';

// Warning modal for server sync
function SyncWarningModal({
  isOpen,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card rounded-xl p-6 max-w-md mx-4 border border-warning/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Sync Settings to Cloud?</h3>
        </div>
        <p className="text-foreground/80 mb-2">
          This will <strong className="text-warning">overwrite</strong> the cloud settings with this device's settings.
        </p>
        <p className="text-muted-foreground text-sm mb-6">
          All other devices will receive these settings on their next sync. Only proceed if you're sure this device has the correct settings.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-surface-3 text-foreground hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-warning text-white hover:opacity-90 transition-colors"
          >
            Yes, Sync to Cloud
          </button>
        </div>
      </div>
    </div>
  );
}

export function RestaurantSettingsInline() {
  const { settings, updateSettings, isConfigured, syncFromCloud, syncToCloud, isSyncing, lastSyncedAt } = useRestaurantSettingsStore();
  const { user } = useAuthStore();
  const { tenant } = useTenantStore();
  const tenantId = user?.tenantId || tenant?.tenantId || '';

  const [activeTab, setActiveTab] = useState<'basic' | 'legal' | 'invoice' | 'tax' | 'print' | 'pos'>('basic');
  const [formData, setFormData] = useState<RestaurantDetails>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSyncWarning, setShowSyncWarning] = useState(false);

  // Device role from settings - determines if this device can push to cloud
  const isServerDevice = settings.deviceRole === 'server';

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
    <div className="settings-toggle-row">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative w-14 h-8 rounded-full transition-colors',
          enabled ? 'bg-accent' : 'bg-surface-3'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform',
            enabled ? 'translate-x-7' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  // Save locally only - does NOT sync to cloud
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save locally only
      updateSettings(formData);
      console.log('[RestaurantSettings] Settings saved locally');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle sync to cloud (server devices only, with confirmation)
  const handleSyncToCloud = async () => {
    if (!isServerDevice) return;

    setShowSyncWarning(false);
    try {
      // Save locally first
      updateSettings(formData);
      // Then sync to cloud
      if (tenantId) {
        await syncToCloud(tenantId);
      }
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '🏪' },
    { id: 'legal', label: 'Legal & Tax IDs', icon: '📋' },
    { id: 'invoice', label: 'Invoice', icon: '🧾' },
    { id: 'tax', label: 'Tax & Charges', icon: '💰' },
    { id: 'print', label: 'Print', icon: '🖨️' },
    { id: 'pos', label: 'POS & Theme', icon: '🎨' },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tabs */}
      <div className="settings-tabs flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'settings-tab',
              activeTab === tab.id && 'active'
            )}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6 max-w-2xl">
            <div className="settings-group">
              <h4 className="settings-group-title">Restaurant Details</h4>
              <div className="space-y-4">
                <div>
                  <label className="settings-label">Restaurant Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="settings-input"
                    placeholder="Enter restaurant name"
                  />
                </div>
                <div>
                  <label className="settings-label">Tagline</label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    className="settings-input"
                    placeholder="e.g., Authentic Indian Cuisine"
                  />
                </div>
              </div>
            </div>

            <div className="settings-group">
              <h4 className="settings-group-title">Address & Contact</h4>
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.address.line1}
                  onChange={(e) => handleInputChange('address.line1', e.target.value)}
                  className="settings-input"
                  placeholder="Address Line 1"
                />
                <input
                  type="text"
                  value={formData.address.line2 || ''}
                  onChange={(e) => handleInputChange('address.line2', e.target.value)}
                  className="settings-input"
                  placeholder="Address Line 2"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    className="settings-input"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    className="settings-input"
                    placeholder="State"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.pincode}
                    onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                    className="settings-input"
                    placeholder="Pincode"
                    maxLength={6}
                  />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="settings-input"
                    placeholder="Phone"
                  />
                </div>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="settings-input"
                  placeholder="Email"
                />
              </div>
            </div>
          </div>
        )}

        {/* Legal Tab */}
        {activeTab === 'legal' && (
          <div className="space-y-6 max-w-2xl">
            <div className="settings-group">
              <h4 className="settings-group-title">Tax & License Numbers</h4>
              <div className="space-y-4">
                <div>
                  <label className="settings-label">GSTIN (GST Number)</label>
                  <input
                    type="text"
                    value={formData.gstNumber || ''}
                    onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                    className="settings-input"
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="settings-label">FSSAI License Number</label>
                  <input
                    type="text"
                    value={formData.fssaiNumber || ''}
                    onChange={(e) => handleInputChange('fssaiNumber', e.target.value)}
                    className="settings-input"
                    placeholder="12345678901234"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="settings-label">PAN Number</label>
                  <input
                    type="text"
                    value={formData.panNumber || ''}
                    onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                    className="settings-input"
                    placeholder="AAAAA0000A"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Tab */}
        {activeTab === 'invoice' && (
          <div className="space-y-6 max-w-2xl">
            <div className="settings-group">
              <h4 className="settings-group-title">Invoice Configuration</h4>
              <div className="space-y-4">
                <div>
                  <label className="settings-label">Invoice Prefix</label>
                  <input
                    type="text"
                    value={formData.invoicePrefix || 'INV'}
                    onChange={(e) => handleInputChange('invoicePrefix', e.target.value.toUpperCase())}
                    className="settings-input"
                    placeholder="INV"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="settings-label">Invoice Terms</label>
                  <textarea
                    value={formData.invoiceTerms || ''}
                    onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                    className="settings-textarea"
                    rows={3}
                    placeholder="Terms and conditions"
                  />
                </div>
                <div>
                  <label className="settings-label">Footer Note</label>
                  <textarea
                    value={formData.footerNote || ''}
                    onChange={(e) => handleInputChange('footerNote', e.target.value)}
                    className="settings-textarea"
                    rows={2}
                    placeholder="Thank you for dining with us!"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tax Tab */}
        {activeTab === 'tax' && (
          <div className="space-y-6 max-w-2xl">
            {/* Tax Enable/Disable Toggle */}
            <div className="settings-group">
              <h4 className="settings-group-title">Tax Settings</h4>
              <Toggle
                enabled={formData.taxEnabled ?? true}
                onChange={(val) => handleInputChange('taxEnabled', val)}
                label="Tax Enabled"
                description="When disabled, menu price = billing price (no GST applied)"
              />
              {!formData.taxEnabled && (
                <div className="mt-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-sm text-warning">
                    Tax is disabled. Menu prices will be billed as-is without any GST calculation.
                  </p>
                </div>
              )}
            </div>

            <div className="settings-group">
              <h4 className="settings-group-title">Tax Rates</h4>
              <div className={cn("space-y-4", !formData.taxEnabled && "opacity-50 pointer-events-none")}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="settings-label">CGST Rate (%)</label>
                    <input
                      type="number"
                      value={formData.cgstRate}
                      onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value))}
                      className="settings-input"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="settings-label">SGST Rate (%)</label>
                    <input
                      type="number"
                      value={formData.sgstRate}
                      onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value))}
                      className="settings-input"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </div>
                </div>
                <div>
                  <label className="settings-label">Service Charge (%)</label>
                  <input
                    type="number"
                    value={formData.serviceChargeRate}
                    onChange={(e) => handleInputChange('serviceChargeRate', parseFloat(e.target.value))}
                    className="settings-input"
                    step="0.5"
                    min="0"
                    max="25"
                  />
                </div>
              </div>
            </div>

            <div className="settings-group">
              <h4 className="settings-group-title">Billing Options</h4>
              <div className="space-y-3">
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
          </div>
        )}

        {/* Print Tab */}
        {activeTab === 'print' && (
          <div className="space-y-6 max-w-2xl">
            <div className="settings-group">
              <h4 className="settings-group-title">Paper Settings</h4>
              <div>
                <label className="settings-label">Paper Width</label>
                <select
                  value={formData.paperWidth}
                  onChange={(e) => handleInputChange('paperWidth', e.target.value)}
                  className="settings-select"
                >
                  <option value="58mm">58mm (2 inch)</option>
                  <option value="80mm">80mm (3 inch)</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <h4 className="settings-group-title">Receipt Options</h4>
              <div className="space-y-3">
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
          </div>
        )}

        {/* POS Tab */}
        {activeTab === 'pos' && (
          <div className="space-y-6 max-w-2xl">
            {/* Theme Selection - NEW */}
            <div className="settings-group">
              <h4 className="settings-group-title">Appearance</h4>
              <div className="settings-toggle-row">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Theme</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose light or dark mode for the interface</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInputChange('posSettings.theme', 'light')}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                      formData.posSettings?.theme === 'light'
                        ? 'bg-accent text-white'
                        : 'bg-surface-3 text-muted-foreground hover:bg-surface-2'
                    )}
                  >
                    <Sun size={16} />
                    Light
                  </button>
                  <button
                    onClick={() => handleInputChange('posSettings.theme', 'dark')}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                      formData.posSettings?.theme !== 'light'
                        ? 'bg-accent text-white'
                        : 'bg-surface-3 text-muted-foreground hover:bg-surface-2'
                    )}
                  >
                    <Moon size={16} />
                    Dark
                  </button>
                </div>
              </div>
            </div>

            {/* Device Role - Server vs Client */}
            <div className="settings-group">
              <h4 className="settings-group-title">Device Role</h4>
              <div className="settings-toggle-row">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Sync Role</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Determines if this device can push settings to cloud</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInputChange('deviceRole', 'client')}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      formData.deviceRole !== 'server'
                        ? 'bg-info text-white'
                        : 'bg-surface-3 text-muted-foreground hover:bg-surface-2'
                    )}
                  >
                    Client
                  </button>
                  <button
                    onClick={() => handleInputChange('deviceRole', 'server')}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      formData.deviceRole === 'server'
                        ? 'bg-warning text-white'
                        : 'bg-surface-3 text-muted-foreground hover:bg-surface-2'
                    )}
                  >
                    Server
                  </button>
                </div>
              </div>
              <div className={cn(
                'mt-3 p-3 rounded-lg text-sm',
                formData.deviceRole === 'server'
                  ? 'bg-warning/10 border border-warning/30 text-warning'
                  : 'bg-info/10 border border-info/30 text-info'
              )}>
                {formData.deviceRole === 'server' ? (
                  <>
                    <strong>Server Mode:</strong> This device can push settings to the cloud.
                    Use only on your main/admin device.
                  </>
                ) : (
                  <>
                    <strong>Client Mode:</strong> This device pulls settings from cloud only.
                    Settings cannot be pushed to cloud from this device.
                  </>
                )}
              </div>
            </div>

            <div className="settings-group">
              <h4 className="settings-group-title">Staff & Access Control</h4>
              <div className="space-y-3">
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
                  <label className="settings-label">PIN Session Timeout (minutes)</label>
                  <input
                    type="number"
                    value={formData.posSettings?.pinSessionTimeoutMinutes ?? 0}
                    onChange={(e) => handleInputChange('posSettings.pinSessionTimeoutMinutes', parseInt(e.target.value))}
                    className="settings-input"
                    min="0"
                    placeholder="0 = no timeout"
                  />
                  <p className="settings-description">0 = no timeout, staff stays logged in</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="settings-footer">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <span className="text-success">Settings configured</span>
              ) : (
                <span className="text-warning">Please configure your restaurant details</span>
              )}
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                isServerDevice ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info'
              )}>
                {isServerDevice ? 'Server' : 'Client'}
              </span>
            </div>
            {lastSyncedAt && (
              <div className="text-xs text-muted-foreground">
                Last synced: {new Date(lastSyncedAt).toLocaleString()}
              </div>
            )}
            {isSyncing && (
              <div className="text-xs text-info">Syncing with cloud...</div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Pull from Cloud Button - Always available */}
            <button
              onClick={() => tenantId && syncFromCloud(tenantId)}
              disabled={isSyncing || !tenantId}
              className="px-4 py-2.5 rounded-lg bg-surface-3 text-foreground font-medium hover:bg-surface-2 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Pull settings from cloud"
            >
              {isSyncing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              Pull from Cloud
            </button>
            {/* Sync to Cloud Button - Only for Server devices */}
            {isServerDevice && (
              <button
                onClick={() => setShowSyncWarning(true)}
                disabled={isSyncing || !tenantId}
                className="px-4 py-2.5 rounded-lg bg-warning text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
                title="Push settings to cloud (Server only)"
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
                Sync to Cloud
              </button>
            )}
            {/* Save Button - Saves locally only */}
            <button
              onClick={handleSave}
              disabled={isSaving || isSyncing}
              className="px-6 py-2.5 rounded-lg bg-accent text-white font-medium hover:opacity-90 transition-colors disabled:opacity-50"
              title="Save settings locally on this device"
            >
              {isSaving ? 'Saving...' : 'Save Locally'}
            </button>
          </div>
        </div>
      </div>

      {/* Sync Warning Modal */}
      <SyncWarningModal
        isOpen={showSyncWarning}
        onConfirm={handleSyncToCloud}
        onCancel={() => setShowSyncWarning(false)}
      />
    </div>
  );
}
