'use client';

import { useState } from 'react';
import { useRestaurant } from '@/app/contexts/RestaurantContext';
import { useSetup } from '@/app/contexts/SetupContext';
import { Step1RestaurantInfo } from './setup-flow/Step1RestaurantInfo';
import { Step2VoiceAI } from './setup-flow/Step2VoiceAI';
import { Step3ThemeBranding } from './setup-flow/Step3ThemeBranding';
import { Step4Menu } from './setup-flow/Step4Menu';
import { ActivateButton } from './setup-flow/ActivateButton';

/**
 * Glassmorphic Setup Flow
 * Warm dark theme with glassmorphic cards for restaurant setup
 */
export function GlassmorphicSetupFlow() {
  const { profile } = useRestaurant();
  const { setupState } = useSetup();
  const [expandedCard, setExpandedCard] = useState<number | null>(1);

  const restaurantName = profile?.name || 'Your Restaurant';

  return (
    <div className="min-h-screen bg-warm-charcoal p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Restaurant Name */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold font-display mb-3 bg-gradient-to-r from-saffron to-honey bg-clip-text text-transparent">
            Welcome to Handsfree!
          </h1>
          <p className="text-2xl text-warm-white/90 mb-2">
            {restaurantName}
          </p>
          <p className="text-warm-white/60">
            Complete your restaurant setup to start accepting voice orders
          </p>
        </div>

        {/* Setup Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Card 1: Restaurant Information */}
          <SetupCard
            title="Restaurant Information"
            description="Basic details about your restaurant"
            icon="🍽️"
            isComplete={setupState.step1Complete}
            isExpanded={expandedCard === 1}
            onToggle={() => setExpandedCard(expandedCard === 1 ? null : 1)}
            required
          >
            <Step1RestaurantInfo />
          </SetupCard>

          {/* Card 2: Voice AI Setup */}
          <SetupCard
            title="Voice AI Assistant"
            description="Configure your AI-powered phone ordering"
            icon="🎙️"
            isComplete={setupState.step2Complete}
            isExpanded={expandedCard === 2}
            onToggle={() => setExpandedCard(expandedCard === 2 ? null : 2)}
            required
          >
            <Step2VoiceAI />
          </SetupCard>

          {/* Card 3: Theme & Branding */}
          <SetupCard
            title="Theme & Branding"
            description="Customize your restaurant's look and feel"
            icon="🎨"
            isComplete={setupState.step3Complete}
            isExpanded={expandedCard === 3}
            onToggle={() => setExpandedCard(expandedCard === 3 ? null : 3)}
            required
          >
            <Step3ThemeBranding />
          </SetupCard>

          {/* Card 4: Menu Setup */}
          <SetupCard
            title="Menu (Optional)"
            description="Upload your menu items"
            icon="📋"
            isComplete={false}
            isExpanded={expandedCard === 4}
            onToggle={() => setExpandedCard(expandedCard === 4 ? null : 4)}
            required={false}
          >
            <Step4Menu />
          </SetupCard>
        </div>

        {/* Activate Button - Centered and Prominent */}
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <ActivateButton />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Glassmorphic Setup Card Component
 */
interface SetupCardProps {
  title: string;
  description: string;
  icon: string;
  isComplete: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  required: boolean;
  children: React.ReactNode;
}

function SetupCard({
  title,
  description,
  icon,
  isComplete,
  isExpanded,
  onToggle,
  required,
  children,
}: SetupCardProps) {
  return (
    <div
      className={`
        admin-glass-panel overflow-hidden transition-all duration-300
        ${isExpanded ? 'row-span-2' : ''}
      `}
    >
      {/* Card Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-5 text-left hover:bg-white/[0.03] transition-all duration-200"
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="text-4xl">{icon}</div>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-semibold text-warm-white">
                {title}
              </h3>
              {required && <span className="text-paprika text-sm">*</span>}
              {isComplete && (
                <span className="ml-auto text-honey text-sm font-medium flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Complete
                </span>
              )}
            </div>
            <p className="text-sm text-warm-white/60">{description}</p>
          </div>

          {/* Expand/Collapse Indicator */}
          <div
            className={`text-warm-white/40 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      {/* Card Content - Expandable */}
      {isExpanded && (
        <div className="px-6 py-6 border-t border-warm-border bg-warm-charcoal/30">
          {children}
        </div>
      )}
    </div>
  );
}
