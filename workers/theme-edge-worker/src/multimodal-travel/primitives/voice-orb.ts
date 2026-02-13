/**
 * Voice Orb Primitive
 * Interactive voice assistant for travel booking
 */

import type { VoiceOrbConfig } from '../types';
import { TravelDesignTokens } from '../design-tokens';

export function createVoiceOrb(overrides?: Partial<VoiceOrbConfig>): VoiceOrbConfig {
  const sizeMap = { small: '64px', medium: '80px', large: '96px' };
  const size = overrides?.size || 'large';

  return {
    id: 'voice-orb',
    name: 'Voice Orb',
    type: 'interactive',
    componentType: 'voice-orb',
    size,
    position: 'bottom-center',
    showVisualizer: true,
    visualizerStyle: 'circular',
    visualizerBars: 16,
    showTranscript: true,
    showSuggestions: true,
    glowEffect: 'medium',
    pulseOnListening: true,
    dimensions: { width: sizeMap[size], height: sizeMap[size] },
    padding: { top: '0', right: '0', bottom: '0', left: '0' },
    backgroundColor: TravelDesignTokens.colors.sky[500],
    borderRadius: '50%',
    ...overrides,
  };
}

export function renderVoiceOrb(config: VoiceOrbConfig = createVoiceOrb(), state: 'idle' | 'listening' | 'thinking' | 'speaking' = 'idle'): string {
  const stateColors = TravelDesignTokens.colors.voiceState[state];
  const glowSize = config.glowEffect === 'strong' ? '32px' : config.glowEffect === 'medium' ? '24px' : '16px';

  return `
    <div style="
      position: fixed;
      ${config.position.includes('bottom') ? 'bottom: 32px;' : 'top: 32px;'}
      ${config.position.includes('left') ? 'left: 32px;' : config.position.includes('right') ? 'right: 32px;' : 'left: 50%; transform: translateX(-50%);'}
      z-index: ${TravelDesignTokens.zIndex.modal};
    ">
      <div style="
        width: ${config.dimensions?.width};
        height: ${config.dimensions?.height};
        background: ${stateColors.gradient};
        border-radius: ${config.borderRadius};
        box-shadow: 0 0 ${glowSize} ${stateColors.glow};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.3s;
        ${config.pulseOnListening && state === 'listening' ? 'animation: pulse 1.5s infinite;' : ''}
      " class="voice-orb">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      </div>

      ${config.showTranscript ? `
        <div style="
          position: absolute;
          bottom: calc(100% + 16px);
          left: 50%;
          transform: translateX(-50%);
          min-width: 300px;
          max-width: 400px;
          padding: ${TravelDesignTokens.spacing.md};
          background: white;
          border-radius: ${TravelDesignTokens.borderRadius.lg};
          box-shadow: ${TravelDesignTokens.shadows.lg};
          display: ${state !== 'idle' ? 'block' : 'none'};
        ">
          <div style="
            font-size: ${TravelDesignTokens.typography.fontSize.sm};
            color: ${TravelDesignTokens.colors.neutral[900]};
          ">
            ${state === 'listening' ? 'Listening...' : state === 'thinking' ? 'Processing...' : 'Speaking...'}
          </div>
        </div>
      ` : ''}
    </div>

    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
    </style>
  `;
}
