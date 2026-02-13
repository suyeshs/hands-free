/**
 * Voice Orb Primitive
 * Animated voice activation UI component
 */

import { HandsfreeDesignTokens } from '../design-tokens';
import type { VoiceOrbConfig } from '../types';

const tokens = HandsfreeDesignTokens;

export function createVoiceOrb(overrides?: Partial<VoiceOrbConfig>): VoiceOrbConfig {
  return {
    id: overrides?.id || 'voice-orb',
    name: overrides?.name || 'Voice Control',
    size: overrides?.size || 'lg',
    position: overrides?.position || 'bottom-center',
    showWaveform: overrides?.showWaveform ?? true,
    waveformStyle: overrides?.waveformStyle || 'circular',
    waveformBars: overrides?.waveformBars || 16,
    glowIntensity: overrides?.glowIntensity || 'medium',
    pulseOnActive: overrides?.pulseOnActive ?? true,
    showTranscript: overrides?.showTranscript ?? true,
    showStatus: overrides?.showStatus ?? true,
  };
}

export function renderVoiceOrb(config: VoiceOrbConfig, active: boolean = false): string {
  const sizeMap = { sm: '64px', md: '80px', lg: '96px', xl: '128px' };
  const size = sizeMap[config.size];

  const positionStyles = {
    'bottom-left': `bottom: ${tokens.spacing[8]}; left: ${tokens.spacing[8]};`,
    'bottom-center': `bottom: ${tokens.spacing[8]}; left: 50%; transform: translateX(-50%);`,
    'bottom-right': `bottom: ${tokens.spacing[8]}; right: ${tokens.spacing[8]};`,
    'center': `top: 50%; left: 50%; transform: translate(-50%, -50%);`,
  };

  const glowColor = active ? tokens.colors.primary[500] : tokens.colors.neutral[600];

  return `
    <div class="voice-orb ${active ? 'active' : ''}" style="
      position: fixed;
      ${positionStyles[config.position]}
      width: ${size};
      height: ${size};
      background: linear-gradient(135deg, ${tokens.colors.primary[500]}, ${tokens.colors.accent[500]});
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: ${tokens.zIndex.fixed};
      box-shadow: ${active ? tokens.shadows.glowBlue : tokens.shadows.lg};
      transition: all ${tokens.animation.normal} ${tokens.easing.standard};
      ${active && config.pulseOnActive ? 'animation: glowPulse 2s ease-in-out infinite;' : ''}
    ">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${tokens.colors.text.primary}" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>

      ${config.showWaveform && active ? `
        <div class="waveform" style="
          position: absolute;
          width: calc(100% + 40px);
          height: calc(100% + 40px);
          border-radius: 50%;
        ">
          ${Array.from({ length: config.waveformBars }, (_, i) => `
            <div class="waveform-bar" style="
              position: absolute;
              width: 3px;
              height: 20px;
              background: ${tokens.colors.success[500]};
              transform-origin: center;
              transform: rotate(${(360 / config.waveformBars) * i}deg) translateY(-${parseInt(size) / 2 + 20}px);
              animation: wave 1s ease-in-out infinite;
              animation-delay: ${(i * 100)}ms;
            "></div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
