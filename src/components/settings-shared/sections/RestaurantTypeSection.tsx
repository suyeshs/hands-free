/**
 * Restaurant Type Section
 * Dropdown selector for restaurant type with feature presets
 * Extracted from RestaurantSettingsInline.tsx
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard } from '../shared';
import { cn } from '@/lib/utils';
import {
  RestaurantType,
  getRestaurantTypeConfig,
  RESTAURANT_TYPE_CONFIGS,
  getFeaturePreset,
} from '@/types/restaurantTypes';

export function RestaurantTypeSection() {
  const { formData, updateField } = useRestaurantSettings();
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const restaurantType = (formData.restaurantType as RestaurantType) || RestaurantType.FULL_SERVICE;
  const typeConfig = getRestaurantTypeConfig(restaurantType);
  const Icon = typeConfig.icon;

  const handleTypeChange = (newType: RestaurantType) => {
    // Apply the feature preset for the selected type
    const featurePreset = getFeaturePreset(newType);

    // Ensure chainManagement is enabled for multi-location types
    if (newType === RestaurantType.MULTI_BRAND || newType === RestaurantType.LARGE_CHAIN) {
      featurePreset.chainManagement = true;
    }

    // Update both restaurant type and features
    updateField('restaurantType', newType);
    updateField('features', featurePreset);

    setShowTypeDropdown(false);

    // Log the change for visibility
    const newConfig = getRestaurantTypeConfig(newType);
    console.log(`[RestaurantSettings] Restaurant type changed to: ${newConfig.label}`);
    console.log(`[RestaurantSettings] Features updated:`, featurePreset);
  };

  return (
    <SectionCard title="Restaurant Type" description="Select your business type to optimize features">
      <div className="bg-surface-2/50 neo-inset p-4 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Icon className="w-7 h-7 text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">{typeConfig.label}</div>
              <div className="text-xs text-muted-foreground truncate">{typeConfig.description}</div>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-accent hover:text-accent/80 border border-accent transition-colors whitespace-nowrap bg-background rounded"
            >
              Change Type
              <ChevronDown size={16} />
            </button>
            {showTypeDropdown && (
              <div className="neo-raised-lg absolute right-0 top-full mt-2 w-80 border-2 border-accent/30 shadow-xl z-50 max-h-96 overflow-y-auto rounded-lg">
                <div className="p-2 bg-accent/10 border-b border-accent/20">
                  <p className="text-xs font-medium text-foreground">Select Restaurant Type</p>
                </div>
                {Object.values(RESTAURANT_TYPE_CONFIGS).map((config) => {
                  const TypeIcon = config.icon;
                  return (
                    <button
                      key={config.type}
                      onClick={() => handleTypeChange(config.type)}
                      className={cn(
                        'w-full text-left p-3 hover:bg-surface-2 border-b border transition-colors last:border-b-0',
                        config.type === restaurantType && 'bg-accent/15 border-accent/30'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <TypeIcon className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{config.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{config.description}</div>
                        </div>
                        {config.type === restaurantType && (
                          <div className="text-accent text-xs font-bold">✓</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
