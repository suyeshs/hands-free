/**
 * Settings Footer Component
 * Fixed footer bar with save/preview buttons and status indicators
 * Shared across all settings plugins
 */

import { CheckCircle2, Eye, EyeOff, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SettingsFooterProps {
  isSaving: boolean;
  saveSuccess: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  showBillPreview: boolean;
  onTogglePreview: () => void;
  className?: string;
}

export function SettingsFooter({
  isSaving,
  saveSuccess,
  hasUnsavedChanges,
  onSave,
  showBillPreview,
  onTogglePreview,
  className,
}: SettingsFooterProps) {
  return (
    <footer
      className={cn(
        'fixed bottom-0 left-0 right-0',
        'bg-card border-t-2 border-border shadow-lg z-40',
        'px-4 sm:px-6 py-3 sm:py-4',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Left: Status indicators */}
        <div className="flex items-center gap-3 order-2 sm:order-1">
          {saveSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success text-sm font-medium border border-success/30 rounded">
              <CheckCircle2 size={16} />
              Saved successfully
            </div>
          )}

          {hasUnsavedChanges && !saveSuccess && (
            <div className="px-3 py-1.5 bg-warning/10 text-warning text-sm font-medium border border-warning/30 rounded">
              Unsaved changes
            </div>
          )}
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2 sm:gap-3 order-1 sm:order-2 w-full sm:w-auto">
          {/* Preview toggle */}
          <button
            onClick={onTogglePreview}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              'flex items-center gap-2 rounded',
              'flex-1 sm:flex-none',
              showBillPreview
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'bg-surface-2 text-foreground hover:bg-surface-3 border border-border'
            )}
          >
            {showBillPreview ? <EyeOff size={16} /> : <Eye size={16} />}
            {showBillPreview ? 'Hide Preview' : 'Preview Bill'}
          </button>

          {/* Save button */}
          <button
            onClick={onSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={cn(
              'px-6 py-2 text-sm font-medium',
              'bg-accent text-white',
              'hover:bg-accent/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center gap-2 rounded shadow-md',
              'flex-1 sm:flex-none'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}
