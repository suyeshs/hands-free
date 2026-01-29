/**
 * Setup Validation Debug Component
 * Shows real-time validation status for all setup requirements
 */

import { useState, useEffect } from 'react';
import { useRestaurantSettingsStore } from '../../stores/restaurantSettingsStore';
import { useFloorPlanStore } from '../../stores/floorPlanStore';
import {
  useHasRestaurantBasics,
  useHasTaxBillingSetup,
  useHasFloorPlan,
} from '../../stores/setupWizardStore';

export function SetupValidationDebug() {
  const { settings } = useRestaurantSettingsStore();
  const { sections, tables } = useFloorPlanStore();

  const hasBasics = useHasRestaurantBasics();
  const hasTax = useHasTaxBillingSetup();
  const hasFloor = useHasFloorPlan();

  // Force re-render every second to catch any missed updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Get raw state for comparison
  // const _rawSettings = useRestaurantSettingsStore.getState().settings;

  // Detailed validation breakdown
  const basicsChecks = {
    hasName: Boolean(settings.name?.trim() && settings.name !== 'Restaurant Name'),
    hasPhone: Boolean(settings.phone?.trim() && settings.phone.replace(/[^\d]/g, '').length === 10),
    hasLine1: Boolean(settings.address?.line1?.trim()),
    hasCity: Boolean(settings.address?.city?.trim()),
    hasState: Boolean(settings.address?.state?.trim()),
    hasPincode: Boolean(settings.address?.pincode?.trim() && settings.address?.pincode.length === 6),
  };

  const taxChecks = {
    hasTaxEnabled: settings.taxEnabled !== undefined,
    hasTaxConfig: Boolean(
      settings.taxEnabled !== undefined &&
      (settings.taxEnabled === false || (settings.cgstRate !== undefined && settings.sgstRate !== undefined))
    ),
    hasInvoicePrefix: Boolean(settings.invoicePrefix?.trim() && settings.invoicePrefix.length >= 2),
    hasInvoiceNumbers: Boolean(
      settings.currentInvoiceNumber !== undefined &&
      settings.currentInvoiceNumber !== null &&
      settings.invoiceStartNumber !== undefined
    ),
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-gray-900 text-white rounded-lg shadow-2xl max-w-lg text-xs font-mono max-h-[80vh] overflow-y-auto">
      <div className="font-bold mb-2 text-sm flex items-center justify-between">
        <span>🔍 Validation Debug</span>
        <span className="text-gray-500 text-xs">{new Date().toLocaleTimeString()}</span>
      </div>

      <div className="space-y-3">
        {/* Restaurant Basics */}
        <div className={hasBasics ? 'text-green-400' : 'text-red-400'}>
          <div className="font-bold">Restaurant Basics: {hasBasics ? '✓' : '✗'}</div>
          <div className="pl-4 text-gray-400 space-y-1">
            <div className={basicsChecks.hasName ? 'text-green-300' : 'text-red-300'}>
              {basicsChecks.hasName ? '✓' : '✗'} name: "{settings.name || '(empty)'}"
            </div>
            <div className={basicsChecks.hasPhone ? 'text-green-300' : 'text-red-300'}>
              {basicsChecks.hasPhone ? '✓' : '✗'} phone: "{settings.phone || '(empty)'}"
              {settings.phone && ` (${settings.phone.replace(/[^\d]/g, '').length} digits)`}
            </div>
            <div className={basicsChecks.hasLine1 ? 'text-green-300' : 'text-red-300'}>
              {basicsChecks.hasLine1 ? '✓' : '✗'} address.line1: "{settings.address?.line1 || '(empty)'}"
            </div>
            <div className={basicsChecks.hasCity ? 'text-green-300' : 'text-red-300'}>
              {basicsChecks.hasCity ? '✓' : '✗'} address.city: "{settings.address?.city || '(empty)'}"
            </div>
            <div className={basicsChecks.hasState ? 'text-green-300' : 'text-red-300'}>
              {basicsChecks.hasState ? '✓' : '✗'} address.state: "{settings.address?.state || '(empty)'}"
            </div>
            <div className={basicsChecks.hasPincode ? 'text-green-300' : 'text-red-300'}>
              {basicsChecks.hasPincode ? '✓' : '✗'} address.pincode: "{settings.address?.pincode || '(empty)'}"
              {settings.address?.pincode && ` (${settings.address.pincode.length} digits)`}
            </div>
          </div>
        </div>

        {/* Tax & Billing */}
        <div className={hasTax ? 'text-green-400' : 'text-red-400'}>
          <div className="font-bold">Tax & Billing: {hasTax ? '✓' : '✗'}</div>
          <div className="pl-4 text-gray-400 space-y-1">
            <div className={taxChecks.hasTaxEnabled ? 'text-green-300' : 'text-red-300'}>
              {taxChecks.hasTaxEnabled ? '✓' : '✗'} taxEnabled: {String(settings.taxEnabled)}
              {!taxChecks.hasTaxEnabled && ' (MUST set to true or false)'}
            </div>
            <div className={taxChecks.hasTaxConfig ? 'text-green-300' : 'text-red-300'}>
              {taxChecks.hasTaxConfig ? '✓' : '✗'} tax config:
              {settings.taxEnabled && ` CGST:${settings.cgstRate} SGST:${settings.sgstRate}`}
              {settings.taxEnabled === false && ' (disabled)'}
            </div>
            <div className={taxChecks.hasInvoicePrefix ? 'text-green-300' : 'text-red-300'}>
              {taxChecks.hasInvoicePrefix ? '✓' : '✗'} invoicePrefix: "{settings.invoicePrefix || '(empty)'}"
              {settings.invoicePrefix && ` (${settings.invoicePrefix.length} chars)`}
            </div>
            <div className={taxChecks.hasInvoiceNumbers ? 'text-green-300' : 'text-red-300'}>
              {taxChecks.hasInvoiceNumbers ? '✓' : '✗'} invoice numbers:
              current={settings.currentInvoiceNumber}, start={settings.invoiceStartNumber}
            </div>
          </div>
        </div>

        {/* Floor Plan */}
        <div className={hasFloor ? 'text-green-400' : 'text-red-400'}>
          <div className="font-bold">Floor Plan: {hasFloor ? '✓' : '✗'}</div>
          <div className="pl-4 text-gray-400">
            <div className={sections.length >= 1 ? 'text-green-300' : 'text-red-300'}>
              {sections.length >= 1 ? '✓' : '✗'} sections: {sections.length} (need 1+)
            </div>
            <div className={tables.length >= 2 ? 'text-green-300' : 'text-red-300'}>
              {tables.length >= 2 ? '✓' : '✗'} tables: {tables.length} (need 2+)
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-700 text-yellow-400 text-[10px]">
        {!hasTax && taxChecks.hasTaxEnabled === false && (
          <div className="mb-2 p-2 bg-yellow-900/30 rounded">
            ⚠️ Tax & Billing incomplete: Click "Configure Tax & Billing" card and complete the setup
          </div>
        )}
        Press F12 for full console logs • Auto-refreshes every 1s
      </div>
    </div>
  );
}
