/**
 * AppLayout Component
 * Main layout wrapper with floating dock and mini-cart
 */

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { FloatingDock } from '../navigation/FloatingDock';
import { FloatingMiniCart } from '../cart/FloatingMiniCart';
import { cn } from '../../lib/utils';

export interface AppLayoutProps {
  children: ReactNode;
  /** Hide the floating dock */
  hideDock?: boolean;
  /** Hide the mini cart (auto-hidden on /pos) */
  hideCart?: boolean;
  /** Additional className for the main content area */
  className?: string;
}

// Routes where the dock should be hidden
const HIDE_DOCK_ROUTES = ['/login', '/guest-order'];

// Routes where the mini-cart should be hidden (they have their own cart UI)
const HIDE_CART_ROUTES = ['/pos', '/checkout'];

export function AppLayout({
  children,
  hideDock = false,
  hideCart = false,
  className,
}: AppLayoutProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  // Determine visibility based on route
  const shouldShowDock = !hideDock && !HIDE_DOCK_ROUTES.some((route) =>
    currentPath.startsWith(route)
  );

  const shouldShowCart = !hideCart && !HIDE_CART_ROUTES.some((route) =>
    currentPath.startsWith(route)
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content - scrollable with bottom padding for dock */}
      <main
        className={cn(
          'flex-1 overflow-auto',
          shouldShowDock && 'pb-24', // Space for the floating dock (~80px + safe area)
          className
        )}
      >
        {children}
      </main>

      {/* Floating Navigation Dock */}
      <FloatingDock visible={shouldShowDock} />

      {/* Floating Mini Cart */}
      {shouldShowCart && <FloatingMiniCart />}
    </div>
  );
}
