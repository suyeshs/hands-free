/**
 * Restaurant Settings Component
 * Admin panel for configuring restaurant details, GST, FSSAI, and billing settings
 */

import { useState } from 'react';
import { useRestaurantSettingsStore, RestaurantDetails } from '../../stores/restaurantSettingsStore';
import { cn } from '../../lib/utils';

interface RestaurantSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RestaurantSettings({ isOpen, onClose }: RestaurantSettingsProps) {
  const { settings, updateSettings, isConfigured } = useRestaurantSettingsStore();
  const [activeTab, setActiveTab] = useState<'basic' | 'legal' | 'invoice' | 'tax' | 'print'>('basic');
  const [formData, setFormData] = useState<RestaurantDetails>(settings);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      // Handle nested fields like 'address.line1'
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateSettings(formData);
      // Small delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 300));
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '🏪' },
    { id: 'legal', label: 'Legal & Tax IDs', icon: '📋' },
    { id: 'invoice', label: 'Invoice Settings', icon: '🧾' },
    { id: 'tax', label: 'Tax & Charges', icon: '💰' },
    { id: 'print', label: 'Print Settings', icon: '🖨️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Restaurant Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your restaurant details for billing and invoices
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <span className="text-xl">×</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-background/50 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-accent border-b-2 border-accent bg-accent/5'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Restaurant Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="Enter restaurant name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tagline (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="e.g., Authentic Indian Cuisine Since 1990"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Address Line 1 *
                    </label>
                    <input
                      type="text"
                      value={formData.address.line1}
                      onChange={(e) => handleInputChange('address.line1', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="Building, Street"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={formData.address.line2 || ''}
                      onChange={(e) => handleInputChange('address.line2', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="Area, Landmark"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      value={formData.address.city}
                      onChange={(e) => handleInputChange('address.city', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      State *
                    </label>
                    <input
                      type="text"
                      value={formData.address.state}
                      onChange={(e) => handleInputChange('address.state', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Pincode *
                    </label>
                    <input
                      type="text"
                      value={formData.address.pincode}
                      onChange={(e) => handleInputChange('address.pincode', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="560001"
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="restaurant@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={formData.website || ''}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="www.restaurant.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Legal & Tax IDs Tab */}
          {activeTab === 'legal' && (
            <div className="space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm text-amber-200">
                  <span className="font-semibold">Important:</span> These details will appear on your tax invoices.
                  Ensure they match your official registration documents.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    GSTIN (GST Number)
                  </label>
                  <input
                    type="text"
                    value={formData.gstNumber || ''}
                    onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
                    placeholder="29AABCU9603R1ZM"
                    maxLength={15}
                  />
                  <p className="text-xs text-muted-foreground mt-1">15-character GST Identification Number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    FSSAI License Number
                  </label>
                  <input
                    type="text"
                    value={formData.fssaiNumber || ''}
                    onChange={(e) => handleInputChange('fssaiNumber', e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
                    placeholder="12345678901234"
                    maxLength={14}
                  />
                  <p className="text-xs text-muted-foreground mt-1">14-digit FSSAI license number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    value={formData.panNumber || ''}
                    onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    CIN Number (if applicable)
                  </label>
                  <input
                    type="text"
                    value={formData.cinNumber || ''}
                    onChange={(e) => handleInputChange('cinNumber', e.target.value.toUpperCase())}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
                    placeholder="U12345KA2020PTC123456"
                    maxLength={21}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Corporate Identification Number (for companies)</p>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Settings Tab */}
          {activeTab === 'invoice' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Invoice Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.invoicePrefix}
                    onChange={(e) => handleInputChange('invoicePrefix', e.target.value.toUpperCase())}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
                    placeholder="INV"
                    maxLength={5}
                  />
                  <p className="text-xs text-muted-foreground mt-1">e.g., INV, BILL, RCP</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Starting Invoice Number
                  </label>
                  <input
                    type="number"
                    value={formData.invoiceStartNumber}
                    onChange={(e) => handleInputChange('invoiceStartNumber', parseInt(e.target.value) || 1)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Current Invoice Number
                  </label>
                  <input
                    type="number"
                    value={formData.currentInvoiceNumber}
                    onChange={(e) => handleInputChange('currentInvoiceNumber', parseInt(e.target.value) || 1)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Next invoice will use this number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Invoice Format Preview
                  </label>
                  <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 font-mono text-accent">
                    {formData.invoicePrefix}-{new Date().getFullYear().toString().slice(-2)}{(new Date().getMonth() + 1).toString().padStart(2, '0')}-{formData.currentInvoiceNumber.toString().padStart(6, '0')}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Invoice Terms / Thank You Message
                  </label>
                  <textarea
                    value={formData.invoiceTerms || ''}
                    onChange={(e) => handleInputChange('invoiceTerms', e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                    rows={2}
                    placeholder="Thank you for dining with us!"
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Footer Note
                  </label>
                  <textarea
                    value={formData.footerNote || ''}
                    onChange={(e) => handleInputChange('footerNote', e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                    rows={2}
                    placeholder="This is a computer generated invoice."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tax & Charges Tab */}
          {activeTab === 'tax' && (
            <div className="space-y-6">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  <span className="font-semibold">GST for Restaurants:</span> Standard rate is 5% (2.5% CGST + 2.5% SGST)
                  for non-AC restaurants. AC restaurants may have 18% GST (9% each).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    CGST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formData.cgstRate}
                    onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value) || 0)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    step="0.5"
                    min={0}
                    max={14}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Central GST (typically 2.5% or 9%)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    SGST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={formData.sgstRate}
                    onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value) || 0)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                    step="0.5"
                    min={0}
                    max={14}
                  />
                  <p className="text-xs text-muted-foreground mt-1">State GST (typically 2.5% or 9%)</p>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Service Charge</h3>
                    <p className="text-xs text-muted-foreground">Apply service charge to orders</p>
                  </div>
                  <button
                    onClick={() => handleInputChange('serviceChargeEnabled', !formData.serviceChargeEnabled)}
                    className={cn(
                      'relative w-14 h-7 rounded-full transition-colors',
                      formData.serviceChargeEnabled ? 'bg-accent' : 'bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                        formData.serviceChargeEnabled ? 'translate-x-8' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                {formData.serviceChargeEnabled && (
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Service Charge Rate (%)
                    </label>
                    <input
                      type="number"
                      value={formData.serviceChargeRate}
                      onChange={(e) => handleInputChange('serviceChargeRate', parseFloat(e.target.value) || 0)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      step="0.5"
                      min={0}
                      max={20}
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Round Off Total</h3>
                    <p className="text-xs text-muted-foreground">Round the final amount to nearest rupee</p>
                  </div>
                  <button
                    onClick={() => handleInputChange('roundOffEnabled', !formData.roundOffEnabled)}
                    className={cn(
                      'relative w-14 h-7 rounded-full transition-colors',
                      formData.roundOffEnabled ? 'bg-accent' : 'bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                        formData.roundOffEnabled ? 'translate-x-8' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Tax Preview */}
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-foreground mb-4">Tax Calculation Preview</h3>
                <div className="bg-background/50 rounded-lg p-4 font-mono text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Subtotal (example)</span>
                    <span>Rs. 1,000.00</span>
                  </div>
                  {formData.serviceChargeEnabled && (
                    <div className="flex justify-between mb-2">
                      <span className="text-muted-foreground">Service Charge ({formData.serviceChargeRate}%)</span>
                      <span>Rs. {(1000 * formData.serviceChargeRate / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">CGST ({formData.cgstRate}%)</span>
                    <span>Rs. {((1000 + (formData.serviceChargeEnabled ? 1000 * formData.serviceChargeRate / 100 : 0)) * formData.cgstRate / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">SGST ({formData.sgstRate}%)</span>
                    <span>Rs. {((1000 + (formData.serviceChargeEnabled ? 1000 * formData.serviceChargeRate / 100 : 0)) * formData.sgstRate / 100).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span>Rs. {(
                      1000 +
                      (formData.serviceChargeEnabled ? 1000 * formData.serviceChargeRate / 100 : 0) +
                      ((1000 + (formData.serviceChargeEnabled ? 1000 * formData.serviceChargeRate / 100 : 0)) * (formData.cgstRate + formData.sgstRate) / 100)
                    ).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Print Settings Tab */}
          {activeTab === 'print' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Paper Width
                  </label>
                  <select
                    value={formData.paperWidth}
                    onChange={(e) => handleInputChange('paperWidth', e.target.value)}
                    className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                  >
                    <option value="58mm">58mm (2.25 inch)</option>
                    <option value="80mm">80mm (3 inch)</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Standard thermal printer widths</p>
                </div>
              </div>

              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Print Logo</h3>
                    <p className="text-xs text-muted-foreground">Show restaurant logo on bills</p>
                  </div>
                  <button
                    onClick={() => handleInputChange('printLogo', !formData.printLogo)}
                    className={cn(
                      'relative w-14 h-7 rounded-full transition-colors',
                      formData.printLogo ? 'bg-accent' : 'bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                        formData.printLogo ? 'translate-x-8' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                {formData.printLogo && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={formData.logoUrl || ''}
                      onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Print QR Code</h3>
                    <p className="text-xs text-muted-foreground">Show QR code for payment/reviews</p>
                  </div>
                  <button
                    onClick={() => handleInputChange('printQRCode', !formData.printQRCode)}
                    className={cn(
                      'relative w-14 h-7 rounded-full transition-colors',
                      formData.printQRCode ? 'bg-accent' : 'bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                        formData.printQRCode ? 'translate-x-8' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
                {formData.printQRCode && (
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      QR Code URL (UPI payment or review link)
                    </label>
                    <input
                      type="url"
                      value={formData.qrCodeUrl || ''}
                      onChange={(e) => handleInputChange('qrCodeUrl', e.target.value)}
                      className="w-full p-3 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="upi://pay?pa=example@upi"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Show Item-wise Tax</h3>
                    <p className="text-xs text-muted-foreground">Display tax breakdown per item</p>
                  </div>
                  <button
                    onClick={() => handleInputChange('showItemwiseTax', !formData.showItemwiseTax)}
                    className={cn(
                      'relative w-14 h-7 rounded-full transition-colors',
                      formData.showItemwiseTax ? 'bg-accent' : 'bg-muted'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                        formData.showItemwiseTax ? 'translate-x-8' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-background/50">
          <div className="text-sm text-muted-foreground">
            {isConfigured ? (
              <span className="text-green-500">Settings configured</span>
            ) : (
              <span className="text-amber-500">Please configure your restaurant details</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-foreground font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
