// ============================================================================
// LANGUAGE STORE - Language Preference Management
// ============================================================================
// Zustand store for managing user language preferences
// Syncs with Rust backend for persistence
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

/**
 * Supported languages across all markets
 *
 * - US: English
 * - Europe: French, German, Spanish, Italian
 * - Southeast Asia: Thai, Vietnamese, Indonesian, Malay
 * - India: Hindi, Tamil, Telugu, Bengali, Marathi
 */
export type SupportedLanguage =
  | 'en' // English
  | 'fr' // French
  | 'de' // German
  | 'es' // Spanish
  | 'it' // Italian
  | 'th' // Thai
  | 'vi' // Vietnamese
  | 'id' // Indonesian
  | 'ms' // Malay
  | 'hi' // Hindi
  | 'ta' // Tamil
  | 'te' // Telugu
  | 'bn' // Bengali
  | 'mr'; // Marathi

/**
 * Language metadata for display in UI
 */
export interface LanguageInfo {
  code: SupportedLanguage;
  name: string; // English name
  nativeName: string; // Native name
  region: 'US' | 'Europe' | 'Southeast Asia' | 'India';
}

/**
 * Complete language catalog
 */
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  // US
  { code: 'en', name: 'English', nativeName: 'English', region: 'US' },

  // Europe
  { code: 'fr', name: 'French', nativeName: 'Français', region: 'Europe' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', region: 'Europe' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', region: 'Europe' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', region: 'Europe' },

  // Southeast Asia
  { code: 'th', name: 'Thai', nativeName: 'ไทย', region: 'Southeast Asia' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', region: 'Southeast Asia' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', region: 'Southeast Asia' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', region: 'Southeast Asia' },

  // India
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', region: 'India' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'India' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', region: 'India' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'India' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'India' },
];

interface LanguageStore {
  // State
  currentLanguage: SupportedLanguage;
  isLoading: boolean;
  tenantId: string | null;

  // Actions
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  loadUserLanguage: (userId: string) => Promise<void>;
  saveUserLanguage: (userId: string, lang: SupportedLanguage) => Promise<void>;
  detectBrowserLanguage: () => SupportedLanguage;
  setTenantId: (tenantId: string) => void;

  // Getters
  getLanguageInfo: (code: SupportedLanguage) => LanguageInfo | undefined;
  getLanguagesByRegion: (region: string) => LanguageInfo[];
}

/**
 * Language preference store
 *
 * Manages current language state and syncs with Rust backend
 * for persistence in SQLite database
 */
export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentLanguage: 'en',
      isLoading: false,
      tenantId: null,

      /**
       * Set the current language
       *
       * Updates state and re-renders all components using translations
       */
      setLanguage: async (lang: SupportedLanguage) => {
        set({ currentLanguage: lang });
      },

      /**
       * Load user's preferred language from database
       *
       * Fetches from Rust backend via Tauri command
       */
      loadUserLanguage: async (userId: string) => {
        set({ isLoading: true });

        try {
          const language = await invoke<string>('get_user_language', { userId });

          if (language && SUPPORTED_LANGUAGES.some((l) => l.code === language)) {
            set({ currentLanguage: language as SupportedLanguage });
          }
        } catch (error) {
          console.error('[LanguageStore] Failed to load user language:', error);

          // Fallback to browser language detection
          const detectedLang = get().detectBrowserLanguage();
          set({ currentLanguage: detectedLang });
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * Save user's language preference to database
       *
       * Persists via Rust backend to SQLite
       */
      saveUserLanguage: async (userId: string, lang: SupportedLanguage) => {
        try {
          await invoke('set_user_language', { userId, language: lang });
          set({ currentLanguage: lang });
        } catch (error) {
          console.error('[LanguageStore] Failed to save user language:', error);
          throw error;
        }
      },

      /**
       * Detect browser language
       *
       * Returns best-match language from supported list
       * Defaults to English if no match found
       */
      detectBrowserLanguage: () => {
        const browserLang = navigator.language.split('-')[0];

        const supported = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang);

        return supported ? supported.code : 'en';
      },

      /**
       * Set tenant ID
       *
       * Required for tenant-specific translation overrides
       */
      setTenantId: (tenantId: string) => {
        set({ tenantId });
      },

      /**
       * Get language metadata by code
       */
      getLanguageInfo: (code: SupportedLanguage) => {
        return SUPPORTED_LANGUAGES.find((l) => l.code === code);
      },

      /**
       * Get all languages for a specific region
       */
      getLanguagesByRegion: (region: string) => {
        return SUPPORTED_LANGUAGES.filter((l) => l.region === region);
      },
    }),
    {
      name: 'language-storage',
      partialize: (state) => ({
        currentLanguage: state.currentLanguage,
        tenantId: state.tenantId,
      }),
    }
  )
);

/**
 * Helper function to get language display name
 */
export function getLanguageDisplayName(code: SupportedLanguage, showNative = true): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);

  if (!lang) return code;

  return showNative ? `${lang.name} (${lang.nativeName})` : lang.name;
}
