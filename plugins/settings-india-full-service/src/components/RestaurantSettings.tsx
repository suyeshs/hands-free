/**
 * Restaurant Settings Component - India Full Service Plugin
 * Pre-configured for Indian full-service restaurants with GST, FSSAI compliance
 */

import { useState, useEffect } from 'react';
import { Info, Save } from 'lucide-react';

interface RestaurantSettings {
  id: number;
  restaurant_type: string;
  operational_scale: string;
  name: string;
  owner_name: string | null;
  tagline: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;

  // Indian Compliance
  gst_number: string | null;
  fssai_number: string | null;
  pan_number: string | null;
  cin_number: string | null;

  // Invoice
  invoice_prefix: string;
  invoice_terms: string;
  footer_note: string;

  // Tax (GST)
  tax_enabled: boolean;
  cgst_rate: number;
  sgst_rate: number;
  service_charge_rate: number;
  service_charge_enabled: boolean;
  round_off_enabled: boolean;
  tax_included_in_price: boolean;

  // Printing
  print_logo: boolean;
  logo_url: string | null;
  print_qr_code: boolean;
  qr_code_url: string | null;
  paper_width: number;
  show_itemwise_tax: boolean;

  // Security
  require_staff_pin_for_pos: boolean;
  filter_tables_by_staff_assignment: boolean;
  pin_session_timeout_minutes: number;

  // Theme
  theme: string;

  // Cloud
  activate_online: boolean;
  enable_inventory_sync: boolean;
  device_role: string;

  // Packing
  packing_charges_enabled: boolean;
  packing_charges_default: number;

  // Region
  region: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  date_format: string;
  time_format: string;
}

