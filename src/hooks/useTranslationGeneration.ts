/**
 * Translation Generation Hook
 *
 * Automatically generates translations using Sarvam AI after setup completes.
 * This ensures all 22 Indian languages are available for staff portal.
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';

export interface TranslationProgress {
  language: string;
  language_name: string;
  total_keys: number;
  translated: number;
  skipped: number;
}

export interface TranslationStatus {
  [languageName: string]: number;
}

export function useTranslationGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<TranslationProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  /**
   * Check if translations have already been generated
   */
  const checkStatus = async (): Promise<TranslationStatus> => {
    try {
      const dataDir = await appDataDir();
      // Ensure proper path separator
      const dbPath = dataDir.endsWith('/') ? `${dataDir}pos.db` : `${dataDir}/pos.db`;
      console.log('[Translations] Check status - dataDir:', dataDir);
      console.log('[Translations] Check status - dbPath:', dbPath);

      const status = await invoke<TranslationStatus>('check_translations_status', {
        dbPath,
      });

      return status;
    } catch (err) {
      console.error('[Translations] Failed to check status:', err);
      return {};
    }
  };

  /**
   * Generate all translations using Sarvam AI
   */
  const generateTranslations = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setProgress([]);

      console.log('[Translations] Starting generation...');

      const dataDir = await appDataDir();
      // Ensure proper path separator
      const dbPath = dataDir.endsWith('/') ? `${dataDir}pos.db` : `${dataDir}/pos.db`;
      console.log('[Translations] Generate - dataDir:', dataDir);
      console.log('[Translations] Generate - dbPath:', dbPath);

      const result = await invoke<TranslationProgress[]>('generate_translations', {
        dbPath,
      });

      setProgress(result);
      setIsComplete(true);
      console.log('[Translations] ✅ Generation complete:', result);

      // Also export to JSON files for mobile staff portal
      try {
        const outputDir = dataDir.endsWith('/') ? `${dataDir}static/i18n` : `${dataDir}/static/i18n`;
        console.log('[Translations] Export - outputDir:', outputDir);
        await invoke('export_translations_to_json', {
          dbPath,
          outputDir,
        });
        console.log('[Translations] ✅ JSON files exported');
      } catch (exportErr) {
        console.warn('[Translations] Failed to export JSON:', exportErr);
        // Don't fail the entire process if JSON export fails
      }

      return result;
    } catch (err: any) {
      console.error('[Translations] Generation failed:', err);
      setError(err.toString());
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Auto-trigger generation on first setup
   */
  useEffect(() => {
    const shouldAutoGenerate = sessionStorage.getItem('translations-needed');

    if (shouldAutoGenerate === 'true') {
      console.log('[Translations] Auto-generating translations after setup...');
      sessionStorage.removeItem('translations-needed');

      checkStatus().then((status) => {
        const totalTranslations = Object.values(status).reduce((sum, count) => sum + count, 0);

        if (totalTranslations === 0) {
          // No translations exist, generate them
          generateTranslations().catch((err) => {
            console.error('[Translations] Auto-generation failed:', err);
          });
        } else {
          console.log('[Translations] Translations already exist, skipping generation');
        }
      });
    }
  }, []);

  return {
    isGenerating,
    progress,
    error,
    isComplete,
    generateTranslations,
    checkStatus,
  };
}
