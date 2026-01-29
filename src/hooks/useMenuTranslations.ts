// ============================================================================
// USE MENU TRANSLATIONS HOOK
// ============================================================================
// React hook for translating dynamic menu content (items, categories)
// Supports both pre-translated content (from cloud sync) and AI transliteration
// ============================================================================

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLanguageStore } from '../stores/languageStore';
import type { MenuItem, MenuCategory } from '../types';

/**
 * Hook for accessing translated menu item names and descriptions
 *
 * Architecture:
 * 1. **Primary**: Use pre-translated content from `name_translations` (synced from cloud)
 * 2. **Fallback**: Use AI transliteration (Cloudflare Workers AI or Gemini)
 * 3. **Final Fallback**: Use original English name
 *
 * Cloud workflow (recommended):
 * - Admin adds menu item in cloud dashboard
 * - Cloudflare Workers AI transliterates to all languages
 * - Stores in D1 `menu_items.name_translations` JSON field
 * - POS syncs down translations automatically
 * - No API calls needed from POS
 *
 * Usage:
 * ```typescript
 * const { getItemName, getItemDescription, getCategoryName } = useMenuTranslations();
 *
 * <h3>{getItemName(menuItem)}</h3>
 * <p>{getItemDescription(menuItem)}</p>
 * ```
 */
export function useMenuTranslations() {
  const { currentLanguage } = useLanguageStore();
  const [transliterationCache, setTransliterationCache] = useState<Record<string, string>>({});

  /**
   * Get translated/transliterated menu item name
   *
   * Priority:
   * 1. Check `name_translations[currentLanguage]` (pre-translated from cloud)
   * 2. Check transliteration cache (previously generated)
   * 3. Return original name (English)
   */
  const getItemName = useCallback(
    (item: MenuItem): string => {
      // English - return original
      if (currentLanguage === 'en') {
        return item.name;
      }

      // Check pre-translated content (synced from cloud)
      if (item.name_translations && item.name_translations[currentLanguage]) {
        return item.name_translations[currentLanguage];
      }

      // Check transliteration cache
      const cacheKey = `item-name-${item.id}-${currentLanguage}`;
      if (transliterationCache[cacheKey]) {
        return transliterationCache[cacheKey];
      }

      // Fallback to original name
      return item.name;
    },
    [currentLanguage, transliterationCache]
  );

  /**
   * Get translated/transliterated menu item description
   */
  const getItemDescription = useCallback(
    (item: MenuItem): string => {
      // English - return original
      if (currentLanguage === 'en') {
        return item.description;
      }

      // Check pre-translated content
      if (item.description_translations && item.description_translations[currentLanguage]) {
        return item.description_translations[currentLanguage];
      }

      // Check transliteration cache
      const cacheKey = `item-desc-${item.id}-${currentLanguage}`;
      if (transliterationCache[cacheKey]) {
        return transliterationCache[cacheKey];
      }

      // Fallback to original description
      return item.description;
    },
    [currentLanguage, transliterationCache]
  );

  /**
   * Get translated category name
   */
  const getCategoryName = useCallback(
    (category: MenuCategory): string => {
      // English - return original
      if (currentLanguage === 'en') {
        return category.name;
      }

      // Check pre-translated content
      if (category.name_translations && category.name_translations[currentLanguage]) {
        return category.name_translations[currentLanguage];
      }

      // Fallback to original name
      return category.name;
    },
    [currentLanguage]
  );

  /**
   * Manually trigger AI transliteration for an item
   *
   * Use case: When admin adds a menu item locally and hasn't synced yet
   * OR when cloud transliteration is missing for some reason
   *
   * NOTE: In production, transliteration should happen in Cloudflare Workers
   * during menu creation and sync down to POS. This is a fallback mechanism.
   */
  const transliterateItem = useCallback(
    async (item: MenuItem, geminiApiKey?: string) => {
      try {
        // Transliterate name
        const nameResult = await invoke<{ original: string; transliterated: string }>('transliterate_text', {
          text: item.name,
          targetLanguage: currentLanguage,
          sourceLanguage: 'en',
          geminiApiKey: geminiApiKey || null,
        });

        // Transliterate description (if exists)
        let descResult = null;
        if (item.description) {
          descResult = await invoke<{ original: string; transliterated: string }>('transliterate_text', {
            text: item.description,
            targetLanguage: currentLanguage,
            sourceLanguage: 'en',
            geminiApiKey: geminiApiKey || null,
          });
        }

        // Update cache
        setTransliterationCache((prev) => ({
          ...prev,
          [`item-name-${item.id}-${currentLanguage}`]: nameResult.transliterated,
          ...(descResult && {
            [`item-desc-${item.id}-${currentLanguage}`]: descResult.transliterated,
          }),
        }));

        return {
          name: nameResult.transliterated,
          description: descResult?.transliterated || item.description,
        };
      } catch (error) {
        console.error('[useMenuTranslations] Transliteration failed:', error);
        throw error;
      }
    },
    [currentLanguage]
  );

  /**
   * Batch transliterate multiple items
   *
   * Useful for admin operations or bulk processing
   */
  const transliterateBatch = useCallback(
    async (items: MenuItem[], geminiApiKey?: string) => {
      const itemNames = items.map((item) => item.name);

      try {
        const results = await invoke<Record<string, string>>('transliterate_batch', {
          items: itemNames,
          targetLanguage: currentLanguage,
          sourceLanguage: 'en',
          geminiApiKey: geminiApiKey || null,
        });

        // Update cache with all results
        const newCache: Record<string, string> = {};
        items.forEach((item) => {
          if (results[item.name]) {
            newCache[`item-name-${item.id}-${currentLanguage}`] = results[item.name];
          }
        });

        setTransliterationCache((prev) => ({ ...prev, ...newCache }));

        return results;
      } catch (error) {
        console.error('[useMenuTranslations] Batch transliteration failed:', error);
        throw error;
      }
    },
    [currentLanguage]
  );

  return {
    getItemName,
    getItemDescription,
    getCategoryName,
    transliterateItem,
    transliterateBatch,
  };
}

/**
 * Hook for checking if menu content needs transliteration
 *
 * Helps identify menu items missing translations for current language
 */
export function useMenuTranslationStatus() {
  const { currentLanguage } = useLanguageStore();

  /**
   * Check if a menu item has translation for current language
   */
  const hasTranslation = useCallback(
    (item: MenuItem): boolean => {
      if (currentLanguage === 'en') return true;

      return !!(item.name_translations && item.name_translations[currentLanguage]);
    },
    [currentLanguage]
  );

  /**
   * Get translation coverage percentage for a menu
   */
  const getTranslationCoverage = useCallback(
    (items: MenuItem[]): number => {
      if (currentLanguage === 'en') return 100;

      const translated = items.filter((item) => hasTranslation(item)).length;

      return items.length > 0 ? Math.round((translated / items.length) * 100) : 0;
    },
    [currentLanguage, hasTranslation]
  );

  /**
   * Get list of items missing translations
   */
  const getMissingTranslations = useCallback(
    (items: MenuItem[]): MenuItem[] => {
      if (currentLanguage === 'en') return [];

      return items.filter((item) => !hasTranslation(item));
    },
    [currentLanguage, hasTranslation]
  );

  return {
    hasTranslation,
    getTranslationCoverage,
    getMissingTranslations,
  };
}