export function RestaurantSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basics' | 'compliance' | 'tax' | 'invoice' | 'print'>('basics');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Use plugin API to fetch settings
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof RestaurantSettings, value: any) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive">Failed to load settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Restaurant Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pre-configured for Indian full-service restaurants
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto">
          {[
            { id: 'basics', label: 'Restaurant Basics', icon: '🏪' },
            { id: 'compliance', label: 'Compliance', icon: '📋' },
            { id: 'tax', label: 'GST & Tax', icon: '💰' },
            { id: 'invoice', label: 'Invoice', icon: '🧾' },
            { id: 'print', label: 'Printing', icon: '🖨️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-foreground hover:bg-surface-3'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 w-full">
          {/* Basics Tab */}
          {activeTab === 'basics' && (
            <>
              <div className="bg-info/10 border border-info/30 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Restaurant Information</h4>
                  <p className="text-sm text-muted-foreground">
                    Basic details that appear on receipts and customer communications
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Restaurant Name *
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Enter restaurant name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    value={settings.owner_name || ''}
                    onChange={(e) => updateField('owner_name', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Owner name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={settings.tagline || ''}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Your restaurant tagline"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={settings.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={settings.email || ''}
                      onChange={(e) => updateField('email', e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={settings.address_line1 || ''}
                    onChange={(e) => updateField('address_line1', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={settings.address_line2 || ''}
                    onChange={(e) => updateField('address_line2', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Landmark, building"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={settings.city || ''}
                      onChange={(e) => updateField('city', e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={settings.state || ''}
                      onChange={(e) => updateField('state', e.target.value)}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={settings.pincode || ''}
                      onChange={(e) => updateField('pincode', e.target.value)}
                      maxLength={6}
                      className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      placeholder="Pincode"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <>
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Legal Compliance for India</h4>
                  <p className="text-sm text-muted-foreground">
                    GSTIN and FSSAI license numbers must be printed on receipts as per Indian law
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    GSTIN (GST Number) *
                  </label>
                  <input
                    type="text"
                    value={settings.gst_number || ''}
                    onChange={(e) => updateField('gst_number', e.target.value.toUpperCase())}
                    maxLength={15}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                    placeholder="22AAAAA0000A1Z5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    15-digit GST identification number (required for GST-compliant invoices)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    FSSAI License Number *
                  </label>
                  <input
                    type="text"
                    value={settings.fssai_number || ''}
                    onChange={(e) => updateField('fssai_number', e.target.value)}
                    maxLength={14}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                    placeholder="12345678901234"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    14-digit FSSAI license number (mandatory for food businesses in India)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={settings.pan_number || ''}
                    onChange={(e) => updateField('pan_number', e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                    placeholder="AAAAA0000A"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    10-character PAN (Permanent Account Number) for tax filing
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    CIN Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={settings.cin_number || ''}
                    onChange={(e) => updateField('cin_number', e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                    placeholder="U01234KA2020PTC123456"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Corporate Identification Number (only for incorporated companies)
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Tax Tab */}
          {activeTab === 'tax' && (
            <>
              <div className="bg-info/10 border border-info/30 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">GST Configuration</h4>
                  <p className="text-sm text-muted-foreground">
                    India uses split GST system: CGST (Central) + SGST (State) = Total GST
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Enable Tax</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      When disabled, no tax will be applied to menu prices
                    </p>
                  </div>
                  <button
                    onClick={() => updateField('tax_enabled', !settings.tax_enabled)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${
                      settings.tax_enabled ? 'bg-accent' : 'bg-muted'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-6 h-6 bg-white shadow-md rounded-full transition-transform ${
                        settings.tax_enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {settings.tax_enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          CGST Rate (%)
                        </label>
                        <input
                          type="number"
                          value={settings.cgst_rate}
                          onChange={(e) => updateField('cgst_rate', parseFloat(e.target.value))}
                          step="0.5"
                          min="0"
                          max="50"
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          SGST Rate (%)
                        </label>
                        <input
                          type="number"
                          value={settings.sgst_rate}
                          onChange={(e) => updateField('sgst_rate', parseFloat(e.target.value))}
                          step="0.5"
                          min="0"
                          max="50"
                          className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-surface-1 rounded-lg">
                      <p className="text-sm font-medium text-foreground">
                        Total GST: {settings.cgst_rate + settings.sgst_rate}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Standard rate for restaurants in India is 5% (2.5% CGST + 2.5% SGST)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Service Charge Rate (%)
                      </label>
                      <input
                        type="number"
                        value={settings.service_charge_rate}
                        onChange={(e) => updateField('service_charge_rate', parseFloat(e.target.value))}
                        step="0.5"
                        min="0"
                        max="25"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Enable Service Charge</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Add service charge to all bills
                          </p>
                        </div>
                        <button
                          onClick={() => updateField('service_charge_enabled', !settings.service_charge_enabled)}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            settings.service_charge_enabled ? 'bg-accent' : 'bg-muted'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white shadow-md rounded-full transition-transform ${
                              settings.service_charge_enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Round Off Total</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Round bill total to nearest rupee
                          </p>
                        </div>
                        <button
                          onClick={() => updateField('round_off_enabled', !settings.round_off_enabled)}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            settings.round_off_enabled ? 'bg-accent' : 'bg-muted'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white shadow-md rounded-full transition-transform ${
                              settings.round_off_enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Tax Inclusive Pricing</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Menu prices already include GST
                          </p>
                        </div>
                        <button
                          onClick={() => updateField('tax_included_in_price', !settings.tax_included_in_price)}
                          className={`relative w-14 h-8 rounded-full transition-colors ${
                            settings.tax_included_in_price ? 'bg-accent' : 'bg-muted'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-6 h-6 bg-white shadow-md rounded-full transition-transform ${
                              settings.tax_included_in_price ? 'translate-x-7' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Invoice Tab */}
          {activeTab === 'invoice' && (
            <>
              <div className="bg-info/10 border border-info/30 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Invoice Customization</h4>
                  <p className="text-sm text-muted-foreground">
                    Customize invoice branding and add terms & conditions
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={settings.invoice_prefix}
                    onChange={(e) => updateField('invoice_prefix', e.target.value.toUpperCase())}
                    maxLength={5}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                    placeholder="INV-"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Prefix for invoice numbers (e.g., INV-1001, INV-1002...)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Invoice Terms
                  </label>
                  <textarea
                    value={settings.invoice_terms}
                    onChange={(e) => updateField('invoice_terms', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Terms and conditions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Footer Note
                  </label>
                  <textarea
                    value={settings.footer_note}
                    onChange={(e) => updateField('footer_note', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Thank you message..."
                  />
                </div>
              </div>
            </>
          )}

          {/* Print Tab */}
          {activeTab === 'print' && (
            <>
              <div className="bg-info/10 border border-info/30 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Thermal Printer Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure receipt printing for 80mm thermal printers (common in India)
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Paper Width
                  </label>
                  <select
                    value={settings.paper_width}
                    onChange={(e) => updateField('paper_width', parseInt(e.target.value))}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value={58}>58mm (2 inch)</option>
                    <option value={80}>80mm (3 inch) - Standard</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Print Logo</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Show restaurant logo on receipts
                      </p>
                    </div>
                    <button
                      onClick={() => updateField('print_logo', !settings.print_logo)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        settings.print_logo ? 'bg-accent' : 'bg-muted'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white shadow-md rounded-full transition-transform ${
                          settings.print_logo ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Print QR Code</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Show payment QR code (UPI) on receipts
                      </p>
                    </div>
                    <button
                      onClick={() => updateField('print_qr_code', !settings.print_qr_code)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        settings.print_qr_code ? 'bg-accent' : 'bg-muted'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white shadow-md rounded-full transition-transform ${
                          settings.print_qr_code ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Show Itemwise Tax</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Display CGST/SGST breakdown per item
                      </p>
                    </div>
                    <button
                      onClick={() => updateField('show_itemwise_tax', !settings.show_itemwise_tax)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        settings.show_itemwise_tax ? 'bg-accent' : 'bg-muted'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-6 h-6 bg-white shadow-md rounded-full transition-transform ${
                          settings.show_itemwise_tax ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
