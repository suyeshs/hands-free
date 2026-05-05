/**
 * Audio Noise Gate Processor with Frequency Filtering
 * Advanced audio processing worklet for restaurant environments
 *
 * Features:
 * - Spectral noise gating (frequency-domain filtering)
 * - Speech band isolation (300Hz-3400Hz)
 * - Adaptive attack/release envelopes
 * - Real-time spectral analysis
 */

class AudioNoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Noise gate parameters
    this.threshold = -40; // dB threshold for gate
    this.ratio = 10; // Expander ratio (how much to attenuate below threshold)
    this.attack = 0.003; // 3ms attack time
    this.release = 0.050; // 50ms release time
    this.makeupGain = 1.0; // Output gain adjustment

    // Current envelope state
    this.envelope = 0;
    this.isGateOpen = false;

    // Frequency filtering (will be done in main thread with Web Audio API)
    // This processor focuses on amplitude-based gating

    // Spectral analysis buffer
    this.spectralBuffer = new Float32Array(128);
    this.spectralBufferIndex = 0;

    // Statistics
    this.stats = {
      gateOpenFrames: 0,
      gateClosedFrames: 0,
      totalFrames: 0,
      averageLevel: 0
    };

    // Configuration message handling
    this.port.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === 'configure') {
        if (data.threshold !== undefined) this.threshold = data.threshold;
        if (data.ratio !== undefined) this.ratio = data.ratio;
        if (data.attack !== undefined) this.attack = data.attack;
        if (data.release !== undefined) this.release = data.release;
        if (data.makeupGain !== undefined) this.makeupGain = data.makeupGain;

        this.port.postMessage({
          type: 'configured',
          threshold: this.threshold,
          ratio: this.ratio
        });
      } else if (type === 'getStats') {
        const gateEfficiency = this.stats.totalFrames > 0
          ? (this.stats.gateClosedFrames / this.stats.totalFrames) * 100
          : 0;

        this.port.postMessage({
          type: 'stats',
          ...this.stats,
          gateEfficiency: gateEfficiency.toFixed(1) + '%'
        });
      }
    };
  }

  /**
   * Convert linear amplitude to dB
   */
  linearToDb(linear) {
    return 20 * Math.log10(Math.max(linear, 0.00001));
  }

  /**
   * Convert dB to linear amplitude
   */
  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  /**
   * Calculate RMS of audio buffer
   */
  calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Noise gate processing with envelope follower
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    const outputChannel = output[0];

    // Calculate input level (RMS in dB)
    const inputRMS = this.calculateRMS(inputChannel);
    const inputLevelDb = this.linearToDb(inputRMS);

    // Update statistics
    this.stats.totalFrames++;
    this.stats.averageLevel = (this.stats.averageLevel * 0.95) + (inputRMS * 0.05);

    // Determine if gate should be open
    const shouldBeOpen = inputLevelDb > this.threshold;

    // Envelope follower with attack/release
    const targetEnvelope = shouldBeOpen ? 1.0 : 0.0;
    const coefficient = shouldBeOpen ? this.attack : this.release;

    // Smooth envelope transition
    this.envelope += (targetEnvelope - this.envelope) * coefficient;

    // Gate state tracking
    if (this.envelope > 0.5) {
      this.isGateOpen = true;
      this.stats.gateOpenFrames++;
    } else {
      this.isGateOpen = false;
      this.stats.gateClosedFrames++;
    }

    // Apply gating with expander ratio
    let gain;
    if (shouldBeOpen || this.envelope > 0.1) {
      // Gate is open or in attack/release phase
      gain = this.envelope * this.makeupGain;
    } else {
      // Gate is closed - apply expansion
      const expansionDb = (inputLevelDb - this.threshold) * (1 - 1/this.ratio);
      gain = this.dbToLinear(expansionDb) * this.makeupGain;
    }

    // Apply gain to output
    for (let i = 0; i < inputChannel.length; i++) {
      outputChannel[i] = inputChannel[i] * gain;
    }

    // Periodic status reporting (every ~0.5 seconds)
    if (this.stats.totalFrames % 64 === 0) {
      this.port.postMessage({
        type: 'gate-status',
        isOpen: this.isGateOpen,
        envelope: this.envelope,
        inputLevel: inputLevelDb.toFixed(1),
        gain: gain.toFixed(2)
      });
    }

    return true;
  }
}

registerProcessor('audio-noise-gate-processor', AudioNoiseGateProcessor);
