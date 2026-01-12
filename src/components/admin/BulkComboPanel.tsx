/**
 * Bulk Combo Panel
 * Wrapper for BulkComboConfigurator to use in Settings page
 */

import { useState } from 'react';
import { BulkComboConfigurator } from './BulkComboConfigurator';
import { useMenuStore } from '../../stores/menuStore';
import { LayoutGrid } from 'lucide-react';

export function BulkComboPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { loadMenuFromDatabase } = useMenuStore();

  const handleSaved = async () => {
    // Reload menu to show updated combo configurations
    await loadMenuFromDatabase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30">
          <LayoutGrid className="w-6 h-6 text-accent" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">Bulk Combo Configuration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Apply the same combo options (rice, papad, etc.) to all items in a category at once
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-6 rounded-xl bg-white/5 border border-border space-y-4">
        <div>
          <h4 className="font-bold text-white mb-2">How it works:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Select a category (e.g., "Combo" or "Thali")</li>
            <li>Create combo groups (e.g., "Choose Your Rice", "Choose Your Papad")</li>
            <li>Add items to each group using the quick-add buttons</li>
            <li>Apply to all items in the category with one click</li>
          </ol>
        </div>

        <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
          <p className="text-sm text-accent font-semibold">💡 Tip:</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use the "All Rice Items", "All Papad/Sides" quick buttons to add all matching items at once.
            This saves time when setting up combos with many options.
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => setIsOpen(true)}
          className="px-8 py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-wider hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center gap-3"
        >
          <LayoutGrid className="w-5 h-5" />
          <span>Configure Bulk Combos</span>
        </button>
      </div>

      {/* Example */}
      <div className="p-6 rounded-xl bg-white/5 border border-border space-y-3">
        <h4 className="font-bold text-white">Example Use Case:</h4>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            If you have 10 combo items in the "Combo" category and they all need the same rice and papad options:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-4">
            <li>Open bulk configurator</li>
            <li>Select "Combo" category</li>
            <li>Add group: "Choose Your Rice"</li>
            <li>Click "🍚 All Rice Items" to add all rice options</li>
            <li>Add group: "Choose Your Papad"</li>
            <li>Click "🥗 All Papad/Sides" to add all papad options</li>
            <li>Click "Apply to 10 Items"</li>
          </ol>
          <p className="text-emerald-400 font-semibold mt-3">
            ✓ All 10 items now have the same combo options configured!
          </p>
        </div>
      </div>

      {/* Modal */}
      <BulkComboConfigurator
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
