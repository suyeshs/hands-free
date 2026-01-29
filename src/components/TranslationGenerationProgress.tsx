/**
 * Translation Generation Progress Component
 *
 * Shows progress while generating translations for all 22 Indian languages.
 * Displayed during setup/provisioning flow.
 */

import { useEffect } from 'react';
import { useTranslationGeneration, TranslationProgress } from '../hooks/useTranslationGeneration';
import { Loader2, CheckCircle, XCircle, Languages } from 'lucide-react';

interface Props {
  onComplete?: () => void;
  onError?: (error: string) => void;
  autoStart?: boolean;
}

export function TranslationGenerationProgress({ onComplete, onError, autoStart = false }: Props) {
  const { isGenerating, progress, error, isComplete, generateTranslations } = useTranslationGeneration();

  useEffect(() => {
    if (autoStart && !isGenerating && !isComplete && !error) {
      generateTranslations();
    }
  }, [autoStart]);

  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  if (!isGenerating && !isComplete && !error) {
    return null;
  }

  const totalLanguages = 22;
  const completedLanguages = progress.length;
  const progressPercent = (completedLanguages / totalLanguages) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-8 max-w-2xl w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Languages className="w-8 h-8 text-accent" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Generating Translations
            </h2>
            <p className="text-sm text-muted-foreground">
              Setting up multi-language support for your restaurant
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {isGenerating && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">
                  {completedLanguages} / {totalLanguages} languages
                </span>
                <span className="text-foreground font-semibold">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Language List */}
            <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
              {progress.map((lang) => (
                <LanguageProgressItem key={lang.language} progress={lang} />
              ))}
              {completedLanguages < totalLanguages && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span className="text-sm text-muted-foreground">
                    Processing next language...
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Complete State */}
        {isComplete && (
          <div className="text-center py-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">
              Translations Generated Successfully!
            </h3>
            <p className="text-muted-foreground mb-4">
              Your restaurant now supports all 22 Indian languages
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <StatCard
                label="Languages"
                value={completedLanguages}
              />
              <StatCard
                label="Translations"
                value={progress.reduce((sum, p) => sum + p.translated, 0)}
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-6">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">
              Translation Generation Failed
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error}
            </p>
            <button
              onClick={() => generateTranslations()}
              className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            💡 <strong>One-time setup:</strong> Translations are generated once and cached locally.
            Staff can select their preferred language from the mobile portal.
          </p>
        </div>
      </div>
    </div>
  );
}

function LanguageProgressItem({ progress }: { progress: TranslationProgress }) {
  const newTranslations = progress.translated;
  const existingTranslations = progress.skipped;
  const total = progress.total_keys;

  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {progress.language_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {newTranslations} new • {existingTranslations} existing • {total} total
          </p>
        </div>
      </div>
      <span className="text-xs text-green-600 font-medium">
        ✓ Complete
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-muted rounded-lg">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
