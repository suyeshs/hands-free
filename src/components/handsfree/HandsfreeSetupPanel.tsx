/**
 * Handsfree Setup Panel Component
 * Full control panel for voice assistant in Settings page
 *
 * Features:
 * - Large interactive button
 * - Live transcript display
 * - Status indicators
 * - Settings configuration
 * - Suggested commands
 */

import { useState } from 'react';
import {
  Mic,
  Volume2,
  Settings,
  HelpCircle,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useHandsfreeSetup } from '../../hooks/useHandsfreeSetup';
import { HandsfreeSetupButton } from './HandsfreeSetupButton';
import { TranscriptionDisplay } from './TranscriptionDisplay';
import { SetupAgentSettings } from './SetupAgentSettings';

// ============================================================================
// Suggested Commands
// ============================================================================

const SUGGESTED_COMMANDS = [
  {
    category: 'Navigation',
    commands: [
      'Where do I change GST settings?',
      'Show me menu management',
      'Take me to printer settings',
      'Open staff management',
    ],
  },
  {
    category: 'Information',
    commands: [
      "What's my current GST rate?",
      'Is service charge enabled?',
      "What's my restaurant name?",
      'Show me invoice settings',
    ],
  },
  {
    category: 'Updates',
    commands: [
      'Change GST to 12 percent',
      'Enable staff PIN',
      'Set service charge to 10 percent',
      'Update restaurant name',
    ],
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function HandsfreeSetupPanel() {
  const {
    status,
    isInitialized,
    transcript,
    error,
    hasConsented,
    initialize,
    shutdown,
    clearTranscript,
    clearError,
  } = useHandsfreeSetup();

  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleInitialize = async () => {
    try {
      await initialize();
    } catch (err) {
      console.error('[HandsfreePanel] Initialize failed:', err);
    }
  };

  const handleShutdown = async () => {
    if (
      !confirm(
        'This will stop the voice assistant and clear the conversation. Are you sure?'
      )
    ) {
      return;
    }

    try {
      await shutdown();
    } catch (err) {
      console.error('[HandsfreePanel] Shutdown failed:', err);
    }
  };

  const handleClearTranscript = () => {
    if (!confirm('Clear conversation history?')) {
      return;
    }
    clearTranscript();
  };

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Mic className="w-7 h-7 text-blue-500" />
              Handsfree Setup Assistant
            </h2>
            <p className="text-gray-600 mt-1">
              Interactive navigation and configuration assistant for your Restaurant OS
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {status === 'idle' && !hasConsented && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                Not Enabled
              </span>
            )}
            {status === 'idle' && hasConsented && !isInitialized && (
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full">
                Ready to Start
              </span>
            )}
            {status === 'initializing' && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </span>
            )}
            {status === 'connected' && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Connected
              </span>
            )}
            {status === 'listening' && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1">
                <Mic className="w-3 h-3 animate-pulse" />
                Listening
              </span>
            )}
            {status === 'processing' && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing
              </span>
            )}
            {status === 'speaking' && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full flex items-center gap-1">
                <Volume2 className="w-3 h-3 animate-pulse" />
                Speaking
              </span>
            )}
            {status === 'error' && (
              <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Error
              </span>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-red-900">Error</div>
              <div className="text-sm text-red-700 mt-1">{error}</div>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Control Area */}
        <div className="flex items-center justify-center gap-4 py-8">
          <HandsfreeSetupButton
            variant="inline"
            size="lg"
            showTranscript={false}
            autoInitialize={false}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>

          {isInitialized && (
            <>
              <button
                onClick={handleClearTranscript}
                disabled={transcript.length === 0}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Clear History
              </button>

              <button
                onClick={handleShutdown}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Stop Session
              </button>
            </>
          )}

          {!isInitialized && hasConsented && (
            <button
              onClick={handleInitialize}
              disabled={status === 'initializing'}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              Start Session
            </button>
          )}

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Help
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <SetupAgentSettings />
        </div>
      )}

      {/* Transcript Display */}
      {transcript.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-gray-600" />
            Conversation History
          </h3>
          <TranscriptionDisplay
            transcript={transcript}
            showTimestamps
            autoScroll
            className="max-h-96"
          />
        </div>
      )}

      {/* Suggested Commands */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Suggested Voice Commands</h3>
        <div className="space-y-4">
          {SUGGESTED_COMMANDS.map((section) => (
            <div key={section.category}>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {section.category}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {section.commands.map((command) => (
                  <div
                    key={command}
                    className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Click to copy"
                    onClick={() => {
                      navigator.clipboard.writeText(command);
                    }}
                  >
                    "{command}"
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            How to Use
          </h3>

          <div className="space-y-4 text-sm text-blue-900">
            <div>
              <h4 className="font-semibold mb-2">Getting Started:</h4>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Click the microphone button or say "Hey" to activate</li>
                <li>Speak your command clearly</li>
                <li>Wait for the assistant to respond</li>
                <li>The assistant will show you the relevant settings or answer your question</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-2">What You Can Ask:</h4>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>
                  <strong>Find settings:</strong> "Where do I change GST rate?"
                </li>
                <li>
                  <strong>Get information:</strong> "What's my current service charge?"
                </li>
                <li>
                  <strong>Navigate:</strong> "Take me to menu management"
                </li>
                <li>
                  <strong>Update settings:</strong> "Change GST to 12 percent"
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Multilingual Support:</h4>
              <p className="text-blue-800">
                The assistant automatically detects your language. You can speak in English,
                Hindi, or other supported languages.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
