/**
 * NavigationDrawer Component
 * Slide-up drawer for screen navigation
 */

import { useEffect } from 'react';
import { cn } from '../../lib/utils';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export interface NavigationDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback to close the drawer */
  onClose: () => void;
  /** Navigation items */
  navItems: NavItem[];
  /** Currently active nav item ID */
  activeId: string;
  /** Callback when a nav item is selected */
  onNavigate: (id: string, path: string) => void;
}

export function NavigationDrawer({
  isOpen,
  onClose,
  navItems,
  activeId,
  onNavigate,
}: NavigationDrawerProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavClick = (item: NavItem) => {
    onNavigate(item.id, item.path);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl shadow-xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Navigate To</h2>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors',
                item.id === activeId
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {item.id === activeId && (
                <span className="ml-auto text-sm opacity-70">Current</span>
              )}
            </button>
          ))}
        </nav>

        {/* Close button */}
        <div className="p-4 pt-2 pb-safe">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-muted hover:bg-muted/80 font-medium text-muted-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
