/**
 * AppShell Component
 * Full-screen container with bottom navigation
 */

import { ReactNode } from 'react';
import { BottomNav, NavItem } from './BottomNav';
import { cn } from '../../lib/utils';

export interface AppShellProps {
  /** Content to display */
  children: ReactNode;
  /** Navigation items */
  navItems: NavItem[];
  /** Currently active nav item ID */
  activeNavId: string;
  /** Callback when navigation item is clicked */
  onNavigate: (id: string, path: string) => void;
  /** Additional className for content area */
  className?: string;
  /** Hide navigation bar */
  hideNav?: boolean;
}

export function AppShell({
  children,
  navItems,
  activeNavId,
  onNavigate,
  className,
  hideNav = false,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content Area - Full Screen */}
      <main
        className={cn(
          'flex-1 overflow-auto',
          !hideNav && 'pb-20', // Add bottom padding for nav bar
          className
        )}
      >
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideNav && (
        <BottomNav
          items={navItems}
          activeId={activeNavId}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
