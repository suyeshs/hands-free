/**
 * AppShell Component
 * Full-screen container with navigation options:
 * - Bottom nav bar (default, for Hub page)
 * - Floating nav blob (for inner pages) - self-contained with internal nav items
 */

import { ReactNode } from 'react';
import { BottomNav, NavItem } from './BottomNav';
import { FloatingNavBlob } from './FloatingNavBlob';
import { cn } from '../../lib/utils';

export interface AppShellProps {
  /** Content to display */
  children: ReactNode;
  /** Navigation items (only used for BottomNav) */
  navItems?: NavItem[];
  /** Currently active nav item ID (only used for BottomNav) */
  activeNavId?: string;
  /** Callback when navigation item is clicked (only used for BottomNav) */
  onNavigate?: (id: string, path: string) => void;
  /** Additional className for content area */
  className?: string;
  /** Hide navigation completely */
  hideNav?: boolean;
  /** Use floating nav blob instead of bottom bar */
  floatingNav?: boolean;
}

export function AppShell({
  children,
  navItems = [],
  activeNavId = '',
  onNavigate,
  className,
  hideNav = false,
  floatingNav = false,
}: AppShellProps) {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Main Content Area - Full Screen */}
      <main
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden',
          // Only add bottom padding for bottom nav bar
          !hideNav && !floatingNav && 'pb-20',
          className
        )}
      >
        {children}
      </main>

      {/* Navigation */}
      {!hideNav && (
        floatingNav ? (
          // FloatingNavBlob is self-contained with internal nav items and routing
          <FloatingNavBlob />
        ) : (
          <BottomNav
            items={navItems}
            activeId={activeNavId}
            onNavigate={onNavigate || (() => {})}
          />
        )
      )}
    </div>
  );
}
