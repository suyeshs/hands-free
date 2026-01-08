/**
 * Voice Activity Detection (VAD) Configuration
 * Using Silero VAD for speech detection in POS training
 */

/**
 * Environment Presets for different noise levels
 */
export const AUDIO_ENVIRONMENT_PRESETS = {
  quiet: {
    name: 'Quiet (Office)',
    description: 'Low ambient noise',
    vadThreshold: 0.15,
    rmsBaseThreshold: 0.005,
    noiseFloorMultiplier: 2.0,
    minSpeechDuration: 250,
    silenceDuration: 800,
    maxSilenceFrames: 25,
    positiveSpeechPad: 10,
  },
  moderate: {
    name: 'Moderate (Restaurant)',
    description: 'Moderate ambient noise',
    vadThreshold: 0.5,
    rmsBaseThreshold: 0.015,
    noiseFloorMultiplier: 2.5,
    minSpeechDuration: 300,
    silenceDuration: 900,
    maxSilenceFrames: 28,
    positiveSpeechPad: 12,
  },
  noisy: {
    name: 'Noisy (Busy Restaurant)',
    description: 'High ambient noise',
    vadThreshold: 0.7,
    rmsBaseThreshold: 0.025,
    noiseFloorMultiplier: 3.0,
    minSpeechDuration: 400,
    silenceDuration: 1000,
    maxSilenceFrames: 31,
    positiveSpeechPad: 15,
  },
  auto: {
    name: 'Auto-Detect',
    description: 'Automatically calibrate based on ambient noise',
    vadThreshold: 0.3,
    rmsBaseThreshold: 0.01,
    noiseFloorMultiplier: 2.5,
    minSpeechDuration: 300,
    silenceDuration: 850,
    maxSilenceFrames: 26,
    positiveSpeechPad: 12,
  },
};

export type AudioEnvironment = keyof typeof AUDIO_ENVIRONMENT_PRESETS;

/**
 * Get preset by environment type
 */
export function getAudioPreset(environment: AudioEnvironment) {
  return AUDIO_ENVIRONMENT_PRESETS[environment] || AUDIO_ENVIRONMENT_PRESETS.auto;
}

/**
 * Default VAD Configuration
 */
export const VAD_CONFIG = {
  // Model path (relative to public/)
  modelPath: '/models/silero_vad.onnx',

  // Current environment
  environment: 'auto' as AudioEnvironment,

  // Speech probability threshold (0-1)
  threshold: AUDIO_ENVIRONMENT_PRESETS.auto.vadThreshold,

  // Silence duration before turn complete (ms)
  silenceDuration: AUDIO_ENVIRONMENT_PRESETS.auto.silenceDuration,

  // Minimum speech duration to avoid false positives (ms)
  minSpeechDuration: AUDIO_ENVIRONMENT_PRESETS.auto.minSpeechDuration,

  // Audio configuration
  sampleRate: 16000,

  // Silero VAD frame size (512 samples = ~32ms at 16kHz)
  frameSamples: 512,

  // Maximum silence frames before turn complete
  maxSilenceFrames: AUDIO_ENVIRONMENT_PRESETS.auto.maxSilenceFrames,

  // Enable detailed logging
  debug: import.meta.env.DEV,

  // Positive speech buffer (frames)
  positiveSpeechPad: AUDIO_ENVIRONMENT_PRESETS.auto.positiveSpeechPad,

  // RMS-based thresholds
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
export function applyAudioPreset(environment: AudioEnvironment): void {
  const preset = getAudioPreset(environment);

  VAD_CONFIG.environment = environment;
  VAD_CONFIG.threshold = preset.vadThreshold;
  VAD_CONFIG.silenceDuration = preset.silenceDuration;
  VAD_CONFIG.minSpeechDuration = preset.minSpeechDuration;
  VAD_CONFIG.maxSilenceFrames = preset.maxSilenceFrames;
  VAD_CONFIG.positiveSpeechPad = preset.positiveSpeechPad;
  VAD_CONFIG.rmsBaseThreshold = preset.rmsBaseThreshold;
  VAD_CONFIG.noiseFloorMultiplier = preset.noiseFloorMultiplier;

  console.log(`[VAD Config] Applied preset: ${preset.name}`);
}

/**
 * Auto-detect environment based on noise floor
 */
export function autoDetectEnvironment(noiseFloorRMS: number): AudioEnvironment {
  if (noiseFloorRMS < 0.008) {
    return 'quiet';
  } else if (noiseFloorRMS < 0.015) {
    return 'moderate';
  } else {
    return 'noisy';
  }
}

/**
 * Validate VAD configuration
 */
export const validateVADConfig = (): boolean => {
  const { frameSamples, threshold, silenceDuration, sampleRate } = VAD_CONFIG;

  const validFrameSizes = [128, 256, 512];
  if (!validFrameSizes.includes(frameSamples)) {
    console.error(`[VAD Config] Invalid frameSamples: ${frameSamples}`);
    return false;
  }

  if (threshold < 0 || threshold > 1) {
    console.error(`[VAD Config] Invalid threshold: ${threshold}`);
    return false;
  }

  if (silenceDuration < 100 || silenceDuration > 5000) {
    console.warn(`[VAD Config] Unusual silenceDuration: ${silenceDuration}ms`);
  }

  if (sampleRate !== 16000) {
    console.error(`[VAD Config] Invalid sampleRate: ${sampleRate}. Must be 16kHz.`);
    return false;
  }

  console.log('[VAD Config] Configuration validated');
  return true;
};
