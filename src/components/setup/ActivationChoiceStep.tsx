/**
 * Activation Choice Step
 * User chooses how to use the owner device:
 * - Option A: Hybrid (management + POS for this location)
 * - Option B: Management-only (separate POS device)
 */

import { useState } from 'react';
import { Monitor, Building2, Check, Loader2 } from 'lucide-react';

export type ActivationChoice = 'hybrid' | 'management-only';

interface ActivationChoiceStepProps {
  locationName: string;
  onComplete: (choice: ActivationChoice) => void;
  onBack?: () => void;
  isProcessing?: boolean;
}

export function ActivationChoiceStep({
  locationName,
  onComplete,
  onBack,
  isProcessing = false,
}: ActivationChoiceStepProps) {
  const [selectedChoice, setSelectedChoice] = useState<ActivationChoice | null>(null);

  const options: Array<{
    value: ActivationChoice;
    icon: typeof Monitor;
    title: string;
    description: string;
    benefits: string[];
    recommended?: boolean;
  }> = [
    {
      value: 'hybrid',
      icon: Monitor,
      title: 'Run Location on This Device',
      description: 'This device will be both the management console AND the POS for this location',
      benefits: [
        'Start taking orders immediately',
        'Manage your business from the same device',
        'Perfect for single-location or owner-operated restaurants',
      ],
      recommended: true,
    },
    {
      value: 'management-only',
      icon: Building2,
      title: 'Management Only',
      description: 'This device will only manage your business. Activate the location on a separate POS device.',
      benefits: [
        'Keep management separate from operations',
        'Ideal for multi-location chains',
        'Dedicated devices for different purposes',
      ],
    },
  ];

  const handleSubmit = () => {
    if (selectedChoice) {
      onComplete(selectedChoice);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">How Will You Use This Device?</h2>
        <p className="text-gray-600 text-base sm:text-lg px-4">
          Choose how you want to set up{' '}
          <span className="font-semibold text-green-600">{locationName}</span>
        </p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedChoice === option.value;

          return (
            <button
              key={option.value}
              onClick={() => setSelectedChoice(option.value)}
              disabled={isProcessing}
              className={`relative p-6 sm:p-8 border-2 rounded-2xl text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-xl'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Recommended Badge */}
              {option.recommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="px-4 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                    Recommended
                  </span>
                </div>
              )}

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}

              {/* Icon */}
              <div
                className={`w-16 h-16 rounded-2xl mb-4 flex items-center justify-center ${
                  isSelected ? 'bg-blue-500' : 'bg-gray-100'
                }`}
              >
                <Icon className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">{option.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{option.description}</p>

              {/* Benefits */}
              <ul className="space-y-2">
                {option.benefits.map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={isSelected ? 'text-gray-800' : 'text-gray-600'}>{benefit}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-2">What happens next?</h4>
        <div className="space-y-2 text-sm text-blue-800">
          {selectedChoice === 'hybrid' ? (
            <>
              <p>
                ✅ This device will be configured as the POS for <strong>{locationName}</strong>
              </p>
              <p>✅ You'll be able to take orders immediately after setup completes</p>
              <p>✅ You can also access management features from the same device</p>
            </>
          ) : selectedChoice === 'management-only' ? (
            <>
              <p>✅ This device will be configured as a management console</p>
              <p>
                ✅ An activation code will be generated for <strong>{locationName}</strong>
              </p>
              <p>✅ You can use that code to activate the location on a separate POS device</p>
            </>
          ) : (
            <p className="text-gray-500 italic">Select an option above to see what happens next</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            onClick={onBack}
            disabled={isProcessing}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            Back
          </button>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedChoice || isProcessing}
          className="ml-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-semibold shadow-lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Setting up...</span>
            </>
          ) : (
            <span>Continue with {selectedChoice === 'hybrid' ? 'Hybrid Mode' : 'Management Mode'}</span>
          )}
        </button>
      </div>
    </div>
  );
}
