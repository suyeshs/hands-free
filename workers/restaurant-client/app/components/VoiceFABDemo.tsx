'use client';

import React, { useState, useEffect } from 'react';
import { VoiceFAB, VoiceFABState } from './VoiceFAB';

/**
 * Demo component to showcase all VoiceFAB states
 */
export const VoiceFABDemo: React.FC = () => {
  const [currentState, setCurrentState] = useState<VoiceFABState>('not-connected');
  const [autoDemo, setAutoDemo] = useState(false);

  const states: VoiceFABState[] = [
    'not-connected',
    'connecting',
    'connected',
    'listening',
    'speaking',
    'thinking'
  ];

  const stateDescriptions: Record<VoiceFABState, string> = {
    'not-connected': 'Initial state - tap to connect',
    'connecting': 'Establishing connection...',
    'connected': 'Ready - tap to start speaking',
    'listening': 'User is speaking',
    'speaking': 'AI is responding',
    'thinking': 'Processing your request...'
  };

  // Auto-cycle through states for demo
  useEffect(() => {
    if (!autoDemo) return;

    const interval = setInterval(() => {
      setCurrentState((prev) => {
        const currentIndex = states.indexOf(prev);
        return states[(currentIndex + 1) % states.length];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [autoDemo]);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Voice FAB States</h1>

        {/* Interactive Demo */}
        <div className="bg-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Interactive Demo</h2>

          <div className="flex flex-col items-center gap-6">
            <VoiceFAB
              state={currentState}
              size={120}
              onClick={() => {
                // Cycle to next state on click
                const currentIndex = states.indexOf(currentState);
                setCurrentState(states[(currentIndex + 1) % states.length]);
              }}
            />

            <div className="text-center">
              <p className="text-lg font-medium text-purple-400 capitalize">
                {currentState.replace('-', ' ')}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {stateDescriptions[currentState]}
              </p>
            </div>

            <button
              onClick={() => setAutoDemo(!autoDemo)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                autoDemo
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {autoDemo ? 'Stop Auto Demo' : 'Start Auto Demo'}
            </button>
          </div>
        </div>

        {/* All States Grid */}
        <div className="bg-gray-800 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">All States</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {states.map((state) => (
              <div
                key={state}
                className={`flex flex-col items-center gap-4 p-4 rounded-lg transition-colors cursor-pointer ${
                  currentState === state
                    ? 'bg-purple-900/30 ring-2 ring-purple-500'
                    : 'hover:bg-gray-700/50'
                }`}
                onClick={() => setCurrentState(state)}
              >
                <VoiceFAB state={state} size={80} />
                <div className="text-center">
                  <p className="text-sm font-medium text-white capitalize">
                    {state.replace('-', ' ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stateDescriptions[state]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Size Variations */}
        <div className="bg-gray-800 rounded-xl p-8 mt-8">
          <h2 className="text-xl font-semibold text-white mb-6">Size Variations</h2>

          <div className="flex items-end justify-center gap-8">
            {[48, 64, 80, 100, 120].map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <VoiceFAB state="connected" size={size} />
                <span className="text-xs text-gray-400">{size}px</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceFABDemo;
