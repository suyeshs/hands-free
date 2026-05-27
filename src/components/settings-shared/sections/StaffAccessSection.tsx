/**
 * Staff & Access Section
 * Staff PIN requirements, session timeout, table filtering
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useEffect } from 'react';
import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard, FormField } from '../shared';
import { cn } from '@/lib/utils';
import {
  RestaurantType,
  getSettingCriticality,
  SettingCriticality,
} from '@/types/restaurantTypes';
import { useFloorPlanStore } from '@/stores/floorPlanStore';
import { useAuthStore } from '@/stores/authStore';

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

export function StaffAccessSection() {
  const { formData, updateField } = useRestaurantSettings();
  const { user } = useAuthStore();
  const { sections, loadFloorPlan, isLoaded, isLoading } = useFloorPlanStore();

  const restaurantType = (formData.restaurantType as RestaurantType) || RestaurantType.FULL_SERVICE;
  const lockedSectionIds: string[] = formData.posSettings?.lockedSectionIds ?? [];

  useEffect(() => {
    if (user?.tenantId && !isLoaded && !isLoading) {
      loadFloorPlan(user.tenantId);
    }
  }, [user?.tenantId, isLoaded, isLoading, loadFloorPlan]);

  function toggleLockedSection(sectionId: string) {
    const next = lockedSectionIds.includes(sectionId)
      ? lockedSectionIds.filter(id => id !== sectionId)
      : [...lockedSectionIds, sectionId];
    updateField('posSettings.lockedSectionIds', next);
  }

  return (
    <SectionCard title="Staff & Access Control" description="Configure staff authentication and access permissions">
      <div className="space-y-4">
        {getSettingCriticality(restaurantType, 'fields', 'staffPin') !== SettingCriticality.HIDDEN && (
          <>
            <div className="flex items-center justify-between p-4 bg-surface-1/50 rounded-lg border border-border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Require Staff PIN</h3>
                  <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'staffPin')} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Staff must enter PIN to access POS</p>
              </div>
              <button
                onClick={() => updateField('posSettings.requireStaffPinForPOS', !(formData.posSettings?.requireStaffPinForPOS ?? false))}
                className={cn(
                  'relative w-16 h-9 rounded-full transition-colors',
                  (formData.posSettings?.requireStaffPinForPOS ?? false) ? 'bg-accent' : 'bg-muted'
                )}
                role="switch"
                aria-checked={formData.posSettings?.requireStaffPinForPOS ?? false}
              >
                <div
                  className={cn(
                    'absolute top-1 w-7 h-7 bg-card shadow-md rounded-full transition-transform',
                    (formData.posSettings?.requireStaffPinForPOS ?? false) ? 'translate-x-8' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <FormField
              label="PIN Session Timeout (minutes)"
              description="0 = no timeout, staff stays logged in"
            >
              <input
                type="number"
                value={formData.posSettings?.pinSessionTimeoutMinutes ?? 0}
                onChange={(e) => updateField('posSettings.pinSessionTimeoutMinutes', parseInt(e.target.value))}
                className="w-full neo-inset px-4 py-4 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                min="0"
                placeholder="0 = no timeout"
              />
            </FormField>
          </>
        )}

        {getSettingCriticality(restaurantType, 'fields', 'tableFiltering') !== SettingCriticality.HIDDEN && (
          <div className="flex items-center justify-between p-4 bg-surface-1/50 rounded-lg border border-border">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Filter Tables by Staff</h3>
                <CriticalityBadge level={getSettingCriticality(restaurantType, 'fields', 'tableFiltering')} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Only show tables assigned to logged-in staff</p>
            </div>
            <button
              onClick={() => updateField('posSettings.filterTablesByStaffAssignment', !(formData.posSettings?.filterTablesByStaffAssignment ?? false))}
              className={cn(
                'relative w-16 h-9 rounded-full transition-colors',
                (formData.posSettings?.filterTablesByStaffAssignment ?? false) ? 'bg-accent' : 'bg-muted'
              )}
              role="switch"
              aria-checked={formData.posSettings?.filterTablesByStaffAssignment ?? false}
            >
              <div
                className={cn(
                  'absolute top-1 w-7 h-7 bg-card shadow-md rounded-full transition-transform',
                  (formData.posSettings?.filterTablesByStaffAssignment ?? false) ? 'translate-x-8' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        )}
        {sections.length > 0 && (
          <div className="p-4 bg-surface-1/50 rounded-lg border border-border space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Lock Device to Sections</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This terminal will only show tables in the selected sections, regardless of who is logged in.
                Leave all unselected to show every section.
              </p>
            </div>

            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading sections…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sections.map((section) => {
                  const isLocked = lockedSectionIds.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      onClick={() => toggleLockedSection(section.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                        isLocked
                          ? 'bg-accent text-white border-accent'
                          : 'bg-surface-1 text-muted-foreground border-border hover:border-accent/50'
                      )}
                    >
                      {section.name}
                    </button>
                  );
                })}
              </div>
            )}

            {lockedSectionIds.length > 0 && (
              <p className="text-xs text-accent font-medium">
                Locked to {lockedSectionIds.length} section{lockedSectionIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
