/**
 * Vision AI Plugin - Edge AI Processing
 * Runs AI models locally in browser using TensorFlow.js
 * Models: COCO-SSD for object detection, MobileNet for classification
 */

import type { Detection, InferenceResult } from './cameraService';

// TensorFlow.js will be loaded dynamically
declare const tf: any;
declare const cocoSsd: any;

export interface EdgeAIModel {
  name: string;
  loaded: boolean;
  model: any;
}

export class EdgeAIProcessor {
  private cocoSsdModel: any = null;
  private isInitialized = false;
  private isLoading = false;

  /**
   * Initialize and load AI models
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      // Load TensorFlow.js and COCO-SSD model
      await this.loadTensorFlow();
      await this.loadCocoSSD();

      this.isInitialized = true;
      console.log('Edge AI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Edge AI:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load TensorFlow.js from CDN
   */
  private async loadTensorFlow(): Promise<void> {
    // Check if already loaded
    if (typeof (window as any).tf !== 'undefined') {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js';
      script.onload = () => {
        console.log('TensorFlow.js loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load TensorFlow.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Load COCO-SSD object detection model
   */
  private async loadCocoSSD(): Promise<void> {
    // Check if already loaded
    if (typeof (window as any).cocoSsd !== 'undefined') {
      this.cocoSsdModel = await (window as any).cocoSsd.load();
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
      script.onload = async () => {
        console.log('COCO-SSD script loaded, initializing model...');
        try {
          this.cocoSsdModel = await (window as any).cocoSsd.load();
          console.log('COCO-SSD model loaded');
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = () => reject(new Error('Failed to load COCO-SSD'));
      document.head.appendChild(script);
    });
  }

  /**
   * Run object detection on video frame
   */
  async detectObjects(
    imageSource: HTMLVideoElement | HTMLImageElement | ImageData,
    cameraId: string
  ): Promise<InferenceResult> {
    if (!this.isInitialized || !this.cocoSsdModel) {
      throw new Error('Edge AI not initialized');
    }

    const startTime = performance.now();

    try {
      // Run inference
      const predictions = await this.cocoSsdModel.detect(imageSource);

      const inferenceTime = performance.now() - startTime;

      // Convert predictions to Detection format
      const detections: Detection[] = predictions.map((pred: any, index: number) => ({
        id: index,
        classId: this.getClassId(pred.class),
        className: pred.class,
        confidence: pred.score,
        bbox: {
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3],
        },
      }));

      // Count people
      const peopleCount = detections.filter(
        d => d.className === 'person'
      ).length;

      return {
        cameraId,
        timestamp: Date.now(),
        detections,
        peopleCount,
        processingSource: 'edge',
        inferenceTimeMs: Math.round(inferenceTime),
      };
    } catch (error) {
      console.error('Detection failed:', error);
      throw error;
    }
  }

  /**
   * Run people counting (optimized for speed)
   */
  async countPeople(
    imageSource: HTMLVideoElement | HTMLImageElement,
    cameraId: string
  ): Promise<InferenceResult> {
    const result = await this.detectObjects(imageSource, cameraId);

    // Filter only person detections with high confidence
    const personDetections = result.detections.filter(
      d => d.className === 'person' && d.confidence > 0.5
    );

    return {
      ...result,
      detections: personDetections,
      peopleCount: personDetections.length,
    };
  }

  /**
   * Detect table occupancy
   * Analyzes if people are near table areas
   */
  async detectTableOccupancy(
    imageSource: HTMLVideoElement | HTMLImageElement,
    cameraId: string,
    tableZones: Array<{ id: string; bbox: { x: number; y: number; width: number; height: number } }>
  ): Promise<Map<string, { peopleCount: number; occupied: boolean }>> {
    const result = await this.countPeople(imageSource, cameraId);

    const occupancy = new Map<string, { peopleCount: number; occupied: boolean }>();

    for (const zone of tableZones) {
      let peopleInZone = 0;

      for (const detection of result.detections) {
        if (this.isInZone(detection.bbox, zone.bbox)) {
          peopleInZone++;
        }
      }

      occupancy.set(zone.id, {
        peopleCount: peopleInZone,
        occupied: peopleInZone > 0,
      });
    }

    return occupancy;
  }

  /**
   * Detect motion by comparing frames
   */
  detectMotion(
    currentFrame: ImageData,
    previousFrame: ImageData,
    threshold = 30
  ): { hasMotion: boolean; motionLevel: number } {
    if (
      !previousFrame ||
      currentFrame.width !== previousFrame.width ||
      currentFrame.height !== previousFrame.height
    ) {
      return { hasMotion: false, motionLevel: 0 };
    }

    let diffSum = 0;
    const totalPixels = currentFrame.data.length / 4;

    // Compare pixel differences
    for (let i = 0; i < currentFrame.data.length; i += 4) {
      const rDiff = Math.abs(currentFrame.data[i] - previousFrame.data[i]);
      const gDiff = Math.abs(currentFrame.data[i + 1] - previousFrame.data[i + 1]);
      const bDiff = Math.abs(currentFrame.data[i + 2] - previousFrame.data[i + 2]);

      const avgDiff = (rDiff + gDiff + bDiff) / 3;
      if (avgDiff > threshold) {
        diffSum++;
      }
    }

    const motionLevel = (diffSum / totalPixels) * 100;
    const hasMotion = motionLevel > 1; // More than 1% of pixels changed

    return { hasMotion, motionLevel };
  }

  /**
   * Check if detection bbox is within a zone
   */
  private isInZone(
    detectionBbox: { x: number; y: number; width: number; height: number },
    zoneBbox: { x: number; y: number; width: number; height: number }
  ): boolean {
    const detectionCenterX = detectionBbox.x + detectionBbox.width / 2;
    const detectionCenterY = detectionBbox.y + detectionBbox.height / 2;

    return (
      detectionCenterX >= zoneBbox.x &&
      detectionCenterX <= zoneBbox.x + zoneBbox.width &&
      detectionCenterY >= zoneBbox.y &&
      detectionCenterY <= zoneBbox.y + zoneBbox.height
    );
  }

  /**
   * Map class name to ID
   */
  private getClassId(className: string): number {
    // COCO class IDs (person = 1, etc.)
    const classMap: Record<string, number> = {
      person: 1,
      bicycle: 2,
      car: 3,
      motorcycle: 4,
      airplane: 5,
      bus: 6,
      train: 7,
      truck: 8,
      boat: 9,
      // ... add more as needed
    };

    return classMap[className] || 0;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.cocoSsdModel) {
      this.cocoSsdModel.dispose();
      this.cocoSsdModel = null;
    }
    this.isInitialized = false;
  }

  /**
   * Check if ready to process
   */
  isReady(): boolean {
    return this.isInitialized && this.cocoSsdModel !== null;
  }
}

// Singleton instance
let edgeAIInstance: EdgeAIProcessor | null = null;

/**
 * Get or create Edge AI processor instance
 */
export function getEdgeAIProcessor(): EdgeAIProcessor {
  if (!edgeAIInstance) {
    edgeAIInstance = new EdgeAIProcessor();
  }
  return edgeAIInstance;
}
