/**
 * Online Features Section
 * Master toggle for cloud sync, online ordering, and customer website
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, Toggle } from '../shared';

export function OnlineFeaturesSection() {
  const { formData, updateField } = useRestaurantSettings();

  const isOnline = formData.posSettings?.activateOnline ?? false;

  return (
    <SectionCard
      title="Online Features"
      description="Master toggle for all online features including cloud sync, online ordering, and customer-facing website"
    >
      <div className="space-y-4">
        <Toggle
          enabled={isOnline}
          onChange={(val) => updateField('posSettings.activateOnline', val)}
          label="Activate Online Features"
          description="Enable cloud sync, online ordering, and customer website (requires internet connection)"
        />

        {isOnline ? (
          <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
            <p className="text-sm font-semibold text-success mb-1">✓ Online Features Active</p>
            <p className="text-xs text-muted-foreground">
              Cloud sync enabled. Your menu, orders, and settings will sync to the cloud. Visit Settings → Operations → Online Presence to configure your customer website.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-info/10 border border-info/30 rounded-lg">
            <p className="text-sm font-semibold text-info mb-1">Offline Mode</p>
            <p className="text-xs text-muted-foreground">
              Your POS works fully offline. Enable this to activate cloud sync, online ordering, and your customer-facing website.
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
