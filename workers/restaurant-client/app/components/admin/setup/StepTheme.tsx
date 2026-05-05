'use client';

import { useState, useEffect } from 'react';
import { Loader2, Check } from 'lucide-react';

interface ThemePreset {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  restaurantId?: string;
}

interface StepThemeProps {
  onNext: (data: { themePresetId: string }) => void;
  onBack?: () => void;
}

export function StepTheme({ onNext, onBack }: StepThemeProps) {
  const [themes, setThemes] = useState<ThemePreset[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://theme-edge-worker.suyesh.workers.dev/api/multimodal-restaurant/themes'
      );

      if (!response.ok) {
        throw new Error('Failed to fetch themes');
      }

      const data = await response.json() as { presets?: any[] };
      setThemes(data.presets || []);
    } catch (err) {
      console.error('Error fetching themes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (selected) {
      onNext({ themePresetId: selected });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-purple-700 mb-4" />
        <p className="text-gray-600">Loading themes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-red-600 mb-4">Error: {error}</p>
        <button
          onClick={fetchThemes}
          className="px-4 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Your Restaurant Theme
        </h2>
        <p className="text-gray-600">
          Select a theme that matches your restaurant's style
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setSelected(theme.id)}
            className={`relative p-6 border-2 rounded-lg text-left transition-all ${
              selected === theme.id
                ? 'border-purple-700 bg-purple-50 shadow-md'
                : 'border-gray-200 hover:border-purple-400 hover:shadow-sm'
            }`}
          >
            {selected === theme.id && (
              <div className="absolute top-4 right-4">
                <Check className="h-6 w-6 text-purple-700" />
              </div>
            )}

            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {theme.name}
            </h3>

            <p className="text-gray-600 mb-4">{theme.description}</p>

            <div className="flex flex-wrap gap-2">
              {theme.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
        )}

        <button
          onClick={handleContinue}
          disabled={!selected}
          className={`ml-auto px-6 py-2 rounded-lg ${
            selected
              ? 'bg-purple-700 text-white hover:bg-purple-800'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
