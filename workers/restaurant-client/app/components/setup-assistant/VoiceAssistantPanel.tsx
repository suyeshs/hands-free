'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Mic, Volume2, Settings, X, MessageSquare } from 'lucide-react';
import { useSetupAssistant } from '../../contexts/SetupAssistantContext';
import { VoiceOrb } from './VoiceOrb';

interface TranscriptEntry {
  id: string;
  type: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}

export function VoiceAssistantPanel() {
  const {
    state,
    connect,
    disconnect,
    sendAudio,
    sendText,
  } = useSetupAssistant();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [textInput, setTextInput] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Add transcript entries from state updates
  useEffect(() => {
    if (state.lastAssistantMessage) {
      setTranscript(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        text: state.lastAssistantMessage,
        timestamp: new Date()
      }]);
    }
  }, [state.lastAssistantMessage]);

  // Add function call results to transcript
  useEffect(() => {
    if (state.lastFunctionResult) {
      const { name, result } = state.lastFunctionResult;
      let message = '';

      switch (name) {
        case 'add_menu_item':
          message = `✓ Added "${result.name}" to menu`;
          break;
        case 'generate_sample_menu':
          message = `✓ Generated ${result.items?.length || 0} sample menu items`;
          break;
        case 'apply_theme_preset':
          message = `✓ Applied "${result.preset}" theme`;
          break;
        case 'navigate_to_step':
          message = `→ Navigating to ${result.step} setup`;
          break;
        case 'update_form_field':
          message = `✓ Updated ${result.field}`;
          break;
        default:
          message = `✓ ${name} completed`;
      }

      setTranscript(prev => [...prev, {
        id: `system-${Date.now()}`,
        type: 'system',
        text: message,
        timestamp: new Date()
      }]);
    }
  }, [state.lastFunctionResult]);

  const handleStartListening = () => {
    setIsListening(true);
  };

  const handleStopListening = () => {
    setIsListening(false);
  };

  const handleAudioData = (data: ArrayBuffer) => {
    sendAudio(data);
  };

  const handleSendText = () => {
    if (!textInput.trim()) return;

    // Add to transcript
    setTranscript(prev => [...prev, {
      id: `user-${Date.now()}`,
      type: 'user',
      text: textInput,
      timestamp: new Date()
    }]);

    sendText(textInput);
    setTextInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  // Collapsed state
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-l-lg shadow-lg transition-all z-50"
      >
        <ChevronLeft className="w-5 h-5" />
        <Mic className="w-5 h-5 mt-2" />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <h3 className="font-semibold text-gray-900 dark:text-white">Setup Assistant</h3>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Voice Orb Section */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900">
        <VoiceOrb
          isConnected={state.isConnected}
          isListening={isListening}
          onStartListening={handleStartListening}
          onStopListening={handleStopListening}
          onAudioData={handleAudioData}
        />
      </div>

      {/* Progress Summary */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Setup Progress</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(state.progress).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{value}%</div>
              <div className="text-xs text-gray-500 capitalize">{key}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {transcript.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Tap the mic to start talking</p>
            <p className="text-xs mt-1">or type a message below</p>
          </div>
        ) : (
          transcript.map((entry) => (
            <div
              key={entry.id}
              className={`
                p-3 rounded-lg text-sm
                ${entry.type === 'user'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 ml-8'
                  : entry.type === 'assistant'
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 mr-8'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs mx-4'
                }
              `}
            >
              {entry.type === 'assistant' && (
                <div className="flex items-center gap-1 mb-1 text-xs text-gray-500">
                  <Volume2 className="w-3 h-3" />
                  <span>Assistant</span>
                </div>
              )}
              {entry.text}
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Text Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
          />
          <button
            onClick={handleSendText}
            disabled={!textInput.trim() || !state.isConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Connection Status Footer */}
      {!state.isConnected && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-700 dark:text-yellow-300 text-center">
            Connecting to assistant...
          </p>
        </div>
      )}
    </div>
  );
}

export default VoiceAssistantPanel;
