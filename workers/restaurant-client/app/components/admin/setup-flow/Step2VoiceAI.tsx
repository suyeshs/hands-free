'use client';

import React, { useState } from 'react';
import { useSetup } from '@/app/contexts/SetupContext';

/**
 * Voice preset options
 */
const VOICE_PRESETS = [
  {
    id: 'warm-welcoming',
    label: 'Warm & Welcoming',
    description: 'Friendly and approachable - perfect for most restaurants',
    icon: '🤗',
    voiceName: 'Aoede',
    gender: 'Female',
  },
  {
    id: 'professional-efficient',
    label: 'Professional & Efficient',
    description: 'Polished and refined - ideal for upscale dining',
    icon: '👔',
    voiceName: 'Kore',
    gender: 'Female',
  },
  {
    id: 'enthusiastic-energetic',
    label: 'Enthusiastic & Energetic',
    description: 'Upbeat and lively - great for casual, fun dining',
    icon: '⚡',
    voiceName: 'Zephyr',
    gender: 'Female',
  },
  {
    id: 'calm-relaxed',
    label: 'Calm & Relaxed',
    description: 'Gentle and soothing - perfect for peaceful dining',
    icon: '🌸',
    voiceName: 'Leda',
    gender: 'Female',
  },
  {
    id: 'friendly-casual-male',
    label: 'Friendly & Casual',
    description: 'Approachable male voice - great for casual settings',
    icon: '😎',
    voiceName: 'Puck',
    gender: 'Male',
  },
  {
    id: 'professional-confident-male',
    label: 'Professional & Confident',
    description: 'Authoritative male voice - ideal for premium dining',
    icon: '🎩',
    voiceName: 'Charon',
    gender: 'Male',
  },
  {
    id: 'smooth-elegant-male',
    label: 'Smooth & Elegant',
    description: 'Refined male voice - perfect for sophisticated venues',
    icon: '🍷',
    voiceName: 'Orus',
    gender: 'Male',
  },
  {
    id: 'energetic-confident-male',
    label: 'Energetic & Confident',
    description: 'Strong male voice - great for active environments',
    icon: '💪',
    voiceName: 'Fenrir',
    gender: 'Male',
  },
];

/**
 * Language options
 */
const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];

/**
 * Tone options
 */
const TONE_OPTIONS = ['Friendly', 'Professional', 'Casual', 'Enthusiastic'];

/**
 * Response length options
 */
const RESPONSE_LENGTH_OPTIONS = ['Concise', 'Balanced', 'Detailed'];

/**
 * Step 2: Voice AI Configuration
 * Selects voice preset, tone, and language settings
 */
export function Step2VoiceAI() {
  const { setupState, updateSetupState } = useSetup();
  const [filterGender, setFilterGender] = useState<'All' | 'Female' | 'Male'>('All');

  const filteredPresets =
    filterGender === 'All'
      ? VOICE_PRESETS
      : VOICE_PRESETS.filter((p) => p.gender === filterGender);

  const handleVoiceSelect = (preset: typeof VOICE_PRESETS[0]) => {
    updateSetupState({
      voicePresetId: preset.id,
      voiceName: preset.voiceName,
    });
  };

  const handleLanguageToggle = (langCode: string) => {
    const languages = setupState.allowedLanguages;
    const isSelected = languages.includes(langCode);

    if (isSelected) {
      // Ensure at least one language remains selected
      if (languages.length > 1) {
        updateSetupState({
          allowedLanguages: languages.filter((l) => l !== langCode),
        });
      }
    } else {
      updateSetupState({
        allowedLanguages: [...languages, langCode],
      });
    }
  };

  const handleSelectAllLanguages = () => {
    const allLanguageCodes = LANGUAGE_OPTIONS.map((lang) => lang.code);
    updateSetupState({
      allowedLanguages: allLanguageCodes,
    });
  };

  const isAllLanguagesSelected = setupState.allowedLanguages.length === LANGUAGE_OPTIONS.length;

  return (
    <div className="space-y-6">
      {/* Voice Preset Selection */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Voice Preset <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-neu-text-secondary mb-4">
          Choose a voice personality that matches your restaurant's vibe
        </p>

        {/* Gender Filter */}
        <div className="flex gap-2 mb-4">
          {['All', 'Female', 'Male'].map((gender) => (
            <button
              key={gender}
              onClick={() => setFilterGender(gender as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterGender === gender
                  ? 'neu-button-accent text-white'
                  : 'neu-flat text-neu-text hover:shadow-lg'
              }`}
            >
              {gender}
            </button>
          ))}
        </div>

        {/* Voice Preset Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleVoiceSelect(preset)}
              className={`p-4 rounded-xl text-left transition-all ${
                setupState.voicePresetId === preset.id
                  ? 'neu-button-accent text-white shadow-xl scale-105'
                  : 'neu-flat text-neu-text hover:shadow-lg'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{preset.icon}</span>
                <div className="flex-1">
                  <h4 className="font-bold text-base mb-1">{preset.label}</h4>
                  <p
                    className={`text-xs mb-2 ${
                      setupState.voicePresetId === preset.id
                        ? 'text-white/90'
                        : 'text-neu-text-secondary'
                    }`}
                  >
                    {preset.description}
                  </p>
                  <span
                    className={`text-xs font-medium ${
                      setupState.voicePresetId === preset.id
                        ? 'text-white/80'
                        : 'text-neu-text-secondary'
                    }`}
                  >
                    {preset.gender} • {preset.voiceName}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Tone
        </label>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((tone) => (
            <button
              key={tone}
              onClick={() => updateSetupState({ tone })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                setupState.tone === tone
                  ? 'neu-button-accent text-white'
                  : 'neu-flat text-neu-text hover:shadow-lg'
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>

      {/* Response Length */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Response Length
        </label>
        <div className="flex flex-wrap gap-2">
          {RESPONSE_LENGTH_OPTIONS.map((length) => (
            <button
              key={length}
              onClick={() => updateSetupState({ responseLength: length })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                setupState.responseLength === length
                  ? 'neu-button-accent text-white'
                  : 'neu-flat text-neu-text hover:shadow-lg'
              }`}
            >
              {length}
            </button>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div>
        <label className="block text-sm font-semibold text-neu-text mb-2">
          Allowed Languages <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-neu-text-secondary mb-3">
          Select all languages your customers might use
        </p>

        {/* All Languages Button */}
        <div className="mb-3">
          <button
            onClick={handleSelectAllLanguages}
            className={`px-6 py-3 rounded-lg text-sm font-bold transition-all ${
              isAllLanguagesSelected
                ? 'neu-button-accent text-white shadow-xl'
                : 'neu-flat text-neu-text hover:shadow-lg'
            }`}
          >
            🌍 All Languages ({LANGUAGE_OPTIONS.length})
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageToggle(lang.code)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                setupState.allowedLanguages.includes(lang.code)
                  ? 'neu-button-accent text-white'
                  : 'neu-flat text-neu-text hover:shadow-lg'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Validation Status */}
      {setupState.step2Complete && (
        <div className="flex items-center gap-2 px-4 py-3 neu-flat rounded-xl">
          <span className="text-2xl">✓</span>
          <span className="text-sm font-semibold text-neu-success">
            Step 2 Complete
          </span>
        </div>
      )}
    </div>
  );
}
