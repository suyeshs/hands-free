/**
 * AppLayout Component
 * Main layout wrapper with navigation:
 * - All pages: Floating nav blob (hamburger menu) in top-right
 * - No bottom dock navigation
 */

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { FloatingMiniCart } from '../cart/FloatingMiniCart';
import { FloatingNavBlob } from './FloatingNavBlob';
import { cn } from '../../lib/utils';
import { useIsDeviceLocked } from '../LockedModeGuard';

export interface AppLayoutProps {
  children: ReactNode;
  /** Hide navigation completely */
  hideNav?: boolean;
  /** Hide the mini cart (auto-hidden on /pos) */
  hideCart?: boolean;
  /** Additional className for the main content area */
  className?: string;
}

// Routes where navigation should be completely hidden
const HIDE_NAV_ROUTES = ['/login', '/guest-order'];

// Routes where the mini-cart should be hidden (they have their own cart UI)
const HIDE_CART_ROUTES = ['/pos', '/checkout'];

export function AppLayout({
  children,
  hideNav = false,
  hideCart = false,
  className,
}: AppLayoutProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const isDeviceLocked = useIsDeviceLocked();

  // Check if nav should be hidden
  const shouldHideNav = isDeviceLocked || hideNav || HIDE_NAV_ROUTES.some((route) =>
    currentPath.startsWith(route)
  );

  const shouldShowCart = !isDeviceLocked && !hideCart && !HIDE_CART_ROUTES.some((route) =>
    currentPath.startsWith(route)
  );

  return (
    <div className="h-full min-h-screen bg-background flex flex-col">
      {/* Main Content - scrollable */}
      <main
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden',
          className
        )}
      >
        {children}
      </main>

      {/* Floating Nav Blob (hamburger menu) - top right on all pages */}
      {!shouldHideNav && <FloatingNavBlob />}

      {/* Floating Mini Cart */}
      {shouldShowCart && <FloatingMiniCart />}
    </div>
  );
}
