/**
 * Printer Setup Screen
 * Configure bill and KOT printers during setup wizard
 */

import { PrinterSettingsInline } from '../../admin/PrinterSettingsInline';

export function PrinterSetupScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Printer Configuration</h2>
        <p className="text-muted-foreground">
          Configure your bill and kitchen printers. You can skip this step and configure later in settings.
        </p>
      </div>

      <PrinterSettingsInline />
    </div>
  );
}
