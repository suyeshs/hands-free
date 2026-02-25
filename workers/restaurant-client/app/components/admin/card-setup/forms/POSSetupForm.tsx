'use client';

import React, { useEffect } from 'react';
import { Download, Monitor, CheckCircle2, ExternalLink } from 'lucide-react';
import { useCardSetup } from '../../../../contexts/CardSetupContext';
import { SetupCardId } from '../types/setup-cards';

/**
 * POS Setup Form
 * Download and configuration instructions for Point of Sale application
 * This is an optional step
 */
export function POSSetupForm() {
  const { markCardInProgress, markCardComplete } = useCardSetup();

  // Mark as in progress when form is opened
  useEffect(() => {
    markCardInProgress(SetupCardId.POS);
  }, [markCardInProgress]);

  const handleMarkComplete = () => {
    markCardComplete(SetupCardId.POS);
  };

  return (
    <div className="space-y-6">
      {/* Download Section */}
      <div className="glass-panel p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-saffron/30 to-paprika/30 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-warm-white" />
          </div>
          <h3 className="text-xl font-bold text-warm-white font-display">
            Download POS Application
          </h3>
        </div>

        <p className="text-warm-white/70 leading-relaxed">
          Download and install our Point of Sale application to manage orders, track inventory,
          and process payments from your restaurant counter.
        </p>

        {/* Download Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Windows */}
          <div className="glass-panel border-saffron/20 p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-saffron/20 to-paprika/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-warm-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 5.557l7.357-1.002.004 7.097-7.354.042L3 5.557zm7.354 6.913l.006 7.103-7.354-1.011v-6.14l7.348.048zm.892-8.046L21.001 3v8.562l-9.755.077V4.424zm9.758 8.113l-.003 8.523-9.755-1.378-.014-7.161 9.772.016z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-warm-white">Windows</h4>
                <p className="text-xs text-warm-white/50">For Windows 10 & 11</p>
              </div>
            </div>
            <button
              disabled
              className="
                w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                bg-warm-white/10 text-warm-white/50 font-semibold text-sm
                cursor-not-allowed
              "
            >
              <Download className="w-4 h-4" />
              <span>Coming Soon</span>
            </button>
          </div>

          {/* macOS */}
          <div className="glass-panel border-saffron/20 p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-saffron/20 to-paprika/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-warm-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-warm-white">macOS</h4>
                <p className="text-xs text-warm-white/50">For macOS 11+</p>
              </div>
            </div>
            <button
              disabled
              className="
                w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg
                bg-warm-white/10 text-warm-white/50 font-semibold text-sm
                cursor-not-allowed
              "
            >
              <Download className="w-4 h-4" />
              <span>Coming Soon</span>
            </button>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-lg font-bold text-warm-white font-display mb-4">
          Setup Instructions
        </h3>

        <div className="space-y-4">
          {[
            {
              step: 1,
              title: 'Download the Application',
              description: 'Choose the version for your operating system and download the installer.',
            },
            {
              step: 2,
              title: 'Install and Launch',
              description: 'Run the installer and follow the on-screen instructions. Launch the app when complete.',
            },
            {
              step: 3,
              title: 'Connect Your Restaurant',
              description: 'Sign in with your restaurant credentials. The POS will automatically sync with your menu and settings.',
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-saffron/30 to-paprika/30 flex items-center justify-center text-warm-white font-bold text-sm">
                {item.step}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-warm-white mb-1">{item.title}</h4>
                <p className="text-sm text-warm-white/60">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration Section (Placeholder) */}
      <div className="glass-panel bg-warm-white/5 border-warm-white/10 p-6">
        <div className="text-center py-8">
          <Monitor className="w-12 h-12 text-warm-white/40 mx-auto mb-3" />
          <h4 className="font-semibold text-warm-white mb-2">
            POS Configuration
          </h4>
          <p className="text-sm text-warm-white/50 max-w-md mx-auto">
            Advanced POS settings and configuration options will be available after you download and install the application.
          </p>
        </div>
      </div>

      {/* Optional Badge */}
      <div className="glass-panel bg-honey/10 border-honey/20 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-honey flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-warm-white/80 font-semibold mb-1">
              This step is optional
            </p>
            <p className="text-sm text-warm-white/60">
              You can download and set up the POS application later from your dashboard.
              Your restaurant can still go live without it.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-4">
        <button
          onClick={handleMarkComplete}
          className="
            text-sm text-warm-white/60 hover:text-warm-white
            transition-colors duration-200
          "
        >
          Skip for now
        </button>

        <button
          onClick={handleMarkComplete}
          className="
            inline-flex items-center gap-2 px-6 py-3 rounded-lg
            bg-gradient-to-r from-paprika to-saffron
            hover:from-paprika/90 hover:to-saffron/90
            text-warm-charcoal font-semibold text-sm
            shadow-warm-glow hover:shadow-saffron-glow
            transition-all duration-200
          "
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Mark as Complete</span>
        </button>
      </div>

      {/* Help Link */}
      <div className="text-center">
        <a
          href="#"
          className="
            inline-flex items-center gap-2 text-sm text-saffron hover:text-saffron-light
            transition-colors duration-200
          "
        >
          <ExternalLink className="w-4 h-4" />
          <span>View POS Setup Documentation</span>
        </a>
      </div>
    </div>
  );
}
