/**
 * ContextualAppShell Component
 * Main wrapper with minimal header and contextual action footer
 */

import { ReactNode, useState } from 'react';
import { cn } from '../../lib/utils';
import { ContextualHeader } from './ContextualHeader';
import { ContextualFooter, ContextualAction } from './ContextualFooter';
import { NavigationDrawer, NavItem } from './NavigationDrawer';
import { ContentToolbar } from './ContentToolbar';

export interface ContextualAppShellProps {
  /** Screen title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Footer action buttons */
  actions: ContextualAction[];
  /** Navigation items for drawer */
  navItems: NavItem[];
  /** Currently active nav item ID */
  activeNavId: string;
  /** Callback when navigation item is clicked */
  onNavigate: (id: string, path: string) => void;
  /** Connection status for toolbar */
  isConnected?: boolean;
  /** Custom status indicators for toolbar */
  statusIndicators?: ReactNode;
  /** Settings click handler */
  onSettingsClick?: () => void;
  /** Logout click handler */
  onLogoutClick?: () => void;
  /** Main content */
  children: ReactNode;
  /** Additional className for content area */
  className?: string;
  /** Hide the header */
  hideHeader?: boolean;
  /** Hide the footer */
  hideFooter?: boolean;
}

export function ContextualAppShell({
  title,
  subtitle,
  actions,
  navItems,
  activeNavId,
  onNavigate,
  isConnected,
  statusIndicators,
  onSettingsClick,
  onLogoutClick,
  children,
  className,
  hideHeader = false,
  hideFooter = false,
}: ContextualAppShellProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      {!hideHeader && (
        <ContextualHeader title={title} subtitle={subtitle} />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          'flex-1 overflow-auto',
          !hideFooter && 'pb-20', // Padding for footer
          className
        )}
      >
        {/* Content Toolbar - positioned at top of content */}
        {(isConnected !== undefined || statusIndicators || onSettingsClick || onLogoutClick) && (
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-2">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex-1" />
              <ContentToolbar
                isConnected={isConnected}
                statusIndicators={statusIndicators}
                showSettings={!!onSettingsClick}
                onSettingsClick={onSettingsClick}
                showLogout={!!onLogoutClick}
                onLogoutClick={onLogoutClick}
              />
            </div>
          </div>
        )}

        {children}
      </main>

      {/* Footer */}
      {!hideFooter && (
        <ContextualFooter
          actions={actions}
          onMenuClick={() => setIsNavOpen(true)}
        />
      )}

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        navItems={navItems}
        activeId={activeNavId}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// Re-export types for convenience
export type { ContextualAction } from './ContextualFooter';
export type { NavItem } from './NavigationDrawer';
