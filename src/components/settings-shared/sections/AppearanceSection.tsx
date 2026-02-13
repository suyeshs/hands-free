/**
 * Appearance Section
 * Brightness slider and border style selector
 * Extracted from RestaurantSettingsInline.tsx
 */

import { Sun, Moon } from 'lucide-react';
import { useRestaurantSettings } from '../contexts/RestaurantSettingsContext';
import { SectionCard } from '../shared';
import { cn } from '@/lib/utils';

export function AppearanceSection() {
  const { formData, updateField } = useRestaurantSettings();

  const brightness = formData.posSettings?.brightness ?? 0;
  const borderStyle = formData.posSettings?.borderStyle ?? 'auto';

  return (
    <>
      {/* Adaptive Brightness Control */}
      <SectionCard
        title="Appearance & Brightness"
        description="Adjust screen brightness to match ambient lighting conditions"
      >
        <div className="space-y-4">
          {/* Brightness Slider */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sun size={18} className="text-warning" />
              <h3 className="text-sm font-semibold text-foreground">Adaptive Brightness</h3>
            </div>
            <div className="flex items-center gap-2">
              <Moon size={18} className="text-info" />
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="100"
              value={brightness}
              onChange={(e) => {
                const newBrightness = parseInt(e.target.value);
                updateField('posSettings.brightness', newBrightness);
              }}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer brightness-slider"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Bright (Day)</span>
              <span className="font-medium text-foreground">{brightness}%</span>
              <span>Dark (Night)</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Adjust screen brightness to match ambient lighting. The interface gradually transitions through different shades of grey from bright (0%) to dark (100%).
            {brightness < 30 && ' Optimal for bright daylight conditions.'}
            {brightness >= 30 && brightness < 60 && ' Balanced for indoor lighting.'}
            {brightness >= 60 && ' Optimized for evening and night operations.'}
          </p>
        </div>
      </SectionCard>

      {/* Border Style Control */}
      <SectionCard
        title="Border Style"
        description="Choose how corners and edges appear throughout the interface"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Corner Appearance</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => updateField('posSettings.borderStyle', 'rounded')}
              className={cn(
                'px-4 py-4 text-sm font-medium transition-colors border flex flex-col items-center gap-2 rounded-lg',
                borderStyle === 'rounded'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-card text-foreground border hover:bg-surface-2'
              )}
            >
              <div className="w-12 h-12 border-2 border-current rounded-lg" />
              <span>Rounded</span>
            </button>
            <button
              onClick={() => updateField('posSettings.borderStyle', 'sharp')}
              className={cn(
                'px-4 py-4 text-sm font-medium transition-colors border flex flex-col items-center gap-2',
                borderStyle === 'sharp'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-card text-foreground border hover:bg-surface-2'
              )}
            >
              <div className="w-12 h-12 border-2 border-current" />
              <span>Sharp</span>
            </button>
            <button
              onClick={() => updateField('posSettings.borderStyle', 'auto')}
              className={cn(
                'px-4 py-4 text-sm font-medium transition-colors border flex flex-col items-center gap-2 rounded-lg',
                borderStyle === 'auto' || !borderStyle
                  ? 'bg-accent text-white border-accent'
                  : 'bg-card text-foreground border hover:bg-surface-2'
              )}
            >
              <div className="w-12 h-12 border-2 border-current rounded-tl-xl rounded-br-xl" />
              <span>Auto</span>
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            {borderStyle === 'rounded' && 'Always use rounded corners for a friendly, modern look.'}
            {borderStyle === 'sharp' && 'Always use sharp edges for a professional, sophisticated appearance.'}
            {(borderStyle === 'auto' || !borderStyle) &&
              'Automatically adjust based on brightness: rounded when light, sharp when dark.'}
          </p>
        </div>
      </SectionCard>
    </>
  );
}
