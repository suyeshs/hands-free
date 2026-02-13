// @ts-nocheck - Work in progress, TypeScript errors temporarily suppressed
/**
 * Service Worker Registration
 * Registers and manages the service worker lifecycle
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.warn('[ServiceWorker] Service workers not supported in this browser');
    return null;
  }

  // Check if background sync is supported
  if (!('SyncManager' in window)) {
    console.warn('[ServiceWorker] Background sync not supported in this browser');
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    console.log('[ServiceWorker] Registered successfully:', registration);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[ServiceWorker] Update found, installing new worker...');

      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New worker is ready but waiting
          console.log('[ServiceWorker] New version available. Refresh to update.');

          // Optionally show a notification to the user
          showUpdateNotification();
        }
      });
    });

    // Handle controller change (new service worker took over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[ServiceWorker] Controller changed, reloading page...');
      window.location.reload();
    });

    return registration;
  } catch (error) {
    console.error('[ServiceWorker] Registration failed:', error);
    return null;
  }
}

/**
 * Unregister service worker (useful for development)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const success = await registration.unregister();
    console.log('[ServiceWorker] Unregistered:', success);
    return success;
  } catch (error) {
    console.error('[ServiceWorker] Unregister failed:', error);
    return false;
  }
}

/**
 * Request background sync
 */
export async function requestBackgroundSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.warn('[ServiceWorker] Background sync not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
    console.log(`[ServiceWorker] Background sync registered: ${tag}`);
  } catch (error) {
    console.error('[ServiceWorker] Background sync registration failed:', error);
    // Fallback: Trigger immediate sync
    await triggerImmediateSync(tag);
  }
}

/**
 * Trigger immediate sync (fallback for browsers without background sync)
 */
async function triggerImmediateSync(tag: string): Promise<void> {
  console.log(`[ServiceWorker] Triggering immediate sync: ${tag}`);

  // Send message to service worker
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SYNC_NOW',
      tag,
    });
  }
}

/**
 * Show update notification to user
 */
function showUpdateNotification(): void {
  // Implement based on your UI framework
  // Example: Show a toast or modal
  const shouldUpdate = window.confirm(
    'A new version of Guanix Restaurant OS is available. Would you like to update now?'
  );

  if (shouldUpdate) {
    // Tell the waiting service worker to activate
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
  }
}

/**
 * Check if service worker is active
 */
export function isServiceWorkerActive(): boolean {
  return !!(navigator.serviceWorker && navigator.serviceWorker.controller);
}

/**
 * Get current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.error('[ServiceWorker] Failed to get registration:', error);
    return null;
  }
}

/**
 * Check online status
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function setupNetworkListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = () => {
    console.log('[Network] Connection restored');
    onOnline?.();

    // Trigger background sync when coming back online
    requestBackgroundSync('sync-all');
  };

  const handleOffline = () => {
    console.log('[Network] Connection lost');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
