/**
 * Locked Mode Guard Component
 *
 * When a device is locked to a specific mode, this component:
 * 1. Redirects to the locked mode's route on startup
 * 2. Prevents navigation to other routes
 * 3. Provides 7-tap admin access to unlock the device
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDeviceStore, DeviceMode } from '../stores/deviceStore';

const ADMIN_PASSWORD = '6163';
const REQUIRED_CLICKS = 7;
const CLICK_TIMEOUT = 3000; // Reset counter after 3 seconds of no clicks

// Map device modes to their locked routes
const MODE_ROUTES: Record<DeviceMode, string> = {
  generic: '/hub',
  pos: '/pos',
  kds: '/kitchen',
  bds: '/service', // Bump Display System -> Service Dashboard
  aggregator: '/aggregator',
  customer: '/table/kiosk', // Self-service kiosk uses guest ordering
  manager: '/hub', // Manager mode gets full access
};

// Routes that should always be accessible (public routes)
const PUBLIC_ROUTES = [
  '/table/',
  '/track/',
  '/login',
];

interface LockedModeGuardProps {
  children: React.ReactNode;
}

export function LockedModeGuard({ children }: LockedModeGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { deviceMode, isLocked, setLocked } = useDeviceStore();

  // 7-tap admin access state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle hidden button clicks for 7-tap access
  const handleHiddenClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickCountRef.current += 1;
    console.log(`[LockedModeGuard] Tap ${clickCountRef.current}/${REQUIRED_CLICKS}`);

    if (clickCountRef.current >= REQUIRED_CLICKS) {
      clickCountRef.current = 0;
      setShowPasswordModal(true);
    }

    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, CLICK_TIMEOUT);
  };

  // Handle password submission
  const handlePasswordSubmit = () => {
    if (password === ADMIN_PASSWORD) {
      console.log('[LockedModeGuard] Admin access granted, unlocking device');
      setLocked(false);
      setShowPasswordModal(false);
      setPassword('');
      setPasswordError(false);
      // Navigate to hub after unlocking
      navigate('/hub', { replace: true });
    } else {
      setPasswordError(true);
      setPassword('');
    }
  };

  // Handle password modal close
  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPassword('');
    setPasswordError(false);
  };

  // Check if current route is a public route
  const isPublicRoute = (pathname: string) => {
    return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  };

  // Redirect to locked mode route on startup and when navigating away
  useEffect(() => {
    if (!isLocked || deviceMode === 'generic' || deviceMode === 'manager') {
      // Not locked or generic/manager mode - allow normal navigation
      return;
    }

    const targetRoute = MODE_ROUTES[deviceMode];
    const currentPath = location.pathname;

    // Allow public routes
    if (isPublicRoute(currentPath)) {
      return;
    }

    // If not on the locked route, redirect
    if (currentPath !== targetRoute) {
      console.log(`[LockedModeGuard] Device locked to ${deviceMode}, redirecting from ${currentPath} to ${targetRoute}`);
      navigate(targetRoute, { replace: true });
    }
  }, [isLocked, deviceMode, location.pathname, navigate]);

  // If device is locked, show the admin access overlay
  if (isLocked && deviceMode !== 'generic' && deviceMode !== 'manager') {
    return (
      <>
        {children}

        {/* Hidden 7-tap target area in top-right corner */}
        <div
          onClick={handleHiddenClick}
          className="fixed top-0 right-0 w-16 h-16 z-[9998] cursor-default"
          aria-hidden="true"
        />

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 w-80 shadow-2xl">
              <h3 className="text-lg font-bold mb-2 text-center">Admin Access</h3>
              <p className="text-sm text-gray-500 mb-4 text-center">
                Enter PIN to unlock device settings
              </p>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Enter PIN"
                className={`w-full p-3 border-2 rounded-lg text-center text-2xl tracking-widest mb-4 ${
                  passwordError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                autoFocus
                maxLength={6}
              />
              {passwordError && (
                <p className="text-red-500 text-sm text-center mb-4">Incorrect PIN</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handlePasswordCancel}
                  className="flex-1 py-2 px-4 border-2 border-gray-300 rounded-lg font-bold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Locked mode indicator - subtle bottom-left badge */}
        <div className="fixed bottom-2 left-2 z-[9997] opacity-30 hover:opacity-100 transition-opacity">
          <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            {deviceMode.toUpperCase()} MODE
          </div>
        </div>
      </>
    );
  }

  // Not locked - render children normally
  return <>{children}</>;
}

/**
 * Hook to check if the device is in locked mode
 */
export function useIsDeviceLocked(): boolean {
  const { deviceMode, isLocked } = useDeviceStore();
  return isLocked && deviceMode !== 'generic' && deviceMode !== 'manager';
}

/**
 * Get the locked mode route for the current device
 */
export function getLockedModeRoute(): string | null {
  const { deviceMode, isLocked } = useDeviceStore.getState();
  if (!isLocked || deviceMode === 'generic' || deviceMode === 'manager') {
    return null;
  }
  return MODE_ROUTES[deviceMode];
}
