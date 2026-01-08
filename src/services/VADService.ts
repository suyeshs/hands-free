/**
 * Voice Activity Detection Service
 * Uses RMS-based detection with adaptive thresholds
 * Can be upgraded to Silero VAD ONNX model later
 */

import { VAD_CONFIG, validateVADConfig } from '../config/vad';

export interface VADResult {
  isSpeech: boolean;
  probability: number;
  rms: number;
  timestamp: number;
}

export interface VADStats {
  totalFrames: number;
  speechFrames: number;
  silenceFrames: number;
  totalAudioSent: number;
  totalAudioReceived: number;
  savingsPercent: string;
  speechRatio: string;
}

export class VADService {
  private isInitialized: boolean = false;
  // Audio buffer for future Silero VAD model support
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _audioBuffer: Float32Array[] = [];
  private lastStateReset: number = 0;
  private noiseFloor: number = 0.01;
  private speechFrameCount: number = 0;
  private silenceFrameCount: number = 0;

  // Statistics
  private stats = {
    totalFrames: 0,
    speechFrames: 0,
    silenceFrames: 0,
    totalAudioSent: 0,
    totalAudioReceived: 0,
  };

  constructor() {
    if (!validateVADConfig()) {
      console.warn('[VAD] Configuration validation failed, using defaults');
    }
  }

  /**
   * Initialize VAD service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[VAD] Already initialized');
      return;
    }

    console.log('[VAD] Initializing RMS-based VAD...');
    this.isInitialized = true;
    this.lastStateReset = Date.now();
    console.log('[VAD] Initialized successfully');
  }

  /**
   * Process audio chunk and detect speech
   */
  async process(audioData: Float32Array): Promise<VADResult> {
    if (!this.isInitialized) {
      throw new Error('VAD not initialized. Call initialize() first.');
    }

    // Calculate RMS (Root Mean Square) for volume level
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);

    // Update noise floor (slow adaptation)
    if (rms < this.noiseFloor * 1.5) {
      this.noiseFloor = this.noiseFloor * 0.99 + rms * 0.01;
    }

    // Calculate speech probability based on RMS vs noise floor
    const threshold = Math.max(
      VAD_CONFIG.rmsBaseThreshold,
      this.noiseFloor * VAD_CONFIG.noiseFloorMultiplier
    );

    // Probability is how much louder than threshold
    const ratio = rms / threshold;
    const probability = Math.min(1, Math.max(0, (ratio - 0.5) / 1.5));

    // Determine if speech based on threshold
    const isSpeech = probability >= VAD_CONFIG.threshold;

    // Track consecutive speech/silence frames for smoothing
    if (isSpeech) {
      this.speechFrameCount++;
      this.silenceFrameCount = 0;
    } else {
      this.silenceFrameCount++;
      if (this.silenceFrameCount > VAD_CONFIG.maxSilenceFrames) {
        this.speechFrameCount = 0;
      }
    }

    // Apply minimum speech duration filter
    const minSpeechFrames = Math.ceil(
      VAD_CONFIG.minSpeechDuration / (VAD_CONFIG.frameSamples / VAD_CONFIG.sampleRate * 1000)
    );
    const confirmedSpeech = isSpeech && this.speechFrameCount >= minSpeechFrames;

    // Update statistics
    this.stats.totalFrames++;
    this.stats.totalAudioReceived += audioData.length * 4;

    if (confirmedSpeech) {
      this.stats.speechFrames++;
      this.stats.totalAudioSent += audioData.length * 2;
      this.lastStateReset = Date.now();
    } else {
      this.stats.silenceFrames++;
    }

    // Auto-reset after extended silence
    if (Date.now() - this.lastStateReset > 5000 && !confirmedSpeech) {
      this.resetState();
    }

    if (VAD_CONFIG.debug && this.stats.totalFrames % 50 === 0) {
      console.log(
        `[VAD] RMS: ${rms.toFixed(4)} | Prob: ${probability.toFixed(2)} | ` +
        `Speech: ${confirmedSpeech ? 'YES' : 'NO'} | NoiseFloor: ${this.noiseFloor.toFixed(4)}`
      );
    }

    return {
      isSpeech: confirmedSpeech,
      probability,
      rms,
      timestamp: Date.now(),
    };
  }

  /**
   * Reset state (call after conversation ends)
   */
  resetState(): void {
    this._audioBuffer = [];
    this.speechFrameCount = 0;
    this.silenceFrameCount = 0;
    this.lastStateReset = Date.now();

    if (VAD_CONFIG.debug) {
      console.log('[VAD] State reset');
    }
  }

  /**
   * Get statistics
   */
  getStats(): VADStats {
    const savingsPercent =
      this.stats.totalAudioReceived > 0
        ? ((1 - this.stats.totalAudioSent / this.stats.totalAudioReceived) * 100).toFixed(1)
        : '0.0';

    return {
      ...this.stats,
      savingsPercent: `${savingsPercent}%`,
      speechRatio: (this.stats.speechFrames / Math.max(this.stats.totalFrames, 1)).toFixed(2),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalFrames: 0,
      speechFrames: 0,
      silenceFrames: 0,
      totalAudioSent: 0,
      totalAudioReceived: 0,
    };
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    this._audioBuffer = [];
    this.isInitialized = false;
    console.log('[VAD] Disposed');
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get buffered audio samples (for future Silero VAD model)
   */
  getAudioBuffer(): Float32Array[] {
    return this._audioBuffer;
  }

  /**
   * Calibrate noise floor from a silence sample
   */
  calibrate(silenceSamples: Float32Array): void {
    let sum = 0;
    for (let i = 0; i < silenceSamples.length; i++) {
      sum += silenceSamples[i] * silenceSamples[i];
    }
    this.noiseFloor = Math.sqrt(sum / silenceSamples.length);
    console.log(`[VAD] Calibrated noise floor: ${this.noiseFloor.toFixed(4)}`);
  }
}

// Singleton instance
let vadInstance: VADService | null = null;

export function getVADService(): VADService {
  if (!vadInstance) {
    vadInstance = new VADService();
  }
  return vadInstance;
}
