/**
 * Voice Activity Detection Service
 * Uses Silero VAD ONNX model via @ricky0123/vad-web library
 */

import { SileroV5 } from '@ricky0123/vad-web/dist/models/v5';
import type { Model } from '@ricky0123/vad-web/dist/models/common';
import * as ort from 'onnxruntime-web';
import { VAD_CONFIG, validateVADConfig } from '../config/vad';

export interface VADResult {
  isSpeech: boolean;
  probability: number;
  timestamp: number;
}

export class VADService {
  private model: Model | null = null;
  private isInitialized: boolean = false;
  private audioBuffer: Float32Array[] = [];
  private lastStateReset: number = 0;
  private sampleRate: number = VAD_CONFIG.sampleRate;

  // Statistics for debugging and cost tracking
  private stats = {
    totalFrames: 0,
    speechFrames: 0,
    silenceFrames: 0,
    totalAudioSent: 0, // bytes
    totalAudioReceived: 0, // bytes
  };

  constructor() {
    // Validate configuration on initialization
    if (!validateVADConfig()) {
      throw new Error('Invalid VAD configuration');
    }
  }

  /**
   * Initialize VAD model using ricky0123/vad-web library
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[VAD] Already initialized');
      return;
    }

    try {
      console.log('[VAD] Loading Silero VAD model via @ricky0123/vad-web...');
      const startTime = performance.now();

      // Configure ONNX Runtime for browser (use same version as @ricky0123/vad-web)
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';

      // Create model fetcher with cache busting
      const modelFetcher = async (): Promise<ArrayBuffer> => {
        // Add timestamp to force cache refresh after model replacement
        const cacheBuster = `?v=${Date.now()}`;
        const modelUrl = VAD_CONFIG.modelPath + cacheBuster;
        console.log('[VAD] Fetching model from:', modelUrl);

        const response = await fetch(modelUrl, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch model: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(`[VAD] Model downloaded: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        // Calculate MD5-like hash for verification (simple check)
        const bytes = new Uint8Array(arrayBuffer);
        const sampleHash = Array.from(bytes.slice(0, 16))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        console.log('[VAD] Model file signature (first 16 bytes):', sampleHash);

        return arrayBuffer;
      };

      // Initialize SileroV5 model
      this.model = await SileroV5.new(ort, modelFetcher);

      const loadTime = performance.now() - startTime;
      console.log(`[VAD] Model loaded successfully in ${loadTime.toFixed(0)}ms`);

      this.isInitialized = true;
      this.lastStateReset = Date.now();
    } catch (error) {
      console.error('[VAD] Failed to initialize:', error);
      throw new Error(`VAD initialization failed: ${error}`);
    }
  }

  /**
   * Process audio chunk and detect speech
   * @param audioData Float32Array of audio samples (any length)
   * @returns VADResult indicating if speech was detected
   */
  async process(audioData: Float32Array): Promise<VADResult> {
    if (!this.isInitialized || !this.model) {
      throw new Error('VAD not initialized. Call initialize() first.');
    }

    // Verify sample rate
    if (this.sampleRate !== 16000 && this.sampleRate !== 8000) {
      throw new Error(`Unsupported sample rate: ${this.sampleRate}. Silero VAD requires 16kHz or 8kHz.`);
    }

    // Compute RMS and apply auto-gain if needed
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    let rms = Math.sqrt(sum / audioData.length);

    // If audio is too quiet, apply gain (cap at 50x to boost very quiet audio)
    if (rms < 0.02 && rms > 0) {
      const gain = Math.min(50, 0.1 / rms); // Target RMS ~0.1
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] *= gain;
        // Clip to [-1, 1] range to avoid distortion
        audioData[i] = Math.max(-1, Math.min(1, audioData[i]));
      }
      // Recalculate RMS after gain and clipping
      sum = 0;
      for (let i = 0; i < audioData.length; i++) {
        sum += audioData[i] * audioData[i];
      }
      rms = Math.sqrt(sum / audioData.length);
      console.log(`[VAD] Applied gain ${gain.toFixed(1)}x | New RMS: ${rms.toFixed(4)}`);
    }

    // Debug: Check if audio data is empty or has values
    if (VAD_CONFIG.debug && Math.random() < 0.1) { // Log 10% of chunks
      const min = Math.min(...Array.from(audioData));
      const max = Math.max(...Array.from(audioData));
      console.log(`[VAD Debug] Incoming chunk: ${audioData.length} samples | Min: ${min.toFixed(4)} | Max: ${max.toFixed(4)} | RMS: ${rms.toFixed(4)}`);
    }

    // Add incoming audio to buffer
    this.audioBuffer.push(audioData);

    // Accumulate samples until we have enough for VAD (512 samples)
    const totalSamples = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);

    if (totalSamples < VAD_CONFIG.frameSamples) {
      // Not enough samples yet, return silence
      return {
        isSpeech: false,
        probability: 0,
        timestamp: Date.now(),
      };
    }

    // Extract exactly 512 samples from buffer
    const vadInput = this.extractSamples(VAD_CONFIG.frameSamples);

    // Run VAD inference
    const result = await this.runInference(vadInput);

    // Auto-reset state every 5 seconds during silence to prevent drift
    if (Date.now() - this.lastStateReset > 5000 && !result.isSpeech) {
      if (VAD_CONFIG.debug) {
        console.log('[VAD] Auto-resetting state after 5s silence');
      }
      this.resetState();
    }

    // Update statistics
    this.stats.totalFrames++;
    this.stats.totalAudioReceived += audioData.length * 4; // Float32 = 4 bytes per sample

    if (result.isSpeech) {
      this.stats.speechFrames++;
      this.stats.totalAudioSent += VAD_CONFIG.frameSamples * 2; // PCM16 = 2 bytes per sample
      this.lastStateReset = Date.now(); // Update last speech time
    } else {
      this.stats.silenceFrames++;
    }

    return result;
  }

  /**
   * Extract N samples from buffer and remove them
   */
  private extractSamples(count: number): Float32Array {
    const result = new Float32Array(count);
    let offset = 0;

    while (offset < count && this.audioBuffer.length > 0) {
      const chunk = this.audioBuffer[0];
      const needed = count - offset;
      const available = chunk.length;

      if (available <= needed) {
        // Use entire chunk
        result.set(chunk, offset);
        offset += available;
        this.audioBuffer.shift();
      } else {
        // Use part of chunk
        result.set(chunk.slice(0, needed), offset);
        this.audioBuffer[0] = chunk.slice(needed);
        offset += needed;
      }
    }

    return result;
  }

  /**
   * Run Silero VAD inference using ricky0123/vad-web
   */
  private async runInference(audioData: Float32Array): Promise<VADResult> {
    if (!this.model) {
      throw new Error('VAD model not initialized');
    }

    try {
      // Use the ricky0123/vad-web model which handles all tensor creation internally
      const result = await this.model.process(audioData);

      // result contains { isSpeech: number, notSpeech: number }
      // isSpeech is the probability that this is speech
      const probability = result.isSpeech;

      // Use dynamic threshold based on environment
      const isSpeech = probability >= VAD_CONFIG.threshold;

      if (VAD_CONFIG.debug) {
        // Calculate RMS for comparison
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
          sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);

        console.log(`[VAD] Prob: ${probability.toFixed(3)} | RMS: ${rms.toFixed(4)} | Samples: ${audioData.length} | Speech: ${isSpeech ? 'YES' : 'NO'}`);
      }

      return {
        isSpeech,
        probability,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[VAD] Inference error:', error);
      // Return silence on error to avoid breaking the audio pipeline
      return {
        isSpeech: false,
        probability: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Reset state tensor (call after long silence or new conversation)
   */
  resetState(): void {
    if (!this.model) return;

    // Use the model's built-in reset_state method
    this.model.reset_state();
    this.audioBuffer = [];
    this.lastStateReset = Date.now();

    if (VAD_CONFIG.debug) {
      console.log('[VAD] State reset');
    }
  }

  /**
   * Get statistics for cost tracking
   */
  getStats() {
    const savingsPercent =
      this.stats.totalAudioReceived > 0
        ? ((1 - this.stats.totalAudioSent / this.stats.totalAudioReceived) * 100).toFixed(1)
        : '0.0';

    return {
      ...this.stats,
      savingsPercent: `${savingsPercent}%`,
      speechRatio: (this.stats.speechFrames / Math.max(this.stats.totalFrames, 1)).toFixed(2),
      totalAudioReceivedMB: (this.stats.totalAudioReceived / 1024 / 1024).toFixed(2),
      totalAudioSentMB: (this.stats.totalAudioSent / 1024 / 1024).toFixed(2),
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
    console.log('[VAD] Statistics reset');
  }

  /**
   * Log current statistics
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('[VAD Stats]', {
      'Total Frames': stats.totalFrames,
      'Speech Frames': stats.speechFrames,
      'Silence Frames': stats.silenceFrames,
      'Speech Ratio': stats.speechRatio,
      'Audio Received': `${stats.totalAudioReceivedMB} MB`,
      'Audio Sent to Gemini': `${stats.totalAudioSentMB} MB`,
      'Savings': stats.savingsPercent,
    });
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.model) {
      await this.model.release();
    }
    this.model = null;
    this.audioBuffer = [];
    this.isInitialized = false;
    console.log('[VAD] Disposed');
  }

  /**
   * Check if VAD is ready to process audio
   */
  isReady(): boolean {
    return this.isInitialized && this.model !== null;
  }
}
