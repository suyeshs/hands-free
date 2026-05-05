/**
 * Tax Configuration Section
 * Country-specific tax settings with dynamic fields
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, FormField, Toggle } from '../shared';
import { cn } from '@/lib/utils';
import { useTaxNomenclature } from '@/hooks/useTaxNomenclature';
import {
  RestaurantType,
  getSettingCriticality,
  SettingCriticality,
} from '@/types/restaurantTypes';

// Badge component for criticality indicators
const CriticalityBadge = ({ level }: { level: SettingCriticality }) => {
  if (level === SettingCriticality.OPTIONAL || level === SettingCriticality.HIDDEN) {
    return null;
  }

  const config = {
    [SettingCriticality.CRITICAL]: {
      className: 'bg-destructive/10 text-destructive border border-destructive/30',
      label: 'Required',
    },
    [SettingCriticality.RECOMMENDED]: {
      className: 'bg-info/10 text-info border border-info/30',
      label: 'Recommended',
    },
  }[level];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${config.className}`}>
      {config.label}
    </span>
  );
};

export function TaxConfigurationSection() {
  const { formData, updateField } = useRestaurantSettings();

  // Fetch tax nomenclature based on selected country
  const { taxInfo, loading: taxInfoLoading, error: taxInfoError } = useTaxNomenclature(
    formData.countryCode,
    true // Always active when this section is visible
  );

  const restaurantType = (formData.restaurantType as RestaurantType) || RestaurantType.FULL_SERVICE;

  return (
    <>
      {/* Country Selection */}
      <SectionCard title="Tax Jurisdiction" description="Select your country to load region-specific tax requirements">
        <FormField label="Country / Region" required>
          <select
            value={formData.countryCode || 'IN'}
            onChange={(e) => updateField('countryCode', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Select Country...</option>
            <option value="IN">🇮🇳 India</option>
            <option value="US">🇺🇸 United States</option>
            <option value="GB">🇬🇧 United Kingdom</option>
            <option value="DE">🇩🇪 Germany</option>
            <option value="AE">🇦🇪 United Arab Emirates</option>
            <option value="AU">🇦🇺 Australia</option>
            <option value="CA">🇨🇦 Canada</option>
            <option value="SG">🇸🇬 Singapore</option>
            <option value="FR">🇫🇷 France</option>
            <option value="ES">🇪🇸 Spain</option>
            <option value="IT">🇮🇹 Italy</option>
            <option value="JP">🇯🇵 Japan</option>
            <option value="CN">🇨🇳 China</option>
            <option value="BR">🇧🇷 Brazil</option>
            <option value="MX">🇲🇽 Mexico</option>
          </select>
        </FormField>

        {taxInfoLoading && (
          <p className="text-sm text-muted-foreground mt-2">Loading tax information...</p>
        )}
        {taxInfoError && (
          <p className="text-sm text-destructive mt-2">{taxInfoError}</p>
        )}
        {taxInfo && (
          <div className="mt-3 p-3 bg-surface-1 rounded-lg border border-border">
            <p className="text-sm font-medium text-foreground">{taxInfo.taxSystemName}</p>
            <p className="text-xs text-muted-foreground mt-1">{taxInfo.taxRate.description}</p>
            {taxInfo.verified && (
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                ✓ Verified compliance-ready data
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* Tax ID Fields (Dynamic based on country) */}
      {taxInfo && taxInfo.taxIdFields && taxInfo.taxIdFields.length > 0 && (
        <SectionCard title="Tax Registration Numbers" description="Enter your tax identification numbers">
          <div className="space-y-4">
            {taxInfo.taxIdFields.map((field) => (
              <FormField
                key={field.id}
                label={field.label}
                required={field.required}
                description={`${field.description} • Format: ${field.format}`}
              >
                <input
                  type="text"
                  value={formData.taxIdFields?.[field.id] || ''}
                  onChange={(e) => {
                    const newTaxIdFields = { ...(formData.taxIdFields || {}), [field.id]: e.target.value };
                    updateField('taxIdFields', newTaxIdFields);
                  }}
                  className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder={field.example}
                  maxLength={field.maxLength}
                  pattern={field.validation}
                  required={field.required}
                />
              </FormField>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Compliance Notes */}
      {taxInfo && taxInfo.complianceNotes && taxInfo.complianceNotes.length > 0 && (
        <div className="neo-raised bg-warning/10 border border-warning/30 p-4 rounded-lg">
          <h4 className="text-sm font-semibold text-foreground mb-2">📋 Compliance Requirements</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {taxInfo.complianceNotes.map((note, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tax Enable/Disable Toggle */}
      <SectionCard title="Tax Settings">
        <div className="space-y-4">
          <Toggle
            enabled={formData.taxEnabled ?? true}
            onChange={(val) => updateField('taxEnabled', val)}
            label="Tax Enabled"
            description="When disabled, menu price = billing price (no tax applied)"
          />
          {!formData.taxEnabled && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Tax is disabled. Menu prices will be billed as-is without any tax calculation.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Tax Rates (Dynamic based on country) */}
      {taxInfo && (
        <SectionCard
          title={`Tax Rates (${taxInfo.taxSystemName})`}
          description="Configure tax rates for your jurisdiction"
        >
          <div className={cn("space-y-4", !formData.taxEnabled && "opacity-50 pointer-events-none")}>
            {/* India: Show CGST + SGST (split GST system) */}
            {formData.countryCode === 'IN' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="CGST Rate (%)">
                    <input
                      type="number"
                      value={formData.cgstRate || 2.5}
                      onChange={(e) => updateField('cgstRate', parseFloat(e.target.value))}
                      className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </FormField>
                  <FormField label="SGST Rate (%)">
                    <input
                      type="number"
                      value={formData.sgstRate || 2.5}
                      onChange={(e) => updateField('sgstRate', parseFloat(e.target.value))}
                      className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </FormField>
                </div>
                <p className="text-xs text-muted-foreground">
                  {taxInfo.taxRate.description}
                </p>
              </>
            )}

            {/* Other Countries: Show standard tax rate */}
            {formData.countryCode !== 'IN' && (
              <>
                <FormField
                  label={`${taxInfo.taxSystemName} Standard Rate (%)`}
                  description={taxInfo.taxRate.description}
                >
                  <input
                    type="number"
                    value={formData.taxRate || taxInfo.taxRate.standard}
                    onChange={(e) => updateField('taxRate', parseFloat(e.target.value))}
                    className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    step="0.1"
                    min="0"
                    max="50"
                  />
                </FormField>

                {/* Reduced Rates (if applicable) */}
                {taxInfo.taxRate.reduced && taxInfo.taxRate.reduced.length > 0 && (
                  <div className="p-3 bg-surface-1 rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Available Reduced Rates:</p>
                    <div className="flex flex-wrap gap-2">
                      {taxInfo.taxRate.reduced.map((rate, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-accent/10 text-accent rounded"
                        >
                          {rate}%
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Configure reduced rates in menu item settings
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Service Charge (all countries) */}
            {getSettingCriticality(restaurantType, 'fields', 'serviceCharge') !== SettingCriticality.HIDDEN && (
              <FormField
                label={
                  <div className="flex items-center gap-2">
                    <span>Service Charge (%)</span>
                    <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'serviceCharge')} />
                  </div>
                }
              >
                <input
                  type="number"
                  value={formData.serviceChargeRate}
                  onChange={(e) => updateField('serviceChargeRate', parseFloat(e.target.value))}
                  className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  step="0.5"
                  min="0"
                  max="25"
                />
              </FormField>
            )}
          </div>
        </SectionCard>
      )}

      {/* Fallback: Show generic tax rate if no country selected */}
      {!taxInfo && (
        <SectionCard title="Tax Rates" description="Select a country to load specific tax rates">
          <div className={cn("space-y-4", !formData.taxEnabled && "opacity-50 pointer-events-none")}>
            <FormField label="Tax Rate (%)" description="Select a country above to load country-specific tax rates">
              <input
                type="number"
                value={formData.taxRate || 0}
                onChange={(e) => updateField('taxRate', parseFloat(e.target.value))}
                className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                step="0.1"
                min="0"
                max="50"
              />
            </FormField>

            {getSettingCriticality(restaurantType, 'fields', 'serviceCharge') !== SettingCriticality.HIDDEN && (
              <FormField
                label={
                  <div className="flex items-center gap-2">
                    <span>Service Charge (%)</span>
                    <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'serviceCharge')} />
                  </div>
                }
              >
                <input
                  type="number"
                  value={formData.serviceChargeRate}
                  onChange={(e) => updateField('serviceChargeRate', parseFloat(e.target.value))}
                  className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  step="0.5"
                  min="0"
                  max="25"
                />
              </FormField>
            )}
          </div>
        </SectionCard>
      )}

      {/* Billing Options */}
      <SectionCard title="Billing Options" description="Configure how taxes and charges are applied">
        <div className="space-y-4">
          {getSettingCriticality(restaurantType, 'fields', 'serviceCharge') !== SettingCriticality.HIDDEN && (
            <Toggle
              enabled={formData.serviceChargeEnabled}
              onChange={(val) => updateField('serviceChargeEnabled', val)}
              label="Enable Service Charge"
              description="Add service charge to all bills"
            />
          )}
          <div className={cn(!formData.taxEnabled && "opacity-50 pointer-events-none")}>
            <Toggle
              enabled={formData.taxIncludedInPrice}
              onChange={(val) => updateField('taxIncludedInPrice', val)}
              label="Tax Inclusive Pricing"
              description={`Menu prices already include ${taxInfo?.taxSystemName || 'tax'}`}
            />
          </div>
          <Toggle
            enabled={formData.roundOffEnabled}
            onChange={(val) => updateField('roundOffEnabled', val)}
            label="Round Off Total"
            description="Round bill total to nearest whole number"
          />
        </div>
      </SectionCard>
    </>
  );
}
