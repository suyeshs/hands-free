/**
 * Legal Information Section
 * Tax and license numbers (GSTIN, FSSAI, PAN)
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, FormField } from '../shared';
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

export function LegalInfoSection() {
  const { formData, updateField } = useRestaurantSettings();

  const restaurantType = (formData.restaurantType as RestaurantType) || RestaurantType.FULL_SERVICE;

  return (
    <SectionCard title="Tax & License Numbers" description="Legal registration and compliance information">
      <div className="space-y-4">
        {getSettingCriticality(restaurantType, 'fields', 'gstNumber') !== SettingCriticality.HIDDEN && (
          <FormField
            label={
              <div className="flex items-center gap-2">
                <span>
                  GSTIN (GST Number)
                  {getSettingCriticality(restaurantType, 'fields', 'gstNumber') === SettingCriticality.CRITICAL && ' *'}
                </span>
                <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'gstNumber')} />
              </div>
            }
          >
            <input
              type="text"
              value={formData.gstNumber || ''}
              onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase())}
              className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
          </FormField>
        )}

        {getSettingCriticality(restaurantType, 'fields', 'fssaiNumber') !== SettingCriticality.HIDDEN && (
          <FormField
            label={
              <div className="flex items-center gap-2">
                <span>
                  FSSAI License Number
                  {getSettingCriticality(restaurantType, 'fields', 'fssaiNumber') === SettingCriticality.CRITICAL && ' *'}
                </span>
                <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'fssaiNumber')} />
              </div>
            }
          >
            <input
              type="text"
              value={formData.fssaiNumber || ''}
              onChange={(e) => updateField('fssaiNumber', e.target.value)}
              className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="12345678901234"
              maxLength={14}
            />
          </FormField>
        )}

        {getSettingCriticality(restaurantType, 'fields', 'panNumber') !== SettingCriticality.HIDDEN && (
          <FormField
            label={
              <div className="flex items-center gap-2">
                <span>
                  PAN Number
                  {getSettingCriticality(restaurantType, 'fields', 'panNumber') === SettingCriticality.CRITICAL && ' *'}
                </span>
                <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'panNumber')} />
              </div>
            }
          >
            <input
              type="text"
              value={formData.panNumber || ''}
              onChange={(e) => updateField('panNumber', e.target.value.toUpperCase())}
              className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="AAAAA0000A"
              maxLength={10}
            />
          </FormField>
        )}
      </div>
    </SectionCard>
  );
}
