/**
 * Native Document Scanner Service
 * Uses Google ML Kit Document Scanner on Android for high-quality bill/invoice scanning
 * Features: auto-crop, edge detection, perspective correction
 */

declare global {
  interface Window {
    NativeDocumentScanner?: {
      scanDocument: (callbackId: string) => void;
      isAvailable: () => boolean;
    };
    __documentScanCallbacks?: Record<string, (result: NativeScanResult) => void>;
  }
}

export interface NativeScanResult {
  success: boolean;
  image?: string;      // Base64 encoded JPEG
  pageCount?: number;
  pdfUri?: string;     // URI to PDF file on device
  error?: string;
  cancelled?: boolean;
}

/**
 * Check if native document scanner is available
 * Only available on Android with Google Play Services
 */
export function isNativeDocumentScannerAvailable(): boolean {
  try {
    return !!window.NativeDocumentScanner?.isAvailable();
  } catch {
    return false;
  }
}

/**
 * Scan a document using native ML Kit Document Scanner
 * Returns a promise with the scanned image as base64
 */
export function scanDocumentNative(): Promise<NativeScanResult> {
  return new Promise((resolve) => {
    if (!window.NativeDocumentScanner) {
      resolve({
        success: false,
        error: 'Native document scanner not available',
      });
      return;
    }

    // Generate unique callback ID
    const callbackId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Initialize callback registry if needed
    if (!window.__documentScanCallbacks) {
      window.__documentScanCallbacks = {};
    }

    // Register callback
    window.__documentScanCallbacks[callbackId] = (result: NativeScanResult) => {
      resolve(result);
    };

    // Set timeout to clean up if scanner doesn't respond
    setTimeout(() => {
      if (window.__documentScanCallbacks?.[callbackId]) {
        delete window.__documentScanCallbacks[callbackId];
        resolve({
          success: false,
          error: 'Document scanner timed out',
        });
      }
    }, 120000); // 2 minute timeout

    // Call native scanner
    try {
      window.NativeDocumentScanner.scanDocument(callbackId);
    } catch (e) {
      delete window.__documentScanCallbacks[callbackId];
      resolve({
        success: false,
        error: e instanceof Error ? e.message : 'Failed to start scanner',
      });
    }
  });
}

/**
 * Check if we're running on a mobile device (Android/iOS)
 */
export function isMobileDevice(): boolean {
  // Check Tauri mobile flag first
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tauriInternals = (window as any).__TAURI_INTERNALS__;
    if (tauriInternals?.isMobile) {
      return true;
    }
  }

  // Fallback to user agent check
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
}

/**
 * Get the best scanning method available
 */
export function getBestScanMethod(): 'native' | 'webview' | 'file' {
  if (isNativeDocumentScannerAvailable()) {
    return 'native';
  }

  // Check if getUserMedia is available (WebView camera)
  if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    return 'webview';
  }

  // Fallback to file upload
  return 'file';
}
