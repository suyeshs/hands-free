/**
 * ContextualFooter Component
 * Action buttons bar replacing bottom navigation
 */

import { cn } from '../../lib/utils';
import { NeoButton } from '../ui-v2/NeoButton';

export interface ContextualAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  variant?: 'primary' | 'default' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
  badge?: number | string;
}

export interface ContextualFooterProps {
  /** Action buttons to display */
  actions: ContextualAction[];
  /** Callback when menu button is clicked */
  onMenuClick: () => void;
  /** Additional className */
  className?: string;
}

export function ContextualFooter({
  actions,
  onMenuClick,
  className,
}: ContextualFooterProps) {
  return (
    <footer className={cn('contextual-footer', className)}>
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Menu/Navigation Button */}
        <button
          onClick={onMenuClick}
          className="w-12 h-12 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center text-lg transition-colors"
          aria-label="Open navigation menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Action Buttons */}
        <div className="flex-1 flex items-center gap-2">
          {actions.map((action) => (
            <NeoButton
              key={action.id}
              variant={action.variant === 'primary' ? 'primary' : action.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={action.onClick}
              disabled={action.disabled}
              loading={action.loading}
              className={cn(
                'contextual-action-btn relative',
                action.variant === 'primary' && 'flex-[2]'
              )}
            >
              <span className="mr-1.5">{action.icon}</span>
              <span>{action.label}</span>
              {action.badge !== undefined && action.badge !== 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                  {action.badge}
                </span>
              )}
            </NeoButton>
          ))}
        </div>
      </div>
    </footer>
  );
}
