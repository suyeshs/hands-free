/**
 * Tax Settings Form for Provisioning
 * GST rates, service charge, and tax calculation settings
 */

import { useRestaurantSettingsStore } from '../../../stores/restaurantSettingsStore';
import { useProvisioningStore } from '../../../stores/provisioningStore';
import { WizardNavigation } from '../WizardNavigation';
import { useState } from 'react';
import { cn } from '../../../lib/utils';

export function TaxSettingsForm() {
  const { settings, updateSettings } = useRestaurantSettingsStore();
  const { markStepComplete, nextStep } = useProvisioningStore();

  const [formData, setFormData] = useState({
    taxEnabled: settings.taxEnabled ?? true,
    cgstRate: settings.cgstRate ?? 2.5,
    sgstRate: settings.sgstRate ?? 2.5,
    taxIncludedInPrice: settings.taxIncludedInPrice ?? false,
    serviceChargeEnabled: settings.serviceChargeEnabled ?? false,
    serviceChargeRate: settings.serviceChargeRate ?? 5,
    roundOffEnabled: settings.roundOffEnabled ?? true,
  });

  const handleInputChange = (field: string, value: boolean | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNext = () => {
    // Update the settings store
    updateSettings({
      ...settings,
      taxEnabled: formData.taxEnabled,
      cgstRate: formData.cgstRate,
      sgstRate: formData.sgstRate,
      taxIncludedInPrice: formData.taxIncludedInPrice,
      serviceChargeEnabled: formData.serviceChargeEnabled,
      serviceChargeRate: formData.serviceChargeRate,
      roundOffEnabled: formData.roundOffEnabled,
    });

    markStepComplete('business_tax');
    nextStep();
  };

  // Toggle component
  const Toggle = ({
    enabled,
    onChange,
    label,
    description,
  }: {
    enabled: boolean;
    onChange: (val: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative w-14 h-7 rounded-full transition-colors',
          enabled ? 'bg-accent' : 'bg-muted'
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

  // Calculate tax preview
  const getTaxPreview = () => {
    const subtotal = 1000;
    const totalTaxRate = formData.cgstRate + formData.sgstRate;

    if (formData.taxIncludedInPrice) {
      const baseAmount = subtotal / (1 + totalTaxRate / 100);
      const taxAmount = subtotal - baseAmount;
      return {
        base: baseAmount,
        cgst: taxAmount / 2,
        sgst: taxAmount / 2,
        serviceCharge: formData.serviceChargeEnabled
          ? (baseAmount * formData.serviceChargeRate) / 100
          : 0,
        total:
          subtotal +
          (formData.serviceChargeEnabled ? (baseAmount * formData.serviceChargeRate) / 100 : 0),
      };
    } else {
      const serviceCharge = formData.serviceChargeEnabled
        ? (subtotal * formData.serviceChargeRate) / 100
        : 0;
      const taxableAmount = subtotal + serviceCharge;
      const cgst = (taxableAmount * formData.cgstRate) / 100;
      const sgst = (taxableAmount * formData.sgstRate) / 100;
      return {
        base: subtotal,
        cgst,
        sgst,
        serviceCharge,
        total: subtotal + serviceCharge + cgst + sgst,
      };
    }
  };

  const preview = getTaxPreview();

  return (
    <div className="glass-panel rounded-2xl border border-border p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">💰</span>
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">
          Tax Configuration
        </h1>
        <p className="text-muted-foreground text-sm">
          Set up GST rates and tax calculation preferences
        </p>
      </div>

      {/* GST Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-200">
          <span className="font-semibold">GST for Restaurants:</span> Standard rate is 5% (2.5%
          CGST + 2.5% SGST) for non-AC restaurants. AC restaurants may have 18% GST (9% each).
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Tax Included Toggle */}
        <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Tax Included in Menu Prices</h3>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, menu prices already include GST. The bill will show tax breakdown
                extracted from the total.
              </p>
            </div>
            <button
              onClick={() => handleInputChange('taxIncludedInPrice', !formData.taxIncludedInPrice)}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors',
                formData.taxIncludedInPrice ? 'bg-accent' : 'bg-muted'
              )}
            >
              <div
                className={cn(
                  'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                  formData.taxIncludedInPrice ? 'translate-x-8' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          {formData.taxIncludedInPrice && (
            <div className="mt-3 text-xs text-accent bg-accent/10 rounded p-2">
              Example: Rs. 100 menu price = Rs. 95.24 base + Rs. 2.38 CGST + Rs. 2.38 SGST
            </div>
          )}
        </div>

        {/* Tax Rates */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              CGST Rate (%)
            </label>
            <input
              type="number"
              value={formData.cgstRate}
              onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value) || 0)}
              step="0.5"
              min={0}
              max={14}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">Central GST (typically 2.5% or 9%)</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              SGST Rate (%)
            </label>
            <input
              type="number"
              value={formData.sgstRate}
              onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value) || 0)}
              step="0.5"
              min={0}
              max={14}
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1">State GST (typically 2.5% or 9%)</p>
          </div>
        </div>

        {/* Service Charge */}
        <div className="pt-6 border-t border-border">
          <Toggle
            enabled={formData.serviceChargeEnabled}
            onChange={(val) => handleInputChange('serviceChargeEnabled', val)}
            label="Service Charge"
            description="Apply service charge to orders"
          />

          {formData.serviceChargeEnabled && (
            <div className="mt-4 w-1/2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Service Charge Rate (%)
              </label>
              <input
                type="number"
                value={formData.serviceChargeRate}
                onChange={(e) =>
                  handleInputChange('serviceChargeRate', parseFloat(e.target.value) || 0)
                }
                step="0.5"
                min={0}
                max={20}
                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
          )}
        </div>

        {/* Round Off */}
        <Toggle
          enabled={formData.roundOffEnabled}
          onChange={(val) => handleInputChange('roundOffEnabled', val)}
          label="Round Off Total"
          description="Round the final amount to nearest rupee"
        />

        {/* Tax Preview */}
        <div className="pt-6 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Tax Calculation Preview</h3>
          <div className="bg-background/50 rounded-xl p-4 font-mono text-sm">
            {formData.taxIncludedInPrice && (
              <div className="text-xs text-accent mb-3 font-sans">
                Tax is included in menu prices
              </div>
            )}

            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">
                {formData.taxIncludedInPrice ? 'Menu Price (incl. tax)' : 'Subtotal'}
              </span>
              <span>Rs. 1,000.00</span>
            </div>

            {formData.taxIncludedInPrice && (
              <div className="flex justify-between mb-2 text-muted-foreground text-xs">
                <span>├─ Base Amount</span>
                <span>Rs. {preview.base.toFixed(2)}</span>
              </div>
            )}

            {formData.serviceChargeEnabled && (
              <div className="flex justify-between mb-2">
                <span className="text-muted-foreground">
                  {formData.taxIncludedInPrice ? '+' : ''} Service Charge (
                  {formData.serviceChargeRate}%)
                </span>
                <span>Rs. {preview.serviceCharge.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">
                {formData.taxIncludedInPrice ? '├─' : ''} CGST ({formData.cgstRate}%)
              </span>
              <span>Rs. {preview.cgst.toFixed(2)}</span>
            </div>

            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">
                {formData.taxIncludedInPrice ? '└─' : ''} SGST ({formData.sgstRate}%)
              </span>
              <span>Rs. {preview.sgst.toFixed(2)}</span>
            </div>

            <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>Rs. {preview.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <WizardNavigation onNext={handleNext} canGoNext={true} />
    </div>
  );
}

export default TaxSettingsForm;
