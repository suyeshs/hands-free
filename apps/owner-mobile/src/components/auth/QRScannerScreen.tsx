import { useState, useRef, useEffect } from 'react';
import QrScanner from 'qr-scanner';
import { Loader2, QrCode, AlertCircle } from 'lucide-react';

interface QRScannerScreenProps {
  onScanned: (qrData: string) => void;
}

export function QRScannerScreen({ onScanned }: QRScannerScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [_scanner, setScanner] = useState<QrScanner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');

  useEffect(() => {
    let qrScanner: QrScanner | null = null;

    const initScanner = async () => {
      if (!videoRef.current) return;

      try {
        // Check camera permission
        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          setError('No camera found on this device');
          setLoading(false);
          return;
        }

        // Create QR scanner
        qrScanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (result.data.startsWith('handsfree://register?token=')) {
              onScanned(result.data);
              qrScanner?.stop();
            } else {
              setError('Invalid QR code. Please scan a Handsfree registration QR code.');
              setTimeout(() => setError(''), 3000);
            }
          },
          {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
          }
        );

        // Start scanner
        await qrScanner.start();
        setCameraPermission('granted');
        setScanner(qrScanner);
        setLoading(false);
      } catch (err: any) {
        console.error('Scanner error:', err);

        if (err.name === 'NotAllowedError') {
          setCameraPermission('denied');
          setError('Camera permission denied. Please enable camera access in settings.');
        } else {
          setError('Failed to start camera: ' + err.message);
        }

        setLoading(false);
      }
    };

    initScanner();

    return () => {
      qrScanner?.stop();
      qrScanner?.destroy();
    };
  }, [onScanned]);

  const requestCameraPermission = async () => {
    setLoading(true);
    setError('');
    setCameraPermission('pending');

    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      window.location.reload(); // Reload to reinitialize scanner
    } catch (err) {
      setError('Camera permission denied');
      setCameraPermission('denied');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <QrCode size={64} className="mx-auto mb-4 text-orange-600" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Scan QR Code
          </h1>
          <p className="text-gray-600">
            Scan the QR code from your desktop app to register this device
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
              <p className="text-gray-600">Starting camera...</p>
            </div>
          )}

          {cameraPermission === 'denied' && (
            <div className="flex flex-col items-center justify-center h-64">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <p className="text-center text-gray-700 mb-4">
                Camera access is required to scan QR codes
              </p>
              <button
                onClick={requestCameraPermission}
                className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600"
              >
                Grant Camera Access
              </button>
            </div>
          )}

          {cameraPermission === 'granted' && (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-lg"
                style={{ transform: 'scaleX(-1)' }} // Mirror for better UX
              />

              <div className="absolute inset-0 border-4 border-orange-500 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500"></div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="mb-2">How to scan:</p>
          <ol className="text-left space-y-1 max-w-sm mx-auto">
            <li>1. Open the desktop app settings</li>
            <li>2. Go to "Devices" → "Add Device"</li>
            <li>3. Point your camera at the QR code</li>
            <li>4. Device will register automatically</li>
          </ol>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Don't have access to the desktop app?{' '}
            <a href="#" className="text-orange-600 hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
