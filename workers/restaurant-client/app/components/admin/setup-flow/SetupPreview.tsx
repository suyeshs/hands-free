'use client';

import React from 'react';
import { useSetup } from '@/app/contexts/SetupContext';

/**
 * Setup Preview Component
 * Shows a live summary of all configured settings
 */
export function SetupPreview() {
  const { setupState } = useSetup();

  return (
    <div className="neu-concave rounded-2xl p-6 space-y-6">
      <h3 className="text-xl font-bold text-neu-text mb-4">Configuration Summary</h3>

      {/* Restaurant Info */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-neu-text-secondary uppercase tracking-wide">
          Restaurant Information
        </h4>
        <div className="space-y-2">
          <PreviewItem
            label="Name"
            value={setupState.restaurantName || '-'}
            complete={setupState.step1Complete}
          />
          <PreviewItem
            label="Cuisine"
            value={setupState.cuisine || '-'}
            complete={setupState.step1Complete}
          />
          <PreviewItem
            label="Address"
            value={setupState.address || '-'}
            complete={setupState.step1Complete}
          />
          <PreviewItem
            label="Phone"
            value={setupState.phone || '-'}
            complete={setupState.step1Complete}
          />
          <PreviewItem
            label="Hours"
            value={setupState.hours || '-'}
            complete={setupState.step1Complete}
          />
          {setupState.about && (
            <PreviewItem
              label="About"
              value={setupState.about.substring(0, 100) + (setupState.about.length > 100 ? '...' : '')}
              complete={true}
            />
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-neu-text-secondary/20 to-transparent" />

      {/* Voice AI */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-neu-text-secondary uppercase tracking-wide">
          Voice AI Configuration
        </h4>
        <div className="space-y-2">
          <PreviewItem
            label="Voice"
            value={setupState.voiceName ? `${setupState.voiceName}` : '-'}
            complete={setupState.step2Complete}
          />
          <PreviewItem
            label="Tone"
            value={setupState.tone}
            complete={setupState.step2Complete}
          />
          <PreviewItem
            label="Response Length"
            value={setupState.responseLength}
            complete={setupState.step2Complete}
          />
          <PreviewItem
            label="Languages"
            value={setupState.allowedLanguages.join(', ') || '-'}
            complete={setupState.step2Complete}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-neu-text-secondary/20 to-transparent" />

      {/* Theme & Branding */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-neu-text-secondary uppercase tracking-wide">
          Theme & Branding
        </h4>
        <div className="space-y-2">
          <PreviewItem
            label="Theme"
            value={setupState.themePreset ? setupState.themePreset.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'}
            complete={setupState.step3Complete}
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-neu-text-secondary">Primary Color</span>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md shadow-md"
                style={{ backgroundColor: setupState.primaryColor }}
              />
              <span className="text-sm font-medium text-neu-text">
                {setupState.primaryColor}
              </span>
            </div>
          </div>
          {setupState.tagline && (
            <PreviewItem
              label="Tagline"
              value={setupState.tagline}
              complete={true}
            />
          )}
        </div>
      </div>

      {/* Divider */}
      {setupState.menuFile && (
        <>
          <div className="h-px bg-gradient-to-r from-transparent via-neu-text-secondary/20 to-transparent" />

          {/* Menu */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-neu-text-secondary uppercase tracking-wide">
              Menu
            </h4>
            <div className="space-y-2">
              <PreviewItem
                label="File"
                value={setupState.menuFile.name}
                complete={true}
              />
            </div>
          </div>
        </>
      )}

      {/* Status Indicator */}
      <div className="mt-6 pt-6 border-t border-neu-text-secondary/10">
        {setupState.canActivate ? (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 rounded-xl">
            <span className="text-2xl">✓</span>
            <span className="text-sm font-semibold text-green-700">
              Ready to Activate
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 rounded-xl">
            <span className="text-2xl">⚠</span>
            <div className="flex-1">
              <span className="text-sm font-semibold text-yellow-700 block">
                Complete Required Steps
              </span>
              <span className="text-xs text-yellow-600">
                Steps 1-3 must be completed before activation
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Preview Item Component
 */
function PreviewItem({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-sm text-neu-text-secondary">{label}</span>
      <span
        className={`text-sm font-medium text-right max-w-[60%] ${
          complete ? 'text-neu-text' : 'text-neu-text-secondary/50'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
