'use client';

import React, { useState } from 'react';
import { useSetup } from '@/app/contexts/SetupContext';
import { Step1RestaurantInfo } from './setup-flow/Step1RestaurantInfo';
import { Step2VoiceAI } from './setup-flow/Step2VoiceAI';
import { Step3ThemeBranding } from './setup-flow/Step3ThemeBranding';
import { Step4Menu } from './setup-flow/Step4Menu';
import { SetupPreview } from './setup-flow/SetupPreview';
import { ActivateButton } from './setup-flow/ActivateButton';

/**
 * Setup Flow Component
 * Main orchestrator for the integrated setup experience
 */
export function SetupFlow() {
  const { setupState } = useSetup();
  const [openStep, setOpenStep] = useState<number>(1);

  const toggleStep = (step: number) => {
    setOpenStep(openStep === step ? 0 : step);
  };

  return (
    <div className="min-h-screen bg-neu-bg p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-neu-text mb-3">
            🍽️ Welcome to Handsfree!
          </h1>
          <p className="text-lg text-neu-text-secondary">
            Let's activate your restaurant
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Setup Steps */}
          <div className="lg:col-span-2 space-y-4">
            {/* Step 1: Restaurant Information */}
            <StepSection
              stepNumber={1}
              title="Restaurant Information"
              isComplete={setupState.step1Complete}
              isOpen={openStep === 1}
              onToggle={() => toggleStep(1)}
              required
            >
              <Step1RestaurantInfo />
            </StepSection>

            {/* Step 2: Voice AI Setup */}
            <StepSection
              stepNumber={2}
              title="Voice AI Setup"
              isComplete={setupState.step2Complete}
              isOpen={openStep === 2}
              onToggle={() => toggleStep(2)}
              required
            >
              <Step2VoiceAI />
            </StepSection>

            {/* Step 3: Theme & Branding */}
            <StepSection
              stepNumber={3}
              title="Theme & Branding"
              isComplete={setupState.step3Complete}
              isOpen={openStep === 3}
              onToggle={() => toggleStep(3)}
              required
            >
              <Step3ThemeBranding />
            </StepSection>

            {/* Step 4: Menu (Optional) */}
            <StepSection
              stepNumber={4}
              title="Menu (Optional)"
              isComplete={false}
              isOpen={openStep === 4}
              onToggle={() => toggleStep(4)}
              required={false}
            >
              <Step4Menu />
            </StepSection>
          </div>

          {/* Right Column: Preview & Activate */}
          <div className="lg:col-span-1 space-y-6">
            {/* Sticky Preview */}
            <div className="lg:sticky lg:top-6 space-y-6">
              <SetupPreview />
              <ActivateButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Step Section Component
 * Accordion-style collapsible section for each setup step
 */
interface StepSectionProps {
  stepNumber: number;
  title: string;
  isComplete: boolean;
  isOpen: boolean;
  onToggle: () => void;
  required: boolean;
  children: React.ReactNode;
}

function StepSection({
  stepNumber,
  title,
  isComplete,
  isOpen,
  onToggle,
  required,
  children,
}: StepSectionProps) {
  return (
    <div
      className={`neu-concave rounded-2xl overflow-hidden transition-all ${
        isOpen ? 'shadow-xl' : ''
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/30 transition-all"
      >
        <div className="flex items-center gap-4">
          {/* Step Number / Checkmark */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              isComplete
                ? 'bg-green-500 text-white shadow-lg'
                : 'neu-flat text-neu-text'
            }`}
          >
            {isComplete ? '✓' : stepNumber}
          </div>

          {/* Title */}
          <div className="text-left">
            <h3 className="text-lg font-bold text-neu-text">
              {title}
              {required && <span className="text-red-500 ml-1">*</span>}
            </h3>
            {isComplete && (
              <p className="text-xs text-green-600 font-medium">Complete</p>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <div
          className={`text-2xl transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </div>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-6 py-6 border-t border-neu-text-secondary/10 bg-white/20">
          {children}
        </div>
      )}
    </div>
  );
}
