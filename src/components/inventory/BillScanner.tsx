/**
 * Bill Scanner Component
 * Supports camera capture and file upload for AI-powered bill scanning
 */

import { useState, useRef, useCallback } from 'react';
import { cn } from '../../lib/utils';

interface BillScannerProps {
  onScanFile: (file: File) => Promise<void>;
  onScanCamera: (base64: string) => Promise<void>;
  isProcessing: boolean;
  error?: string | null;
}

export function BillScanner({ onScanFile, onScanCamera, isProcessing, error }: BillScannerProps) {
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Please select an image or PDF file');
      return;
    }

    await onScanFile(file);
  };

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        await handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    [onScanFile]
  );

  // Handle file input change
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileSelect(e.target.files[0]);
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Failed to access camera:', err);
      alert('Failed to access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCapturedImage(null);
  };

  // Capture photo
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
      }
    }
  };

  // Confirm captured photo
  const confirmCapture = async () => {
    if (capturedImage) {
      // Extract base64 data (remove data:image/jpeg;base64, prefix)
      const base64Data = capturedImage.split(',')[1];
      await onScanCamera(base64Data);
      stopCamera();
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
  };

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setMode('upload');
            stopCamera();
          }}
          className={cn(
            'flex-1 py-3 rounded-lg font-bold transition-colors',
            mode === 'upload'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          )}
        >
          Upload File
        </button>
        <button
          onClick={() => setMode('camera')}
          className={cn(
            'flex-1 py-3 rounded-lg font-bold transition-colors',
            mode === 'camera'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          )}
        >
          Camera
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-600 hover:border-slate-500',
            isProcessing && 'opacity-50 pointer-events-none'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {isProcessing ? (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-300">Processing bill...</p>
              <p className="text-sm text-slate-500">AI is extracting items from your document</p>
            </div>
          ) : (
            <>
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg font-medium text-slate-300 mb-2">
                Drag & drop your bill here
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Supports images (JPG, PNG) and PDF files
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
              >
                Browse Files
              </button>
            </>
          )}
        </div>
      )}

      {/* Camera Mode */}
      {mode === 'camera' && (
        <div className="space-y-4">
          {!cameraActive && !capturedImage && (
            <button
              onClick={startCamera}
              className="w-full py-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex flex-col items-center gap-4 transition-colors"
            >
              <span className="text-6xl">📷</span>
              <span className="text-lg font-medium">Start Camera</span>
            </button>
          )}

          {cameraActive && !capturedImage && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Camera overlay guide */}
                <div className="absolute inset-4 border-2 border-white/30 rounded-lg pointer-events-none" />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={stopCamera}
                  className="flex-1 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition-colors"
                >
                  Capture
                </button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                <img
                  src={capturedImage}
                  alt="Captured bill"
                  className="w-full h-full object-cover"
                />
              </div>

              {isProcessing ? (
                <div className="py-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-300">Processing captured image...</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={retakePhoto}
                    className="flex-1 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold transition-colors"
                  >
                    Retake
                  </button>
                  <button
                    onClick={confirmCapture}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors"
                  >
                    Use Photo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Tips */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <h4 className="font-bold text-sm text-slate-400 mb-2">Tips for best results:</h4>
        <ul className="text-sm text-slate-500 space-y-1">
          <li>- Ensure good lighting and clear focus</li>
          <li>- Capture the entire bill including totals</li>
          <li>- Avoid shadows and reflections</li>
          <li>- Hold camera steady when capturing</li>
        </ul>
      </div>
    </div>
  );
}
