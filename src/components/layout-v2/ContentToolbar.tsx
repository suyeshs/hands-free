/**
 * ContentToolbar Component
 * Status indicators and settings/logout in content area top-right
 */

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { StatusPill } from '../ui-v2/StatusPill';

export interface ContentToolbarProps {
  /** Connection status */
  isConnected?: boolean;
  /** Custom status indicators */
  statusIndicators?: ReactNode;
  /** Show settings button */
  showSettings?: boolean;
  /** Settings click handler */
  onSettingsClick?: () => void;
  /** Show logout button */
  showLogout?: boolean;
  /** Logout click handler */
  onLogoutClick?: () => void;
  /** Additional className */
  className?: string;
}

export function ContentToolbar({
  isConnected,
  statusIndicators,
  showSettings = true,
  onSettingsClick,
  showLogout = true,
  onLogoutClick,
  className,
}: ContentToolbarProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Custom status indicators */}
      {statusIndicators}

      {/* Connection status */}
      {isConnected !== undefined && (
        <StatusPill status={isConnected ? 'success' : 'error'}>
          {isConnected ? 'Live' : 'Disconnected'}
        </StatusPill>
      )}

      {/* Settings button */}
      {showSettings && onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="h-9 px-3 rounded-lg bg-muted hover:bg-muted/80 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="hidden sm:inline">Settings</span>
        </button>
      )}

      {/* Logout button */}
      {showLogout && onLogoutClick && (
        <button
          onClick={onLogoutClick}
          className="h-9 px-3 rounded-lg bg-muted hover:bg-destructive/10 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Logout"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      )}
    </div>
  );
}
