import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// Supported locales
export const supportedLocales = ['en', 'es', 'pt-BR', 'de', 'fr', 'it', 'nl', 'pl', 'th', 'vi', 'id', 'ms', 'tl', 'ja'] as const;
export type SupportedLocale = typeof supportedLocales[number];

interface LocaleContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string | string[];
  country: string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

// Translation cache
const translationCache: Record<string, Record<string, unknown>> = {};

interface LocaleProviderProps {
  children: ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const { locale: urlLocale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [translations, setTranslations] = useState<Record<string, unknown>>({});
  const [country, setCountry] = useState('US');

  // Validate locale or default to 'en'
  const locale: SupportedLocale = (urlLocale && supportedLocales.includes(urlLocale as SupportedLocale))
    ? urlLocale as SupportedLocale
    : 'en';

  // Load translations
  useEffect(() => {
    async function loadTranslations() {
      // Check cache first
      if (translationCache[locale]) {
        setTranslations(translationCache[locale]);
        return;
      }

      try {
        // Dynamic import based on locale
        const module = await import(`../locales/${locale}/translations.json`);
        translationCache[locale] = module.default;
        setTranslations(module.default);
      } catch {
        // Fallback to English
        if (locale !== 'en') {
          try {
            const fallback = await import('../locales/en/translations.json');
            setTranslations(fallback.default);
          } catch {
            console.error('Failed to load fallback translations');
          }
        }
      }
    }

    loadTranslations();
  }, [locale]);

  // Detect country from header (set by Cloudflare middleware)
  useEffect(() => {
    // Try to get country from a meta tag or window variable set by middleware
    const detectedCountry = document.querySelector('meta[name="x-detected-country"]')?.getAttribute('content');
    if (detectedCountry) {
      setCountry(detectedCountry);
    }
  }, []);

  // Translation function with parameter interpolation
  // Returns string for string values, or the raw value for arrays/objects
  const t = (key: string, params?: Record<string, string | number>): string | string[] => {
    const keys = key.split('.');
    let value: unknown = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    // Return arrays as-is
    if (Array.isArray(value)) {
      return value as string[];
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters like {year} with actual values
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) =>
        String(params[paramKey] ?? `{${paramKey}}`)
      );
    }

    return value;
  };

  // Change locale and navigate
  const setLocale = (newLocale: SupportedLocale) => {
    // Store preference in cookie
    document.cookie = `preferred_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Navigate to new locale path
    const currentPath = location.pathname;
    const pathWithoutLocale = currentPath.replace(new RegExp(`^/${locale}`), '');
    const newPath = `/${newLocale}${pathWithoutLocale || '/'}`;
    navigate(newPath);
  };

  // Update document lang attribute
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, country }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}

// Hook for components outside LocaleProvider (uses browser detection)
export function useDetectedLocale(): SupportedLocale {
  const browserLang = navigator.language.split('-')[0].toLowerCase();
  const match = supportedLocales.find(l => l.startsWith(browserLang));
  return match || 'en';
}
