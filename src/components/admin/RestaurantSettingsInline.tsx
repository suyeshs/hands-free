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

export function RestaurantSettingsInline() {
  const { settings, updateSettings, isConfigured } = useRestaurantSettingsStore();
  const { user: _user } = useAuthStore();
  const { tenant: _tenant } = useTenantStore();
  // Priority: Tenant Store (device activation) > Auth Store (user login)
  // const tenantId = tenant?.tenantId || user?.tenantId || '';

  const [activeTab, setActiveTab] = useState<'basic' | 'legal' | 'invoice' | 'tax' | 'print' | 'pos'>('basic');
  const [formData, setFormData] = useState<RestaurantDetails>(settings);
  const [isSaving, setIsSaving] = useState(false);

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
    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <p className="text-xs text-gray-600 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative w-14 h-8 transition-colors',
          enabled ? 'bg-orange-500' : 'bg-gray-300'
        )}
      >
        <div
          className={cn(
            'absolute top-1 w-6 h-6 bg-white shadow-md transition-transform',
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

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '🏪' },
    { id: 'legal', label: 'Legal & Tax IDs', icon: '📋' },
    { id: 'invoice', label: 'Invoice', icon: '🧾' },
    { id: 'tax', label: 'Tax & Charges', icon: '💰' },
    { id: 'print', label: 'Print', icon: '🖨️' },
    { id: 'pos', label: 'POS & Theme', icon: '🎨' },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'bg-orange-50 text-orange-600 border-orange-500'
                : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'
            )}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white p-6 border border-gray-200">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Restaurant Details</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="Enter restaurant name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                  <input
                    type="text"
                    value={formData.ownerName || ''}
                    onChange={(e) => handleInputChange('ownerName', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="Enter owner name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="e.g., Authentic Indian Cuisine"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 border border-gray-200">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Address & Contact</h4>
              <div className="space-y-4">
                <input
                  type="text"
                  value={formData.address.line1}
                  onChange={(e) => handleInputChange('address.line1', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Address Line 1"
                />
                <input
                  type="text"
                  value={formData.address.line2 || ''}
                  onChange={(e) => handleInputChange('address.line2', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Address Line 2"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => handleInputChange('address.city', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="State"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={formData.address.pincode}
                    onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="Pincode"
                    maxLength={6}
                  />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="Phone"
                  />
                </div>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Email"
                />
              </div>
            </div>
          </div>
        )}

        {/* Legal Tab */}
        {activeTab === 'legal' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white p-6 border border-gray-200">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Tax & License Numbers</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN (GST Number)</label>
                  <input
                    type="text"
                    value={formData.gstNumber || ''}
                    onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FSSAI License Number</label>
                  <input
                    type="text"
                    value={formData.fssaiNumber || ''}
                    onChange={(e) => handleInputChange('fssaiNumber', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="12345678901234"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={formData.panNumber || ''}
                    onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
            <div className="bg-white p-6 border border-gray-200">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Invoice Configuration</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={formData.invoicePrefix || 'INV'}
                    onChange={(e) => handleInputChange('invoicePrefix', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    placeholder="INV"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Terms</label>
                  <textarea
                    value={formData.invoiceTerms || ''}
                    onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    rows={3}
                    placeholder="Terms and conditions"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Footer Note</label>
                  <textarea
                    value={formData.footerNote || ''}
                    onChange={(e) => handleInputChange('footerNote', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
            <div className="bg-white border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h4 className="text-base font-semibold text-gray-900 mb-4">Tax Settings</h4>
              </div>
              <div className="p-0">
                <Toggle
                  enabled={formData.taxEnabled ?? true}
                  onChange={(val) => handleInputChange('taxEnabled', val)}
                  label="Tax Enabled"
                  description="When disabled, menu price = billing price (no GST applied)"
                />
              </div>
              {!formData.taxEnabled && (
                <div className="m-4 p-3 bg-yellow-50 border border-yellow-300">
                  <p className="text-sm text-yellow-800">
                    Tax is disabled. Menu prices will be billed as-is without any GST calculation.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 border border-gray-200">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Tax Rates</h4>
              <div className={cn("space-y-4", !formData.taxEnabled && "opacity-50 pointer-events-none")}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CGST Rate (%)</label>
                    <input
                      type="number"
                      value={formData.cgstRate}
                      onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SGST Rate (%)</label>
                    <input
                      type="number"
                      value={formData.sgstRate}
                      onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Charge (%)</label>
                  <input
                    type="number"
                    value={formData.serviceChargeRate}
                    onChange={(e) => handleInputChange('serviceChargeRate', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    step="0.5"
                    min="0"
                    max="25"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h4 className="text-base font-semibold text-gray-900">Billing Options</h4>
              </div>
              <div className="space-y-0">
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
            <div className="bg-white p-6 border border-gray-200">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Paper Settings</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Width</label>
                <select
                  value={formData.paperWidth}
                  onChange={(e) => handleInputChange('paperWidth', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="58mm">58mm (2 inch)</option>
                  <option value="80mm">80mm (3 inch)</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h4 className="text-base font-semibold text-gray-900">Receipt Options</h4>
              </div>
              <div className="space-y-0">
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
            {/* Theme Selection */}
            <div className="bg-white p-6 border border-gray-200">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Appearance</h4>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">Theme</h3>
                  <p className="text-xs text-gray-600 mt-0.5">Choose light or dark mode for the interface</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInputChange('posSettings.theme', 'light')}
                    className={cn(
                      'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 border',
                      formData.posSettings?.theme === 'light'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <Sun size={16} />
                    Light
                  </button>
                  <button
                    onClick={() => handleInputChange('posSettings.theme', 'dark')}
                    className={cn(
                      'px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 border',
                      formData.posSettings?.theme !== 'light'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <Moon size={16} />
                    Dark
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h4 className="text-base font-semibold text-gray-900">Staff & Access Control</h4>
              </div>
              <div className="space-y-0">
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
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIN Session Timeout (minutes)</label>
                  <input
                    type="number"
                    value={formData.posSettings?.pinSessionTimeoutMinutes ?? 0}
                    onChange={(e) => handleInputChange('posSettings.pinSessionTimeoutMinutes', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    min="0"
                    placeholder="0 = no timeout"
                  />
                  <p className="text-xs text-gray-600 mt-1">0 = no timeout, staff stays logged in</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <span className="text-green-600 font-medium">Settings configured</span>
              ) : (
                <span className="text-yellow-600 font-medium">Please configure your restaurant details</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Save Button - Saves locally and triggers automatic background sync */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save settings (syncs to cloud automatically)"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
