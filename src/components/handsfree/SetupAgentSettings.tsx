/**
 * Setup Agent Settings Component
 * Configuration panel for voice assistant settings
 */

import { useHandsfreeSettingsManagement } from '../../hooks/useHandsfreeSetup';

// ============================================================================
// Main Component
// ============================================================================

export function SetupAgentSettings() {
  const { settings, updateSettings, availableLanguages } = useHandsfreeSettingsManagement();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Assistant Settings</h3>
        <p className="text-sm text-gray-600 mb-6">
          Configure language, voice, and behavior preferences for the voice assistant.
        </p>
      </div>

      {/* Language Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Language
        </label>
        <select
          value={settings.language}
          onChange={(e) => updateSettings({ language: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {availableLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          The assistant will respond in your selected language
        </p>
      </div>

      {/* Voice Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Voice
        </label>
        <select
          value={settings.voiceName}
          onChange={(e) => updateSettings({ voiceName: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="Aoede">Aoede (Female, Natural)</option>
          <option value="Puck">Puck (Male, Friendly)</option>
          <option value="Charon">Charon (Male, Professional)</option>
          <option value="Kore">Kore (Female, Energetic)</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Choose the voice personality for responses
        </p>
      </div>

      {/* Auto-Listen Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="font-medium text-gray-900">Auto-Listen Mode</div>
          <div className="text-sm text-gray-600 mt-1">
            Automatically start listening when the assistant finishes speaking
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoListen}
            onChange={(e) => updateSettings({ autoListen: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
        </label>
      </div>

      {/* Confirmation Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="font-medium text-gray-900">Confirm Critical Actions</div>
          <div className="text-sm text-gray-600 mt-1">
            Ask for confirmation before changing tax rates or critical settings
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.confirmCriticalActions}
            onChange={(e) => updateSettings({ confirmCriticalActions: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
        </label>
      </div>

      {/* Show Transcript Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <div className="font-medium text-gray-900">Show Live Transcript</div>
          <div className="text-sm text-gray-600 mt-1">
            Display conversation text while speaking
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showTranscript}
            onChange={(e) => updateSettings({ showTranscript: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
        </label>
      </div>

      {/* Privacy Notice */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-900 mb-1">Privacy & Data</h4>
            <p className="text-sm text-yellow-800">
              Voice data is processed by Google Cloud's Gemini Live API. Audio is streamed for
              real-time processing and not stored permanently. Your restaurant data remains
              local and is only used to provide context to the assistant.
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Settings (Collapsed by default) */}
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <span className="font-medium text-gray-900">Advanced Settings</span>
            <svg
              className="w-5 h-5 text-gray-600 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </summary>

        <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
          {/* API Configuration (Read-only for now) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Endpoint
            </label>
            <input
              type="text"
              value="Google Cloud Vertex AI"
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Configured via environment variables
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </label>
            <input
              type="text"
              value="gemini-2.0-flash-live-preview-04-09"
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current Gemini Live model version
            </p>
          </div>
        </div>
      </details>

      {/* Help Text */}
      <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
        <p>
          Need help? Check the{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Voice Assistant Documentation
          </a>{' '}
          or contact support.
        </p>
      </div>
    </div>
  );
}
