/**
 * BottomNav Component
 * iOS-style bottom navigation bar with pill buttons
 */

import { cn } from '../../lib/utils';

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path: string;
}

export interface BottomNavProps {
  /** Navigation items */
  items: NavItem[];
  /** Currently active item ID */
  activeId: string;
  /** Callback when nav item is clicked */
  onNavigate: (id: string, path: string) => void;
  /** Additional className */
  className?: string;
}

export function BottomNav({
  items,
  activeId,
  onNavigate,
  className,
}: BottomNavProps) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-background/80 backdrop-blur-lg',
        'border-t border-border',
        'bottom-nav-safe',
        className
      )}
    >
      <div className="flex items-center justify-around px-4 py-3 max-w-7xl mx-auto">
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id, item.path)}
              className={cn(
                'pill-nav flex items-center gap-2 min-w-[100px] justify-center',
                isActive && 'pill-nav-active'
              )}
            >
              {item.icon && <span className="text-lg">{item.icon}</span>}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
