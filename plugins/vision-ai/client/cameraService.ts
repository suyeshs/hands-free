/**
 * Vision AI Plugin - Camera Service
 * Multi-camera abstraction layer supporting:
 * - Webcams (getUserMedia)
 * - IP/RTSP Cameras
 * - reCamera with edge AI
 * - Airtel Xsafe (via ONVIF or manual RTSP)
 * - Generic ONVIF cameras
 */

export type CameraType = 'webcam' | 'ip_camera' | 'recamera' | 'airtel_xsafe' | 'onvif';
export type CameraLocation = 'dining' | 'kitchen' | 'entrance' | 'bar' | 'parking' | 'storage' | 'custom';
export type ProcessingMode = 'edge' | 'cloud' | 'hybrid';

export interface ConnectionConfig {
  // Webcam
  deviceId?: string;

  // IP/RTSP Camera
  rtspUrl?: string;
  httpUrl?: string;
  ipAddress?: string;
  port?: number;
  username?: string;
  password?: string;

  // reCamera specific
  reCameraEdgeAI?: boolean;
  reCameraWsPort?: number;

  // Airtel Xsafe / ONVIF
  onvifProfile?: string;
  onvifServiceUrl?: string;
}

export interface CameraFeatures {
  peopleCounting: boolean;
  tableOccupancy: boolean;
  motionDetection: boolean;
  faceDetection: boolean;
  safetyMonitoring: boolean;
  cloudAnalysis: boolean;
  cloudInterval: number; // seconds
}

export interface CameraConfig {
  id: string;
  tenantId: string;
  name: string;
  type: CameraType;
  location: CameraLocation;
  enabled: boolean;
  connection: ConnectionConfig;
  features: CameraFeatures;
  processingMode: ProcessingMode;
}

export interface Detection {
  id: number;
  classId: number;
  className: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  trackingId?: number;
}

export interface InferenceResult {
  cameraId: string;
  timestamp: number;
  detections: Detection[];
  peopleCount: number;
  processingSource: 'edge' | 'cloud_gemini' | 'cloud_worker_ai';
  inferenceTimeMs: number;
}

/**
 * Detect available webcams
 */
