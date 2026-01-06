/**
 * Bill Scanner Component
 * Supports multiple scanning modes:
 * - Document Scanner: AI-powered bill/invoice scanning (ML Kit on Android)
 * - Barcode Scanner: Scan packaged products (EAN, UPC, QR codes)
 * - File Upload: Upload images or PDFs
 * - WebView Camera: Fallback camera capture
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  isNativeDocumentScannerAvailable,
  scanDocumentNative,
  isMobileDevice,
} from '../../lib/nativeDocumentScanner';

interface BillScannerProps {
  onScanFile: (file: File) => Promise<void>;
  onScanCamera: (base64: string) => Promise<void>;
  onBarcodeScanned?: (barcode: string, format: string) => void;
  isProcessing: boolean;
  error?: string | null;
}

type ScanMode = 'upload' | 'camera' | 'barcode';

export function BillScanner({
  onScanFile,
  onScanCamera,
  onBarcodeScanned,
  isProcessing,
  error,
}: BillScannerProps) {
  const [mode, setMode] = useState<ScanMode>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [nativeScannerAvailable, setNativeScannerAvailable] = useState(false);
  const [barcodeScannerAvailable, setBarcodeScannerAvailable] = useState(false);
  const [scanningBarcode, setScanningBarcode] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for native scanner availability on mount
  useEffect(() => {
    setNativeScannerAvailable(isNativeDocumentScannerAvailable());

    // Check for Tauri barcode scanner plugin
    const checkBarcodeScanner = async () => {
      try {
        const barcodeScannerPlugin = await import('@tauri-apps/plugin-barcode-scanner');
        if (barcodeScannerPlugin && typeof barcodeScannerPlugin.scan === 'function') {
          setBarcodeScannerAvailable(true);
        }
      } catch {
        // Plugin not available
        setBarcodeScannerAvailable(false);
      }
    };

    if (isMobileDevice()) {
      checkBarcodeScanner();
    }
  }, []);

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

  // Start native document scanner (ML Kit)
  const startNativeDocumentScanner = async () => {
    const result = await scanDocumentNative();

    if (result.success && result.image) {
      await onScanCamera(result.image);
    } else if (result.cancelled) {
      // User cancelled, do nothing
    } else {
      alert(result.error || 'Failed to scan document');
    }
  };

  // Start barcode scanner
  const startBarcodeScanner = async () => {
    setScanningBarcode(true);
    setLastScannedBarcode(null);

    try {
      const { scan, Format } = await import('@tauri-apps/plugin-barcode-scanner');

      const result = await scan({
        formats: [
          Format.EAN13,
          Format.EAN8,
          Format.UPC_A,
          Format.UPC_E,
          Format.Code128,
          Format.Code39,
          Format.QRCode,
          Format.DataMatrix,
        ],
        windowed: false, // Full screen scanner
      });

      if (result?.content) {
        setLastScannedBarcode(result.content);
        onBarcodeScanned?.(result.content, result.format || 'unknown');
      }
    } catch (err) {
      console.error('Barcode scan error:', err);
      alert('Failed to scan barcode. Please try again.');
    } finally {
      setScanningBarcode(false);
    }
  };

  // Start WebView camera (fallback)
  const startCamera = async () => {
    // If native scanner is available on mobile, use it
    if (nativeScannerAvailable && isMobileDevice()) {
      await startNativeDocumentScanner();
      return;
    }

    // Otherwise use WebView camera
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

  const isMobile = isMobileDevice();
  const showBarcodeTab = barcodeScannerAvailable && onBarcodeScanned;

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
            'flex-1 py-3 rounded-lg font-bold transition-colors text-sm',
            mode === 'upload'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          )}
        >
          Upload
        </button>
        <button
          onClick={() => setMode('camera')}
          className={cn(
            'flex-1 py-3 rounded-lg font-bold transition-colors text-sm',
            mode === 'camera'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          )}
        >
          {nativeScannerAvailable ? 'Scan Doc' : 'Camera'}
        </button>
        {showBarcodeTab && (
          <button
            onClick={() => {
              setMode('barcode');
              stopCamera();
            }}
            className={cn(
              'flex-1 py-3 rounded-lg font-bold transition-colors text-sm',
              mode === 'barcode'
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            )}
          >
            Barcode
          </button>
        )}
      </div>

      {/* Native scanner badge */}
      {isMobile && nativeScannerAvailable && mode === 'camera' && (
        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded-lg">
          <span>✨</span>
          <span>Using ML Kit Document Scanner with auto-crop & edge detection</span>
        </div>
      )}

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

      {/* Camera/Document Scanner Mode */}
      {mode === 'camera' && (
        <div className="space-y-4">
          {!cameraActive && !capturedImage && (
            <button
              onClick={startCamera}
              disabled={isProcessing}
              className={cn(
                'w-full py-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex flex-col items-center gap-4 transition-colors',
                isProcessing && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isProcessing ? (
                <>
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-lg font-medium">Processing...</span>
                </>
              ) : (
                <>
                  <span className="text-6xl">{nativeScannerAvailable ? '📑' : '📷'}</span>
                  <span className="text-lg font-medium">
                    {nativeScannerAvailable ? 'Scan Document' : 'Start Camera'}
                  </span>
                  {nativeScannerAvailable && (
                    <span className="text-sm text-slate-400">
                      Auto-crop, edge detection, perspective correction
                    </span>
                  )}
                </>
              )}
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

      {/* Barcode Scanner Mode */}
      {mode === 'barcode' && (
        <div className="space-y-4">
          <button
            onClick={startBarcodeScanner}
            disabled={scanningBarcode}
            className={cn(
              'w-full py-12 bg-slate-700 hover:bg-slate-600 rounded-xl flex flex-col items-center gap-4 transition-colors',
              scanningBarcode && 'opacity-50 cursor-not-allowed'
            )}
          >
            {scanningBarcode ? (
              <>
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-lg font-medium">Scanning...</span>
              </>
            ) : (
              <>
                <span className="text-6xl">📦</span>
                <span className="text-lg font-medium">Scan Product Barcode</span>
                <span className="text-sm text-slate-400">
                  EAN-13, UPC, QR Code, Code-128
                </span>
              </>
            )}
          </button>

          {lastScannedBarcode && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <p className="text-sm text-green-400 mb-1">Last scanned:</p>
              <p className="font-mono text-lg text-green-300">{lastScannedBarcode}</p>
            </div>
          )}

          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="font-bold text-sm text-slate-400 mb-2">Barcode scanning tips:</h4>
            <ul className="text-sm text-slate-500 space-y-1">
              <li>- Hold the device steady</li>
              <li>- Ensure barcode is well-lit</li>
              <li>- Center barcode in the frame</li>
              <li>- Works with packaged products (EAN/UPC)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tips (for upload and camera modes) */}
      {mode !== 'barcode' && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <h4 className="font-bold text-sm text-slate-400 mb-2">Tips for best results:</h4>
          <ul className="text-sm text-slate-500 space-y-1">
            <li>- Ensure good lighting and clear focus</li>
            <li>- Capture the entire bill including totals</li>
            <li>- Avoid shadows and reflections</li>
            <li>- Hold camera steady when capturing</li>
          </ul>
        </div>
      )}
    </div>
  );
}
