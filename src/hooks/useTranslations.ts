// ============================================================================
// USE TRANSLATIONS HOOK
// ============================================================================
// React hook for accessing translations from Rust backend
// Fetches translations via Tauri commands and provides interpolation support
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLanguageStore } from '../stores/languageStore';

interface TranslationsResponse {
  translations: Record<string, string>;
  language: string;
  namespace: string | null;
}

/**
 * Custom hook for accessing translations
 *
 * Usage:
 * ```typescript
 * const { t, isLoading } = useTranslations('pos');
 *
 * <button>{t('addToCart')}</button>
 * <span>{t('prepTime', { minutes: 15 })}</span>
 * ```
 *
 * @param namespace - Optional namespace filter (e.g., "pos", "common")
 * @returns Object with translation function and loading state
 */
export function useTranslations(namespace?: string) {
  const { currentLanguage, tenantId } = useLanguageStore();
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load translations from Rust backend
  useEffect(() => {
    const loadTranslations = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<TranslationsResponse>('get_translations', {
          language: currentLanguage,
          namespace: namespace || null,
          tenantId: tenantId || null,
        });

        setTranslations(result.translations);
      } catch (err) {
        console.error('[useTranslations] Failed to load translations:', err);
        setError(err as string);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [currentLanguage, namespace, tenantId]);

  /**
   * Translation function with interpolation support
   *
   * @param key - Translation key (e.g., "addToCart" or "pos.addToCart")
   * @param params - Optional parameters for interpolation
   * @returns Translated string with interpolated values
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // Add namespace prefix if not already present
      const fullKey = namespace && !key.includes('.') ? `${namespace}.${key}` : key;

      // Return empty string if translation not found (allows fallback to work)
      let value = translations[fullKey] || '';

      // Handle interpolation: {{paramName}} → actual value
      if (params && value) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          value = value.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
        });
      }

      return value;
    },
    [translations, namespace]
  );

  return { t, isLoading, error };
}

/**
 * Hook for getting a single translation (one-time fetch)
 *
 * Usage:
 * ```typescript
 * const { translation, isLoading } = useTranslation('pos.addToCart');
 * ```
 */
export function useTranslation(key: string) {
  const { currentLanguage, tenantId } = useLanguageStore();
  const [translation, setTranslation] = useState<string>(key);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTranslation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<string>('get_translation', {
          key,
          language: currentLanguage,
          tenantId: tenantId || null,
        });

        setTranslation(result);
      } catch (err) {
        console.error('[useTranslation] Failed to load translation:', err);
        setError(err as string);
        setTranslation(key); // Fallback to key
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslation();
  }, [key, currentLanguage, tenantId]);

  return { translation, isLoading, error };
}

/**
 * Hook for admin translation management
 *
 * Provides functions to update and delete tenant translation overrides
 */
export function useTranslationAdmin() {
  const { tenantId } = useLanguageStore();

  /**
   * Update a tenant-specific translation override
   */
  const updateTranslation = useCallback(
    async (key: string, language: string, value: string, userId?: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID required for updating translations');
      }

      try {
        await invoke('update_tenant_translation', {
          tenantId,
          key,
          language,
          value,
          userId: userId || null,
        });
      } catch (err) {
        console.error('[useTranslationAdmin] Failed to update translation:', err);
        throw err;
      }
    },
    [tenantId]
  );

  /**
   * Delete a tenant translation override (revert to base translation)
   */
  const deleteTranslation = useCallback(
    async (key: string, language: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID required for deleting translations');
      }

      try {
        await invoke('delete_tenant_translation', {
          tenantId,
          key,
          language,
        });
      } catch (err) {
        console.error('[useTranslationAdmin] Failed to delete translation:', err);
        throw err;
      }
    },
    [tenantId]
  );

  /**
   * Get all tenant overrides
   */
  const getTenantOverrides = useCallback(
    async (language?: string) => {
      if (!tenantId) {
        throw new Error('Tenant ID required for getting overrides');
      }

      try {
        const result = await invoke('get_tenant_overrides', {
          tenantId,
          language: language || null,
        });

        return result;
      } catch (err) {
        console.error('[useTranslationAdmin] Failed to get overrides:', err);
        throw err;
      }
    },
    [tenantId]
  );

  /**
   * Get all translation keys (for building admin UI)
   */
  const getTranslationKeys = useCallback(async (category?: string) => {
    try {
      const result = await invoke('get_translation_keys', {
        category: category || null,
      });

      return result;
    } catch (err) {
      console.error('[useTranslationAdmin] Failed to get translation keys:', err);
      throw err;
    }
  }, []);

  return {
    updateTranslation,
    deleteTranslation,
    getTenantOverrides,
    getTranslationKeys,
  };
}
