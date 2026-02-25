'use client';

import React, { useEffect } from 'react';
import { Save } from 'lucide-react';
import { useCardSetup } from '../../../../contexts/CardSetupContext';
import { SetupCardId } from '../types/setup-cards';
import { Step4Menu } from '../../setup-flow/Step4Menu';

/**
 * Menu Setup Form
 * Wrapper around existing Step4Menu component
 * Allows restaurant to upload or manually create menu items
 */
export function MenuSetupForm() {
  const { markCardInProgress, markCardComplete } = useCardSetup();

  // Mark as in progress when form is opened
  useEffect(() => {
    markCardInProgress(SetupCardId.MENU);
  }, [markCardInProgress]);

  const handleSaveAndContinue = () => {
    // Mark menu card as complete
    markCardComplete(SetupCardId.MENU);
  };

  return (
    <div className="space-y-6">
      {/* Menu Step Component */}
      <div className="glass-panel p-6">
        <Step4Menu />
      </div>

      {/* Info Message */}
      <div className="glass-panel bg-saffron/10 border-saffron/20 p-4">
        <p className="text-sm text-warm-white/70 leading-relaxed">
          <strong className="text-saffron">Tip:</strong> You can add menu items now or skip this step and add them later from your dashboard.
          Menu items help customers browse and order through your voice assistant.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={handleSaveAndContinue}
          className="
            inline-flex items-center gap-2 px-6 py-3 rounded-lg
            bg-gradient-to-r from-paprika to-saffron
            hover:from-paprika/90 hover:to-saffron/90
            text-warm-charcoal font-semibold text-sm
            shadow-warm-glow hover:shadow-saffron-glow
            transition-all duration-200
          "
        >
          <Save className="w-4 h-4" />
          <span>Save & Continue</span>
        </button>
      </div>
    </div>
  );
}
