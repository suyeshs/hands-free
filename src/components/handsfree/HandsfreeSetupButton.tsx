/**
 * Handsfree Setup Button Component
 * Main interactive button for voice-based setup assistance
 *
 * Variants:
 * - floating: Fixed position button (bottom-right) for all pages
 * - inline: Embedded button for settings page
 *
 * States:
 * - idle: Gray microphone icon
 * - initializing: Blue spinner
 * - listening: Pulsing blue microphone + waveform
 * - processing: Gray spinner
 * - speaking: Green microphone + waveform
 * - error: Red microphone + error toast
 */

import { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { useHandsfreeSetup } from '../../hooks/useHandsfreeSetup';
import { VoiceWaveform } from './VoiceWaveform';
import { TranscriptionDisplay } from './TranscriptionDisplay';

// ============================================================================
// Props Interface
// ============================================================================

export interface HandsfreeSetupButtonProps {
  variant?: 'floating' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  showTranscript?: boolean;
  autoInitialize?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function HandsfreeSetupButton({
  variant = 'floating',
  size = 'md',
  showTranscript = false,
  autoInitialize = false,
}: HandsfreeSetupButtonProps) {
  const {
    status,
    isInitialized,
    isListening,
    isSpeaking,
    audioLevel,
    transcript,
    error,
    hasConsented,
    initialize,
    toggleListening,
    setConsent,
    clearError,
  } = useHandsfreeSetup();

  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showError, setShowError] = useState(false);

  // Auto-initialize if requested and consented
  useEffect(() => {
    if (autoInitialize && hasConsented && !isInitialized && status === 'idle') {
      initialize().catch((err) => {
        console.error('[HandsfreeButton] Auto-init failed:', err);
      });
    }
  }, [autoInitialize, hasConsented, isInitialized, status, initialize]);

  // Show error toast
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // ========================================================================
  // Event Handlers
  // ========================================================================

  const handleClick = async () => {
    // Check consent first
    if (!hasConsented) {
      setShowConsentDialog(true);
      return;
    }

    try {
      await toggleListening();
    } catch (err) {
      console.error('[HandsfreeButton] Toggle failed:', err);
    }
  };

  const handleConsent = async () => {
    setConsent(true);
    setShowConsentDialog(false);

    // Auto-start after consent
    try {
      await initialize();
      await toggleListening();
    } catch (err) {
      console.error('[HandsfreeButton] Post-consent start failed:', err);
    }
  };

  // ========================================================================
  // Styling
  // ========================================================================

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'w-10 h-10 text-sm';
      case 'lg':
        return 'w-16 h-16 text-2xl';
      case 'md':
      default:
        return 'w-12 h-12 text-lg';
    }
  };

  const getStatusColor = () => {
    if (error || status === 'error') return 'bg-red-500 hover:bg-red-600';
    if (isSpeaking) return 'bg-green-500 hover:bg-green-600';
    if (isListening) return 'bg-blue-500 hover:bg-blue-600 animate-pulse';
    if (status === 'initializing' || status === 'processing')
      return 'bg-gray-400 hover:bg-gray-500';
    return 'bg-gray-500 hover:bg-gray-600';
  };

  const getIcon = () => {
    if (status === 'initializing' || status === 'processing') {
      return <Loader2 className="w-6 h-6 animate-spin" />;
    }
    if (error || status === 'error') {
      return <AlertCircle className="w-6 h-6" />;
    }
    if (isSpeaking) {
      return <Volume2 className="w-6 h-6" />;
    }
    if (isListening) {
      return <Mic className="w-6 h-6" />;
    }
    return <MicOff className="w-6 h-6 opacity-70" />;
  };

  const getTooltip = () => {
    if (!hasConsented) return 'Enable voice assistant';
    if (error) return `Error: ${error}`;
    if (status === 'initializing') return 'Connecting...';
    if (status === 'processing') return 'Processing...';
    if (isSpeaking) return 'AI speaking...';
    if (isListening) return 'Listening... (click to stop)';
    return 'Click to start voice assistant';
  };

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      {/* Main Button Container */}
      <div
        className={`
          ${variant === 'floating' ? 'fixed bottom-6 right-6 z-50' : 'relative'}
          flex flex-col items-center gap-3
        `}
      >
        {/* Button with Waveform */}
        <div className="relative flex flex-col items-center">
          {/* Waveform Background (when active) */}
          {(isListening || isSpeaking) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <VoiceWaveform level={audioLevel} active={isListening || isSpeaking} />
            </div>
          )}

          {/* Main Button */}
          <button
            onClick={handleClick}
            disabled={status === 'initializing' || status === 'processing'}
            title={getTooltip()}
            className={`
              ${getSizeClass()}
              ${getStatusColor()}
              relative rounded-full
              flex items-center justify-center
              text-white
              shadow-lg
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-4 focus:ring-blue-300
            `}
          >
            {getIcon()}
          </button>

          {/* Status Badge */}
          {(status === 'initializing' || status === 'processing' || isSpeaking) && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
          )}
        </div>

        {/* Transcript Display (if enabled) */}
        {showTranscript && transcript.length > 0 && (
          <div className="max-w-md">
            <TranscriptionDisplay
              transcript={transcript}
              maxEntries={3}
              compact={variant === 'floating'}
            />
          </div>
        )}

        {/* Error Toast */}
        {showError && error && variant === 'floating' && (
          <div className="absolute bottom-full mb-4 right-0 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg max-w-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Consent Dialog */}
      {showConsentDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mic className="w-6 h-6 text-blue-500" />
              Enable Voice Assistant
            </h3>

            <div className="space-y-4 text-sm text-gray-700 mb-6">
              <p>
                The Handsfree Setup Agent uses Google's Gemini Live AI to help you navigate
                settings and configure your POS system using voice commands.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <h4 className="font-semibold text-blue-900 mb-2">What it can do:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Answer questions about settings</li>
                  <li>Navigate to specific pages</li>
                  <li>Update configuration values</li>
                  <li>Search for settings</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <h4 className="font-semibold text-yellow-900 mb-2">Privacy:</h4>
                <ul className="list-disc list-inside space-y-1 text-yellow-800">
                  <li>Your voice is processed by Google Cloud</li>
                  <li>Audio is not stored permanently</li>
                  <li>Only used for voice recognition and response</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConsentDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConsent}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
              >
                Enable Voice Assistant
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
