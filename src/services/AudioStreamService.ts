/**
 * Audio Stream Service
 * Handles microphone input capture and audio playback using Web Audio API
 * Works in both browser and Tauri desktop environments
 */

import { VAD_CONFIG } from '../config/vad';
import { VADService, getVADService } from './VADService';

export interface AudioStreamConfig {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  isSpeech: boolean;
  rms: number;
}

type AudioCallback = (chunk: AudioChunk) => void;
type LevelCallback = (level: number) => void;

const DEFAULT_CONFIG: AudioStreamConfig = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export class AudioStreamService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private playbackContext: AudioContext | null = null;

  private vadService: VADService;
  private config: AudioStreamConfig;
  private isCapturing: boolean = false;
  private isCalibrating: boolean = false;

  private onAudioChunk: AudioCallback | null = null;
  private onAudioLevel: LevelCallback | null = null;

  // Audio level for visualization
  private currentLevel: number = 0;
  private levelAnimationFrame: number | null = null;

  constructor(config: Partial<AudioStreamConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vadService = getVADService();
  }

  /**
   * Initialize audio capture
   */
  async initialize(): Promise<void> {
    console.log('[AudioStream] Initializing...');

    // Initialize VAD
    await this.vadService.initialize();

    // Request microphone permission
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
        },
      });

      console.log('[AudioStream] Microphone access granted');
    } catch (error) {
      console.error('[AudioStream] Microphone access denied:', error);
      throw new Error('Microphone access required for voice training');
    }

    // Create audio context for capture
    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });

    // Create source from microphone
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Create analyser for level visualization
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Connect source to analyser
    this.sourceNode.connect(this.analyserNode);

    // Create processor for raw audio data (legacy API but more reliable)
    const bufferSize = VAD_CONFIG.frameSamples * 4; // ~128ms chunks
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = async (event) => {
      if (!this.isCapturing) return;

      const inputData = event.inputBuffer.getChannelData(0);
      const audioChunk = new Float32Array(inputData);

      // Process through VAD
      const vadResult = await this.vadService.process(audioChunk);

      // Create audio chunk with metadata
      const chunk: AudioChunk = {
        data: audioChunk,
        timestamp: Date.now(),
        isSpeech: vadResult.isSpeech,
        rms: vadResult.rms,
      };

      // Callback with processed chunk
      if (this.onAudioChunk) {
        this.onAudioChunk(chunk);
      }
    };

    // Create playback context (24kHz for Gemini audio output)
    this.playbackContext = new AudioContext({ sampleRate: 24000 });

    console.log('[AudioStream] Initialized successfully');
  }

  /**
   * Start capturing audio
   */
  startCapture(onChunk: AudioCallback, onLevel?: LevelCallback): void {
    if (!this.audioContext || !this.sourceNode || !this.processorNode) {
      throw new Error('AudioStreamService not initialized');
    }

    this.onAudioChunk = onChunk;
    this.onAudioLevel = onLevel || null;
    this.isCapturing = true;

    // Connect processor to get audio data
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    // Start level monitoring
    this.startLevelMonitoring();

    console.log('[AudioStream] Capture started');
  }

  /**
   * Stop capturing audio
   */
  stopCapture(): void {
    this.isCapturing = false;
    this.onAudioChunk = null;

    if (this.processorNode && this.audioContext) {
      this.processorNode.disconnect();
    }

    this.stopLevelMonitoring();
    this.vadService.resetState();

    console.log('[AudioStream] Capture stopped');
  }

  /**
   * Monitor audio level for visualization
   */
  private startLevelMonitoring(): void {
    const updateLevel = () => {
      if (!this.analyserNode || !this.isCapturing) return;

      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(dataArray);

      // Calculate average level
      const sum = dataArray.reduce((a, b) => a + b, 0);
      this.currentLevel = sum / dataArray.length / 255;

      if (this.onAudioLevel) {
        this.onAudioLevel(this.currentLevel);
      }

      this.levelAnimationFrame = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  /**
   * Stop level monitoring
   */
  private stopLevelMonitoring(): void {
    if (this.levelAnimationFrame) {
      cancelAnimationFrame(this.levelAnimationFrame);
      this.levelAnimationFrame = null;
    }
    this.currentLevel = 0;
    if (this.onAudioLevel) {
      this.onAudioLevel(0);
    }
  }

  /**
   * Get current audio level (0-1)
   */
  getLevel(): number {
    return this.currentLevel;
  }

  /**
   * Calibrate VAD using ambient noise
   */
  async calibrate(durationMs: number = 1000): Promise<void> {
    if (!this.audioContext || !this.sourceNode) {
      throw new Error('AudioStreamService not initialized');
    }

    console.log('[AudioStream] Starting calibration...');
    this.isCalibrating = true;

    const samples: Float32Array[] = [];
    const bufferSize = VAD_CONFIG.frameSamples;

    return new Promise((resolve) => {
      const processor = this.audioContext!.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!this.isCalibrating) return;
        samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };

      this.sourceNode!.connect(processor);
      processor.connect(this.audioContext!.destination);

      setTimeout(() => {
        this.isCalibrating = false;
        processor.disconnect();
        this.sourceNode!.disconnect(processor);

        // Combine samples and calibrate
        const totalLength = samples.reduce((sum, arr) => sum + arr.length, 0);
        const combined = new Float32Array(totalLength);
        let offset = 0;
        for (const sample of samples) {
          combined.set(sample, offset);
          offset += sample.length;
        }

        this.vadService.calibrate(combined);
        console.log('[AudioStream] Calibration complete');
        resolve();
      }, durationMs);
    });
  }

  /**
   * Play audio from base64 PCM data (Gemini response format)
   */
  async playBase64Audio(base64Data: string, sampleRate: number = 24000): Promise<void> {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate });
    }

    try {
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to Float32
      const samples = new Float32Array(bytes.length / 2);
      const dataView = new DataView(bytes.buffer);

      for (let i = 0; i < samples.length; i++) {
        const int16 = dataView.getInt16(i * 2, true); // Little-endian
        samples[i] = int16 / 32768;
      }

      // Create audio buffer and play
      const audioBuffer = this.playbackContext.createBuffer(1, samples.length, sampleRate);
      audioBuffer.copyToChannel(samples, 0);

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      source.start();

      console.log(`[AudioStream] Playing audio: ${samples.length} samples`);
    } catch (error) {
      console.error('[AudioStream] Playback error:', error);
    }
  }

  /**
   * Play audio from ArrayBuffer
   */
  async playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext();
    }

    try {
      const audioBuffer = await this.playbackContext.decodeAudioData(buffer);
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      source.start();
    } catch (error) {
      console.error('[AudioStream] Playback error:', error);
    }
  }

  /**
   * Convert Float32 audio to PCM16 ArrayBuffer (for sending to server)
   */
  static float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(i * 2, int16, true); // Little-endian
    }

    return buffer;
  }

  /**
   * Convert Float32 audio to base64 PCM16
   */
  static float32ToBase64PCM16(float32Array: Float32Array): string {
    const pcmBuffer = AudioStreamService.float32ToPCM16(float32Array);
    const bytes = new Uint8Array(pcmBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Check if audio is available
   */
  async checkAudioAvailable(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInput = devices.some((device) => device.kind === 'audioinput');
      return hasAudioInput;
    } catch {
      return false;
    }
  }

  /**
   * Get list of audio input devices
   */
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audioinput');
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.stopCapture();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.playbackContext) {
      await this.playbackContext.close();
      this.playbackContext = null;
    }

    this.sourceNode = null;
    this.processorNode = null;
    this.analyserNode = null;

    await this.vadService.dispose();

    console.log('[AudioStream] Disposed');
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }
}

// Singleton instance
let audioStreamInstance: AudioStreamService | null = null;

export function getAudioStreamService(): AudioStreamService {
  if (!audioStreamInstance) {
    audioStreamInstance = new AudioStreamService();
  }
  return audioStreamInstance;
}

export async function disposeAudioStreamService(): Promise<void> {
  if (audioStreamInstance) {
    await audioStreamInstance.dispose();
    audioStreamInstance = null;
  }
}
