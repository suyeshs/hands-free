/**
 * Audio Worklet Processor for VAD-filtered Audio Streaming
 * Runs in a separate thread for efficient audio processing
 *
 * Enhanced with adaptive noise floor detection for restaurant environments:
 * - Dynamic threshold adjustment based on ambient noise
 * - Noise floor calibration support
 * - Restaurant environment presets (quiet/moderate/noisy)
 */

class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.isSpeaking = false;
    this.baseThreshold = 0.01; // Base RMS threshold
    this.speechThreshold = 0.01; // Dynamic RMS threshold (will adapt)
    this.lastSpeechTime = 0;

    // Adaptive noise floor detection
    this.noiseFloorSamples = [];
    this.maxNoiseFloorSamples = 100; // Track last 100 RMS values during silence
    this.noiseFloor = 0.005; // Estimated noise floor
    this.noiseFloorMultiplier = 2.5; // Speech must be 2.5x noise floor (configurable)
    this.calibrating = false;
    this.calibrationSamples = 0;
    this.calibrationTarget = 60; // Calibrate for ~2 seconds (at 30 samples/sec)

    // Proximity detection for multi-speaker handling
    this.speakerLevelHistory = []; // Track speech levels over time
    this.maxLevelHistory = 150; // Track last ~5 seconds of speech
    this.expectedSpeakerLevel = 0; // Expected level for primary speaker
    this.speakerLevelTolerance = 0.4; // 40% variation allowed
    this.suddenSpikeThreshold = 3.0; // Reject levels 3x higher than expected (likely background)

    // Message handling for configuration updates
    this.port.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === 'configure') {
        this.configureProcessor(data);
      } else if (type === 'startCalibration') {
        this.startNoiseFloorCalibration();
      }
    };
  }

  /**
   * Configure processor with environment-specific settings
   */
  configureProcessor(config) {
    if (config.baseThreshold !== undefined) {
      this.baseThreshold = config.baseThreshold;
    }
    if (config.noiseFloorMultiplier !== undefined) {
      this.noiseFloorMultiplier = config.noiseFloorMultiplier;
    }
    if (config.calibrationTarget !== undefined) {
      this.calibrationTarget = config.calibrationTarget;
    }

    // Recalculate speech threshold
    this.updateSpeechThreshold();

    this.port.postMessage({
      type: 'configured',
      threshold: this.speechThreshold,
      noiseFloor: this.noiseFloor
    });
  }

  /**
   * Start noise floor calibration (measure ambient noise for 2-3 seconds)
   */
  startNoiseFloorCalibration() {
    this.calibrating = true;
    this.calibrationSamples = 0;
    this.noiseFloorSamples = [];

    this.port.postMessage({
      type: 'calibration-started'
    });
  }

  /**
   * Update speech threshold based on current noise floor
   */
  updateSpeechThreshold() {
    this.speechThreshold = Math.max(
      this.baseThreshold,
      this.noiseFloor * this.noiseFloorMultiplier
    );
  }

  /**
   * Check if audio level matches primary speaker (proximity detection)
   * Returns true if level is consistent with primary speaker
   */
  isPrimarySpeaker(rms) {
    // If we don't have enough history yet, accept all speech
    if (this.speakerLevelHistory.length < 10) {
      return true;
    }

    // Calculate expected speaker level (median of history)
    const sorted = this.speakerLevelHistory.slice().sort((a, b) => a - b);
    this.expectedSpeakerLevel = sorted[Math.floor(sorted.length * 0.5)];

    // Check for sudden spikes (likely someone shouting nearby or background noise)
    if (rms > this.expectedSpeakerLevel * this.suddenSpikeThreshold) {
      // Sudden spike - likely background speaker
      return false;
    }

    // Check if within tolerance range
    const minAcceptable = this.expectedSpeakerLevel * (1 - this.speakerLevelTolerance);
    const maxAcceptable = this.expectedSpeakerLevel * (1 + this.speakerLevelTolerance);

    return rms >= minAcceptable && rms <= maxAcceptable;
  }

  /**
   * Update speaker level history
   */
  updateSpeakerHistory(rms) {
    this.speakerLevelHistory.push(rms);

    // Keep only recent history
    if (this.speakerLevelHistory.length > this.maxLevelHistory) {
      this.speakerLevelHistory.shift();
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const inputData = input[0]; // First channel (mono)

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    // Handle noise floor calibration
    if (this.calibrating) {
      this.noiseFloorSamples.push(rms);
      this.calibrationSamples++;

      if (this.calibrationSamples >= this.calibrationTarget) {
        // Calibration complete - calculate noise floor
        // Use 90th percentile to ignore brief loud sounds during calibration
        const sorted = this.noiseFloorSamples.slice().sort((a, b) => a - b);
        const percentile90Index = Math.floor(sorted.length * 0.9);
        this.noiseFloor = sorted[percentile90Index];

        // Update threshold based on new noise floor
        this.updateSpeechThreshold();

        this.calibrating = false;

        this.port.postMessage({
          type: 'calibration-complete',
          noiseFloor: this.noiseFloor,
          speechThreshold: this.speechThreshold,
          samples: this.calibrationSamples
        });

        // Keep only recent samples for ongoing adaptation
        this.noiseFloorSamples = [];
      } else {
        // Send calibration progress
        this.port.postMessage({
          type: 'calibration-progress',
          progress: this.calibrationSamples / this.calibrationTarget,
          currentRMS: rms
        });
      }
    }

    // Continuous noise floor adaptation (during silence)
    if (!this.calibrating && !this.isSpeaking && rms < this.speechThreshold) {
      this.noiseFloorSamples.push(rms);

      // Keep only recent samples
      if (this.noiseFloorSamples.length > this.maxNoiseFloorSamples) {
        this.noiseFloorSamples.shift();
      }

      // Periodically update noise floor estimate (every 30 samples ~1 second)
      if (this.noiseFloorSamples.length % 30 === 0 && this.noiseFloorSamples.length > 10) {
        const sorted = this.noiseFloorSamples.slice().sort((a, b) => a - b);
        const percentile90Index = Math.floor(sorted.length * 0.9);
        const newNoiseFloor = sorted[percentile90Index];

        // Smooth transition to new noise floor
        this.noiseFloor = this.noiseFloor * 0.8 + newNoiseFloor * 0.2;
        this.updateSpeechThreshold();

        this.port.postMessage({
          type: 'noise-floor-updated',
          noiseFloor: this.noiseFloor,
          speechThreshold: this.speechThreshold
        });
      }
    }

    // Detect speech start/end for interruption handling
    const currentTime = Date.now();

    if (!this.isSpeaking && rms > this.speechThreshold) {
      // Check if this is the primary speaker (proximity detection)
      const isPrimary = this.isPrimarySpeaker(rms);

      if (isPrimary) {
        // Accept this speech - likely the customer ordering
        this.isSpeaking = true;
        this.lastSpeechTime = currentTime;
        this.updateSpeakerHistory(rms);

        this.port.postMessage({
          type: 'speech-start',
          time: currentTime,
          rms: rms,
          threshold: this.speechThreshold,
          isPrimarySeaker: true
        });
      } else {
        // Reject - likely background speaker or sudden noise
        this.port.postMessage({
          type: 'background-speech-rejected',
          rms: rms,
          expectedLevel: this.expectedSpeakerLevel
        });
      }
    }

    if (this.isSpeaking && rms < this.speechThreshold) {
      const duration = currentTime - this.lastSpeechTime;
      this.port.postMessage({
        type: 'speech-end',
        duration: duration
      });
      this.isSpeaking = false;
    } else if (this.isSpeaking && rms > this.speechThreshold) {
      // Continue tracking speaker level during ongoing speech
      this.updateSpeakerHistory(rms);
    }

    // Send raw Float32 data to main thread for VAD processing
    // Clone the Float32Array to avoid transfer issues
    const audioClone = new Float32Array(inputData);

    this.port.postMessage({
      type: 'audio-data',
      data: audioClone.buffer,
      rms: rms, // Include RMS for monitoring
      noiseFloor: this.noiseFloor // Include current noise floor
    }, [audioClone.buffer]); // Transfer buffer ownership for efficiency

    return true; // Keep processor alive
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