export async function detectWebcams(): Promise<Array<{ deviceId: string; label: string }>> {
  try {
    // Request permission first
    await navigator.mediaDevices.getUserMedia({ video: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    return videoDevices.map(device => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${device.deviceId.substring(0, 8)}`,
    }));
  } catch (error) {
    console.error('Failed to detect webcams:', error);
    return [];
  }
}

/**
 * Abstract Camera Stream Handler
 */
export abstract class CameraStream {
  protected config: CameraConfig;
  protected isActive = false;
  protected videoElement: HTMLVideoElement | null = null;
  protected onFrameCallback?: (imageData: ImageData) => void;
  protected onErrorCallback?: (error: Error) => void;

  constructor(config: CameraConfig) {
    this.config = config;
  }

  abstract start(): Promise<void>;
  abstract stop(): void;
  abstract captureSnapshot(): Promise<Blob>;

  onFrame(callback: (imageData: ImageData) => void): void {
    this.onFrameCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  isStreaming(): boolean {
    return this.isActive;
  }

  protected extractFrameData(video: HTMLVideoElement): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Webcam Stream Handler
 */
export class WebcamStream extends CameraStream {
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  async start(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: this.config.connection.deviceId
            ? { exact: this.config.connection.deviceId }
            : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 },
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;

      await this.videoElement.play();
      this.isActive = true;

      // Start frame processing loop
      this.processFrames();
    } catch (error) {
      this.onErrorCallback?.(error as Error);
      throw error;
    }
  }

  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.isActive = false;
  }

  async captureSnapshot(): Promise<Blob> {
    if (!this.videoElement) {
      throw new Error('Video stream not active');
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(this.videoElement, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to capture snapshot'));
      }, 'image/jpeg', 0.9);
    });
  }

  private processFrames(): void {
    if (!this.isActive || !this.videoElement) return;

    if (this.onFrameCallback && this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
      const imageData = this.extractFrameData(this.videoElement);
      this.onFrameCallback(imageData);
    }

    this.animationFrameId = requestAnimationFrame(() => this.processFrames());
  }
}

/**
 * RTSP/IP Camera Stream Handler
 * Uses HTML5 video element with converted stream (via server proxy or WebRTC)
 */
export class RTSPCameraStream extends CameraStream {
  private ws: WebSocket | null = null;

  async start(): Promise<void> {
    // For RTSP cameras, we need a proxy server to convert RTSP to WebRTC/HLS
    // This would typically be handled by your backend or a service like go2rtc

    const proxyUrl = this.getProxyUrl();

    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;

    // Connect via WebSocket or set HLS source
    if (proxyUrl.startsWith('ws://') || proxyUrl.startsWith('wss://')) {
      await this.connectWebSocket(proxyUrl);
    } else {
      this.videoElement.src = proxyUrl;
    }

    await this.videoElement.play();
    this.isActive = true;
  }

  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.src = '';
      this.videoElement = null;
    }

    this.isActive = false;
  }

  async captureSnapshot(): Promise<Blob> {
    if (!this.videoElement) {
      throw new Error('Video stream not active');
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(this.videoElement, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to capture snapshot'));
      }, 'image/jpeg', 0.9);
    });
  }

  private getProxyUrl(): string {
    // This would be your backend proxy that converts RTSP to browser-compatible format
    const { rtspUrl, httpUrl } = this.config.connection;

    if (httpUrl) return httpUrl;
    if (rtspUrl) {
      // Convert to proxy URL
      return `/api/vision/stream/${this.config.id}`;
    }

    throw new Error('No valid stream URL configured');
  }

  private async connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (error) => {
        this.onErrorCallback?.(new Error('WebSocket connection failed'));
        reject(error);
      };

      // Handle incoming stream data
      this.ws.onmessage = (event) => {
        // Process incoming video frames
      };
    });
  }
}

/**
 * reCamera Stream Handler with Edge AI
 */
export class ReCameraStream extends RTSPCameraStream {
  private edgeAIWebSocket: WebSocket | null = null;

  async start(): Promise<void> {
    // Start RTSP stream
    await super.start();

    // If edge AI is enabled, connect to reCamera's AI WebSocket
    if (this.config.connection.reCameraEdgeAI) {
      await this.connectEdgeAI();
    }
  }

  stop(): void {
    if (this.edgeAIWebSocket) {
      this.edgeAIWebSocket.close();
      this.edgeAIWebSocket = null;
    }

    super.stop();
  }

  private async connectEdgeAI(): Promise<void> {
    const { ipAddress, reCameraWsPort } = this.config.connection;
    const wsUrl = `ws://${ipAddress}:${reCameraWsPort || 80}/ai-stream`;

    return new Promise((resolve, reject) => {
      this.edgeAIWebSocket = new WebSocket(wsUrl);

      this.edgeAIWebSocket.onopen = () => {
        // Send configuration
        this.edgeAIWebSocket?.send(JSON.stringify({
          type: 'config',
          cameraId: this.config.id,
        }));
        resolve();
      };

      this.edgeAIWebSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEdgeAIResult(data);
        } catch (error) {
          console.error('Failed to parse edge AI data:', error);
        }
      };

      this.edgeAIWebSocket.onerror = (error) => {
        console.error('Edge AI WebSocket error:', error);
        reject(error);
      };
    });
  }

  private handleEdgeAIResult(data: any): void {
    // Process edge AI inference results from reCamera
    const result: InferenceResult = {
      cameraId: this.config.id,
      timestamp: Date.now(),
      detections: data.boxes?.map((box: any, index: number) => ({
        id: index,
        classId: box.class_id || 0,
        className: box.class_name || 'person',
        confidence: box.confidence || 0,
        bbox: {
          x: box.x || 0,
          y: box.y || 0,
          width: box.w || 0,
          height: box.h || 0,
        },
        trackingId: box.tracking_id,
      })) || [],
      peopleCount: data.boxes?.length || 0,
      processingSource: 'edge',
      inferenceTimeMs: data.inference_time || 0,
    };

    // Emit result to plugin system
    console.log('Edge AI Result:', result);
  }
}

/**
 * Camera Factory
 */
export function createCameraStream(config: CameraConfig): CameraStream {
  switch (config.type) {
    case 'webcam':
      return new WebcamStream(config);

    case 'recamera':
      return new ReCameraStream(config);

    case 'ip_camera':
    case 'airtel_xsafe':
    case 'onvif':
      return new RTSPCameraStream(config);

    default:
      throw new Error(`Unsupported camera type: ${config.type}`);
  }
}
