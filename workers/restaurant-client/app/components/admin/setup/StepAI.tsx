'use client';

import { useState } from 'react';
import {
  VOICE_PRESETS,
  DEFAULT_PRESET_ID,
  getPresetsByCategory,
  getPopularLanguages,
  getInternationalLanguages,
  type VoicePreset,
} from '../../../utils/voicePresets';

interface AIConfig {
  voicePresetId: string;
  voiceName: string;
  tone: {
    style: string;
    personality: string;
    formality: string;
  };
  responseLength: string;
  allowedLanguages: string[];
}

interface StepAIProps {
  onNext: (data: { aiConfig: AIConfig }) => void;
  onBack: () => void;
}

export function StepAI({ onNext, onBack }: StepAIProps) {
  const [selectedPreset, setSelectedPreset] = useState<VoicePreset>(
    VOICE_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) || VOICE_PRESETS[0]
  );
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['en']);
  const [showAllLanguages, setShowAllLanguages] = useState(false);

  const femaleVoices = getPresetsByCategory('female');
  const maleVoices = getPresetsByCategory('male');
  const popularLanguages = getPopularLanguages();
  const internationalLanguages = getInternationalLanguages();

  const toggleLanguage = (code: string) => {
    setAllowedLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  };

  const handleContinue = () => {
    if (allowedLanguages.length === 0) {
      alert('Please select at least one language');
      return;
    }

    const config: AIConfig = {
      voicePresetId: selectedPreset.id,
      voiceName: selectedPreset.config.voiceName,
      tone: selectedPreset.config.tone,
      responseLength: selectedPreset.config.responseLength,
      allowedLanguages,
    };

    onNext({ aiConfig: config });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Your Voice Assistant
        </h2>
        <p className="text-gray-600">
          Select a personality that matches your restaurant's vibe
        </p>
      </div>

      <div className="space-y-8">
        {/* Female Voices */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Female Voices
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {femaleVoices.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset)}
                className={`p-5 border-2 rounded-xl text-left transition-all ${
                  selectedPreset.id === preset.id
                    ? 'border-purple-700 bg-purple-50 shadow-md'
                    : 'border-gray-200 hover:border-purple-400 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{preset.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      {preset.label}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {preset.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      Best for: {preset.recommendedFor.join(', ')}
                    </div>
                  </div>
                  {selectedPreset.id === preset.id && (
                    <div className="text-purple-700 text-xl">✓</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Male Voices */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Male Voices
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maleVoices.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedPreset(preset)}
                className={`p-5 border-2 rounded-xl text-left transition-all ${
                  selectedPreset.id === preset.id
                    ? 'border-purple-700 bg-purple-50 shadow-md'
                    : 'border-gray-200 hover:border-purple-400 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{preset.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      {preset.label}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {preset.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      Best for: {preset.recommendedFor.join(', ')}
                    </div>
                  </div>
                  {selectedPreset.id === preset.id && (
                    <div className="text-purple-700 text-xl">✓</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Supported Languages
          </label>

          {/* Popular Languages */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Popular Languages</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {popularLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  className={`p-3 border-2 rounded-lg text-sm transition-all ${
                    allowedLanguages.includes(lang.code)
                      ? 'border-purple-700 bg-purple-50 font-medium'
                      : 'border-gray-200 hover:border-purple-400'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Show More Languages */}
          <button
            onClick={() => setShowAllLanguages(!showAllLanguages)}
            className="text-sm text-purple-700 hover:text-purple-800 font-medium"
          >
            {showAllLanguages ? '− Show Less' : '+ Show More Languages'}
          </button>

          {showAllLanguages && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-600 mb-2">
                Other International Languages
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {internationalLanguages
                  .filter((lang) => !popularLanguages.find((p) => p.code === lang.code))
                  .map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`p-3 border-2 rounded-lg text-sm transition-all ${
                        allowedLanguages.includes(lang.code)
                          ? 'border-purple-700 bg-purple-50 font-medium'
                          : 'border-gray-200 hover:border-purple-400'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-4 text-sm text-gray-500">
            Selected: {allowedLanguages.length} language{allowedLanguages.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
        >
          Back
        </button>

        <button
          onClick={handleContinue}
          className="px-6 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-800 font-medium shadow-sm"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
