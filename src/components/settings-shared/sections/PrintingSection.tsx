/**
 * Printing Section
 * Receipt printing configuration (paper width, logo, QR code, itemwise tax)
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, FormField, Toggle } from '../shared';
import { cn } from '@/lib/utils';
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

export function PrintingSection() {
  const { formData, updateField } = useRestaurantSettings();

  const restaurantType = (formData.restaurantType as RestaurantType) || RestaurantType.FULL_SERVICE;

  return (
    <>
      <SectionCard title="Paper Settings" description="Configure receipt paper size for thermal printers">
        <FormField label="Paper Width" description="Must match your thermal printer model">
          <select
            value={formData.paperWidth}
            onChange={(e) => updateField('paperWidth', e.target.value)}
            className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="58mm">58mm (2 inch)</option>
            <option value="80mm">80mm (3 inch)</option>
          </select>
        </FormField>
      </SectionCard>

      <SectionCard title="Receipt Options" description="Customize what appears on printed receipts">
        <div className="space-y-4">
          {getSettingCriticality(restaurantType, 'fields', 'printLogo') !== SettingCriticality.HIDDEN && (
            <div className="flex items-center justify-between p-4 bg-surface-1/50 rounded-lg border border-border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Print Logo</h3>
                  <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'printLogo')} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Show restaurant logo on receipts</p>
              </div>
              <button
                onClick={() => updateField('printLogo', !formData.printLogo)}
                className={cn(
                  'relative w-16 h-9 rounded-full transition-colors',
                  formData.printLogo ? 'bg-accent' : 'bg-muted'
                )}
                role="switch"
                aria-checked={formData.printLogo}
              >
                <div
                  className={cn(
                    'absolute top-1 w-7 h-7 bg-card shadow-md rounded-full transition-transform',
                    formData.printLogo ? 'translate-x-8' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}

          {getSettingCriticality(restaurantType, 'fields', 'qrCode') !== SettingCriticality.HIDDEN && (
            <div className="flex items-center justify-between p-4 bg-surface-1/50 rounded-lg border border-border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Print QR Code</h3>
                  <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'qrCode')} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Show payment QR code on receipts</p>
              </div>
              <button
                onClick={() => updateField('printQRCode', !formData.printQRCode)}
                className={cn(
                  'relative w-16 h-9 rounded-full transition-colors',
                  formData.printQRCode ? 'bg-accent' : 'bg-muted'
                )}
                role="switch"
                aria-checked={formData.printQRCode}
              >
                <div
                  className={cn(
                    'absolute top-1 w-7 h-7 bg-card shadow-md rounded-full transition-transform',
                    formData.printQRCode ? 'translate-x-8' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}

          <Toggle
            enabled={formData.showItemwiseTax}
            onChange={(val) => updateField('showItemwiseTax', val)}
            label="Show Itemwise Tax"
            description="Display tax breakdown per item"
          />
        </div>
      </SectionCard>
    </>
  );
}
