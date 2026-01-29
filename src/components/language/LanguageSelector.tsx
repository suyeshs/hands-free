// ============================================================================
// LANGUAGE SELECTOR COMPONENT
// ============================================================================
// Dropdown component for selecting UI language
// Saves preference to database via Rust backend
// ============================================================================

import { useState } from 'react';
import { useLanguageStore, SUPPORTED_LANGUAGES, getLanguageDisplayName } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import type { SupportedLanguage } from '../../stores/languageStore';

interface LanguageSelectorProps {
  /**
   * Display mode
   * - "dropdown": Standard select dropdown
   * - "grid": Grid of language cards (for first-time setup)
   */
  mode?: 'dropdown' | 'grid';

  /**
   * Show language names in native script
   */
  showNativeNames?: boolean;

  /**
   * Optional callback when language changes
   */
  onChange?: (language: SupportedLanguage) => void;

  /**
   * Group languages by region
   */
  groupByRegion?: boolean;
}

/**
 * Language Selector Component
 *
 * Allows staff users to select their preferred UI language
 * Persists preference to SQLite database
 */
export function LanguageSelector({
  mode = 'dropdown',
  showNativeNames = true,
  onChange,
  groupByRegion = true,
}: LanguageSelectorProps) {
  const { currentLanguage, saveUserLanguage, isLoading } = useLanguageStore();
  const { user: currentUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);

  const handleLanguageChange = async (newLanguage: SupportedLanguage) => {
    if (!currentUser) {
      console.error('[LanguageSelector] No user logged in');
      return;
    }

    setIsSaving(true);

    try {
      await saveUserLanguage(currentUser.id, newLanguage);

      // Trigger callback if provided
      onChange?.(newLanguage);
    } catch (error) {
      console.error('[LanguageSelector] Failed to save language preference:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === 'dropdown') {
    return (
      <div className="language-selector">
        <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-2">
          Language / भाषा / 语言
        </label>

        <select
          id="language-select"
          value={currentLanguage}
          onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
          disabled={isLoading || isSaving}
          className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          {groupByRegion ? (
            <>
              <optgroup label="🇺🇸 United States">
                {SUPPORTED_LANGUAGES.filter((l) => l.region === 'US').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {showNativeNames ? `${lang.name} (${lang.nativeName})` : lang.name}
                  </option>
                ))}
              </optgroup>

              <optgroup label="🇪🇺 Europe">
                {SUPPORTED_LANGUAGES.filter((l) => l.region === 'Europe').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {showNativeNames ? `${lang.name} (${lang.nativeName})` : lang.name}
                  </option>
                ))}
              </optgroup>

              <optgroup label="🌏 Southeast Asia">
                {SUPPORTED_LANGUAGES.filter((l) => l.region === 'Southeast Asia').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {showNativeNames ? `${lang.name} (${lang.nativeName})` : lang.name}
                  </option>
                ))}
              </optgroup>

              <optgroup label="🇮🇳 India">
                {SUPPORTED_LANGUAGES.filter((l) => l.region === 'India').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {showNativeNames ? `${lang.name} (${lang.nativeName})` : lang.name}
                  </option>
                ))}
              </optgroup>
            </>
          ) : (
            SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {getLanguageDisplayName(lang.code, showNativeNames)}
              </option>
            ))
          )}
        </select>

        {isSaving && (
          <p className="mt-2 text-sm text-gray-500">
            Saving language preference...
          </p>
        )}
      </div>
    );
  }

  // Grid mode - for first-time setup or preference screens
  return (
    <div className="language-selector-grid">
      <h3 className="text-lg font-semibold mb-4">Select Your Language</h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isLoading || isSaving}
            className={`
              p-4 rounded-lg border-2 transition-all
              ${
                currentLanguage === lang.code
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-300'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">{getRegionFlag(lang.region)}</div>
              <div className="font-medium">{lang.name}</div>
              <div className="text-sm text-gray-600">{lang.nativeName}</div>
            </div>
          </button>
        ))}
      </div>

      {isSaving && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Saving language preference...
        </p>
      )}
    </div>
  );
}

/**
 * Get emoji flag for region
 */
function getRegionFlag(region: string): string {
  const flags: Record<string, string> = {
    'US': '🇺🇸',
    'Europe': '🇪🇺',
    'Southeast Asia': '🌏',
    'India': '🇮🇳',
  };

  return flags[region] || '🌐';
}

/**
 * Compact language switcher for top navigation
 */
export function LanguageSwitcher() {
  const { currentLanguage, getLanguageInfo } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = getLanguageInfo(currentLanguage);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium">{currentLang?.nativeName || 'EN'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <LanguageSelector
              mode="dropdown"
              showNativeNames={true}
              groupByRegion={true}
              onChange={() => setIsOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
