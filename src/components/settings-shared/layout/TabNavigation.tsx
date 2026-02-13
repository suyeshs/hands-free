/**
 * Tab Navigation Component
 * Sticky horizontal tabs with theme integration
 * Used by settings plugins to display their tab structure
 */

import { cn } from '@/lib/utils';

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  priority?: 'essential' | 'advanced';
  badge?: number;
}

export interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  className,
}: TabNavigationProps) {
  return (
    <div className={cn('sticky top-0 z-30 bg-card border-b border-border flex-shrink-0', className)}>
      <div className="flex items-center gap-2 px-6 py-2 overflow-x-auto scrollbar-visible">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'px-6 py-4 text-base font-medium',
                'flex items-center gap-3',
                'border-b-4 border-transparent',
                'hover:bg-surface-2 transition-all',
                'whitespace-nowrap relative',
                isActive && 'border-b-4 border-accent bg-surface-2/50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon */}
              <span className="text-2xl" aria-hidden="true">
                {tab.icon}
              </span>

              {/* Label */}
              <span className={cn(isActive && 'text-accent')}>{tab.label}</span>

              {/* Badge (if provided) */}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
