'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRestaurant } from '@/app/contexts/RestaurantContext';
import { SetupProvider } from '@/app/contexts/SetupContext';
import { Step2VoiceAI } from '@/app/components/admin/setup-flow/Step2VoiceAI';

/**
 * Voice AI Configuration Page
 * Allows editing of voice settings, tone, and languages
 */
export default function VoiceConfigPage() {
  const { profile } = useRestaurant();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save functionality to update backend
    setTimeout(() => {
      setIsSaving(false);
      alert('Voice AI settings saved! (Save functionality to be implemented)');
    }, 1000);
  };

  return (
    <SetupProvider>
      <div className="min-h-screen bg-neu-bg">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="neu-button px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-all"
              >
                ← Back to Dashboard
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-neu-text">Voice AI Configuration</h1>
                <p className="text-sm text-neu-text-secondary">
                  {profile?.name || 'Restaurant'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="neu-button-accent px-6 py-3 rounded-lg font-semibold text-white hover:shadow-xl transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="neu-concave rounded-2xl p-8">
            <Step2VoiceAI />
          </div>

          {/* Save Button (Bottom) */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="neu-button-accent px-8 py-4 rounded-xl font-bold text-white text-lg hover:shadow-2xl transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving Voice Settings...' : 'Save Voice Settings'}
            </button>
          </div>
        </div>
      </div>
    </SetupProvider>
  );
}
