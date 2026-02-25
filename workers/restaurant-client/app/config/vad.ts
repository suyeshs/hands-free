/**
 * Voice Activity Detection (VAD) Configuration
 * Using Silero VAD for speech detection
 *
 * Enhanced for restaurant environments with adaptive noise handling
 */

/**
 * Restaurant Environment Presets
 * Optimized for different noise levels
 */
export const AUDIO_ENVIRONMENT_PRESETS = {
  quiet: {
    name: 'Quiet (Home/Office)',
    description: 'Low ambient noise, single speaker',
    vadThreshold: 0.15, // Very sensitive for testing
    rmsBaseThreshold: 0.005, // Very low RMS threshold
    noiseFloorMultiplier: 2.0, // Speech 2x louder than noise floor
    minSpeechDuration: 250, // ms
    silenceDuration: 800, // ms
    maxSilenceFrames: 25,
    positiveSpeechPad: 10, // frames
  },
  moderate: {
    name: 'Moderate (Cafe/Casual Dining)',
    description: 'Moderate ambient noise, occasional background voices',
    vadThreshold: 0.6, // More conservative
    rmsBaseThreshold: 0.015, // Higher RMS threshold
    noiseFloorMultiplier: 2.5, // Speech 2.5x louder than noise floor
    minSpeechDuration: 300, // Filter brief noises
    silenceDuration: 900, // Longer silence threshold
    maxSilenceFrames: 28,
    positiveSpeechPad: 12, // Longer buffer
  },
  noisy: {
    name: 'Noisy (Busy Restaurant/Bar)',
    description: 'High ambient noise, multiple speakers, background music',
    vadThreshold: 0.7, // Very conservative
    rmsBaseThreshold: 0.025, // Much higher RMS threshold
    noiseFloorMultiplier: 3.0, // Speech 3x louder than noise floor
    minSpeechDuration: 400, // Filter more noises
    silenceDuration: 1000, // Even longer silence threshold
    maxSilenceFrames: 31,
    positiveSpeechPad: 15, // Maximum buffer
  },
  auto: {
    name: 'Auto-Detect',
    description: 'Automatically calibrate based on ambient noise level',
    vadThreshold: 0.15, // Very sensitive for testing
    rmsBaseThreshold: 0.005,
    noiseFloorMultiplier: 2.5,
    minSpeechDuration: 300,
    silenceDuration: 850,
    maxSilenceFrames: 26,
    positiveSpeechPad: 12,
  }
};

/**
 * Get preset by environment type
 */
export function getAudioPreset(environment: keyof typeof AUDIO_ENVIRONMENT_PRESETS) {
  return AUDIO_ENVIRONMENT_PRESETS[environment] || AUDIO_ENVIRONMENT_PRESETS.auto;
}

/**
 * Default VAD Configuration (uses Auto-Detect preset)
 */
export const VAD_CONFIG = {
  // Model path (relative to public/)
  modelPath: '/models/silero_vad.onnx',

  // Current environment (can be changed at runtime)
  environment: 'auto' as keyof typeof AUDIO_ENVIRONMENT_PRESETS,

  // Speech probability threshold (0-1)
  // Higher = more conservative (less false positives)
  // Lower = more sensitive (may catch weak speech)
  threshold: AUDIO_ENVIRONMENT_PRESETS.auto.vadThreshold,

  // Silence duration before considering turn complete (ms)
  // Recommended: 300-800ms for natural conversation
  silenceDuration: AUDIO_ENVIRONMENT_PRESETS.auto.silenceDuration,

  // Minimum speech duration to avoid false positives (ms)
  // Helps filter out brief noises
  minSpeechDuration: AUDIO_ENVIRONMENT_PRESETS.auto.minSpeechDuration,

  // Audio configuration
  sampleRate: 16000, // Must match AudioContext sample rate

  // Silero VAD expects specific frame sizes
  // Valid options: 512, 256, or 128 samples at 16kHz
  frameSamples: 512, // ~32ms per frame at 16kHz

  // Maximum silence frames before turn complete
  maxSilenceFrames: AUDIO_ENVIRONMENT_PRESETS.auto.maxSilenceFrames,

  // Enable detailed logging for debugging
  debug: true,

  // Positive speech buffer (frames)
  // Continue sending audio for N frames after speech ends
  // to avoid cutting off final syllables
  positiveSpeechPad: AUDIO_ENVIRONMENT_PRESETS.auto.positiveSpeechPad,

  // RMS-based thresholds (for audio processor)
  rmsBaseThreshold: AUDIO_ENVIRONMENT_PRESETS.auto.rmsBaseThreshold,
  noiseFloorMultiplier: AUDIO_ENVIRONMENT_PRESETS.auto.noiseFloorMultiplier,
};

/**
 * Calculate frame duration in milliseconds
 */
export const getFrameDurationMs = (): number => {
  return (VAD_CONFIG.frameSamples / VAD_CONFIG.sampleRate) * 1000;
};

/**
 * Update VAD configuration with a preset
 */
export function applyAudioPreset(environment: keyof typeof AUDIO_ENVIRONMENT_PRESETS): void {
  const preset = getAudioPreset(environment);

  VAD_CONFIG.environment = environment;
  VAD_CONFIG.threshold = preset.vadThreshold;
  VAD_CONFIG.silenceDuration = preset.silenceDuration;
  VAD_CONFIG.minSpeechDuration = preset.minSpeechDuration;
  VAD_CONFIG.maxSilenceFrames = preset.maxSilenceFrames;
  VAD_CONFIG.positiveSpeechPad = preset.positiveSpeechPad;
  VAD_CONFIG.rmsBaseThreshold = preset.rmsBaseThreshold;
  VAD_CONFIG.noiseFloorMultiplier = preset.noiseFloorMultiplier;

  console.log(`[VAD Config] Applied preset: ${preset.name} - ${preset.description}`);
}

/**
 * Auto-detect environment based on noise floor measurement
 */
export function autoDetectEnvironment(noiseFloorRMS: number): keyof typeof AUDIO_ENVIRONMENT_PRESETS {
  if (noiseFloorRMS < 0.008) {
    return 'quiet'; // Very low ambient noise
  } else if (noiseFloorRMS < 0.015) {
    return 'moderate'; // Moderate ambient noise
  } else {
    return 'noisy'; // High ambient noise
  }
}

/**
 * Validate VAD configuration
 */
export const validateVADConfig = (): boolean => {
  const { frameSamples, threshold, silenceDuration, sampleRate } = VAD_CONFIG;

  // Silero VAD only supports specific frame sizes
  const validFrameSizes = [128, 256, 512];
  if (!validFrameSizes.includes(frameSamples)) {
    console.error(`[VAD Config] Invalid frameSamples: ${frameSamples}. Must be 128, 256, or 512.`);
    return false;
  }

  // Threshold must be between 0 and 1
  if (threshold < 0 || threshold > 1) {
    console.error(`[VAD Config] Invalid threshold: ${threshold}. Must be between 0 and 1.`);
    return false;
  }

  // Silence duration should be reasonable
  if (silenceDuration < 100 || silenceDuration > 5000) {
    console.warn(`[VAD Config] Unusual silenceDuration: ${silenceDuration}ms. Recommended: 300-800ms.`);
  }

  // Sample rate must be 16kHz for Silero VAD
  if (sampleRate !== 16000) {
    console.error(`[VAD Config] Invalid sampleRate: ${sampleRate}. Silero VAD requires 16kHz.`);
    return false;
  }

  console.log('[VAD Config] Configuration validated ✓');
  return true;
};
