'use client';

import React, { useEffect } from 'react';
import { Save } from 'lucide-react';
import { useCardSetup } from '../../../../contexts/CardSetupContext';
import { SetupCardId } from '../types/setup-cards';
import { Step2VoiceAI } from '../../setup-flow/Step2VoiceAI';

/**
 * AI Setup Form
 * Wrapper around existing Step2VoiceAI component
 * Configures voice assistant settings, tone, and language
 */
export function AISetupForm() {
  const { markCardInProgress, markCardComplete } = useCardSetup();

  // Mark as in progress when form is opened
  useEffect(() => {
    markCardInProgress(SetupCardId.AI);
  }, [markCardInProgress]);

  const handleSaveAndContinue = () => {
    // Mark AI card as complete
    markCardComplete(SetupCardId.AI);
  };

  return (
    <div className="space-y-6">
      {/* AI Step Component */}
      <div className="glass-panel p-6">
        <Step2VoiceAI />
      </div>

      {/* Info Message */}
      <div className="glass-panel bg-saffron/10 border-saffron/20 p-4">
        <p className="text-sm text-warm-white/70 leading-relaxed">
          <strong className="text-saffron">Tip:</strong> Your AI assistant will handle customer inquiries, take orders,
          and provide information about your menu. Choose a voice and tone that matches your brand personality.
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
